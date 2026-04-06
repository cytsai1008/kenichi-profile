// @ts-check

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://kenichi.photocat.blue",
  adapter: cloudflare({
    imageService: "compile",
  }),
  output: "static",

  integrations: [
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

  vite: {
    plugins: [tailwindcss()],
    define: {
      // Cloudflare Workers runtime lacks these Node.js globals; polyfill for dev
      setImmediate: "setTimeout",
      clearImmediate: "clearTimeout",
    },
  },
});
