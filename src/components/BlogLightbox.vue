<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

interface ImageItem {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

interface Props {
  // Single-image shorthand
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
  // Multi-image mode
  images?: ImageItem[];
}

const props = defineProps<Props>();

const galleryEl = ref<HTMLElement | null>(null);
let lightbox: PhotoSwipeLightbox | null = null;

const items = computed<ImageItem[]>(() => {
  if (props.images?.length) return props.images;
  if (props.src) {
    return [
      {
        src: props.src,
        alt: props.alt,
        width: props.width,
        height: props.height,
        caption: props.caption,
      },
    ];
  }
  return [];
});

const isSingle = computed(() => items.value.length === 1);

onMounted(() => {
  if (!galleryEl.value) return;

  let triggerEl: HTMLElement | null = null;
  galleryEl.value.addEventListener(
    "click",
    (e) => {
      triggerEl = (e.target as HTMLElement).closest<HTMLElement>("[data-pswp]");
    },
    { capture: true }
  );

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl.value,
    children: "[data-pswp]",
    pswpModule: () => import("photoswipe"),
    initialZoomLevel: "fit",
    secondaryZoomLevel: (z) => Math.min(z.fit * 1.8, 1),
    maxZoomLevel: 4,
    wheelToZoom: true,
    returnFocus: false,
    paddingFn: (viewportSize) => {
      const p = viewportSize.x < 768 ? 12 : 24;
      return { top: p, right: p, bottom: viewportSize.x < 768 ? 88 : p, left: p };
    },
  });

  // PhotoSwipe only reads data-pswp-* from <a> elements or their children.
  // Since we use <button>, we must populate itemData manually.
  lightbox.addFilter("itemData", (itemData, index) => {
    const el = galleryEl.value?.querySelectorAll<HTMLElement>("[data-pswp]")[index];
    if (!el) return itemData;
    if (el.dataset.pswpSrc) itemData.src = el.dataset.pswpSrc;
    if (el.dataset.pswpWidth) itemData.w = parseInt(el.dataset.pswpWidth, 10);
    if (el.dataset.pswpHeight) itemData.h = parseInt(el.dataset.pswpHeight, 10);
    const img = el.querySelector("img");
    if (img) {
      itemData.msrc = img.currentSrc || img.src;
      itemData.alt = img.getAttribute("alt") ?? "";
    }
    return itemData;
  });

  lightbox.on("openingAnimationStart", () => {
    const pswpEl = lightbox?.pswp?.element;
    if (!pswpEl) return;

    pswpEl.setAttribute("role", "dialog");
    pswpEl.setAttribute("aria-modal", "true");
    pswpEl.setAttribute("aria-labelledby", "pswp-blog-sr-label");

    let liveRegion = pswpEl.querySelector<HTMLElement>("#pswp-blog-sr-label");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "pswp-blog-sr-label";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.className = "sr-only";
      pswpEl.appendChild(liveRegion);
    }

    const region = liveRegion;
    const announce = () => {
      const idx = lightbox?.pswp?.currIndex ?? 0;
      const item = items.value[idx];
      const parts = [item?.caption, item?.alt].filter(Boolean);
      region.textContent = parts.length ? parts.join(" — ") : "Image viewer";
    };

    announce();
    lightbox?.pswp?.on("change", announce);
  });

  lightbox.on("destroy", () => {
    triggerEl?.focus();
    triggerEl = null;
  });

  lightbox.init();
});

onUnmounted(() => {
  lightbox?.destroy();
  lightbox = null;
});
</script>

<template>
  <div
    ref="galleryEl"
    :class="
      isSingle
        ? 'mx-auto my-6 max-w-[min(100%,36rem)]'
        : 'my-6 grid grid-cols-2 gap-2 sm:grid-cols-3'
    "
  >
    <figure v-for="item in items" :key="item.src" class="m-0">
      <button
        type="button"
        data-pswp
        :data-pswp-src="item.src"
        :data-pswp-width="item.width || undefined"
        :data-pswp-height="item.height || undefined"
        class="block w-full cursor-zoom-in overflow-hidden rounded-lg"
      >
        <img
          :src="item.src"
          :alt="item.alt ?? ''"
          :width="item.width || undefined"
          :height="item.height || undefined"
          loading="lazy"
          class="block h-auto w-full rounded-lg transition-transform duration-300 hover:scale-[1.02]"
        />
      </button>
      <figcaption v-if="item.caption" class="mt-3 text-center text-sm leading-normal text-fg-muted">
        {{ item.caption }}
      </figcaption>
    </figure>
  </div>
</template>
