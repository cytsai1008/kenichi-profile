/**
 * Reads the generated build manifest via a Vite virtual module (resolved in Node
 * context at build/dev time) and exposes lookup helpers for gallery pages.
 *
 * The virtual module is populated by the galleryManifestPlugin in astro.config.mjs,
 * which reads node_modules/.astro/gallery-explicit-build-manifest.json.
 * Run `npm run gallery:sync` to generate that file before starting the dev server.
 */

import manifestData from "virtual:gallery-manifest";
import type { BuildManifest, BuildManifestEntry } from "./galleryAssetShared.js";

const _manifest: BuildManifest = manifestData;

/** Return all entries from the build manifest. */
export function getAllManifestEntries(): BuildManifestEntry[] {
  return _manifest.entries;
}

/**
 * Look up a single entry by logical path.
 * @param relativePath e.g. "gallery-explicit/Baka_inuta.jpg"
 */
export function getManifestEntry(relativePath: string): BuildManifestEntry | undefined {
  return _manifest.entries.find((e) => e.relativePath === relativePath);
}

/**
 * Build an index keyed by relativePath for O(1) lookups in loops.
 */
export function getManifestIndex(): Map<string, BuildManifestEntry> {
  return new Map(_manifest.entries.map((e) => [e.relativePath, e]));
}
