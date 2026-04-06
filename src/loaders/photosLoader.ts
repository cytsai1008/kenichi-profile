/**
 * Custom Astro content loader for the photos collection.
 *
 * Scans `src/content/photos/` for image files (jpg, jpeg, png, webp, avif),
 * reads EXIF data automatically using exifreader, and merges optional
 * per-photo overrides from a sidecar `.md` file of the same base name.
 *
 * Result: each photo entry has `exif` populated without any manual frontmatter.
 */

import type { Loader } from "astro/loaders";
import ExifReader from "exifreader";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff", ".tif"]);

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

/** Load one image file and store it. `album` is undefined for top-level files. */
async function loadPhotoFile(
  absPath: string,
  absBase: string,
  album: string | undefined,
  store: Parameters<Loader["load"]>[0]["store"],
  logger: Parameters<Loader["load"]>[0]["logger"]
) {
  const ext = path.extname(absPath);
  const slug = path.basename(absPath, ext);
  const id = album ? `${album}/${slug}` : slug;
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

  const entry: PhotoEntry = {
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

  store.set({ id, data: entry });
  logger.info(`photos-loader: loaded ${id}`);
}

export function photosLoader(baseDir = "./src/content/photos"): Loader {
  return {
    name: "photos-loader",

    async load({ store, logger }) {
      store.clear();

      const absBase = path.resolve(baseDir);
      let entries: string[];
      try {
        entries = await readdir(absBase);
      } catch {
        logger.warn(`photos-loader: directory not found — ${absBase}`);
        return;
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
            await loadPhotoFile(path.join(absEntry, file), absBase, entry, store, logger);
          }
        } else if (IMAGE_EXTS.has(path.extname(entry).toLowerCase())) {
          // Top-level flat file
          await loadPhotoFile(absEntry, absBase, undefined, store, logger);
        }
      }
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
