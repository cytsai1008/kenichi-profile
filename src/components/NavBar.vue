<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { animate, spring, stagger } from "animejs";
import { ChevronDown, Languages, type LucideIcon, Menu, Monitor, Moon, Sun, X } from "@lucide/vue";
import type { Locale } from "../i18n/utils";
import { switchLocalePath, locales } from "../i18n/utils";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: NavLink[];
  locale: Locale;
  currentPath: string;
  themeDarkLabel: string;
  themeLightLabel: string;
  langLabel: string;
}

const props = defineProps<Props>();

/* ─── Reduced motion ─────────────────────────────────────── */
const reducedMotion = ref(false);
onMounted(() => {
  reducedMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
});

/* ─── Theme ─────────────────────────────────────────────── */
type ThemeMode = "system" | "light" | "dark";

const theme = ref<ThemeMode>("system");

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

onMounted(() => {
  const stored = localStorage.getItem("theme") as ThemeMode | null;
  theme.value = stored ?? "system";
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (theme.value === "system") applyTheme("system");
  });
});

function setTheme(mode: ThemeMode) {
  theme.value = mode;
  localStorage.setItem("theme", mode);
  applyTheme(mode);
}

const themeOptions: { mode: ThemeMode; icon: LucideIcon; label: string }[] = [
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "system", icon: Monitor, label: "System" },
  { mode: "dark", icon: Moon, label: "Dark" },
];

const activeTheme = computed(() => themeOptions.find((o) => o.mode === theme.value)!);

function cycleTheme() {
  const order: ThemeMode[] = ["light", "system", "dark"];
  const idx = order.indexOf(theme.value);
  setTheme(order[(idx + 1) % order.length]);
}

/* ─── Theme hover reveal ─────────────────────────────────── */
const themeCompact = ref<HTMLElement | null>(null);
const themePanel = ref<HTMLElement | null>(null);
const themeHovered = ref(false);

function showTheme() {
  if (themeHovered.value) return;
  themeHovered.value = true;

  if (reducedMotion.value) {
    if (themeCompact.value) {
      themeCompact.value.style.opacity = "0";
      themeCompact.value.style.pointerEvents = "none";
    }
    if (themePanel.value) {
      themePanel.value.style.opacity = "1";
      themePanel.value.style.pointerEvents = "auto";
    }
    return;
  }
  if (themeCompact.value) {
    animate(themeCompact.value, {
      opacity: { from: 1, to: 0 },
      scale: { from: 1, to: 0.7 },
      x: { from: 0, to: -4 },
      duration: 160,
      ease: "in(3)",
    });
  }
  if (themePanel.value) {
    themePanel.value.style.pointerEvents = "auto";
    animate(themePanel.value, {
      opacity: { from: 0, to: 1 },
      scale: { from: 0.75, to: 1 },
      x: { from: 12, to: 0 },
      ease: spring({ bounce: 0.45 }),
    });
  }
}

function hideTheme() {
  if (!themeHovered.value) return;
  themeHovered.value = false;

  if (reducedMotion.value) {
    if (themeCompact.value) {
      themeCompact.value.style.opacity = "1";
      themeCompact.value.style.pointerEvents = "";
    }
    if (themePanel.value) {
      themePanel.value.style.opacity = "0";
      themePanel.value.style.pointerEvents = "none";
    }
    return;
  }
  if (themeCompact.value) {
    animate(themeCompact.value, {
      opacity: { from: 0, to: 1 },
      scale: { from: 0.7, to: 1 },
      x: { from: -4, to: 0 },
      ease: spring({ bounce: 0.4 }),
    });
  }
  if (themePanel.value) {
    const panel = themePanel.value;
    animate(panel, {
      opacity: { from: 1, to: 0 },
      scale: { from: 1, to: 0.8 },
      x: { from: 0, to: 10 },
      duration: 200,
      ease: "in(3)",
      onComplete() {
        panel.style.pointerEvents = "none";
      },
    });
  }
}

