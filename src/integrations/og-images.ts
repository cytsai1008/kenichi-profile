import type { AstroIntegration } from "astro";
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { generateOgImage } from "../lib/og";
import { t, locales } from "../i18n/utils";
import { SITE_TITLE } from "../consts";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

function getBlogPosts() {
  const posts: { locale: string; slug: string; title: string; description: string }[] = [];
  for (const locale of locales) {
    const dir = join(root, "src/content/blog", locale);
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
    } catch {
      continue;
    }
    for (const file of files) {
      const { data } = matter(readFileSync(join(dir, file), "utf-8"));
      posts.push({
        locale,
        slug: file.replace(/\.(md|mdx)$/, ""),
        title: data.title ?? "",
        description: data.description ?? "",
      });
    }
  }
  return posts;
}

export function ogImages(): AstroIntegration {
  return {
    name: "og-images",
    hooks: {
      "astro:build:start": async () => {
        const outDir = join(root, "public/og");
        mkdirSync(outDir, { recursive: true });

        const jobs: { path: string; title: string; description: string }[] = [];

        for (const locale of locales) {
          const tr = t(locale);
          const prefix = locale === "en" ? "" : `${locale}/`;

          jobs.push(
            { path: `${prefix}home`, title: tr.nav.home, description: SITE_TITLE },
            { path: `${prefix}blog`, title: tr.blog.title, description: tr.blog.description },
            {
              path: `${prefix}gallery`,
              title: tr.gallery.title,
              description: tr.gallery.description,
            },
            { path: `${prefix}photos`, title: tr.photos.title, description: tr.photos.description },
            { path: `${prefix}about`, title: tr.about.title, description: tr.home.tagline }
          );
        }

        for (const { locale, slug, title, description } of getBlogPosts()) {
          const prefix = locale === "en" ? "" : `${locale}/`;
          jobs.push({ path: `${prefix}blog/${slug}`, title, description });
        }

        console.log(`[og-images] Generating ${jobs.length} OG images…`);
        // Run 4 at a time to avoid disk I/O spike
        for (let i = 0; i < jobs.length; i += 4) {
          await Promise.all(
            jobs.slice(i, i + 4).map(async ({ path, title, description }) => {
              const png = await generateOgImage(title, description);
              const file = join(outDir, `${path.replace(/\//g, "_")}.png`);
              writeFileSync(file, png);
            })
          );
        }
        console.log(`[og-images] Done.`);
      },
    },
  };
}
