/**
 * proxy-worker/src/index.js
 *
 * Cloudflare Worker that proxies public gallery asset requests from
 * kenichi.photocat.blue/alt-media/... to kenichi-explicit.photocat.blue/...
 *
 * Route: kenichi.photocat.blue/alt-media/*
 *
 * Behavior:
 *   - Matches GET and HEAD requests under the configured public prefix (/alt-media).
 *   - Strips the prefix and proxies to the upstream asset host.
 *   - Sets immutable cache headers on image responses.
 *   - Passes no cookies, auth headers, or query params upstream.
 *   - Returns 404 for any non-matching path.
 */

/** Public proxy prefix — must not conflict with existing page routes */
const PUBLIC_PREFIX = "/alt-media";

/** Fallback upstream asset origin when UPSTREAM_OVERRIDE is not set */
const DEFAULT_UPSTREAM_ORIGIN = "https://kenichi-explicit.photocat.blue";

/** Cache TTL for immutable hashed asset responses (1 year) */
const IMMUTABLE_MAX_AGE = 31_536_000;

/** Known bad path patterns — scanner probes and LFI attempts */
const BAD_PATH = [
  /\x00/, // null byte injection
  /\/\.git\b/, // git repository probe
  /\/\.env\b/, // environment file probe
  /\/etc\/passwd/, // LFI classic
  /\/proc\//, // Linux proc filesystem
];

export default {
  /**
   * @param {Request} request
   * @param {object} _env
   * @param {ExecutionContext} _ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, _ctx) {
    // Allow local dev to override the upstream (e.g. wrangler dev --var UPSTREAM_OVERRIDE:http://localhost:8080)
    const UPSTREAM_ORIGIN = env.UPSTREAM_OVERRIDE || DEFAULT_UPSTREAM_ORIGIN;

    const url = new URL(request.url);

    // Only proxy GET and HEAD
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Match prefix
    if (!url.pathname.startsWith(PUBLIC_PREFIX + "/") && url.pathname !== PUBLIC_PREFIX) {
      return new Response("Not Found", { status: 404 });
    }

    // Strip prefix to get upstream path — query params are dropped intentionally.
    // Hashed asset filenames are the only cache key; forwarding arbitrary params
    // would create distinct cache entries for the same bytes and enable cache poisoning.
    const upstreamPath = url.pathname.slice(PUBLIC_PREFIX.length) || "/";

    // Reject path traversal attempts. `url.pathname` is already percent-decoded and
    // normalized by the URL parser, so a literal `..` segment here is a real traversal.
    if (upstreamPath.split("/").some((seg) => seg === ".." || seg === ".")) {
      return new Response("Bad Request", { status: 400 });
    }

    // Block known bad path patterns: scanner probes and LFI attempts.
    if (BAD_PATH.some((re) => re.test(upstreamPath))) {
      return new Response("Not Found", { status: 404 });
    }
    const upstreamUrl = `${UPSTREAM_ORIGIN}${upstreamPath}`;

    // Build clean upstream request — strip cookies and auth
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: buildUpstreamHeaders(request.headers),
    });

    let response;
    try {
      response = await fetch(upstreamRequest);
    } catch (err) {
      return new Response("Bad Gateway", { status: 502 });
    }

    if (!response.ok && response.status !== 304) {
      return new Response(response.statusText || "Upstream error", {
        status: response.status,
      });
    }

    // Build response with appropriate cache headers
    const responseHeaders = new Headers(response.headers);
    setCacheHeaders(responseHeaders, upstreamPath, response.status);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};

/**
 * Build headers for the upstream request.
 * Passes through Accept, Accept-Encoding, If-None-Match, If-Modified-Since.
 * Strips Cookie, Authorization, and CF-Access headers.
 */
function buildUpstreamHeaders(incoming) {
  const allowed = ["accept", "accept-encoding", "if-none-match", "if-modified-since", "range"];
  const headers = new Headers();
  for (const name of allowed) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

/**
 * Set cache headers on the proxied response.
 * Hashed files (contain a dot-hash segment like .abcd1234.) get immutable headers.
 * Non-hashed paths get a short TTL to allow re-validation.
 */
function setCacheHeaders(headers, upstreamPath, status) {
  if (status === 304) return;

  const isHashed = /\.[0-9a-f]{8}\.[a-z]+$/.test(upstreamPath);

  if (isHashed) {
    headers.set("Cache-Control", `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`);
  } else {
    // Non-hashed paths (e.g. manifest probes) — short TTL
    headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  }

  // Ensure CORS is permissive for image loads
  if (!headers.has("Access-Control-Allow-Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
  }
}
