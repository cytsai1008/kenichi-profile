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

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryEl.value,
    children: "[data-pswp]",
    pswpModule: () => import("photoswipe"),
    initialZoomLevel: "fit",
    secondaryZoomLevel: (z) => Math.min(z.fit * 1.8, 1),
    maxZoomLevel: 4,
    wheelToZoom: true,
    paddingFn: (viewportSize) => {
      const p = viewportSize.x < 768 ? 12 : 24;
      return { top: p, right: p, bottom: viewportSize.x < 768 ? 88 : p, left: p };
    },
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
      <a
        data-pswp
        :href="item.src"
        :data-pswp-src="item.src"
        :data-pswp-width="item.width || undefined"
        :data-pswp-height="item.height || undefined"
        class="block cursor-zoom-in overflow-hidden rounded-lg"
      >
        <img
          :src="item.src"
          :alt="item.alt ?? ''"
          :width="item.width || undefined"
          :height="item.height || undefined"
          loading="lazy"
          class="block h-auto w-full rounded-lg transition-transform duration-300 hover:scale-[1.02]"
        />
      </a>
      <figcaption v-if="item.caption" class="mt-3 text-center text-sm leading-normal text-fg-muted">
        {{ item.caption }}
      </figcaption>
    </figure>
  </div>
</template>
