<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Pin } from "@lucide/vue";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

export interface PhotoItem {
  src: string;
  downloadSrc?: string;
  width: number;
  height: number;
  alt: string;
  thumb: string;
  title?: string;
  subtitle?: string;
  subtitleUrl?: string;
  featured?: boolean;
  category?: string;
  creator?: string;
  creatorUrl?: string;
  exif?: {
    camera?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutter?: string;
    iso?: string;
    date?: string;
  };
  exifLabels?: {
    camera: string;
    lens: string;
    focalLength: string;
    aperture: string;
    shutter: string;
    iso: string;
    date: string;
  };
}

interface Props {
  photos: PhotoItem[];
  downloadLabel?: string;
  closeLabel?: string;
  zoomLabel?: string;
  prevLabel?: string;
  nextLabel?: string;
  creatorLabel?: string;
  showDownloadButton?: boolean;
  showExifPanel?: boolean;
  itemClass?: string;
  alwaysShowText?: boolean;
  disableHoverZoom?: boolean;
  thumbClass?: string;
  placeholderSrc?: boolean;
}

const props = defineProps<Props>();
const galleryEl = ref<HTMLElement | null>(null);
const masonryReady = ref(false);
const pressedPhoto = ref<string | null>(null);
let lightbox: PhotoSwipeLightbox | null = null;
let resizeObserver: ResizeObserver | null = null;

function getLightboxElements() {
  return Array.from(galleryEl.value?.querySelectorAll<HTMLElement>("[data-pswp]") ?? []);
}

function getPhotoByElement(element: HTMLElement | null | undefined) {
  const src = element?.dataset.pswpSrc;
  return src ? props.photos.find((photo) => photo.src === src) : undefined;
}

function getLightboxPhotos() {
  const photos = getLightboxElements()
    .map((element) => getPhotoByElement(element))
    .filter((photo): photo is PhotoItem => Boolean(photo));

  return photos.length ? photos : props.photos;
}

function updateMasonryLayout() {
  if (!props.alwaysShowText || !galleryEl.value) return;

  const styles = window.getComputedStyle(galleryEl.value);
  const rowGap = Number.parseFloat(styles.getPropertyValue("row-gap")) || 0;
  const columnGap = Number.parseFloat(styles.getPropertyValue("column-gap")) || rowGap;
  const columns = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2;
  const containerWidth = galleryEl.value.clientWidth;
  if (!containerWidth || columns <= 0) return;

  const columnWidth = (containerWidth - columnGap * (columns - 1)) / columns;
  const columnHeights = Array(columns).fill(0);
  const visibleItems = Array.from(galleryEl.value.children).filter(
    (item) => (item as HTMLElement).offsetParent !== null
  ) as HTMLElement[];

  visibleItems.forEach((element, index) => {
    const column = index % columns;
    const x = column * (columnWidth + columnGap);
    const y = columnHeights[column];

    element.style.position = "absolute";
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.width = `${columnWidth}px`;
    element.style.gridRowEnd = "";

    const height = element.offsetHeight;
    columnHeights[column] += height + rowGap;
  });

  Array.from(galleryEl.value.children).forEach((item) => {
    const element = item as HTMLElement;
    if (element.offsetParent !== null) return;
    element.style.position = "";
    element.style.left = "";
    element.style.top = "";
    element.style.width = "";
  });

  galleryEl.value.style.height = `${Math.max(0, ...columnHeights.map((value) => value - rowGap))}px`;
}

async function syncMasonryLayout() {
  await nextTick();

  const isFirstMasonry = props.alwaysShowText && !masonryReady.value;

  if (isFirstMasonry && galleryEl.value) {
    // Items already start at opacity:0 via the :style binding (!masonryReady),
    // so they are invisible in the SSR HTML before JS runs — no flash.
    masonryReady.value = true;
    await nextTick(); // wait for Vue to apply photo-viewer-masonry class

    const items = Array.from(galleryEl.value.children) as HTMLElement[];

    updateMasonryLayout();

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && items.length) {
      // CSS keyframe animations are used here because:
      // - animejs races with Vue's re-render microtask and never reliably fires
      // - CSS transitions require observing a "from→to" state change across paint
      //   cycles, which double-rAF doesn't guarantee
      // CSS animations fire as soon as the property is applied; fill-mode:both
      // holds the `from` state (opacity:0) during the delay, so pre-hidden items
      // stay hidden until their turn without any extra timing tricks.
      items.forEach((el, i) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.animation = `masonry-fade-in 0.48s ease-out ${i * 40}ms both`;
        htmlEl.addEventListener(
          "animationend",
          () => {
            htmlEl.style.animation = "";
            htmlEl.style.opacity = "1";
          },
          { once: true }
        );
      });
    } else {
      items.forEach((el) => {
        (el as HTMLElement).style.opacity = "";
      });
    }
  } else {
    updateMasonryLayout();
  }

  if (!props.alwaysShowText || !galleryEl.value || !resizeObserver) return;

  resizeObserver.disconnect();
  Array.from(galleryEl.value.children).forEach((item) => {
    resizeObserver?.observe(item);
  });
}

function formatExifDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;

  return new Intl.DateTimeFormat(navigator.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

onMounted(() => {
  if (!galleryEl.value) return;

  resizeObserver = new ResizeObserver(() => {
    updateMasonryLayout();
  });

  void syncMasonryLayout();
  window.addEventListener("resize", updateMasonryLayout);

  // Track which gallery button triggered the open so we can reliably restore
  // focus on close — screen readers activate via virtual cursor without always
  // updating document.activeElement, so PhotoSwipe's built-in returnFocus fails.
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
    secondaryZoomLevel: (zoomLevel) => Math.min(zoomLevel.fit * 1.8, 1),
    maxZoomLevel: 4,
    preload: [2, 3],
    wheelToZoom: true,
    returnFocus: false,
    closeTitle: props.closeLabel ?? "Close",
    zoomTitle: props.zoomLabel ?? "Zoom",
    arrowPrevTitle: props.prevLabel ?? "Previous",
    arrowNextTitle: props.nextLabel ?? "Next",
    paddingFn: (viewportSize) => {
      const edgePadding = viewportSize.x < 768 ? 12 : 24;
      const bottomPadding = viewportSize.x < 768 ? 88 : 24;

      return {
        top: edgePadding,
        right: edgePadding,
        bottom: bottomPadding,
        left: edgePadding,
      };
    },
  });

  lightbox.on("openingAnimationStart", () => {
    lightbox?.pswp?.element?.classList.add("pswp--opening");

    const pswpEl = lightbox?.pswp?.element;
    if (!pswpEl) return;

    // Mark as modal dialog so screen readers announce it correctly
    pswpEl.setAttribute("role", "dialog");
    pswpEl.setAttribute("aria-modal", "true");
    pswpEl.setAttribute("aria-labelledby", "pswp-sr-label");

    // Visually hidden live region — announces current photo on open and slide change
    let liveRegion = pswpEl.querySelector<HTMLElement>("#pswp-sr-label");
    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "pswp-sr-label";
      liveRegion.setAttribute("aria-live", "polite");
      liveRegion.className = "sr-only";
      pswpEl.appendChild(liveRegion);
    }

    const region = liveRegion;
    const announce = () => {
      const data = getLightboxPhotos()[lightbox?.pswp?.currIndex ?? 0];
      const parts = [data?.title, data?.alt].filter(Boolean);
      region.textContent = parts.length ? parts.join(" — ") : "Photo viewer";
    };

    announce();
    lightbox?.pswp?.on("change", announce);
  });

  lightbox.on("openingAnimationEnd", () => {
    lightbox?.pswp?.element?.classList.remove("pswp--opening");
  });
  lightbox.on("closingAnimationStart", () => {
    lightbox?.pswp?.element?.classList.add("pswp--opening");
  });
  lightbox.on("destroy", () => {
    lightbox?.pswp?.element?.classList.remove("pswp--opening");
    triggerEl?.focus();
    triggerEl = null;
  });

  // Inject EXIF panel into PhotoSwipe UI
  lightbox.on("uiRegister", () => {
    if (props.showDownloadButton) {
      lightbox!.pswp!.ui!.registerElement({
        name: "download-button",
        order: 8,
        isButton: true,
        tagName: "a",
        appendTo: "bar",
        title: props.downloadLabel ?? "Download photo",
        html: {
          isCustomSVG: true,
          inner:
            '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 16l6 6.1 6-6.1ZM23 23H9v2h14Z" id="pswp__icn-download"/>',
          outlineID: "pswp__icn-download",
        },
        onInit: (el, pswp) => {
          const updateDownloadLink = () => {
            const data = getLightboxPhotos()[pswp.currIndex];
            const downloadUrl = data?.downloadSrc ?? data?.src;
            if (!downloadUrl) {
              el.removeAttribute("href");
              el.removeAttribute("download");
              return;
            }

            el.setAttribute("href", downloadUrl);
            el.setAttribute("download", "");
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener");
          };

          updateDownloadLink();
          pswp.on("change", updateDownloadLink);
        },
      });
    }

    lightbox!.pswp!.ui!.registerElement({
      name: "info-panel",
      order: 9,
      isButton: false,
      appendTo: "root",
      html: "",
      onInit: (el, pswp) => {
        const updateInfoPanel = () => {
          const slide = pswp.currSlide;
          if (!slide) return;
          const data = getLightboxPhotos()[pswp.currIndex];
          const hasExif = Boolean(
            props.showExifPanel && data?.exif && Object.values(data.exif).some(Boolean)
          );
          const hasCreator = Boolean(data?.creator);

          if (!hasExif && !hasCreator) {
            el.innerHTML = "";
            el.removeAttribute("data-show");
            return;
          }

          const rows = hasExif
            ? [
                ["camera", data!.exif!.camera],
                ["lens", data!.exif!.lens],
                ["focalLength", data!.exif!.focalLength],
                ["aperture", data!.exif!.aperture],
                ["shutter", data!.exif!.shutter],
                ["iso", data!.exif!.iso],
                ["date", formatExifDate(data!.exif!.date)],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => {
                  const labels = data!.exifLabels;
                  return `<tr><td class="pswp-exif-key">${labels ? labels[k as keyof typeof labels] : k}</td><td class="pswp-exif-val">${v}</td></tr>`;
                })
                .join("")
            : `<tr><td class="pswp-exif-key">${props.creatorLabel ?? "Creator"}</td><td class="pswp-exif-val">${
                data!.creatorUrl
                  ? `<a class="pswp-info-link" href="${data!.creatorUrl}" target="_blank" rel="noopener noreferrer">${data!.creator}</a>`
                  : data!.creator
              }</td></tr>`;

          el.innerHTML = `<div class="pswp-exif-wrap"><table>${rows}</table></div>`;
          el.setAttribute("data-show", "1");
        };

        updateInfoPanel();
        pswp.on("change", updateInfoPanel);
      },
    });
  });

  // At the moment a photo is opened, inject naturalWidth/naturalHeight from the
  // already-loaded thumbnail <img>. This runs before PhotoSwipe calculates zoom,
  // so it always has the correct intrinsic dimensions regardless of EXIF or timing.
  lightbox.addFilter("itemData", (itemData, index) => {
    // Always read src from data-pswp-src — prevents PhotoSwipe from accidentally
    // picking up a child <a> (e.g. creator link) as the image src
    const el = getLightboxElements()[index];
    if (el?.dataset.pswpSrc) {
      itemData.src = el.dataset.pswpSrc;
    }

    const activePhoto = getPhotoByElement(el);
    if (activePhoto) {
      itemData.w = activePhoto.width;
      itemData.h = activePhoto.height;
      itemData.alt = activePhoto.alt;
    }

    const img = el?.querySelector<HTMLImageElement>("img");
    if (
      img?.naturalWidth &&
      img.naturalHeight &&
      (!itemData.w ||
        !itemData.h ||
        img.naturalWidth > itemData.w ||
        img.naturalHeight > itemData.h)
    ) {
      itemData.w = img.naturalWidth;
      itemData.h = img.naturalHeight;
    }
    return itemData;
  });

  lightbox.addFilter("placeholderSrc", (placeholderSrc) => {
    return !props.placeholderSrc ? false : placeholderSrc;
  });

  lightbox.addFilter("useContentPlaceholder", (usePlaceholder) => {
    return !props.placeholderSrc ? false : usePlaceholder;
  });

  lightbox.init();
});

