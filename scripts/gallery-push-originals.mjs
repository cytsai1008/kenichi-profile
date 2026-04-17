#!/usr/bin/env node
/**
 * gallery-push-originals.mjs
 *
 * CLI tool to upload original image files to the private sync host before a build.
 *
 * Usage:
 *   npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg
 *   npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg --prefix gallery-explicit
 *   npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg --remote-path gallery-explicit/subfolder/Baka_inuta.jpg
 *   npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg --overwrite
 *
 * Required env vars (same as gallery-explicit-sync.mjs):
 *   GALLERY_CF_CLIENT_ID
 *   GALLERY_CF_CLIENT_SECRET
 *   GALLERY_SIGNING_KEY
 *
 * Optional env vars:
 *   GALLERY_SYNC_HOST   (default: https://sync.kenichi-explicit.photocat.blue)
 *   GALLERY_NAMESPACE   (default: gallery-explicit)
 */

import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

const { subtle } = globalThis.crypto;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SYNC_HOST = process.env.GALLERY_SYNC_HOST ?? "https://sync.kenichi-explicit.photocat.blue";
const DEFAULT_NAMESPACE = process.env.GALLERY_NAMESPACE ?? "gallery-explicit";

const CF_CLIENT_ID = process.env.GALLERY_CF_CLIENT_ID ?? "";
const CF_CLIENT_SECRET = process.env.GALLERY_CF_CLIENT_SECRET ?? "";
const SIGNING_KEY_B64 = process.env.GALLERY_SIGNING_KEY ?? "";
const DEV_SKIP_AUTH = process.env.GALLERY_DEV_SKIP_AUTH === "true" || process.env.GALLERY_DEV_SKIP_AUTH === "1";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    prefix: { type: "string" },
    "remote-path": { type: "string" },
    overwrite: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: true,
});



if (values.help || positionals.length === 0) {
  printHelp();
  process.exit(positionals.length === 0 && !values.help ? 1 : 0);
}

