<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
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
let lightbox: PhotoSwipeLightbox | null = null;

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

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl.value,
    children: "a[data-pswp]",
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
    if (!props.placeholderSrc) {
      itemData.msrc = undefined;
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

onUnmounted(() => {
  lightbox?.destroy();
  lightbox = null;
});
</script>

<template>
  <div
    ref="galleryEl"
    data-animate-stagger
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
  >
    <a
      v-for="(photo, i) in photos"
      :key="i"
      data-animate
      data-pswp
      :href="photo.src"
      v-bind="{
        ...(!props.placeholderSrc ? {} : { 'data-pswp-msrc': photo.thumb }),
        ...(photo.width && photo.height
          ? { 'data-pswp-width': photo.width, 'data-pswp-height': photo.height }
          : {}),
      }"
      :data-cropped="true"
      :data-category="photo.category"
      class="group relative block overflow-hidden rounded-lg bg-surface-alt"
      :class="props.itemClass"
      style="aspect-ratio: 1 / 1"
    >
      <img
        :src="photo.thumb"
        :alt="photo.alt"
        loading="lazy"
        class="h-full w-full transition-transform duration-300"
        :class="[
          props.thumbClass ?? 'object-cover',
          !props.disableHoverZoom && 'group-hover:scale-105',
        ]"
      />
      <div
        class="absolute inset-0 flex items-end p-3"
        :class="
          props.alwaysShowText
            ? ''
            : 'bg-linear-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100'
        "
      >
        <div v-if="photo.title || photo.subtitle" class="space-y-0.5">
          <p
            v-if="photo.title"
            class="text-sm leading-tight font-medium"
            :class="props.alwaysShowText ? 'text-fg dark:text-white' : 'text-white'"
          >
            {{ photo.title }}
          </p>
          <p
            v-if="photo.subtitle"
            class="text-xs leading-tight"
            :class="props.alwaysShowText ? 'text-fg-muted dark:text-white/80' : 'text-white/80'"
          >
            <a
              v-if="photo.subtitleUrl"
              :href="photo.subtitleUrl"
              class="underline underline-offset-2"
              :class="
                props.alwaysShowText
                  ? 'text-fg-muted decoration-fg-muted/50 dark:text-white/80 dark:decoration-white/50'
                  : 'text-white/80 decoration-white/50'
              "
              target="_blank"
              rel="noopener noreferrer"
              @click.stop
            >
              {{ photo.subtitle }}
            </a>
            <template v-else>{{ photo.subtitle }}</template>
          </p>
        </div>
      </div>
    </a>
  </div>
</template>

<style>
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
