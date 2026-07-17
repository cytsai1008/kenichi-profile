# Design System: kenichi-profile

## 1. Visual Theme & Atmosphere

Calm, accessible, softly clinical — well-lit personal journal. Palette: cool blue-grays + single warm amber accent for
featured emphasis. Content center stage; chrome muted. Chrome (nav, mobile menu, modal backdrop) uses frosted-glass
(`backdrop-blur`) + near-opaque fills; primary content sits flat and unchromed directly on the page surface — the hero
carries no card, border, or heavy shadow. Weightless feel. Dark mode true dark (near-black `#17181c`), not mere
dimming — switching feels like different room.

Motions intentional, physics-based (anime.js spring curves), never decorative.
`prefers-reduced-motion` first-class concern throughout.

---

## 2. Color Palette & Roles

All colors CSS variables swapping light/dark under `.dark` on `<html>`.
Tailwind outputs `var(…)` at runtime — no static hex baked into build.

### Light mode

| Semantic name                   | Hex       | Role                                                                                     |
| ------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Surface — cool off-white        | `#f3f8fb` | Page background (`bg-surface`)                                                           |
| Surface Alt — pale blue-gray    | `#e8f0f5` | Card/container fills, code inline backgrounds                                            |
| Foreground — dark slate-navy    | `#37424c` | Body text, headings                                                                      |
| Foreground Muted — washed steel | `#70808d` | Captions, dates, secondary labels, `dt` labels                                           |
| Accent — medium steel-blue      | `#6f93af` | Links, icon tints, blockquote left-border, focus rings                                   |
| Accent BG — deeper blue         | `#507392` | Filled interactive surfaces: active nav pills, primary buttons, text selection highlight |
| Accent Dim — deep slate-blue    | `#405d78` | Hover/pressed state on filled `bg-accent-bg` surfaces                                    |
| Highlight — warm amber          | `#d4a84b` | Featured/pinned badge accents, "pin" icon tint                                           |
| Highlight Dim — deeper amber    | `#b88c35` | Hover on highlight-filled surfaces                                                       |
| Border — soft blue-gray         | `#d5e0e8` | All hairline dividers and card outlines                                                  |
| Explicit — desaturated rose     | `#ae5555` | Content-warning text and toggle label                                                    |
| Explicit BG — deep rose         | `#8a3838` | Filled confirm button for explicit toggle                                                |

### Dark mode overrides (same semantic roles)

| Token                     | Dark hex                          |
| ------------------------- | --------------------------------- |
| Surface                   | `#17181c`                         |
| Surface Alt               | `#1f2028`                         |
| Foreground                | `#e5e1db`                         |
| Foreground Muted          | `#948e89`                         |
| Accent                    | `#7ba4c9`                         |
| Accent BG                 | `#4a7aa3`                         |
| Accent Dim                | `#3d6b8f`                         |
| Border                    | `#30323c`                         |
| Explicit                  | `#c47878`                         |
| Explicit BG               | `#7a3232`                         |
| Highlight / Highlight Dim | unchanged (`#d4a84b` / `#b88c35`) |

### Automatic white-text rule

Elements with `bg-accent-bg`, `bg-accent-dim`, `bg-highlight`, or `bg-highlight-dim` (incl. hover + descendants)
auto-get `color: #fff` via global CSS. Never add `text-white` to these.

---

## 3. Typography Rules

### Typefaces

| Token               | Stack                                         | Use                                                                                                         |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `--font-sans`       | Atkinson Hyperlegible → Noto Sans → system-ui | Default body + headings (accessibility-first)                                                               |
| `--font-sans-tc`    | Atkinson Hyperlegible → **Noto Sans TC** → …  | Injected as `--font-sans` when `<html lang="zh-TW">`                                                        |
| `--font-sans-sc`    | Atkinson Hyperlegible → **Noto Sans SC** → …  | Injected as `--font-sans` when `<html lang="zh-CN">`                                                        |
| `--font-noto`       | Noto Sans → system-ui                         | Pure Noto Sans; UI strings needing native script regardless of locale (e.g. "English" in language switcher) |
| `--font-noto-tc`    | Noto Sans TC → Noto Sans → system-ui          | Traditional Chinese UI strings (e.g. "繁體中文" in language switcher)                                       |
| `--font-noto-sc`    | Noto Sans SC → Noto Sans → system-ui          | Simplified Chinese UI strings (e.g. "简体中文" in language switcher)                                        |
| `--font-chiron`     | Chiron GoRound TC                             | Hero display only: `健一 / Kenichi` logotype                                                                |
| `--font-mono-maple` | Maple Mono CN → ui-monospace                  | Inline `code` + fenced code blocks                                                                          |

### Scale & rhythm

- Body: `1.125rem` / `line-height: 1.75` (desktop); `1rem` on viewports < 640 px
- Heading weight: always `700`; line-height `1.25`
- `h1` 2.5 rem → `h5` 1.125 rem (mobile: h1 2 rem, h2 1.5 rem)
- Section labels / `dt` elements: `text-xs font-semibold tracking-[0.18em] uppercase text-fg-muted`
- Hero greeting overline: `text-[clamp(0.8rem,1.8vw,0.95rem)] tracking-[0.2em] uppercase text-accent`
- Logotype: `font-chiron tracking-[0.05em]` (kanji), `tracking-[0.3em]` (romaji subtitle)

