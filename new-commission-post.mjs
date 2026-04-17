#!/usr/bin/env node

import { access, copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const OpenCC = require("opencc");

const ROOT = process.cwd();
const GALLERY_DIR = path.join(ROOT, "src", "content", "gallery");
const SRC_DIR = path.join(ROOT, "src");
const ASSET_DIR = path.join(SRC_DIR, "assets", "commissions");
const ALT_MEDIA_DIR = path.join(ROOT, "alt-media");
const DEFAULT_NAME = "Kenichi";
const UNKNOWN_ARTIST_EN = "Unknown";
const UNKNOWN_ARTIST_ZH_TW = "未知";
const twToSConverter = new OpenCC("tw2s.json");
const GALLERY_CATEGORIES = ["commission", "gift-art"];
const WORK_TYPE_LABELS = {
  commission: {
    en: "commission",
    "zh-tw": "委託",
    "zh-cn": "委托",
  },
  "gift-art": {
    en: "gift art",
    "zh-tw": "贈圖",
    "zh-cn": "赠图",
  },
};

const IMAGE_TYPE_PRESETS = {
  avatar: {
    category: "commission",
    featured: false,
    titleTemplate: "Kenichi Avatar",
    descriptionTemplate: "Kenichi avatar drawn by {artist}.",
    titleI18nTemplates: {
      "zh-tw": "健一頭像",
      "zh-cn": "健一头像",
    },
    descriptionI18nTemplates: {
      "zh-tw": "{artist}繪製的健一頭像",
      "zh-cn": "{artist}绘制的健一头像",
    },
  },
  "full-body": {
    category: "commission",
    featured: false,
    titleTemplate: "{name} Full Body",
    descriptionTemplate: "{name} full body {workType} drawn by {artist}.",
    titleI18nTemplates: {
      "zh-tw": "健一全身",
      "zh-cn": "健一全身",
    },
    descriptionI18nTemplates: {
      "zh-tw": "{artist}繪製的健一全身{workType}",
      "zh-cn": "{artist}绘制的健一全身{workType}",
    },
  },
  "half-body": {
    category: "commission",
    featured: false,
    titleTemplate: "{name} Half Body",
    descriptionTemplate: "{name} half body {workType} drawn by {artist}.",
    titleI18nTemplates: {
      "zh-tw": "健一半身",
      "zh-cn": "健一半身",
    },
    descriptionI18nTemplates: {
      "zh-tw": "{artist}繪製的健一半身{workType}",
      "zh-cn": "{artist}绘制的健一半身{workType}",
    },
  },
  other: {
    category: "commission",
    featured: false,
    titleTemplate: "{name}",
    descriptionTemplate: "{name} {workType} drawn by {artist}.",
    titleI18nTemplates: {
      "zh-tw": "{name}",
      "zh-cn": "{name}",
    },
    descriptionI18nTemplates: {
      "zh-tw": "{artist}繪製的健一{workType}",
      "zh-cn": "{artist}绘制的健一{workType}",
    },
  },
};

const { values } = parseArgs({
  options: {
    category: { type: "string" },
    "dry-run": { type: "boolean" },
    help: { type: "boolean", short: "h" },
    preset: { type: "string" },
  },
});

if (values.help) {
  printHelp();
  process.exit(0);
}

void main();

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: pathCompleter,
  });

  try {
    const imageType = await promptChoice(
      rl,
      "Image type",
      Object.keys(IMAGE_TYPE_PRESETS),
      values.preset ?? "avatar"
    );
    const preset = IMAGE_TYPE_PRESETS[imageType];
    const category = await promptChoice(
      rl,
      "Gallery category",
      GALLERY_CATEGORIES,
      values.category ?? preset.category
    );

    const sourceInput = await promptText(rl, "Source image path", "", true);
    const sourcePath = path.resolve(ROOT, sourceInput);
    await assertExists(sourcePath, "Source image");

    const ext = path.extname(sourcePath).toLowerCase();
    if (!ext) {
      throw new Error("Source image must have a file extension.");
    }

    const isExplicit = sourcePath.startsWith(`${ALT_MEDIA_DIR}${path.sep}`);

    const baseSlug = slugify(path.parse(sourcePath).name);
    const slug = slugify(await promptText(rl, "Post slug", baseSlug, true));
    const sourceBaseName = path.parse(sourcePath).name;
    const inferredXUsername = inferUsernameFromFilename(sourceBaseName);
    const artist = await promptText(
      rl,
      "Artist (en)",
      isUnknownSourceName(sourceBaseName) ? UNKNOWN_ARTIST_EN : "",
      false
    );
    const title = await promptText(
      rl,
      "Title",
      applyTemplate(preset.titleTemplate, { name: DEFAULT_NAME, artist }),
      true
    );
    const description = await promptText(
      rl,
      "Description",
      applyTemplate(preset.descriptionTemplate, {
        name: DEFAULT_NAME,
        artist,
        workType: getWorkTypeLabel(category, "en"),
      }),
      false
    );
    const date = await promptText(rl, "Date", isoToday(), true, (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Date must use YYYY-MM-DD format."
    );

    const titleZhTw = await promptText(
      rl,
      "Title (zh-tw)",
      applyTemplate(preset.titleI18nTemplates["zh-tw"], { name: DEFAULT_NAME, artist }),
      false
    );
    const titleZhCn = await promptText(
      rl,
      "Title (zh-cn)",
      (await toSimplifiedChinese(titleZhTw)) ||
        applyTemplate(preset.titleI18nTemplates["zh-cn"], { name: DEFAULT_NAME, artist }),
      false
    );
    const descriptionZhTw = await promptText(
      rl,
      "Description (zh-tw)",
      applyTemplate(preset.descriptionI18nTemplates["zh-tw"], {
        name: DEFAULT_NAME,
        artist,
        workType: getWorkTypeLabel(category, "zh-tw"),
      }),
      false
    );
    const descriptionZhCn = await promptText(
      rl,
      "Description (zh-cn)",
      (await toSimplifiedChinese(descriptionZhTw)) ||
        applyTemplate(preset.descriptionI18nTemplates["zh-cn"], {
          name: DEFAULT_NAME,
          artist,
          workType: getWorkTypeLabel(category, "zh-cn"),
        }),
      false
    );

    const artistZhTw = await promptText(
      rl,
      "Artist (zh-tw)",
      isUnknownSourceName(sourceBaseName) ? UNKNOWN_ARTIST_ZH_TW : "",
      false
    );
    const artistZhCn = await promptText(
      rl,
      "Artist (zh-cn)",
      await toSimplifiedChinese(artistZhTw),
      false
    );
    const xUsername = await promptText(rl, "X username", inferredXUsername, false);
    const artistUrl = await promptText(rl, "Artist URL", inferArtistUrl(xUsername), false);
    const featured = await promptBoolean(rl, "Featured", preset.featured);

    const explicitGalleryDir = path.join(GALLERY_DIR, "explicit");
    const postDir = isExplicit ? explicitGalleryDir : GALLERY_DIR;
    const postTarget = path.join(postDir, `${slug}.md`);

    // Explicit content: image stays in alt-media, frontmatter uses logical remote path.
    // Non-explicit: copy image to src/assets/commissions as before.
    const sourceAssetPath = isExplicit ? null : getSourceAssetPath(sourcePath);
    const imageTarget = isExplicit ? null : (sourceAssetPath ?? path.join(ASSET_DIR, path.basename(sourcePath)));
    const frontmatterImagePath = isExplicit
      ? `gallery-explicit/${path.basename(sourcePath)}`
      : toGalleryImagePath(imageTarget);

    await assertDoesNotExist(postTarget, "Gallery post");
    if (imageTarget && path.resolve(sourcePath) !== path.resolve(imageTarget)) {
      await assertDoesNotExist(imageTarget, "Target image");
    }

    const frontmatter = buildFrontmatter({
      title,
      description,
      titleI18n: {
        "zh-tw": titleZhTw,
        "zh-cn": titleZhCn,
      },
      descriptionI18n: {
        "zh-tw": descriptionZhTw,
        "zh-cn": descriptionZhCn,
      },
      image: frontmatterImagePath,
      date,
      category,
      artist,
      artistI18n: {
        "zh-tw": artistZhTw,
        "zh-cn": artistZhCn,
      },
      artistUrl,
      featured,
      explicit: isExplicit,
    });

    console.log("");
    console.log("Summary");
    console.log(`- image: ${isExplicit ? frontmatterImagePath : path.relative(ROOT, imageTarget)}`);
    console.log(`- post:  ${path.relative(ROOT, postTarget)}`);
    console.log(`- image type: ${imageType}`);
    console.log(`- category: ${category}`);
    console.log(`- explicit: ${isExplicit}`);
    console.log(`- artist: ${artist || "(empty)"}`);

    const shouldWrite = values["dry-run"] ? false : await promptBoolean(rl, "Write files", true);
    if (!shouldWrite) {
      console.log("");
      console.log(frontmatter);
      process.exit(0);
    }

    await mkdir(postDir, { recursive: true });

    if (isExplicit) {
      await writeFile(postTarget, `${frontmatter}\n`, "utf8");
      console.log("");
      console.log(`Created post: ${path.relative(ROOT, postTarget)}`);
      console.log(`Next: npm run gallery:push-originals -- ${path.relative(ROOT, sourcePath)}`);
    } else {
      await mkdir(ASSET_DIR, { recursive: true });
      if (imageTarget && path.resolve(sourcePath) !== path.resolve(imageTarget)) {
        await copyFile(sourcePath, imageTarget);
        console.log("");
        console.log(`Created image: ${path.relative(ROOT, imageTarget)}`);
      }
      await writeFile(postTarget, `${frontmatter}\n`, "utf8");
      console.log(`Created post: ${path.relative(ROOT, postTarget)}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

function printHelp() {
  console.log(`Usage: npm run new:commission

Interactive commission post generator.

Options:
  --preset <name>         Preselect an image type preset
  --category <name>       Preselect a gallery category (${GALLERY_CATEGORIES.join("|")})
  --dry-run               Print the generated frontmatter instead of writing files
  -h, --help              Show this help
`);
}

async function promptText(rl, label, fallback, required, validate) {
  const suffix = fallback ? ` [${fallback}]` : "";
  while (true) {
    const answer = (await rl.question(`${label}${suffix}: `)).trim();
    const value = answer || fallback || "";
    if (!value && required) {
      console.error(`  ${label} is required.`);
      continue;
    }
    if (value && validate) {
      const err = validate(value);
      if (err) {
        console.error(`  ${err}`);
        continue;
      }
    }
    return value;
  }
}

async function promptChoice(rl, label, choices, fallback) {
  const prompt = `${label} (${choices.join("/")}) [${fallback}]: `;
  while (true) {
    const answer = (await rl.question(prompt)).trim() || fallback;
    if (choices.includes(answer)) {
      return answer;
    }
    console.error(`  Must be one of: ${choices.join(", ")}`);
  }
}

async function promptBoolean(rl, label, fallback) {
  const marker = fallback ? "Y/n" : "y/N";
  while (true) {
    const answer = (await rl.question(`${label} [${marker}]: `)).trim().toLowerCase();
    if (!answer) return fallback;
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    console.error("  Please answer y or n.");
  }
}

async function assertExists(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

async function assertDoesNotExist(filePath, label) {
  try {
    await access(filePath);
    throw new Error(`${label} already exists: ${filePath}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      throw error;
    }
  }
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function titleFromSlug(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildFrontmatter(data) {
  const lines = ["---"];
  pushString(lines, "title", data.title, true);
  pushString(lines, "description", data.description);
  pushI18n(lines, "titleI18n", data.titleI18n);
  pushI18n(lines, "descriptionI18n", data.descriptionI18n);
  pushString(lines, "image", data.image, true);
  lines.push(`date: ${data.date}`);
  lines.push(`category: ${data.category}`);
  pushString(lines, "artist", data.artist);
  pushI18n(lines, "artistI18n", data.artistI18n);
  pushString(lines, "artistUrl", data.artistUrl);
  if (data.featured) {
    lines.push("featured: true");
  }
  if (data.explicit) {
    lines.push("explicit: true");
  }
  lines.push("---");
  return lines.join("\n");
}

function pushString(lines, key, value, required = false) {
  const text = value.trim();
  if (!text) {
    if (required) {
      throw new Error(`${key} is required.`);
    }
    return;
  }
  lines.push(`${key}: ${JSON.stringify(text)}`);
}

function pushI18n(lines, key, values) {
  const entries = Object.entries(values).filter(([, value]) => value.trim());
  if (entries.length === 0) {
    return;
  }
  lines.push(`${key}:`);
  for (const [locale, value] of entries) {
    lines.push(`  ${locale}: ${JSON.stringify(value.trim())}`);
  }
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function applyTemplate(template, values) {
  return template
    .replaceAll("{name}", values.name)
    .replaceAll("{artist}", values.artist || "the artist")
    .replaceAll("{workType}", values.workType || "artwork");
}

function getWorkTypeLabel(category, locale) {
  return WORK_TYPE_LABELS[category]?.[locale] ?? WORK_TYPE_LABELS.commission[locale];
}

function inferUsernameFromFilename(fileName) {
  const normalized = fileName.replace(/[_-]\d+$/, "").trim();
  if (isUnknownSourceName(fileName)) {
    return "";
  }
  return normalized;
}

function isUnknownSourceName(fileName) {
  return /^unknown(?:[_-]\d+)?$/i.test(fileName.trim());
}

function inferArtistUrl(artist) {
  if (!artist.trim()) {
    return "";
  }
  return `https://x.com/${artist.trim()}`;
}

function getSourceAssetPath(sourcePath) {
  const normalizedSource = path.resolve(sourcePath);
  const normalizedSrcDir = `${path.resolve(SRC_DIR)}${path.sep}`;
  if (!normalizedSource.startsWith(normalizedSrcDir)) {
    return null;
  }
  return normalizedSource;
}

function toGalleryImagePath(imagePath) {
  const relativeFromGallery = path.relative(GALLERY_DIR, imagePath).replace(/\\/g, "/");

  if (!relativeFromGallery.startsWith("../")) {
    return `./${relativeFromGallery}`;
  }

  return relativeFromGallery;
}

async function toSimplifiedChinese(value) {
  if (!value.trim()) {
    return "";
  }
  return twToSConverter.convertPromise(value.trim());
}

async function pathCompleter(line) {
  const input = line.trim();
  const normalizedInput = input.replace(/"/g, "");
  const hasSeparator = /[\\/]/.test(normalizedInput);

  if (hasSeparator) {
    const searchBase = path.resolve(ROOT, path.dirname(normalizedInput));
    const partialName = path.basename(normalizedInput);
    return [await listMatches(searchBase, partialName), line];
  }

  // No separator — search both ASSET_DIR and ALT_MEDIA_DIR and merge
  const [fromAssets, fromAlt] = await Promise.all([
    listMatches(ASSET_DIR, normalizedInput),
    listMatches(ALT_MEDIA_DIR, normalizedInput),
  ]);
  return [[...fromAssets, ...fromAlt], line];
}

async function listMatches(searchBase, partialName) {
  try {
    const entries = await readdir(searchBase, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.name.toLowerCase().startsWith(partialName.toLowerCase()))
        .map(async (entry) => {
          const absolutePath = path.join(searchBase, entry.name);
          const relativePath = path.relative(ROOT, absolutePath).replace(/\\/g, "/");
          const isDirectory = entry.isDirectory() || (await stat(absolutePath)).isDirectory();
          return isDirectory ? `${relativePath}/` : relativePath;
        })
    );
  } catch {
    return [];
  }
}
