# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server at localhost:4321
npm run build      # production build to ./dist/
npm run preview    # preview the production build locally
npx prettier --write <file>   # format a file
npx eslint <file> --fix       # lint a file
```

Use **npm** (not yarn) — project uses Tailwind CSS.
Run Prettier + ESLint on changed `.astro`, `.vue`, `.ts` before commit.

### Gallery image upload workflow

1. **Upload original** — `npm run gallery:push-originals -- ./image.jpg`
    - Uploads to private sync host under `gallery-explicit/<filename>` by default
    - `--remote-path gallery-explicit/sub/name.jpg` for explicit path
    - `--overwrite` to overwrite existing original (or `GALLERY_OVERWRITE=1`)
2. **Sync** — `npm run gallery:sync`
    - Downloads originals, generates viewer + thumb derivatives, uploads them, updates build manifest
3. **Dev server** reads build manifest from `node_modules/.astro/gallery-explicit-build-manifest.json`

**Local dev against `../kenichi-profile-ext-server`** — set in `.env.builder.dev`:

```
GALLERY_SYNC_HOST=http://localhost:8081     # private endpoints
GALLERY_PUBLIC_HOST=http://localhost:8080   # viewer/thumb asset URLs baked into build manifest
```

All `gallery:*` + `prebuild` npm scripts load `.env.builder.dev` via `--env-file`.

## Architecture

### i18n — three locales, file-based routing

- Locales: `en` (default, no prefix), `zh-tw` (`/zh-tw/…`), `zh-cn` (`/zh-cn/…`)
- **Never duplicate page logic.** One shared component per page in `src/components/pages/` accepts `locale` prop. Route
  files in `src/pages/` and `src/pages/zh-{tw,cn}/` are 3-line wrappers.
- Translation strings in `src/i18n/{en,zh-tw,zh-cn}.json`. Use `t(locale)` from `src/i18n/utils.ts`.
- Use `localePath(path, locale)` for locale-prefixed hrefs; `getLocaleFromUrl(url)` to detect locale.
- Root `/` prerendered. Locale detection client-side in `BaseHead.astro` (defers to `preferred-locale` cookie, then
  `navigator.languages`).

### Color system — Tailwind v4 with `@theme inline`

Defined in `src/styles/global.css`. Raw CSS vars in `:root` / `.dark` mapped into Tailwind tokens via `@theme inline` so
utilities output `var(…)` and respond to `.dark` at runtime.

Dark mode: add/remove `.dark` on `<html>`. Inline script in `BaseHead.astro` applies before first paint.

Key token rules:

- `text-accent` / `border-accent` — medium blue, text/borders on light bg
- `bg-accent-bg` / `bg-accent-dim` — darker blue for filled bg (white text auto via global CSS — never add `text-white`
  manually)
- `bg-highlight` / `bg-highlight-dim` — warm amber fills (also auto-white text)

See `DESIGN.md` for full palette, typography, component patterns, layout principles.

### Scroll animations

`src/scripts/scrollAnimations.ts` drives `data-animate` / `data-animate-stagger` via IntersectionObserver. Elements
start at `opacity: 0` (gated by `html.js` class applied before paint). Optional `data-opacity="0.5"` settles at sub-1
opacity. `data-animate-on-load-only` skips observer, fires immediately.

Interactive animations (nav, gallery filters, mobile menu) use **anime.js v4** with spring physics.
`prefers-reduced-motion` respected throughout.

### Content collections

Defined in `src/content.config.ts`:

| Collection | Source                                 | Notes                                                                                                                                                        |
|------------|----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `blog`     | `src/content/blog/{locale}/*.{md,mdx}` | Locale-prefixed subdirs; filtered per locale by `getBlogPostsForLocale()`                                                                                    |
| `gallery`  | `src/content/gallery/*.{md,mdx}`       | Frontmatter: `image`, `category`, `artist`; `image` can be repo-local path or remote manifest key                                                            |
| `photos`   | `src/content/photos/` images           | Custom loader (`src/loaders/photosLoader.ts`) — EXIF auto-read via `exifreader`; optional sidecar `.md` overrides `title`, `description`, `location`, `date` |

Gallery entries with bare logical `image` path (e.g. `gallery-explicit/foo.jpg`) resolved via build manifest.

### Components

- **Astro components** for static structure: `Layout.astro`, `BlogPost.astro`, `BlogCard.astro`, `SiteFooter.astro`,
  `BaseHead.astro`, `CookieConsent.astro`
- **Vue SFCs** (`client:load`) for interactive islands:
    - `NavBar.vue` — theme toggle (light/system/dark), language switcher, mobile menu
    - `PhotoViewer.vue` — PhotoSwipe lightbox with EXIF overlay; used by `/photos` + `/gallery`
    - `SocialLinks.vue` — animated social icon row
    - `BlogLightbox.vue` — lightbox for blog post inline images

### Layouts

- `src/layouts/Layout.astro` — base HTML shell; builds locale-prefixed nav links, injects `NavBar.vue`
- `src/layouts/BlogPost.astro` — wraps Layout, adds article header with date + back link

## Adding content

**Blog post** — create `src/content/blog/{locale}/my-post.md` (e.g. `en/`, `zh-tw/`, `zh-cn/`). Frontmatter: `title`,
`description`, `pubDate`, optional `heroImage`, `tags`, `draft` (bool). Locale prefix stripped from URLs by
`getBlogSlug()` in `src/lib/blog.ts`.

**Gallery artwork** — create `src/content/gallery/my-art.md` with frontmatter: `title`, `image` (relative asset path or
remote manifest key), `date`, `category` (`ref-sheet` | `commission` | `gift-art` | `other`), optional `artist`,
`artistUrl`, `featured` (bool), `titleI18n`, `artistI18n`.

**Photo** — drop `photo.jpg` into `src/content/photos/`. EXIF extracted automatically. Optionally create `photo.md` for
`title`, `location`, `description`.
