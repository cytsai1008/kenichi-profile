#!/usr/bin/env node
/**
 * gallery-explicit-sync.mjs
 *
 * Prebuild sync script for the gallery-explicit remote asset system.
 *
 * What it does:
 *   1. Fetches the remote manifest from the private sync host.
 *   2. Compares each entry against the local cache.
 *   3. Downloads changed originals from the private host.
 *   4. Generates viewer and thumb derivatives with sharp.
 *   5. Uploads changed derivatives to the private host.
 *   6. Updates the remote manifest entry after successful upload.
 *   7. Deletes old unreferenced derivative files.
 *   8. Writes node_modules/.astro/gallery-explicit-build-manifest.json
 *      for GalleryPage.astro to consume.
 *
 * Required env vars:
 *   GALLERY_CF_CLIENT_ID       Cloudflare Access service token client ID
 *   GALLERY_CF_CLIENT_SECRET   Cloudflare Access service token client secret
 *   GALLERY_SIGNING_KEY        Ed25519 private key (base64-encoded raw 64-byte seed+pub)
 *
 * Optional env vars:
 *   GALLERY_SYNC_HOST          Private sync host (default: https://sync.kenichi-explicit.photocat.blue)
 *   GALLERY_TRANSFORM_VERSION  Bump this to force regeneration of all derivatives (default: "1")
 *   GALLERY_VIEWER_WIDTH       Viewer image max width (default: 2048)
 *   GALLERY_VIEWER_QUALITY     Viewer WebP quality (default: 92)
 *   GALLERY_THUMB_WIDTH        Thumb image max width (default: 640)
 *   GALLERY_THUMB_QUALITY      Thumb WebP quality (default: 85)
 */

import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Ed25519 signing via Node's built-in WebCrypto
const { subtle } = globalThis.crypto;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SYNC_HOST = process.env.GALLERY_SYNC_HOST ?? "https://sync.kenichi-explicit.photocat.blue";
const TRANSFORM_VERSION = process.env.GALLERY_TRANSFORM_VERSION ?? "1";
const VIEWER_WIDTH = parseInt(process.env.GALLERY_VIEWER_WIDTH ?? "2048", 10);
const VIEWER_QUALITY = parseInt(process.env.GALLERY_VIEWER_QUALITY ?? "92", 10);
const THUMB_WIDTH = parseInt(process.env.GALLERY_THUMB_WIDTH ?? "640", 10);
const THUMB_QUALITY = parseInt(process.env.GALLERY_THUMB_QUALITY ?? "85", 10);

const CF_CLIENT_ID = process.env.GALLERY_CF_CLIENT_ID ?? "";
const CF_CLIENT_SECRET = process.env.GALLERY_CF_CLIENT_SECRET ?? "";
const SIGNING_KEY_B64 = process.env.GALLERY_SIGNING_KEY ?? "";
const DEV_SKIP_AUTH =
  process.env.GALLERY_DEV_SKIP_AUTH === "true" || process.env.GALLERY_DEV_SKIP_AUTH === "1";

const ROOT = process.cwd();
const ASTRO_CACHE_DIR = path.join(ROOT, "node_modules", ".astro");
const CACHE_FILE = path.join(ASTRO_CACHE_DIR, "gallery-explicit-cache.json");
const BUILD_MANIFEST_FILE = path.join(ASTRO_CACHE_DIR, "gallery-explicit-build-manifest.json");
const SRC_DIR = path.join(ASTRO_CACHE_DIR, "gallery-explicit-src");
const OUT_DIR = path.join(ASTRO_CACHE_DIR, "gallery-explicit-out");

