// @ts-check

import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "astro/config";
import { ogImages } from "./src/integrations/og-images";
import rehypeImageCaption from "./src/plugins/rehypeImageCaption.mjs";
import rehypeTaskListLucide from "./src/plugins/rehypeTaskListLucide.mjs";

const VIRTUAL_GALLERY_MANIFEST = "virtual:gallery-manifest";
const MANIFEST_PATH = path.resolve(
  process.cwd(),
  "node_modules/.astro/gallery-explicit-build-manifest.json"
);

function galleryManifestPlugin() {
  return /** @type {import('vite').Plugin} */ ({
    name: "gallery-manifest",
    resolveId(id) {
      return id === VIRTUAL_GALLERY_MANIFEST ? "\0" + VIRTUAL_GALLERY_MANIFEST : undefined;
    },
    async load(id) {
      if (id !== "\0" + VIRTUAL_GALLERY_MANIFEST) return;
      try {
        const raw = await readFile(MANIFEST_PATH, "utf8");
        return `export default ${raw}`;
      } catch {
        return `export default ${JSON.stringify({ version: 1, builtAt: new Date().toISOString(), entries: [] })}`;
      }
    },
  });
}

// https://astro.build/config
export default defineConfig({
  site: "https://kenichi.photocat.blue",
  adapter: cloudflare({
    imageService: "compile",
  }),
  output: "static",

  integrations: [
    ogImages(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en",
          "zh-tw": "zh-TW",
          "zh-cn": "zh-CN",
        },
      },
    }),
    vue(),
  ],

  i18n: {
    defaultLocale: "en",
    locales: ["en", "zh-tw", "zh-cn"],
    routing: {
      prefixDefaultLocale: false,
    },
    fallback: {
      "zh-cn": "zh-tw",
    },
  },

  markdown: {
    processor: unified({
      rehypePlugins: [rehypeTaskListLucide, rehypeImageCaption],
    }),
  },

  vite: {
    plugins: [tailwindcss(), galleryManifestPlugin()],
    define: {
      setImmediate: "setTimeout",
      clearImmediate: "clearTimeout",
    },
    optimizeDeps: {
      include: ["photoswipe", "photoswipe/lightbox"],
    },
  },
});
