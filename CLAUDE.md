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

Always use **npm** (not yarn) — the project uses Tailwind CSS.
Run Prettier and ESLint on any changed `.astro`, `.vue`, or `.ts` files before committing.

### Gallery image upload workflow

1. **Upload original** — `npm run gallery:push-originals -- ./image.jpg`
   - Uploads to private sync host under `gallery-explicit/<filename>` by default
   - `--remote-path gallery-explicit/sub/name.jpg` to set an explicit path
   - `--overwrite` to overwrite an existing original (or `GALLERY_OVERWRITE=1`)
2. **Sync** — `npm run gallery:sync`
   - Downloads originals, generates viewer + thumb derivatives, uploads them, updates the build manifest
3. **Dev server** reads the build manifest from `node_modules/.astro/gallery-explicit-build-manifest.json`

**Local dev against `../kenichi-profile-ext-server`** — set in `.env.builder.dev`:
```
GALLERY_SYNC_HOST=http://localhost:8081     # private endpoints
GALLERY_PUBLIC_HOST=http://localhost:8080   # viewer/thumb asset URLs baked into build manifest
```
All `gallery:*` and `prebuild` npm scripts load `.env.builder.dev` automatically via `--env-file`.

## Architecture

### i18n — three locales, file-based routing

- Locales: `en` (default, no prefix), `zh-tw` (`/zh-tw/…`), `zh-cn` (`/zh-cn/…`)
- **Never duplicate page logic.** Every page has one shared component in `src/components/pages/` that accepts a `locale` prop. Route files in `src/pages/` and `src/pages/zh-{tw,cn}/` are 3-line wrappers.
- Translation strings in `src/i18n/{en,zh-tw,zh-cn}.json`. Use `t(locale)` from `src/i18n/utils.ts`.
- Use `localePath(path, locale)` for locale-prefixed hrefs; `getLocaleFromUrl(url)` to detect locale.
- Root `/` is prerendered. Locale detection is client-side in `BaseHead.astro` (defers to `preferred-locale` cookie, then `navigator.languages`).

### Color system — Tailwind v4 with `@theme inline`

Defined in `src/styles/global.css`. Raw CSS variables in `:root` / `.dark` are mapped into Tailwind tokens via `@theme inline` so utilities output `var(…)` and respond to `.dark` at runtime.

Dark mode: add/remove `.dark` on `<html>`. Inline script in `BaseHead.astro` applies it before first paint.

Key token rules:
- `text-accent` / `border-accent` — medium blue, for text/borders on light backgrounds
- `bg-accent-bg` / `bg-accent-dim` — darker blue for filled backgrounds (white text auto-applied via global CSS rule — never add `text-white` manually)
- `bg-highlight` / `bg-highlight-dim` — warm amber fills (also auto-white text)

See `DESIGN.md` for the full palette, typography, component patterns, and layout principles.

### Scroll animations

`src/scripts/scrollAnimations.ts` drives `data-animate` / `data-animate-stagger` attributes via IntersectionObserver. Elements start at `opacity: 0` (gated by `html.js` class applied before paint). Optional `data-opacity="0.5"` settles at sub-1 opacity. `data-animate-on-load-only` skips the observer and fires immediately.

Interactive animations (nav, gallery filters, mobile menu) use **anime.js v4** with spring physics. `prefers-reduced-motion` is respected throughout.

### Content collections

Defined in `src/content.config.ts`:

| Collection | Source | Notes |
|---|---|---|
| `blog` | `src/content/blog/{locale}/*.{md,mdx}` | Locale-prefixed subdirectories; filtered per locale by `getBlogPostsForLocale()` |
| `gallery` | `src/content/gallery/*.{md,mdx}` | Frontmatter: `image`, `category`, `artist`; `image` can be a repo-local path or a remote manifest key |
| `photos` | `src/content/photos/` images | Custom loader (`src/loaders/photosLoader.ts`) — EXIF auto-read via `exifreader`; optional sidecar `.md` overrides `title`, `description`, `location`, `date` |

Gallery entries whose `image` value is a bare logical path (e.g. `gallery-explicit/foo.jpg`) are treated as remote/explicit content resolved through the build manifest.

### Components

- **Astro components** for static structure: `Layout.astro`, `BlogPost.astro`, `BlogCard.astro`, `SiteFooter.astro`, `BaseHead.astro`, `CookieConsent.astro`
- **Vue SFCs** (`client:load`) for interactive islands:
  - `NavBar.vue` — theme toggle (light/system/dark), language switcher, mobile menu
  - `PhotoViewer.vue` — PhotoSwipe lightbox with EXIF overlay; used by both `/photos` and `/gallery`
  - `SocialLinks.vue` — animated social icon row
  - `BlogLightbox.vue` — lightbox for blog post inline images

### Layouts

- `src/layouts/Layout.astro` — base HTML shell; builds locale-prefixed nav links, injects `NavBar.vue`
- `src/layouts/BlogPost.astro` — wraps Layout, adds article header with date and back link

## Adding content

**Blog post** — create `src/content/blog/{locale}/my-post.md` (e.g. `en/`, `zh-tw/`, `zh-cn/`). Frontmatter: `title`, `description`, `pubDate`, optional `heroImage`, `tags`, `draft` (bool). The locale prefix is stripped from URLs by `getBlogSlug()` in `src/lib/blog.ts`.

**Gallery artwork** — create `src/content/gallery/my-art.md` with frontmatter: `title`, `image` (relative asset path or remote manifest key), `date`, `category` (`ref-sheet` | `commission` | `gift-art` | `other`), optional `artist`, `artistUrl`, `featured` (bool), `titleI18n`, `artistI18n`.

**Photo** — drop `photo.jpg` into `src/content/photos/`. EXIF extracted automatically. Optionally create `photo.md` to add `title`, `location`, `description`.
