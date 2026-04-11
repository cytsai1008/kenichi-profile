// @ts-check

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { ogImages } from "./src/integrations/og-images";
import rehypeImageCaption from "./src/plugins/rehypeImageCaption.mjs";
import rehypeTaskListLucide from "./src/plugins/rehypeTaskListLucide.mjs";

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
    rehypePlugins: [rehypeTaskListLucide, rehypeImageCaption],
  },

  vite: {
    plugins: [tailwindcss()],
    define: {
      setImmediate: "setTimeout",
      clearImmediate: "clearTimeout",
    },
    optimizeDeps: {
      include: ["photoswipe", "photoswipe/lightbox"],
    },
  },
});