/* ─── Lang text hover reveal ─────────────────────────────── */
const langText = ref<HTMLElement | null>(null);
const langHovered = ref(false);

function showLangText() {
  if (langHovered.value) return;
  // The text is sm:inline only — skip on mobile where it should stay hidden
  if (window.innerWidth < 640) return;
  langHovered.value = true;

  if (langText.value) {
    langText.value.style.display = "inline";
    if (reducedMotion.value) {
      langText.value.style.opacity = "1";
      return;
    }
    animate(langText.value, {
      opacity: { from: 0, to: 1 },
      x: { from: -10, to: 0 },
      ease: spring({ bounce: 0.4 }),
    });
  }
}

function hideLangText() {
  if (!langHovered.value) return;
  langHovered.value = false;
  if (langOpen.value) return; // keep text visible while dropdown is open

  if (langText.value) {
    const el = langText.value;
    if (reducedMotion.value) {
      el.style.opacity = "0";
      el.style.display = "none";
      return;
    }
    animate(el, {
      opacity: { from: 1, to: 0 },
      x: { from: 0, to: -8 },
      duration: 180,
      ease: "in(3)",
      onComplete() {
        el.style.display = "none";
      },
    });
  }
}

/* ─── Mobile menu ────────────────────────────────────────── */
const menuOpen = ref(false);
const hamburgerRef = ref<HTMLButtonElement | null>(null);
const firstMenuLinkRef = ref<HTMLAnchorElement | null>(null);
const mobileMenuRef = ref<HTMLElement | null>(null);

watch(menuOpen, async (open) => {
  if (open) {
    closeLangDropdown();
    menuOpenedAt = Date.now();
  }

  await nextTick();
  const el = mobileMenuRef.value;
  if (!el) return;

  if (open) {
    firstMenuLinkRef.value?.focus();
    el.style.display = "";

    if (reducedMotion.value) return;

    // Panel springs down with a scale pop
    animate(el, {
      opacity: [0, 1],
      translateY: [-24, 0],
      scale: [0.93, 1],
      ease: spring({ stiffness: 260, damping: 18, mass: 0.85 }),
    });

    // Nav items fly in from the left, staggered
    const rows = el.querySelectorAll<HTMLElement>("li, .mobile-menu-controls");
    animate(rows, {
      opacity: [0, 1],
      translateX: [-22, 0],
      ease: spring({ stiffness: 340, damping: 24 }),
      delay: stagger(55, { start: 80 }),
    });
  } else {
    hamburgerRef.value?.focus();

    if (reducedMotion.value) {
      el.style.display = "none";
      return;
    }

    animate(el, {
      opacity: [1, 0],
      translateY: [0, -18],
      scale: [1, 0.93],
      duration: 200,
      ease: "in(3)",
      onComplete() {
        el.style.display = "none";
      },
    });
  }
});

/* ─── Hamburger icon transition hooks ───────────────────── */
function onIconEnter(el: Element, done: () => void) {
  if (reducedMotion.value) {
    done();
    return;
  }
  animate(el as HTMLElement, {
    opacity: [0, 1],
    rotate: [-30, 0],
    duration: 200,
    ease: "out(3)",
    onComplete: done,
  });
}

function onIconLeave(el: Element, done: () => void) {
  if (reducedMotion.value) {
    done();
    return;
  }
  animate(el as HTMLElement, {
    opacity: [1, 0],
    rotate: [0, 30],
    duration: 150,
    ease: "in(3)",
    onComplete: done,
  });
}

function handleOutsideClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest("[data-navbar]")) {
    menuOpen.value = false;
    closeLangDropdown();
  }
}

let menuOpenedAt = 0;