const PUBLIC_HOST = process.env.GALLERY_PUBLIC_HOST ?? "https://kenichi.photocat.blue/alt-media";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(ASTRO_CACHE_DIR, { recursive: true });
  await mkdir(SRC_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const dryRun = process.argv.includes("--dry-run");
  const forceAll = process.argv.includes("--force");
  if (dryRun) console.log("[sync] dry-run mode — no uploads or remote manifest writes");

  // When sync credentials are absent, skip entirely and leave any existing build manifest
  // in place. This makes `npm run build` (via prebuild) work on fresh checkouts, contributor
  // machines, and preview environments without the private sync secrets.
  if (!DEV_SKIP_AUTH && (!CF_CLIENT_ID || !CF_CLIENT_SECRET)) {
    console.log(
      "[sync] GALLERY_CF_CLIENT_ID / GALLERY_CF_CLIENT_SECRET not set — " +
        "skipping remote sync. Existing build manifest (if any) will be used."
    );
    return;
  }

  let signingKey = null;
  if (SIGNING_KEY_B64) {
    signingKey = await importSigningKey(SIGNING_KEY_B64);
  }

  // 1. Fetch remote manifest (always, even in dry-run, so the preview shows real changes)
  console.log("[sync] fetching remote manifest…");
  const remoteManifest = await fetchJson(
    `${SYNC_HOST}/_manifest/gallery-explicit.json`,
    signingKey
  );

  // 2. Load local cache
  const cache = await loadCache();

  // 3. Process each remote entry
  const sharp = (await import("sharp")).default;

  const buildEntries = [];
  const deletions = []; // { type: "viewer"|"thumbs", storedPath: string }

  for (const entry of remoteManifest.entries) {
    const { relativePath, sourceHash, viewerFile, thumbFile } = entry;

    // Validate the remote path before using it for any local filesystem operations.
    // A malformed manifest entry containing ".." or an absolute path could otherwise
    // escape the cache directory during path.join writes.
    if (!isSafeRelativePath(relativePath)) {
      console.warn(`[sync] skipping unsafe relativePath from remote manifest: ${relativePath}`);
      continue;
    }
    // Containment check: ensure path.join doesn't escape SRC_DIR
    const localSrcPathCheck = path.resolve(SRC_DIR, relativePath);
    if (!localSrcPathCheck.startsWith(SRC_DIR + path.sep) && localSrcPathCheck !== SRC_DIR) {
      console.warn(`[sync] skipping path that escapes cache dir: ${relativePath}`);
      continue;
    }

    const cached = cache.entries[relativePath];

    const sourceChanged = !cached || cached.sourceHash !== sourceHash;
    const transformChanged = !cached || cached.transformVersion !== TRANSFORM_VERSION;
    const needsRegen = forceAll || sourceChanged || transformChanged;

    if (!needsRegen && cached.uploaded) {
      // Nothing changed — use cached metadata
      buildEntries.push(buildEntry(cached));
      continue;
    }

    console.log(
      `[sync] processing ${relativePath} (sourceChanged=${sourceChanged}, transformChanged=${transformChanged})`
    );

    // 4. Download original if needed
    const localSrcPath = path.join(SRC_DIR, relativePath);
    await mkdir(path.dirname(localSrcPath), { recursive: true });

    let needsDownload = sourceChanged || !(await fileExists(localSrcPath));
    if (needsDownload) {
      if (dryRun) {
        console.log(`[sync] [dry-run] would download original: ${relativePath}`);
      } else {
        console.log(`[sync] downloading original: ${relativePath}`);
        const encodedRelPath = relativePath.split("/").map(encodeURIComponent).join("/");
        await downloadFile(
          `${SYNC_HOST}/_files/originals/${encodedRelPath}`,
          localSrcPath,
          signingKey
        );
      }
    }

    if (dryRun) {
      console.log(`[sync] [dry-run] would generate viewer+thumb for: ${relativePath}`);
      continue;
    }

    // 5. Generate viewer and thumb
    // Derivatives are encoded as WebP for better compression and broad browser support.
    const srcBaseName = path.basename(relativePath);
    const webpBaseName = srcBaseName.replace(/\.[^.]+$/, "") + ".webp";
    const localViewerPath = path.join(OUT_DIR, "viewer", path.dirname(relativePath), webpBaseName);
    const localThumbPath = path.join(OUT_DIR, "thumbs", path.dirname(relativePath), webpBaseName);
    await mkdir(path.dirname(localViewerPath), { recursive: true });
    await mkdir(path.dirname(localThumbPath), { recursive: true });

    const src = sharp(localSrcPath);
    const meta = await src.metadata();

    await src
      .clone()
      .resize({ width: VIEWER_WIDTH, withoutEnlargement: true })
      .webp({ quality: VIEWER_QUALITY })
      .toFile(localViewerPath);

    await src
      .clone()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(localThumbPath);

    // 6. Compute hashes of generated files
    const newViewerHash = await sha256File(localViewerPath);
    const newThumbHash = await sha256File(localThumbPath);
    const newViewerFile = hashedFilename(webpBaseName, newViewerHash);
    const newThumbFile = hashedFilename(webpBaseName, newThumbHash);

    // 7. Check if upload is needed
    const viewerUnchanged = cached && cached.viewerHash === newViewerHash;
    const thumbUnchanged = cached && cached.thumbHash === newThumbHash;

    if (!viewerUnchanged) {
      console.log(`[sync] uploading viewer: ${newViewerFile}`);
      const dirPart = dirPartOf(relativePath);
      const remoteViewerPath = dirPart ? `${dirPart}/${newViewerFile}` : newViewerFile;
      await uploadFile(
        `${SYNC_HOST}/_upload/viewer/${encodeSegments(remoteViewerPath)}`,
        localViewerPath,
        newViewerHash,
        signingKey
      );
    }

    if (!thumbUnchanged) {
      console.log(`[sync] uploading thumb: ${newThumbFile}`);
      const dirPart = dirPartOf(relativePath);
      const remoteThumbPath = dirPart ? `${dirPart}/${newThumbFile}` : newThumbFile;
      await uploadFile(
        `${SYNC_HOST}/_upload/thumbs/${encodeSegments(remoteThumbPath)}`,
        localThumbPath,
        newThumbHash,
        signingKey
      );
    }

    // 8. Update remote manifest entry
    const newEntry = {
      relativePath,
      sourceHash,
      viewerFile: newViewerFile,
      thumbFile: newThumbFile,
    };
    await updateManifestEntry(newEntry, signingKey);

    // 9. Queue deletion of old derivative files (after manifest update).
    // Use the remote manifest entry as the authoritative source for the old filenames when
    // the local cache is absent or stale (e.g. first run after a cache wipe or transform
    // version bump), so old derivatives are not orphaned on the asset host.
    const oldViewerFile = cached?.viewerFile ?? entry.viewerFile;
    const oldThumbFile = cached?.thumbFile ?? entry.thumbFile;
    if (oldViewerFile && oldViewerFile !== newViewerFile) {
      const dirPart = dirPartOf(relativePath);
      const oldPath = dirPart ? `${dirPart}/${oldViewerFile}` : oldViewerFile;
      deletions.push({ type: "viewer", storedPath: oldPath });
    }
    if (oldThumbFile && oldThumbFile !== newThumbFile) {
      const dirPart = dirPartOf(relativePath);
      const oldPath = dirPart ? `${dirPart}/${oldThumbFile}` : oldThumbFile;
      deletions.push({ type: "thumbs", storedPath: oldPath });
    }

    // Determine output dimensions from the viewer image metadata
    const viewerMeta = await sharp(localViewerPath).metadata();

    // Update local cache
    const newCacheEntry = {
      relativePath,
      sourceHash,
      transformVersion: TRANSFORM_VERSION,
      viewerHash: newViewerHash,
      thumbHash: newThumbHash,
      viewerFile: newViewerFile,
      thumbFile: newThumbFile,
      localSrcPath,
      localViewerPath,
      localThumbPath,
      uploaded: true,
      width: viewerMeta.width ?? meta.width ?? 0,
      height: viewerMeta.height ?? meta.height ?? 0,
    };
    cache.entries[relativePath] = newCacheEntry;
    buildEntries.push(buildEntry(newCacheEntry));
  }

  // 10. Delete old derivative files
  for (const { type, storedPath } of deletions) {
    console.log(`[sync] deleting old ${type}: ${storedPath}`);
    try {
      const encodedStoredPath = storedPath.split("/").map(encodeURIComponent).join("/");
      await signedRequest(
        "DELETE",
        `${SYNC_HOST}/_files/${type}/${encodedStoredPath}`,
        null,
        signingKey
      );
    } catch (err) {
      // Non-fatal — old files becoming orphaned is acceptable
      console.warn(`[sync] warn: failed to delete old ${type} file ${storedPath}:`, err.message);
    }
  }

  if (dryRun) {
    // Do not write the build manifest or cache in dry-run mode.
    // Writing an empty-entries manifest (from the stub remote manifest used in dry-run)
    // would clobber a real manifest and silently drop all gallery items from the next build.
    console.log("[sync] dry-run complete — build manifest and cache left unchanged");
    return;
  }

  // 11. Write build manifest
  const buildManifest = {
    version: 1,
    builtAt: new Date().toISOString(),
    entries: buildEntries,
  };
  await writeFile(BUILD_MANIFEST_FILE, JSON.stringify(buildManifest, null, 2), "utf8");
  console.log(`[sync] wrote build manifest with ${buildEntries.length} entries`);

  // 12. Persist local cache
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  console.log("[sync] done");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSafeRelativePath(p) {
  if (!p) return false;
  if (p.startsWith("/")) return false;
  if (p.includes("..")) return false;
  if (/[\\:]/.test(p)) return false;
  return true;
}

function encodeSegments(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function buildEntry(cached) {
  const dir = dirPartOf(cached.relativePath);
  const viewerPath = dir ? `${dir}/${cached.viewerFile}` : cached.viewerFile;
  const thumbPath = dir ? `${dir}/${cached.thumbFile}` : cached.thumbFile;
  return {
    relativePath: cached.relativePath,
    // Encode each segment so URL-reserved characters in filenames (e.g. `#`, `?`) are not
    // misinterpreted as fragment/query by browsers or PhotoSwipe when used in <img src>.
    viewerUrl: `${PUBLIC_HOST}/_viewer/${encodeSegments(viewerPath)}`,
    thumbUrl: `${PUBLIC_HOST}/_thumbs/${encodeSegments(thumbPath)}`,
    width: cached.width ?? 0,
    height: cached.height ?? 0,
  };
}

function dirPartOf(relativePath) {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? "" : relativePath.slice(0, idx);
}

function hashedFilename(baseName, hashHex) {
  const dotIdx = baseName.lastIndexOf(".");
  const short = hashHex.slice(0, 8);
  if (dotIdx === -1) return `${baseName}.${short}`;
  return `${baseName.slice(0, dotIdx)}.${short}${baseName.slice(dotIdx)}`;
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

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadCache() {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: 1, entries: {} };
  }
}

// ---------------------------------------------------------------------------
// Ed25519 signing
// ---------------------------------------------------------------------------

async function importSigningKey(b64) {
  const raw = Buffer.from(b64, "base64");
  // Node WebCrypto expects the 32-byte private seed for Ed25519 import (PKCS8)
  // We accept the raw 64-byte seed+pub or 32-byte seed.
  const seed = raw.length === 64 ? raw.slice(0, 32) : raw;
  // Wrap as PKCS8 DER for importKey
  const pkcs8 = pkcs8Wrap(seed);
  return subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
}

function pkcs8Wrap(seed) {
  // PKCS8 DER wrapper for Ed25519 private key (32-byte seed)
  // OID 1.3.101.112 = id-Ed25519
  // Structure: SEQUENCE { INTEGER 0, SEQUENCE { OID }, OCTET STRING { OCTET STRING { seed } } }
  const oidBytes = Buffer.from("06032b6570", "hex"); // OID id-Ed25519
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
  const seq = Buffer.concat([
    Buffer.from("020100", "hex"), // INTEGER 0 = 02 01 00
    algorithmSeq,
    outerOctet,
  ]);
  // Return the Buffer directly — Node's WebCrypto importKey accepts BufferSource (Buffer/TypedArray).
  // Do NOT use .buffer.slice(0): Buffer.concat uses allocUnsafe which may share a pool ArrayBuffer,
  // so .buffer would reference the entire pool and .slice(0) would copy far more bytes than the DER.
  return Buffer.concat([Buffer.from("30", "hex"), encodeLength(seq.length), seq]);
}

function encodeLength(len) {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

async function buildSignedHeaders(method, urlPath, bodyBuf, signingKey) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const bodyHash = bodyBuf ? await sha256Buffer(bodyBuf) : await sha256Buffer(Buffer.alloc(0));

  const payload = [method.toUpperCase(), urlPath, timestamp, nonce, bodyHash].join("\n");
  const payloadBuf = Buffer.from(payload, "utf8");

  const sigBuf = signingKey
    ? await subtle.sign("Ed25519", signingKey, payloadBuf)
    : Buffer.alloc(64);

  const sig = Buffer.from(sigBuf).toString("base64");

  return {
    "CF-Access-Client-Id": CF_CLIENT_ID,
    "CF-Access-Client-Secret": CF_CLIENT_SECRET,
    "x-key-id": "default", // TODO: remove — unused by server
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-content-sha256": bodyHash,
    "x-signature": sig,
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function mimeFromUrl(url) {
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  return (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      json: "application/json",
    }[ext] ?? "image/jpeg"
  );
}

async function signedRequest(method, url, bodyBuf, signingKey) {
  const urlObj = new URL(url);
  const headers = await buildSignedHeaders(method, urlObj.pathname, bodyBuf, signingKey);

  const init = { method, headers };
  if (bodyBuf) {
    init.body = bodyBuf;
    headers["Content-Type"] = mimeFromUrl(url);
    headers["Content-Length"] = String(bodyBuf.length);
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${method} ${url}: ${text}`);
  }
  return res;
}

async function fetchJson(url, signingKey) {
  const res = await signedRequest("GET", url, null, signingKey);
  return res.json();
}

async function downloadFile(url, destPath, signingKey) {
  const res = await signedRequest("GET", url, null, signingKey);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

async function uploadFile(url, srcPath, expectedHash, signingKey) {
  const buf = await readFile(srcPath);
  const res = await signedRequest("PUT", url, buf, signingKey);
  const json = await res.json().catch(() => ({}));
  if (json.hash && json.hash !== expectedHash) {
    throw new Error(`Upload hash mismatch for ${url}: expected ${expectedHash}, got ${json.hash}`);
  }
}

async function updateManifestEntry(entry, signingKey) {
  const body = Buffer.from(JSON.stringify(entry), "utf8");
  await signedRequest("PUT", `${SYNC_HOST}/_manifest/gallery-explicit.json`, body, signingKey);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error("[sync] fatal:", err);
  process.exitCode = 1;
});