### Links

Underlines hidden by default (`text-decoration-color: transparent`), appear on hover via `color 0.2s ease` transition.
Active: `--accent`; hover shifts to `--accent-dim`.

---

## 4. Component Stylings

### Buttons

| Variant                  | Shape                         | Fill                                                             | Text                        |
| ------------------------ | ----------------------------- | ---------------------------------------------------------------- | --------------------------- |
| Primary CTA              | Subtly rounded (`rounded-xl`) | `bg-accent-bg` → `bg-accent-dim` on hover                        | White (auto-applied)        |
| Secondary/Ghost          | Pill (`rounded-full`)         | `bg-surface-alt/55` → `bg-surface-alt` on hover                  | `text-fg`                   |
| Nav — active             | Gently rounded (`rounded-lg`) | `bg-accent-bg` → `bg-accent-dim`                                 | White                       |
| Nav — inactive           | Gently rounded (`rounded-lg`) | transparent → `bg-surface-alt`                                   | `text-fg`                   |
| Filter pill              | Pill (`rounded-full`)         | transparent, `border-border` → filled `bg-accent-bg` when active | `text-fg-muted` → white     |
| Explicit warning         | Pill                          | `border-explicit/50` → `bg-explicit-bg` when active              | `text-explicit/80` → white  |
| Icon button (theme/menu) | Gently rounded (`rounded-lg`) | transparent → `bg-surface-alt`                                   | `text-fg-muted` → `text-fg` |

Sizing: `px-6 py-3` hero CTAs; `px-4 py-1.5` filter pills; `p-1.5` icon buttons.

### Cards

| Type                    | Corner roundness                   | Background              | Border               | Shadow                                          |
| ----------------------- | ---------------------------------- | ----------------------- | -------------------- | ----------------------------------------------- |
| Blog card               | Generously rounded (`rounded-2xl`) | `bg-surface-alt`        | `border-border`      | `hover:shadow-lg`                               |
| Gallery/photo thumbnail | Generously rounded (`rounded-2xl`) | `bg-surface-alt`        | `border-border`      | none                                            |
| About image             | Generously rounded (`rounded-2xl`) | —                       | `ring-1 ring-border` | `shadow-md`                                     |

Image hover: `transition-transform duration-300 group-hover:scale-105` inside `overflow-hidden`.

**Hero is flat, not a card.** Content sits directly on the page surface (`mx-auto max-w-5xl p-7 sm:p-10`) with no
background fill, border, or shadow — deliberately flattened. Max corner radius in use across the site is `rounded-2xl`
(16px); there is no `rounded-3xl`/`rounded-4xl`.

### Navigation bar

Sticky, `border-b border-border bg-surface/60 backdrop-blur-3xl`. Three-column CSS grid: logo left, nav links centered,
controls right (`max-w-5xl`). Active link: filled `bg-accent-bg` pill. Mobile menu: separate frosted panel below bar,
`shadow-lg`.

Theme switcher: compact icon; expands to three-segment pill (Light/System/Dark) on hover via spring. Active segment:
`bg-accent-bg`.

Language switcher: globe icon + hidden label revealed on hover via spring; dropdown from top-right with scale-pop
spring.

### Modals / dialogs

`rounded-2xl border border-border shadow-2xl` box, centered in viewport. Backdrop: `bg-black/50 backdrop-blur-sm`.
Footer uses `bg-surface-alt/60` separated by `border-t border-border`. No full-bleed backgrounds inside modal.

### Prose

Blockquote: `border-l-4 border-accent pl-5 text-fg-muted`.
Code inline: `bg-surface-alt rounded px-1.5`.
Code block: `bg-[#141210]` near-black + `text-[#e8e0d5]` warm cream, `rounded-xl`.
Table rows separated by `border-b` with `color-mix(in srgb, fg-muted 40%, transparent)`.

---

## 5. Layout Principles

- **Max content width:** `max-w-5xl` (64 rem) on all page wrappers + nav — no visual drift between sections.
- **Horizontal padding:** `px-4` outer; `px-7 sm:px-10` inner content areas.
- **Vertical rhythm:** sections `py-12`; hero `pt-14 pb-10 sm:pt-18 sm:pb-20`.
- **Grid system:** responsive — 1 col → `sm:grid-cols-2` → `lg:grid-cols-3`; `gap-4` media grids, `gap-6` text-heavy
  card grids.
- **Scrollbar stability:** `scrollbar-gutter: stable` on `html` reserves scrollbar space, eliminates layout shift
  between long/short pages.
- **Animation entry state:** `[data-animate]` start `opacity: 0` (JS-gated via `html.js`) revealed by
  `scrollAnimations.ts` via IntersectionObserver. `[data-animate-stagger]` staggers children. Targets accept
  `data-opacity="0.5"` etc. for sub-1 opacity settle.
- **Whitespace philosophy:** generous padding inside cards (`p-5`), breathing room between sections; tight internal
  spacing (`gap-1` nav, `space-y-4` definition lists).