watch(
  () => props.photos,
  () => {
    void syncMasonryLayout();
  },
  { deep: true, flush: "post" }
);

onUnmounted(() => {
  window.removeEventListener("resize", updateMasonryLayout);
  resizeObserver?.disconnect();
  resizeObserver = null;
  lightbox?.destroy();
  lightbox = null;
});
</script>

<template>
  <div
    ref="galleryEl"
    data-animate-stagger
    class="photo-viewer-root"
    :class="
      props.alwaysShowText && masonryReady
        ? 'photo-viewer-masonry'
        : 'grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4'
    "
  >
    <button
      v-for="photo in photos"
      :key="photo.src"
      type="button"
      v-bind="{
        ...(!props.alwaysShowText ? { 'data-animate': '' } : {}),
        ...(photo.width && photo.height
          ? { 'data-pswp-width': photo.width, 'data-pswp-height': photo.height }
          : {}),
      }"
      data-pswp
      :data-pswp-src="photo.src"
      :data-pswp-msrc="photo.thumb"
      :data-cropped="true"
      :data-category="photo.category"
      class="group block overflow-hidden rounded-lg bg-surface-alt transition-transform duration-150"
      :class="[props.itemClass, props.alwaysShowText ? 'cursor-pointer text-left' : 'relative']"
      :style="[
        props.alwaysShowText ? undefined : 'aspect-ratio: 1 / 1',
        pressedPhoto === photo.src ? { scale: '0.97' } : {},
        props.alwaysShowText && !masonryReady ? { opacity: 0 } : {},
      ]"
      @pointerdown="pressedPhoto = photo.src"
      @pointerup="pressedPhoto = null"
      @pointercancel="pressedPhoto = null"
      @pointerleave="pressedPhoto = null"
    >
      <!-- image container -->
      <div class="relative overflow-hidden">
        <img
          :src="photo.thumb"
          :alt="photo.alt"
          :width="props.alwaysShowText && photo.width ? photo.width : undefined"
          :height="props.alwaysShowText && photo.height ? photo.height : undefined"
          loading="lazy"
          class="block w-full transition-transform duration-300"
          :class="[props.thumbClass, !props.disableHoverZoom && 'group-hover:scale-105']"
          :style="props.alwaysShowText ? 'height: auto' : 'height: 100%; object-fit: cover'"
        />
        <!-- hover overlay for non-alwaysShowText mode -->
        <div
          v-if="!props.alwaysShowText"
          class="absolute inset-0 flex items-end bg-linear-to-t from-black/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <div v-if="photo.title || photo.subtitle" class="space-y-0.5">
            <p v-if="photo.title" class="text-sm leading-tight font-medium text-white">
              {{ photo.title }}
            </p>
            <p v-if="photo.subtitle" class="text-xs leading-tight text-white/80">
              <a
                v-if="photo.subtitleUrl"
                :href="photo.subtitleUrl"
                class="underline decoration-white/50 underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
                @mousedown.stop
                @pointerdown.stop
                >{{ photo.subtitle }}</a
              >
              <template v-else>{{ photo.subtitle }}</template>
            </p>
          </div>
        </div>
      </div>

      <!-- caption below image for alwaysShowText mode -->
      <div v-if="props.alwaysShowText && (photo.title || photo.subtitle)" class="space-y-0.5 p-3">
        <p
          v-if="photo.title"
          class="flex items-start gap-1.5 text-sm leading-tight font-medium text-fg"
        >
          <Pin
            v-if="photo.featured"
            :size="14"
            aria-hidden="true"
            class="mt-0.5 shrink-0 text-highlight-dim"
          />
          {{ photo.title }}
        </p>
        <p v-if="photo.subtitle" class="text-xs leading-tight text-fg-muted">
          <a
            v-if="photo.subtitleUrl"
            :href="photo.subtitleUrl"
            class="-my-1.5 -mr-2 inline-block py-1.5 pr-2 underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
            @mousedown.stop
            @pointerdown.stop
            >{{ photo.subtitle }}</a
          >
          <template v-else>{{ photo.subtitle }}</template>
        </p>
      </div>
    </button>
  </div>
