import eslintPluginAstro from "eslint-plugin-astro";
import pluginVue from "eslint-plugin-vue";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import prettierConfig from "@vue/eslint-config-prettier";
import tsParser from "@typescript-eslint/parser";

export default [
  // Astro flat config (already turns off prettier/prettier for virtual script blocks)
  ...eslintPluginAstro.configs["flat/recommended"],
  // Vue recommended
  ...pluginVue.configs["flat/recommended"],
  // Disable ESLint formatting rules that conflict with Prettier
  eslintConfigPrettier,
  // Enable prettier/prettier as warnings — scoped to non-Astro files only
  {
    ...prettierConfig,
    files: ["**/*.{js,ts,mjs,vue}"],
  },
  // Re-disable prettier/prettier for Astro virtual script blocks (paths like *.astro/*.ts)
  // because eslint-plugin-prettier can't parse Astro-specific syntax in those contexts
  {
    files: ["**/*.astro/*.js", "**/*.astro/*.ts"],
    rules: {
      "prettier/prettier": "off",
    },
  },
  // TypeScript parser for Vue and TS files
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    rules: {},
  },
];