function handleScroll() {
  // Ignore the incidental scroll that mobile browsers fire during the tap that opened the menu
  if (Date.now() - menuOpenedAt < 350) return;
  menuOpen.value = false;
  closeLangDropdown();
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
  window.addEventListener("scroll", handleScroll, { passive: true });
});
onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
  window.removeEventListener("scroll", handleScroll);
});

/* ─── Language switcher ──────────────────────────────────── */
const langOpen = ref(false);
const langBtnRef = ref<HTMLButtonElement | null>(null);
const langListRef = ref<HTMLUListElement | null>(null);

function handleLangKeydown(e: KeyboardEvent) {
  if (!langOpen.value) return;
  const items = langListRef.value?.querySelectorAll<HTMLButtonElement>("button[role='option']");
  if (!items?.length) return;
  const idx = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);

  if (e.key === "Escape") {
    e.preventDefault();
    closeLangDropdown();
    langBtnRef.value?.focus();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    items[(idx + 1) % items.length].focus();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    items[(idx - 1 + items.length) % items.length].focus();
  } else if (e.key === "Tab") {
    closeLangDropdown();
  }
}

const localeLabels: Record<string, string> = {
  en: "English",
  "zh-tw": "繁體中文",
  "zh-cn": "简体中文",
};

function closeLangDropdown() {
  langOpen.value = false;
  // On mobile the watch(langOpen) owns text visibility — skip here to avoid double-animation.
  // On desktop, hide the text now if the cursor has already left the wrapper.
  if (window.innerWidth >= 640 && !langHovered.value && langText.value) {
    const el = langText.value;
    animate(el, {
      opacity: { from: 1, to: 0 },
      x: { from: 0, to: -8 },
      duration: 180,
      ease: "in(3)",
      onComplete() {
        el.style.display = "none";
      },
    });
  }
}

/* ─── Lang dropdown animation ────────────────────────────── */
watch(langOpen, async (open) => {
  if (open) menuOpen.value = false;

  // On mobile the text label is hover-hidden; tie its visibility to the dropdown state instead
  const isMobile = window.innerWidth < 640;
  if (isMobile && langText.value) {
    const txt = langText.value;
    if (open) {
      txt.style.display = "inline";
      if (!reducedMotion.value) {
        animate(txt, { opacity: [0, 1], x: [-10, 0], ease: spring({ bounce: 0.4 }) });
      } else {
        txt.style.opacity = "1";
      }
    } else {
      if (!reducedMotion.value) {
        animate(txt, {
          opacity: [1, 0],
          x: [0, -8],
          duration: 180,
          ease: "in(3)",
          onComplete() {
            txt.style.display = "none";
          },
        });
      } else {
        txt.style.opacity = "0";
        txt.style.display = "none";
      }
    }
  }

  await nextTick();
  const el = langListRef.value;
  if (!el) return;

  if (open) {
    el.style.display = "";
    el.style.transformOrigin = "top right";

    if (reducedMotion.value) return;

    // Dropdown pops open from the top-right corner
    animate(el, {
      opacity: [0, 1],
      scale: [0.78, 1],
      translateY: [-8, 0],
      ease: spring({ stiffness: 440, damping: 22, mass: 0.55 }),
    });

    // Options slide in from the right, staggered
    const items = el.querySelectorAll<HTMLElement>("li");
    animate(items, {
      opacity: [0, 1],
      translateX: [10, 0],
      ease: spring({ stiffness: 500, damping: 30 }),
      delay: stagger(50, { start: 55 }),
    });
  } else {
    if (reducedMotion.value) {
      el.style.display = "none";
      return;
    }

    animate(el, {
      opacity: [1, 0],
      scale: [1, 0.84],
      translateY: [0, -6],
      duration: 160,
      ease: "in(3)",
      onComplete() {
        el.style.display = "none";
      },
    });
  }
});

