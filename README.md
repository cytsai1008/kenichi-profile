# Kenichi profile

This repo powers Kenichi's personal site at <https://kenichi.photocat.blue>. It is built with Astro, uses a few Vue islands for the interactive bits, and is deployed on Cloudflare.

The site ships in three locales: `en`, `zh-tw`, and `zh-cn`. The repo also holds the blog, the artwork and commission gallery, the photo section that reads EXIF metadata, and the Open Graph image generation used during the build.

## Stack

- Astro 7
- Vue 3 islands for interactive UI
- Tailwind CSS v4
- Cloudflare adapter + Wrangler
- Markdown/MDX content collections
- `exifreader`, `sharp`, `photoswipe`, `satori`, and `@resvg/resvg-js`

## Requirements

- Node.js `>=22.12.0`
- npm

## Local development

```sh
npm install
npm run dev
```

Useful commands:

| Command                  | What it does                                |
| ------------------------ | ------------------------------------------- |
| `npm run dev`            | Start the local dev server                  |
| `npm run build`          | Build the site into `dist/`                 |
| `npm run preview`        | Preview the production build locally        |
| `npm run new:commission` | Interactive commission post generator       |
| `npm run lint`           | Run ESLint with `--fix`                     |
| `npm run format`         | Run Prettier on `src` and root `.mjs` files |

## Project structure

```text
.
├── public/                 # Static assets, including generated OG images
├── src/
│   ├── assets/             # Imported site assets and gallery images
│   ├── components/         # Astro components, Vue islands, and page shells
│   ├── content/            # Blog, gallery, and photo source content
│   ├── i18n/               # Translation dictionaries and locale helpers
│   ├── integrations/       # Custom Astro integrations
│   ├── layouts/            # Base layouts
│   ├── loaders/            # Custom content loaders
│   ├── pages/              # Route wrappers for each locale
│   └── styles/             # Global styles and design tokens
├── astro.config.mjs
├── wrangler.jsonc
└── package.json
```

## How localization works

- English is the default locale, so its routes do not use a URL prefix.
- Traditional Chinese routes live under `/zh-tw/...`.
- Simplified Chinese routes live under `/zh-cn/...`.
- The root path `/` is prerendered; locale redirection now happens client-side in `src/components/BaseHead.astro` by checking the `preferred-locale` cookie first and `navigator.languages` after that.
- Shared page logic lives in `src/components/pages/`; route files in `src/pages/` mainly pass the locale through.

## Content workflows

### Blog posts

Put blog posts in `src/content/blog/<locale>/` as `.md` or `.mdx` files.

Required frontmatter:

```yaml
---
title: My post
description: Short summary
pubDate: 2026-04-08
---
```

Optional fields:

- `updatedDate`
- `heroImage`
- `tags`
- `featured`

### Gallery entries

Put gallery entries in `src/content/gallery/`.

For new commission posts, use the interactive CLI:

```sh
npm run new:commission
```

It will prompt for the source image, titles, descriptions, optional i18n fields, and artist details, then:

- ask for the image type first, such as `avatar`, `full-body`, or `other`
- ask for the gallery category, such as `commission` or `gift-art`
- copy the image into `src/assets/commissions/`
- create `src/content/gallery/<slug>.md`
- infer the artist username from the filename and use it as the default artist value
- fill title and description defaults from the selected image-type preset

Optional flags:

- `--preset avatar|full-body|half-body|other`
- `--category commission|gift-art`
- `--dry-run`

Required frontmatter:

```yaml
---
title: Artwork title
image: ../../assets/commissions/example.jpg
date: 2026-04-08
---
```

Optional fields:

- `description`
- `titleI18n`
- `descriptionI18n`
- `category` (`ref-sheet`, `commission`, `gift-art`, `other`)
- `artist`
- `artistI18n`
- `artistUrl`
- `featured`

### Photos

Drop images into `src/content/photos/`, or into a subfolder if you want them grouped as an album.

The custom loader in `src/loaders/photosLoader.ts` will:

- detect supported image files
- extract EXIF metadata automatically
- derive a default title and date from the file metadata
- use nested folder names as album names

If you want to override or add metadata, place a sidecar `.md` file next to the image with the same basename:

```yaml
---
title: Sunset walk
description: Evening light near the river
location: Taipei
date: 2026-04-08
---
```

## Deployment notes

- The site uses the Cloudflare Astro adapter with `output: "static"`.
- Because the site is prerendered, request-time Astro middleware is not used for locale detection.
- `wrangler.jsonc` is already configured for the custom domain `kenichi.photocat.blue`.
- Open Graph images are generated during the build and written to `public/og/`.

## Maintenance conventions

- Use npm, not yarn.
- Keep shared page logic in `src/components/pages/` instead of duplicating locale-specific page implementations.
- Prefer updating `src/i18n/*.json` over hard-coding copy in page files.