</template>

<style>
.photo-viewer-masonry {
  position: relative;
  width: 100%;
  min-height: 1px;
  column-gap: 0.75rem;
  row-gap: 0.75rem;
}

.photo-viewer-masonry > * {
  min-width: 0;
  will-change: transform, opacity;
}

@keyframes masonry-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* EXIF panel overlay in PhotoSwipe */
/* noinspection CssUnusedSymbol */
.pswp__info-panel[data-show] {
  display: block;
  pointer-events: none;
}

/* noinspection CssUnusedSymbol */
.pswp__img,
.pswp__img--placeholder {
  border-radius: 0.5rem;
}

/* noinspection CssUnusedSymbol */
.pswp__img--placeholder {
  object-fit: contain;
}

/* noinspection CssUnusedSymbol */
.pswp--opening .pswp__img,
.pswp--opening .pswp__img--placeholder {
  border-radius: 0.25rem;
}

.pswp-exif-wrap {
  position: absolute;
  bottom: 60px;
  right: 16px;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  border-radius: 10px;
  padding: 10px 14px;
  pointer-events: none;
}

.pswp-exif-wrap table {
  border-collapse: collapse;
  font-size: 12px;
  line-height: 1.6;
  color: #e8e0d5;
}

.pswp-exif-key {
  padding-right: 12px;
  color: #9a8e87;
  white-space: nowrap;
}

.pswp-exif-val {
  white-space: nowrap;
}

.pswp-info-link {
  color: inherit;
  text-decoration: underline;
  pointer-events: auto;
}

@media (max-width: 767px) {
  .pswp-exif-wrap {
    right: 12px;
    bottom: 72px;
    max-width: calc(100vw - 24px);
    padding: 8px 12px;
  }

  .pswp-exif-wrap table {
    font-size: 11px;
    line-height: 1.5;
  }
}
</style>
