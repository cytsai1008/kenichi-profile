/**
 * Shared types and helpers for the gallery-explicit remote asset system.
 *
 * This file is imported by both the Astro site build (galleryAssetManifest.ts)
 * and the sync script (scripts/gallery-explicit-sync.mjs). Keep it free of
 * Node-only or Astro-only dependencies so it can run in both environments.
 */

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

/** One entry in the remote manifest returned by GET /_manifest/gallery-explicit.json */
export interface RemoteManifestEntry {
  /** Stable namespaced logical path, e.g. "gallery-explicit/Baka_inuta.jpg" */
  relativePath: string;
  /** SHA-256 hex of the stored original file */
  sourceHash: string;
  /** Hashed viewer filename, e.g. "Baka_inuta.abcd1234.jpg" */
  viewerFile: string;
  /** Hashed thumb filename, e.g. "Baka_inuta.abcd1234.jpg" */
  thumbFile: string;
  /** ISO date string of when the entry was last updated */
  updatedAt: string;
}

/** Shape of GET /_manifest/gallery-explicit.json */
export interface RemoteManifest {
  version: number;
  entries: RemoteManifestEntry[];
}

// ---------------------------------------------------------------------------
// Build manifest types (written to node_modules/.astro/ by sync script)
// ---------------------------------------------------------------------------

/** One entry in the generated build manifest used by GalleryPage.astro */
export interface BuildManifestEntry {
  /** Stable namespaced logical path, mirrors RemoteManifestEntry.relativePath */
  relativePath: string;
  /** Full public URL for the viewer-size image */
  viewerUrl: string;
  /** Full public URL for the thumbnail image */
  thumbUrl: string;
  /** Pixel width of the viewer image (set during sync) */
  width: number;
  /** Pixel height of the viewer image (set during sync) */
  height: number;
}

/** Shape of node_modules/.astro/gallery-explicit-build-manifest.json */
export interface BuildManifest {
  version: number;
  /** ISO date string written by the sync script */
  builtAt: string;
  entries: BuildManifestEntry[];
}

// ---------------------------------------------------------------------------
// Local cache types (node_modules/.astro/gallery-explicit-cache.json)
// ---------------------------------------------------------------------------

export interface CacheEntry {
  relativePath: string;
  sourceHash: string;
  /** Bumped manually when resize/quality rules change */
  transformVersion: string;
  viewerHash: string;
  thumbHash: string;
  viewerFile: string;
  thumbFile: string;
  /** Absolute path to the downloaded original in node_modules/.astro/gallery-explicit-src/ */
  localSrcPath: string;
  /** Absolute path to the generated viewer file in node_modules/.astro/gallery-explicit-out/ */
  localViewerPath: string;
  /** Absolute path to the generated thumb file in node_modules/.astro/gallery-explicit-out/ */
  localThumbPath: string;
  /** True once the derived files have been confirmed uploaded to remote */
  uploaded: boolean;
  width: number;
  height: number;
}

export interface LocalCache {
  version: number;
  entries: Record<string, CacheEntry>;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const PUBLIC_HOST =
  (typeof process !== "undefined" && process.env.GALLERY_PUBLIC_HOST) ||
  "https://kenichi.photocat.blue/alt-media";

/** Percent-encode each slash-delimited segment of a path. */
function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Build the public viewer URL for an entry.
 * e.g. relativePath "gallery-explicit/Baka_inuta.jpg", viewerFile "Baka_inuta.abcd1234.jpg"
 *   → "https://kenichi.photocat.blue/alt-media/_viewer/gallery-explicit/Baka_inuta.abcd1234.jpg"
 * Segments are percent-encoded so filenames containing `#`, `?`, etc. are safe in <img src>.
 */
export function viewerUrl(relativePath: string, viewerFile: string): string {
  const dir = dirPart(relativePath);
  const joined = dir ? `${dir}/${viewerFile}` : viewerFile;
  return `${PUBLIC_HOST}/_viewer/${encodePathSegments(joined)}`;
}

/**
 * Build the public thumb URL for an entry.
 */
export function thumbUrl(relativePath: string, thumbFile: string): string {
  const dir = dirPart(relativePath);
  const joined = dir ? `${dir}/${thumbFile}` : thumbFile;
  return `${PUBLIC_HOST}/_thumbs/${encodePathSegments(joined)}`;
}

/** Return the directory portion of a logical relative path, or empty string. */
export function dirPart(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? "" : relativePath.slice(0, idx);
}

/** Return the filename portion of a logical relative path. */
export function filePart(relativePath: string): string {
  const idx = relativePath.lastIndexOf("/");
  return idx === -1 ? relativePath : relativePath.slice(idx + 1);
}

/**
 * Build a deterministic hashed output filename from a base filename and a hex hash.
 * e.g. ("Baka_inuta.jpg", "abcd1234ef56") → "Baka_inuta.abcd1234.jpg"
 */
export function hashedFilename(baseName: string, hashHex: string): string {
  const dotIdx = baseName.lastIndexOf(".");
  const shortHash = hashHex.slice(0, 8);
  if (dotIdx === -1) {
    return `${baseName}.${shortHash}`;
  }
  const name = baseName.slice(0, dotIdx);
  const ext = baseName.slice(dotIdx);
  return `${name}.${shortHash}${ext}`;
}

/**
 * Validate that a logical relative path is safe (no traversal, no absolute paths).
 * Returns true if the path is acceptable for use as a remote storage key.
 */
export function isSafeRelativePath(relativePath: string): boolean {
  if (!relativePath) return false;
  if (relativePath.startsWith("/")) return false;
  if (relativePath.includes("..")) return false;
  if (/[\\:]/.test(relativePath)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Signed-request header names (shared constants)
// ---------------------------------------------------------------------------

export const SIGN_HEADER_KEY_ID = "x-key-id";
export const SIGN_HEADER_TIMESTAMP = "x-timestamp";
export const SIGN_HEADER_NONCE = "x-nonce";
export const SIGN_HEADER_CONTENT_SHA256 = "x-content-sha256";
export const SIGN_HEADER_SIGNATURE = "x-signature";

/** Max clock skew in seconds accepted by the server */
export const SIGN_MAX_SKEW_SECONDS = 120;

/**
 * Build the canonical signing payload string from request parts.
 * Both client and server must use the same function to produce the same string.
 */
export function signingPayload(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyHashHex: string
): string {
  return [method.toUpperCase(), path, timestamp, nonce, bodyHashHex].join("\n");
}
