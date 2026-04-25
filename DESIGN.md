# Design System: kenichi-profile

## 1. Visual Theme & Atmosphere

Calm, accessible, and softly clinical — like a well-lit personal journal. The palette is anchored in
cool blue-grays with a single warm amber accent for featured emphasis. Content takes center stage;
chrome is muted and unobtrusive. Surfaces use frosted-glass effects (`backdrop-blur`) and near-opaque
fills rather than heavy shadows, giving the interface a weightless quality. Dark mode is a true
dark (near-black `#17181c`) rather than a mere dimming — switching feels like stepping into a
different room, not lowering the blinds.

Motions are intentional and physics-based (anime.js spring curves), never decorative noise.
`prefers-reduced-motion` is a first-class concern throughout.

---

## 2. Color Palette & Roles

All colors are CSS variables that swap between light and dark under `.dark` on `<html>`.
Tailwind utilities output `var(…)` at runtime — no static hex baked into the build.

### Light mode

| Semantic name | Hex | Role |
|---|---|---|
| Surface — cool off-white | `#f3f8fb` | Page background (`bg-surface`) |
| Surface Alt — pale blue-gray | `#e8f0f5` | Card/container fills, code inline backgrounds |
| Foreground — dark slate-navy | `#37424c` | Body text, headings |
| Foreground Muted — washed steel | `#70808d` | Captions, dates, secondary labels, `dt` labels |
| Accent — medium steel-blue | `#6f93af` | Links, icon tints, blockquote left-border, focus rings |
| Accent BG — deeper blue | `#507392` | Filled interactive surfaces: active nav pills, primary buttons, text selection highlight |
| Accent Dim — deep slate-blue | `#405d78` | Hover/pressed state on filled `bg-accent-bg` surfaces |
| Highlight — warm amber | `#d4a84b` | Featured/pinned badge accents, "pin" icon tint |
| Highlight Dim — deeper amber | `#b88c35` | Hover on highlight-filled surfaces |
| Border — soft blue-gray | `#d5e0e8` | All hairline dividers and card outlines |
| Explicit — desaturated rose | `#ae5555` | Content-warning text and toggle label |
| Explicit BG — deep rose | `#8a3838` | Filled confirm button for explicit toggle |

### Dark mode overrides (same semantic roles)

| Token | Dark hex |
|---|---|
| Surface | `#17181c` |
| Surface Alt | `#1f2028` |
| Foreground | `#e5e1db` |
| Foreground Muted | `#948e89` |
| Accent | `#7ba4c9` |
| Accent BG | `#4a7aa3` |
| Accent Dim | `#3d6b8f` |
| Border | `#30323c` |
| Explicit | `#c47878` |
| Explicit BG | `#7a3232` |
| Highlight / Highlight Dim | unchanged (`#d4a84b` / `#b88c35`) |

### Automatic white-text rule

Any element carrying `bg-accent-bg`, `bg-accent-dim`, `bg-highlight`, or `bg-highlight-dim`
(including on hover and all descendants) automatically receives `color: #fff` via a global CSS rule.
Never add `text-white` to these elements.

---

## 3. Typography Rules

### Typefaces

| Token | Stack | Use |
|---|---|---|
| `--font-sans` | Atkinson Hyperlegible → Noto Sans → system-ui | Default body and headings (accessibility-first) |
| `--font-sans-tc` | Atkinson Hyperlegible → **Noto Sans TC** → … | Injected as `--font-sans` when `<html lang="zh-TW">` |
| `--font-sans-sc` | Atkinson Hyperlegible → **Noto Sans SC** → … | Injected as `--font-sans` when `<html lang="zh-CN">` |
| `--font-noto` | Noto Sans → system-ui | Pure Noto Sans without Atkinson; used for UI strings that must render in native script regardless of page locale (e.g. language switcher "English" label) |
| `--font-noto-tc` | Noto Sans TC → Noto Sans → system-ui | Same as above for Traditional Chinese UI strings (e.g. "繁體中文" in language switcher) |
| `--font-noto-sc` | Noto Sans SC → Noto Sans → system-ui | Same as above for Simplified Chinese UI strings (e.g. "简体中文" in language switcher) |
| `--font-chiron` | Chiron GoRound TC | Hero display only: the `健一 / Kenichi` logotype |
| `--font-mono-maple` | Maple Mono CN → ui-monospace | Inline `code` and fenced code blocks |

### Scale & rhythm

- Body: `1.125rem` / `line-height: 1.75` (desktop); `1rem` on viewports < 640 px
- Heading weight: always `700`; line-height `1.25`
- `h1` 2.5 rem → `h5` 1.125 rem (mobile: h1 2 rem, h2 1.5 rem)
- Section labels / `dt` elements: `text-xs font-semibold tracking-[0.18em] uppercase text-fg-muted`
- Hero greeting overline: `text-[clamp(0.8rem,1.8vw,0.95rem)] tracking-[0.2em] uppercase text-accent`
- Logotype: `font-chiron tracking-[0.05em]` (kanji), `tracking-[0.3em]` (romaji subtitle)