// --remote-path overrides the logical path for a single file only.
// With multiple input files it would assign the same remote path to all of them,
// causing subsequent uploads to replace the first or corrupt the manifest entry.
if (values["remote-path"] && positionals.length > 1) {
  console.error(
    "[push-originals] --remote-path can only be used with a single input file, " +
      `but ${positionals.length} files were provided`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = values["dry-run"];
  if (dryRun) console.log("[push-originals] dry-run mode — no uploads");

  if (!dryRun && !DEV_SKIP_AUTH && (!CF_CLIENT_ID || !CF_CLIENT_SECRET)) {
    throw new Error("Missing GALLERY_CF_CLIENT_ID / GALLERY_CF_CLIENT_SECRET.");
  }

  let signingKey = null;
  if (!dryRun && SIGNING_KEY_B64) {
    signingKey = await importSigningKey(SIGNING_KEY_B64);
  }

  for (const inputPath of positionals) {
    const resolved = path.resolve(ROOT, inputPath);

    // Check file exists
    try {
      await stat(resolved);
    } catch {
      console.error(`[push-originals] file not found: ${resolved}`);
      process.exitCode = 1;
      continue;
    }

    // Derive remote path
    let remotePath;
    if (values["remote-path"]) {
      remotePath = values["remote-path"];
    } else {
      const namespace = values.prefix ?? DEFAULT_NAMESPACE;
      const baseName = path.basename(resolved);
      remotePath = namespace ? `${namespace}/${baseName}` : baseName;
    }

    // Validate
    if (!isSafeRelativePath(remotePath)) {
      console.error(
        `[push-originals] unsafe remote path "${remotePath}" — use only forward slashes, no "..", no leading "/"`
      );
      process.exitCode = 1;
      continue;
    }

    console.log(`[push-originals] ${path.relative(ROOT, resolved)} → ${remotePath}`);

    // Compute local hash
    const localHash = await sha256File(resolved);
    console.log(`[push-originals] sha256: ${localHash}`);

    if (dryRun) {
      console.log(`[push-originals] [dry-run] would PUT /_upload/originals/${remotePath}`);
      continue;
    }

    // Upload
    const buf = await readFile(resolved);
    // Encode each path segment so that URL-reserved characters like `#` or `?` in filenames
    // are not misinterpreted as fragment/query by the fetch API.
    const encodedRemotePath = remotePath.split("/").map(encodeURIComponent).join("/");
    const uploadUrl = `${SYNC_HOST}/_upload/originals/${encodedRemotePath}`;
    const doOverwrite =
      values.overwrite ||
      process.env.GALLERY_OVERWRITE === "true" ||
      process.env.GALLERY_OVERWRITE === "1";
    const uploadUrlWithForce = doOverwrite ? `${uploadUrl}?force=true` : uploadUrl;

    console.log("[debug] upload URL:", uploadUrlWithForce);
    let json;
    try {
      const res = await signedRequest("PUT", uploadUrlWithForce, buf, signingKey);
      if (res.status === 409) {
        console.warn(`[push-originals] skipped: ${remotePath} already exists — set GALLERY_OVERWRITE=1 to replace`);
        continue;
      }
      json = await res.json().catch(() => ({}));
    } catch (err) {
      console.error(`[push-originals] upload failed for ${remotePath}:`, err.message);
      process.exitCode = 1;
      continue;
    }

    // Verify server hash
    if (json.hash && json.hash !== localHash) {
      console.error(
        `[push-originals] hash mismatch for ${remotePath}: local=${localHash} server=${json.hash}`
      );
      process.exitCode = 1;
      continue;
    }

    console.log(
      `[push-originals] uploaded: ${remotePath} (${json.size ?? buf.length} bytes, hash verified)`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers (duplicated from sync script — keep in sync)
// ---------------------------------------------------------------------------

function isSafeRelativePath(p) {
  if (!p) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  if (/[\\:]/.test(p)) return false;
  return true;
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function sha256Buffer(buf) {
  const hash = createHash("sha256");
  hash.update(buf);
  return hash.digest("hex");
}

async function importSigningKey(b64) {
  const raw = Buffer.from(b64, "base64");
  const seed = raw.length === 64 ? raw.slice(0, 32) : raw;
  const pkcs8 = pkcs8Wrap(seed);
  return subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
}

function pkcs8Wrap(seed) {
  const oidBytes = Buffer.from("06032b6570", "hex");
  const innerOctet = Buffer.concat([Buffer.from("0420", "hex"), seed]);
  const outerOctet = Buffer.concat([
    Buffer.from("04", "hex"),
    encodeLength(innerOctet.length),
    innerOctet,
  ]);
  const algorithmSeq = Buffer.concat([
    Buffer.from("30", "hex"),
    encodeLength(oidBytes.length),
    oidBytes,
  ]);
  const seq = Buffer.concat([Buffer.from("020100", "hex"), algorithmSeq, outerOctet]);
  // Return Buffer directly — see gallery-explicit-sync.mjs pkcs8Wrap for the reason .buffer.slice(0) is wrong.
  return Buffer.concat([Buffer.from("30", "hex"), encodeLength(seq.length), seq]);
}

function encodeLength(len) {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

async function buildSignedHeaders(method, urlPath, bodyBuf, signingKey, extra = {}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const bodyHash = await sha256Buffer(bodyBuf ?? Buffer.alloc(0));
  const payload = [method.toUpperCase(), urlPath, timestamp, nonce, bodyHash].join("\n");
  const payloadBuf = Buffer.from(payload, "utf8");
  const sigBuf = signingKey
    ? await subtle.sign("Ed25519", signingKey, payloadBuf)
    : Buffer.alloc(64);
  const sig = Buffer.from(sigBuf).toString("base64");

  return {
    "CF-Access-Client-Id": CF_CLIENT_ID,
    "CF-Access-Client-Secret": CF_CLIENT_SECRET,
    "x-key-id": "default",
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-content-sha256": bodyHash,
    "x-signature": sig,
    ...extra,
  };
}

function mimeFromUrl(url) {
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" }[ext] ?? "image/jpeg";
}

async function signedRequest(method, url, bodyBuf, signingKey, extraHeaders = {}) {
  const urlObj = new URL(url);
  const headers = await buildSignedHeaders(
    method,
    urlObj.pathname,
    bodyBuf,
    signingKey,
    extraHeaders
  );
  const init = { method, headers };
  if (bodyBuf) {
    init.body = bodyBuf;
    headers["Content-Type"] = mimeFromUrl(url);
    headers["Content-Length"] = String(bodyBuf.length);
  }
  const res = await fetch(url, init);
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} on ${method} ${url}: ${text}`);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Usage: npm run gallery:push-originals -- <file> [<file>...] [options]

Upload original image files to the gallery-explicit sync host.

Options:
  --prefix <namespace>          Logical namespace prefix (default: gallery-explicit)
  --remote-path <path>          Override remote path for a single file upload
  --overwrite                       Allow overwriting an existing original on the server
  --dry-run                     Print what would be uploaded without making requests
  -h, --help                    Show this help

Examples:
  npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg
  npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg --prefix gallery-explicit
  npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg --remote-path gallery-explicit/Baka_inuta.jpg
  npm run gallery:push-originals -- ./incoming/Baka_inuta.jpg --overwrite
`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("[push-originals] fatal:", err);
  process.exitCode = 1;
});
