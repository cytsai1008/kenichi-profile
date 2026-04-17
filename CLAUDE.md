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
- **Never duplicate page logic.** Every page has one shared component in `src/components/pages/` that accepts a `locale` prop. The actual route files in `src/pages/` and `src/pages/zh-{tw,cn}/` are 3-line wrappers that pass the locale.
- Translation strings live in `src/i18n/{en,zh-tw,zh-cn}.json`. Use `t(locale)` from `src/i18n/utils.ts` to get the full typed object.
- Use `localePath(path, locale)` to build locale-prefixed hrefs. Use `getLocaleFromUrl(url)` to detect locale in layouts/components.
- The root path `/` is prerendered. Locale detection happens client-side in `src/components/BaseHead.astro`, which defers to the `preferred-locale` cookie set when the user manually switches language via the NavBar and otherwise checks `navigator.languages`.

### Color system — Tailwind v4 with `@theme inline`

Defined in `src/styles/global.css`:

1. Raw CSS variables in `:root` / `.dark` (e.g. `--surface`, `--fg`, `--accent-bg`)
2. Mapped into Tailwind tokens via `@theme inline` so utilities output `var(…)` and respond to `.dark` at runtime — **not** static hex values.

Dark mode is toggled by adding/removing the `.dark` class on `<html>`. The inline script in `BaseHead.astro` applies it before first paint to prevent flash.

Key token distinction:

- `text-accent` / `border-accent` — the medium blue, for text/borders on light backgrounds
- `bg-accent-bg` / `bg-accent-dim` — the darker blue, for filled backgrounds where white text must be legible (WCAG AA ≥ 4.5:1)
- Filled backgrounds (`.bg-accent-bg`, `.bg-highlight`, etc.) auto-get `color: #fff` via a global CSS rule — no need to add `text-white`.

All page content wrappers use `max-w-5xl` to match the nav, preventing layout shift. `scrollbar-gutter: stable` on `html` prevents the scrollbar-width shift between pages.

### Content collections

Defined in `src/content.config.ts`:

| Collection | Source                           | Notes                                                                                                                                                                                                                                       |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blog`     | `src/content/blog/*.{md,mdx}`    | Standard Astro glob loader                                                                                                                                                                                                                  |
| `gallery`  | `src/content/gallery/*.{md,mdx}` | Artwork; frontmatter includes `image`, `category`, `artist`                                                                                                                                                                                 |
| `photos`   | `src/content/photos/` images     | **Custom loader** (`src/loaders/photosLoader.ts`) — drop image files here and EXIF is read automatically at build time via `exifreader`. Optional sidecar `.md` of the same base name overrides `title`, `description`, `location`, `date`. |

### Components

- **Astro components** for static structure (layouts, cards, footer, head)
- **Vue SFCs** for interactive islands: `NavBar.vue` (theme toggle, language switcher, mobile menu), `PhotoViewer.vue` (PhotoSwipe lightbox with EXIF overlay)
- Interactive Vue components use `client:load`

### Layouts

- `src/layouts/Layout.astro` — base HTML shell; builds locale-prefixed nav links and passes them to `NavBar.vue`
- `src/layouts/BlogPost.astro` — wraps Layout, adds article header with date and back link

## Adding content

**Blog post** — create `src/content/blog/my-post.md` with frontmatter: `title`, `description`, `pubDate`, optional `heroImage`, `tags`.

**Gallery artwork** — create `src/content/gallery/my-art.md` with frontmatter: `title`, `image`, `date`, `category` (`ref-sheet` | `commission` | `gift-art` | `other`), optional `artist`, `artistUrl`.

**Photo** — drop `photo.jpg` into `src/content/photos/`. EXIF is extracted automatically. Optionally create `photo.md` to add `title`, `location`, `description`.