### Links

Underlines are hidden by default (`text-decoration-color: transparent`) and appear on hover via
`color 0.2s ease` transition, sliding the underline in. Active link color is `--accent`; hover
shifts to `--accent-dim`.

---

## 4. Component Stylings

### Buttons

| Variant | Shape | Fill | Text |
|---|---|---|---|
| Primary CTA | Subtly rounded (`rounded-xl`) | `bg-accent-bg` → `bg-accent-dim` on hover | White (auto-applied) |
| Secondary/Ghost | Pill (`rounded-full`) | `bg-surface-alt/55` → `bg-surface-alt` on hover | `text-fg` |
| Nav — active | Gently rounded (`rounded-lg`) | `bg-accent-bg` → `bg-accent-dim` | White |
| Nav — inactive | Gently rounded (`rounded-lg`) | transparent → `bg-surface-alt` | `text-fg` |
| Filter pill | Pill (`rounded-full`) | transparent, `border-border` → filled `bg-accent-bg` when active | `text-fg-muted` → white |
| Explicit warning | Pill | `border-explicit/50` → `bg-explicit-bg` when active | `text-explicit/80` → white |
| Icon button (theme/menu) | Gently rounded (`rounded-lg`) | transparent → `bg-surface-alt` | `text-fg-muted` → `text-fg` |

Sizing: `px-6 py-3` for hero CTAs; `px-4 py-1.5` for filter pills; `p-1.5` for icon buttons.

### Cards

| Type | Corner roundness | Background | Border | Shadow |
|---|---|---|---|---|
| Blog card | Generously rounded (`rounded-2xl`) | `bg-surface-alt` | `border-border` | `hover:shadow-lg` |
| Gallery/photo thumbnail | Generously rounded (`rounded-2xl`) | `bg-surface-alt` | `border-border` | none |
| Hero card | Very large rounded (`rounded-4xl`) | `bg-surface/88` frosted | `border-border/30` | `0 24px 80px rgba(61,53,48,0.08)` warm diffused |
| About image | Generously rounded (`rounded-2xl`) | — | `ring-1 ring-border` | `shadow-md` |

Image hover: `transition-transform duration-300 group-hover:scale-105` inside `overflow-hidden`.

### Navigation bar

Sticky, `border-b border-border bg-surface/60 backdrop-blur-3xl`. Three-column CSS grid: logo
left-aligned, nav links truly centered, controls right-aligned (max-w-5xl). Active link uses
filled `bg-accent-bg` pill. Mobile menu drops below the bar as a separate frosted panel with
`shadow-lg`.

Theme switcher: compact icon normally; expands to a three-segment pill (Light/System/Dark) on
hover using spring animation. Active segment uses `bg-accent-bg` fill.

Language switcher: globe icon + hidden label text revealed on hover via spring animation; dropdown
appears from top-right with a scale-pop spring.

### Modals / dialogs

`rounded-2xl border border-border shadow-2xl` box, centered in viewport. Backdrop:
`bg-black/50 backdrop-blur-sm`. Footer action row uses `bg-surface-alt/60` fill separated
by `border-t border-border`. No full-bleed backgrounds inside the modal box itself.

### Prose

Blockquote: `border-l-4 border-accent pl-5 text-fg-muted`.
Code inline: `bg-surface-alt rounded px-1.5`.
Code block: `bg-[#141210]` near-black with `text-[#e8e0d5]` warm cream, `rounded-xl`.
Table rows separated by `border-b` with `color-mix(in srgb, fg-muted 40%, transparent)`.

---

## 5. Layout Principles

- **Max content width:** `max-w-5xl` (64 rem) on all page wrappers and the nav — content never
  exceeds this boundary, preventing visual drift between sections.
- **Horizontal padding:** `px-4` outer wrapper; `px-7 sm:px-10` for inner content areas on top of
  section containers.
- **Vertical rhythm:** sections use `py-12`; hero is `pt-14 pb-10 sm:pt-18 sm:pb-20`.
- **Grid system:** responsive — 1 col → `sm:grid-cols-2` → `lg:grid-cols-3`; gap `gap-4` for
  media grids, `gap-6` for text-heavy card grids.
- **Scrollbar stability:** `scrollbar-gutter: stable` on `html` reserves scrollbar space on all
  pages, eliminating layout shift when switching between long and short pages.
- **Animation entry state:** `[data-animate]` elements start at `opacity: 0` (JS-gated via
  `html.js` class) and are revealed by `scrollAnimations.ts` using IntersectionObserver.
  `[data-animate-stagger]` staggers child items. Targets can carry `data-opacity="0.5"` etc.
  to settle at sub-1 opacity.
- **Whitespace philosophy:** generous padding inside cards (`p-5`), breathing room between sections;
  tight internal spacing (`gap-1` in nav, `space-y-4` in definition lists).
