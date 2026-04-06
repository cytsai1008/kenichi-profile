/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/styles/global.css",
  printWidth: 100,
  tabWidth: 2,
  singleQuote: false,
  trailingComma: "es5",
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
