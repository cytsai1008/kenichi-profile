<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
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
let lightbox: PhotoSwipeLightbox | null = null;
let resizeObserver: ResizeObserver | null = null;

function updateMasonryLayout() {
  if (!props.alwaysShowText || !galleryEl.value) return;

  const styles = window.getComputedStyle(galleryEl.value);
  const autoRow = Number.parseFloat(styles.getPropertyValue("grid-auto-rows"));
  const rowGap = Number.parseFloat(styles.getPropertyValue("row-gap"));
  if (!autoRow) return;

  Array.from(galleryEl.value.children).forEach((item) => {
    const element = item as HTMLElement;
    if (element.offsetParent === null) return;

    element.style.gridRowEnd = "auto";
    const height = element.offsetHeight;
    const span = Math.max(1, Math.ceil((height + rowGap) / (autoRow + rowGap)));
    element.style.gridRowEnd = `span ${span}`;
  });
}

async function syncMasonryLayout() {
  await nextTick();

  if (props.alwaysShowText && !masonryReady.value) {
    masonryReady.value = true;
    await nextTick();
  }

  updateMasonryLayout();

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

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl.value,
    children: "[data-pswp]",
    pswpModule: () => import("photoswipe"),
    initialZoomLevel: "fit",
    secondaryZoomLevel: (zoomLevel) => Math.min(zoomLevel.fit * 1.8, 1),
    maxZoomLevel: 4,
    preload: [2, 3],
    wheelToZoom: true,
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
  });

  lightbox.on("openingAnimationEnd", () => {
    lightbox?.pswp?.element?.classList.remove("pswp--opening");
  });
  lightbox.on("closingAnimationStart", () => {
    lightbox?.pswp?.element?.classList.add("pswp--opening");
  });
  lightbox.on("destroy", () => {
    lightbox?.pswp?.element?.classList.remove("pswp--opening");
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
            const data = props.photos[pswp.currIndex];
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
          const data = props.photos[pswp.currIndex];
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
    const el = galleryEl.value?.querySelectorAll<HTMLElement>("[data-pswp]")[index];
    if (el?.dataset.pswpSrc) {
      itemData.src = el.dataset.pswpSrc;
    }

    const imgs = galleryEl.value?.querySelectorAll<HTMLImageElement>("img");
    const img = imgs?.[index];
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
    :class="
      props.alwaysShowText && masonryReady
        ? 'photo-viewer-masonry'
        : 'grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4'
    "
  >
    <component
      :is="props.alwaysShowText ? 'div' : 'a'"
      v-for="photo in photos"
      :key="photo.src"
      data-animate
      data-pswp
      :href="props.alwaysShowText ? undefined : photo.src"
      :data-pswp-src="photo.src"
      :data-pswp-msrc="photo.thumb"
      v-bind="
        photo.width && photo.height
          ? { 'data-pswp-width': photo.width, 'data-pswp-height': photo.height }
          : {}
      "
      :data-cropped="true"
      :data-category="photo.category"
      class="group block overflow-hidden rounded-lg bg-surface-alt transition-transform duration-150 active:scale-[0.97]"
      :class="[props.itemClass, props.alwaysShowText ? 'cursor-pointer' : 'relative']"
      :style="props.alwaysShowText ? undefined : 'aspect-ratio: 1 / 1'"
    >
      <!-- image container -->
      <div class="relative overflow-hidden">
        <img
          :src="photo.thumb"
          :alt="photo.alt"
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
                >{{ photo.subtitle }}</a
              >
              <template v-else>{{ photo.subtitle }}</template>
            </p>
          </div>
        </div>
      </div>

      <!-- caption below image for alwaysShowText mode -->
      <div v-if="props.alwaysShowText && (photo.title || photo.subtitle)" class="space-y-0.5 p-3">
        <p v-if="photo.title" class="text-sm leading-tight font-medium text-fg">
          {{ photo.title }}
        </p>
        <p v-if="photo.subtitle" class="text-xs leading-tight text-fg-muted">
          <a
            v-if="photo.subtitleUrl"
            :href="photo.subtitleUrl"
            class="underline decoration-fg-muted/50 underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
            >{{ photo.subtitle }}</a
          >
          <template v-else>{{ photo.subtitle }}</template>
        </p>
      </div>
    </component>
  </div>
</template>

<style>
.photo-viewer-masonry {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  grid-auto-flow: row;
  grid-auto-rows: 2px;
  align-items: start;
}

.photo-viewer-masonry > * {
  min-width: 0;
}

@media (min-width: 640px) {
  .photo-viewer-masonry {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .photo-viewer-masonry {
    grid-template-columns: repeat(4, minmax(0, 1fr));
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