function switchLang(targetLocale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `preferred-locale=${targetLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;
  try {
    window.location.href = switchLocalePath(new URL(window.location.href), targetLocale);
  } catch {
    window.location.href = "/";
  }
  closeLangDropdown();
}

/* ─── Active link ────────────────────────────────────────── */
function isActive(href: string) {
  const p = props.currentPath;
  if (href === "/" || href === "/zh-tw/" || href === "/zh-cn/")
    return p === href || p === href.replace(/\/$/, "");
  return p.startsWith(href);
}
</script>

<template>
  <div data-navbar class="sticky top-0 z-50">
    <header class="w-full border-b border-border bg-surface/60 backdrop-blur-3xl transition-colors">
      <!-- CSS grid: logo | links | controls — links are always truly centered -->
      <nav
        class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:grid"
        style="grid-template-columns: 1fr auto 1fr"
        aria-label="Main navigation"
      >
        <!-- Col 1: Logo (left-aligned) -->
        <a
          href="/"
          class="inline-flex w-fit shrink-0 items-center gap-2 text-lg font-bold text-fg no-underline transition-opacity md:justify-self-start"
        >
          <span class="text-accent">健一</span>
          <span class="hidden text-fg-muted sm:inline">Kenichi</span>
        </a>

        <!-- Col 2: Desktop links (centered) -->
        <ul class="m-0 hidden list-none items-center gap-1 p-0 md:flex">
          <li v-for="link in links" :key="link.href">
            <a
              :href="link.href"
              :aria-current="isActive(link.href) ? 'page' : undefined"
              class="rounded-lg px-3 py-1.5 text-sm font-medium no-underline transition-colors"
              :class="
                isActive(link.href)
                  ? 'bg-accent-bg hover:bg-accent-dim'
                  : 'text-fg hover:bg-surface-alt'
              "
            >
              {{ link.label }}
            </a>
          </li>
        </ul>

        <!-- Col 3: Controls (right-aligned) -->
        <div class="flex items-center justify-end gap-1">
          <!-- Theme wrapper: compact icon always visible; full panel absolute on hover -->
          <div
            class="relative -my-3 hidden items-center py-3 md:flex"
            :class="themeHovered ? '-ml-28 pl-28' : '-ml-8 pl-8'"
            @mouseenter="showTheme"
            @mouseleave="hideTheme"
          >
            <!-- Compact: active icon, always visible, fades out on hover -->
            <button
              ref="themeCompact"
              class="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-surface-alt hover:text-fg"
              :aria-label="activeTheme.label"
              @click="cycleTheme"
            >
              <component :is="activeTheme.icon" :size="16" />
            </button>

            <!-- Full panel: absolute right-aligned, fades in on hover -->
            <div
              ref="themePanel"
              class="absolute right-0 flex items-center overflow-hidden rounded-lg border border-border"
              style="opacity: 0; pointer-events: none"
              role="group"
              aria-label="Theme"
            >
              <button
                v-for="opt in themeOptions"
                :key="opt.mode"
                class="p-1.5 transition-colors"
                :class="
                  theme === opt.mode
                    ? 'bg-accent-bg text-white'
                    : 'text-fg-muted hover:bg-surface-alt hover:text-fg'
                "
                :aria-label="opt.label"
                :aria-pressed="theme === opt.mode"
                @click="setTheme(opt.mode)"
              >
                <component :is="opt.icon" :size="16" />
              </button>
            </div>
          </div>

          <!-- Language switcher -->
          <div class="relative" @mouseenter="showLangText" @mouseleave="hideLangText">
            <button
              ref="langBtnRef"
              class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-alt"
              :aria-label="langLabel"
              :aria-expanded="langOpen"
              aria-haspopup="listbox"
              @click.stop="langOpen ? closeLangDropdown() : (langOpen = true)"
              @keydown="handleLangKeydown"
            >
              <Languages :size="16" class="text-fg-muted" />
              <!-- Text hidden by default, revealed on controls hover -->
              <span
                ref="langText"
                class="hidden overflow-hidden whitespace-nowrap sm:inline"
                :class="
                  locale === 'zh-tw'
                    ? 'font-noto-tc'
                    : locale === 'zh-cn'
                      ? 'font-noto-sc'
                      : 'font-noto'
                "
                style="display: none; opacity: 0"
              >
                {{ localeLabels[locale] }}
              </span>
              <ChevronDown
                :size="14"
                class="transition-transform"
                :class="langOpen ? 'rotate-180' : ''"
              />
            </button>

            <!-- Invisible bridge: fills the mt-1 gap so mouseleave doesn't fire mid-travel -->
            <div class="absolute inset-x-0 top-full h-2" />

            <ul
              ref="langListRef"
              role="listbox"
              :aria-label="langLabel"
              class="absolute right-0 z-70 m-0 mt-2 w-36 list-none rounded-xl border border-border bg-surface p-1 shadow-lg"
              style="display: none"
              @keydown="handleLangKeydown"
            >
              <li v-for="loc in locales" :key="loc">
                <button
                  role="option"
                  :aria-selected="loc === locale"
                  class="w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-alt"
                  :class="[
                    loc === locale ? 'font-semibold text-accent' : 'text-fg',
                    loc === 'zh-tw'
                      ? 'font-noto-tc'
                      : loc === 'zh-cn'
                        ? 'font-noto-sc'
                        : 'font-noto',
                  ]"
                  @click="switchLang(loc)"
                >
                  {{ localeLabels[loc] }}
                </button>
              </li>
            </ul>
          </div>

          <!-- Hamburger (mobile only) -->
          <button
            ref="hamburgerRef"
            class="rounded-lg p-2 text-fg transition-colors hover:bg-surface-alt md:hidden"
            :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
            :aria-expanded="menuOpen"
            aria-controls="mobile-menu"
            @click.stop="menuOpen = !menuOpen"
          >
            <span class="relative block h-5 w-5">
              <Transition :css="false" @enter="onIconEnter" @leave="onIconLeave">
                <X v-if="menuOpen" :key="'close'" :size="20" class="absolute inset-0" />
                <Menu v-else :key="'open'" :size="20" class="absolute inset-0" />
              </Transition>
            </span>
          </button>
        </div>
      </nav>
    </header>

    <!-- Mobile menu -->
    <div
      id="mobile-menu"
      ref="mobileMenuRef"
      class="absolute inset-x-0 top-full z-60 border-b border-border bg-surface/60 px-4 pb-4 shadow-lg backdrop-blur-3xl md:hidden"
      style="display: none"
    >
      <ul class="m-0 flex list-none flex-col gap-1 p-0 pt-3">
        <li v-for="(link, i) in links" :key="link.href">
          <a
            :ref="
              i === 0
                ? (el) => {
                    firstMenuLinkRef = el as HTMLAnchorElement;
                  }
                : undefined
            "
            :href="link.href"
            :aria-current="isActive(link.href) ? 'page' : undefined"
            class="block rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors"
            :class="
              isActive(link.href)
                ? 'bg-accent-bg hover:bg-accent-dim'
                : 'text-fg hover:bg-surface-alt'
            "
            @click="menuOpen = false"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>

      <!-- Theme + lang in mobile menu (always fully visible) -->
      <div
        class="mobile-menu-controls mt-3 flex items-center justify-between border-t border-border pt-3"
      >
        <div
          class="flex items-center overflow-hidden rounded-lg border border-border"
          role="group"
          aria-label="Theme"
        >
          <button
            v-for="opt in themeOptions"
            :key="opt.mode"
            class="p-1.5 transition-colors"
            :class="
              theme === opt.mode
                ? 'bg-accent-bg text-white'
                : 'text-fg-muted hover:bg-surface-alt hover:text-fg'
            "
            :aria-label="opt.label"
            :aria-pressed="theme === opt.mode"
            @click="setTheme(opt.mode)"
          >
            <component :is="opt.icon" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
