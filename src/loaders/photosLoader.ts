/**
 * Custom Astro content loader for the photos collection.
 *
 * Scans `src/content/photos/` for image files (jpg, jpeg, png, webp, avif),
 * reads EXIF data automatically using exifreader, and merges optional
 * per-photo overrides from a sidecar `.md` file of the same base name.
 *
 * Result: each photo entry has `exif` populated without any manual frontmatter.
 * Parsed entries are cached in node_modules/.astro/photos-loader-cache.json,
 * keyed by an MD5 hash of the first 64 KB of the image + sidecar content.
 * Unchanged photos are skipped on subsequent builds, including on Cloudflare Pages
 * (which caches node_modules/.astro between builds).
 */

import { createHash } from "node:crypto";
import type { Loader } from "astro/loaders";
import ExifReader from "exifreader";
import { mkdir, open, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff", ".tif"]);
const CACHE_PATH = "node_modules/.astro/photos-loader-cache.json";

export interface PhotoExif {
  camera?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  date?: string;
  width?: number;
  height?: number;
  gps?: { lat: number; lon: number };
}

export interface PhotoEntry {
  [key: string]: unknown;
  /** Absolute path to the original image file — used for `<Image src={...}>` */
  src: string;
  /** File base name without extension, e.g. "golden-hour" */
  slug: string;
  /** Album folder name, if the photo is inside a subdirectory */
  album?: string;
  title: string;
  description?: string;
  date: Date;
  location?: string;
  exif: PhotoExif;
  /** Raw image file path relative to project root (for Astro Image component) */
  imagePath: string;
}

/** Serialised form stored in the cache file (Date becomes ISO string). */
interface CacheEntry {
  hash: string;
  data: Omit<PhotoEntry, "date"> & { date: string };
}

async function readPhotoCache(): Promise<Record<string, CacheEntry>> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

async function writePhotoCache(cache: Record<string, CacheEntry>): Promise<void> {
  try {
    await mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(cache));
  } catch {
    // non-fatal — cache miss on next build
  }
}

/**
 * Hash the first 64 KB of the image (covers all EXIF metadata) plus the full
 * sidecar .md content if present. Changing either invalidates the cache entry.
 */
async function computeEntryHash(absPath: string): Promise<string> {
  const SAMPLE = 64 * 1024;
  const hash = createHash("md5");

  const fh = await open(absPath, "r");
  try {
    const buf = Buffer.alloc(SAMPLE);
    const { bytesRead } = await fh.read(buf, 0, SAMPLE, 0);
    hash.update(buf.subarray(0, bytesRead));
  } finally {
    await fh.close();
  }

  const ext = path.extname(absPath);
  const sidecarPath = path.join(path.dirname(absPath), `${path.basename(absPath, ext)}.md`);
  try {
    hash.update(await readFile(sidecarPath, "utf-8"));
  } catch {
    // no sidecar
  }

  return hash.digest("hex");
}

/** Read actual pixel dimensions from a JPEG SOF marker — more reliable than EXIF tags. */
function readJpegDimensions(buf: Buffer): { width: number; height: number } | undefined {
  for (let i = 0; i < buf.length - 8; i++) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc1 || buf[i + 1] === 0xc2)) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }
  return undefined;
}

type ExifTagLike = {
  description?: string;
  value?: unknown;
};

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

function readRational(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    value[1] !== 0
  ) {
    return value[0] / value[1];
  }
  return undefined;
}

async function parseExif(buffer: Buffer): Promise<PhotoExif> {
  try {
    const tags = ExifReader.load(asArrayBuffer(buffer), { expanded: true });
    const exif = (tags.exif ?? {}) as Record<string, ExifTagLike>;
    const file = (tags.file ?? {}) as Record<string, ExifTagLike>;
    const gpsRaw = tags.gps;

    const make = exif["Make"]?.description ?? "";
    const model = exif["Model"]?.description ?? "";
    const camera = [make, model].filter(Boolean).join(" ") || undefined;

    const lens = exif["LensModel"]?.description ?? exif["Lens"]?.description ?? undefined;

    const focalRaw = exif["FocalLength"]?.description;
    const focalLength = focalRaw ? `${focalRaw}` : undefined;

    const fNumber = readRational(exif["FNumber"]?.value);
    const aperture = fNumber ? `f/${fNumber.toFixed(1)}` : undefined;

    const shutter = exif["ExposureTime"]?.description ?? undefined;

    const isoRaw = exif["ISOSpeedRatings"]?.value ?? exif["ISO"]?.value;
    const iso = isoRaw != null ? String(isoRaw) : undefined;

    const dateRaw = exif["DateTimeOriginal"]?.description ?? exif["DateTime"]?.description;
    // Convert "2024:03:15 14:30:00" → "2024-03-15 14:30:00"
    const date = dateRaw ? dateRaw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3") : undefined;

    // Prefer SOF-parsed dimensions (exact pixel size) over EXIF tags (can be thumbnails)
    const sof = readJpegDimensions(buffer);
    const width =
      sof?.width ??
      (typeof file["Image Width"]?.value === "number" ? file["Image Width"]?.value : undefined) ??
      (typeof exif["PixelXDimension"]?.value === "number"
        ? exif["PixelXDimension"]?.value
        : undefined) ??
      undefined;
    const height =
      sof?.height ??
      (typeof file["Image Height"]?.value === "number" ? file["Image Height"]?.value : undefined) ??
      (typeof exif["PixelYDimension"]?.value === "number"
        ? exif["PixelYDimension"]?.value
        : undefined) ??
      undefined;

    let gps: { lat: number; lon: number } | undefined;
    if (gpsRaw && typeof gpsRaw.Latitude === "number" && typeof gpsRaw.Longitude === "number") {
      gps = { lat: gpsRaw.Latitude, lon: gpsRaw.Longitude };
    }

    return { camera, lens, focalLength, aperture, shutter, iso, date, width, height, gps };
  } catch {
    return {};
  }
}

/** Parse the image file and return a PhotoEntry (no store interaction). */
async function buildPhotoEntry(absPath: string, album: string | undefined): Promise<PhotoEntry> {
  const ext = path.extname(absPath);
  const slug = path.basename(absPath, ext);
  const relPath = path.relative(path.resolve("."), absPath).replace(/\\/g, "/");

  const buffer = await readFile(absPath);
  const exif = await parseExif(buffer);

  let title = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let description: string | undefined;
  let location: string | undefined;
  let date: Date = exif.date ? new Date(exif.date) : (await stat(absPath)).mtime;

  // Sidecar .md lives next to the image
  const sidecarPath = path.join(path.dirname(absPath), `${slug}.md`);
  try {
    const sidecar = await readFile(sidecarPath, "utf-8");
    const fm = parseFrontmatter(sidecar);
    if (fm.title) title = fm.title;
    if (fm.description) description = fm.description;
    if (fm.location) location = fm.location;
    if (fm.date) date = new Date(fm.date);
  } catch {
    // No sidecar — use defaults
  }

  return {
    src: absPath,
    slug,
    album,
    title,
    description,
    date,
    location,
    exif,
    imagePath: `/${relPath}`,
  };
}

export function photosLoader(baseDir = "./src/content/photos"): Loader {
  return {
    name: "photos-loader",

    async load({ store, logger }) {
      const absBase = path.resolve(baseDir);
      let entries: string[];
      try {
        entries = await readdir(absBase);
      } catch {
        logger.warn(`photos-loader: directory not found — ${absBase}`);
        return;
      }

      const prevCache = await readPhotoCache();
      const newCache: Record<string, CacheEntry> = {};
      const seenIds = new Set<string>();

      async function processPhoto(absPath: string, album: string | undefined) {
        const ext = path.extname(absPath);
        const slug = path.basename(absPath, ext);
        const id = album ? `${album}/${slug}` : slug;
        seenIds.add(id);

        const hash = await computeEntryHash(absPath);
        const cached = prevCache[id];

        if (cached?.hash === hash) {
          // Restore from cache — no full file read or EXIF parse needed
          const data = { ...cached.data, date: new Date(cached.data.date) } as PhotoEntry;
          store.set({ id, data });
          newCache[id] = cached;
          logger.info(`photos-loader: cached  ${id}`);
          return;
        }

        const data = await buildPhotoEntry(absPath, album);
        store.set({ id, data });
        newCache[id] = { hash, data: { ...data, date: data.date.toISOString() } };
        logger.info(`photos-loader: loaded  ${id}`);
      }

      for (const entry of entries) {
        const absEntry = path.join(absBase, entry);
        const s = await stat(absEntry);

        if (s.isDirectory()) {
          // Album folder — load all images inside it
          const albumFiles = await readdir(absEntry);
          const imageFiles = albumFiles.filter((f) =>
            IMAGE_EXTS.has(path.extname(f).toLowerCase())
          );
          for (const file of imageFiles) {
            await processPhoto(path.join(absEntry, file), entry);
          }
        } else if (IMAGE_EXTS.has(path.extname(entry).toLowerCase())) {
          // Top-level flat file
          await processPhoto(absEntry, undefined);
        }
      }

      // Remove store entries for photos that have been deleted
      for (const [id] of store.entries()) {
        if (!seenIds.has(id)) {
          store.delete(id);
          logger.info(`photos-loader: removed ${id}`);
        }
      }

      await writePhotoCache(newCache);
    },
  };
}

/** Minimal YAML frontmatter parser (handles string/date values only). */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && val) result[key] = val;
  }
  return result;
}
