<script setup lang="ts">
import { createApp, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { PanelBottomClose, PanelBottomOpen, Pin } from "@lucide/vue";
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
  isExplicit?: boolean;
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
const introReady = ref(false);
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

function animateItemsIn(items: HTMLElement[]) {
  if (!items.length) {
    introReady.value = true;
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    introReady.value = true;
    items.forEach((item) => {
      item.style.animation = "";
      item.style.opacity = "";
    });
    return;
  }

  items.forEach((item, index) => {
    item.style.animation = `photo-viewer-fade-in 0.48s ease-out ${index * 40}ms both`;
    item.addEventListener(
      "animationend",
      () => {
        item.style.animation = "";
        item.style.opacity = "1";
      },
      { once: true }
    );
  });

  introReady.value = true;
}

async function syncViewerLayout() {
  await nextTick();

  if (!galleryEl.value) return;

  const shouldAnimateIn = !introReady.value;
  const isFirstMasonry = props.alwaysShowText && !masonryReady.value;

  if (isFirstMasonry) {
    // Items already start at opacity:0 via the :style binding (!introReady),
    // so they are invisible in the SSR HTML before JS runs — no flash.
    masonryReady.value = true;
    await nextTick(); // wait for Vue to apply photo-viewer-masonry class

    updateMasonryLayout();
  } else {
    updateMasonryLayout();
  }

  if (shouldAnimateIn) {
    // CSS keyframe animations are used here because:
    // - animejs races with Vue's re-render microtask and never reliably fires
    // - CSS transitions require observing a "from→to" state change across paint
    //   cycles, which double-rAF doesn't guarantee
    // CSS animations fire as soon as the property is applied; fill-mode:both
    // holds the `from` state (opacity:0) during the delay, so pre-hidden items
    // stay hidden until their turn without any extra timing tricks.
    animateItemsIn(
      Array.from(galleryEl.value.children).filter(
        (item) => (item as HTMLElement).offsetParent !== null
      ) as HTMLElement[]
    );
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

  void syncViewerLayout();
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

  let isFilmstripHidden = false;

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
      const hasFilmstrip = getLightboxElements().length > 1;
      const bottomPadding =
        hasFilmstrip && !isFilmstripHidden ? (viewportSize.x < 768 ? 108 : 100) : edgePadding;

      return {
        top: edgePadding,
        right: edgePadding,
        bottom: bottomPadding,
        left: edgePadding,
      };
    },
  });

  // Trackpad grab: directly drives the pswp container transform.
  // mainScroll.x is kept in sync on every frame so PhotoSwipe never sees a
  // mismatch to "correct", and animations.stopAll() kills any pending spring.
  let swipeOffset = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingCurrItemUpdate = false;
  let isFastBrowsing = false;
  let updateFilmstripFromScroll:
    | ((behavior?: ScrollBehavior, positionOverride?: number) => void)
    | null = null;

  const p = () => lightbox?.pswp as any;
  const slideWidth = () => p()?.mainScroll?.slideWidth || p()?.viewportSize?.x || window.innerWidth;
  // Use getCurrSlideX() so baseX() is correct immediately after next()/prev()
  // (currIndex is only updated later by updateCurrItem(), but _currPositionIndex
  // is updated immediately inside moveIndexBy()).
  const baseX = () => p()?.mainScroll?.getCurrSlideX?.() ?? -(p()?.currIndex ?? 0) * slideWidth();

  const forceAppendHeavy = () => {
    // appendHeavy() guards on isShifted(). Briefly align mainScroll.x with the
    // slide center so isShifted() returns false, then restore the dragging x.
    // appendHeavy() only initiates async image loading — it doesn't use x for
    // layout, so restoring x afterwards is safe.
    const ms = p()?.mainScroll;
    if (!ms) return;
    const savedX = ms.x;
    ms.x = ms.getCurrSlideX ? ms.getCurrSlideX() : savedX;
    p()?.appendHeavy?.();
    ms.x = savedX;
  };

  const setX = (x: number) => {
    p()?.animations?.stopAll?.();
    if (p()?.mainScroll) p().mainScroll.x = x;
    const c: HTMLElement | undefined = p()?.container;
    if (c) {
      c.style.transition = "none";
      c.style.transform = `translate3d(${x}px,0px,0px)`;
    }
    // stopAll() kills the spring whose onComplete fires updateCurrItem() +
    // appendHeavy(). Replicate both here, once per navigation.
    if (pendingCurrItemUpdate) {
      pendingCurrItemUpdate = false;
      p()?.mainScroll?.updateCurrItem?.();
      if (!isFastBrowsing) forceAppendHeavy();
    }
  };

  const snapBack = () => {
    // Unblock content loading before any slide setup so updateCurrItem() and
    // appendHeavy() below can load images for the slide the user settled on.
    isFastBrowsing = false;
    swipeOffset = 0;
    // Consume any pending navigation whose updateCurrItem() was never called
    // (happens when the user stops swiping mid-burst without a subsequent event).
    if (pendingCurrItemUpdate) {
      pendingCurrItemUpdate = false;
      p()?.mainScroll?.updateCurrItem?.();
    }
    // contentLoadImage was blocked during fast browse, so img.src was never set
    // (content.state === 'idle'). The element and sizes ARE correct. Just need
    // to call loadImage() now that isFastBrowsing is false.
    for (const holder of p()?.mainScroll?.itemHolders ?? []) {
      const content = (holder as any)?.slide?.content;
      if (content?.state === "idle" && content?.element) content.loadImage?.(false);
    }
    const target = baseX();
    if (p()?.mainScroll) p().mainScroll.x = target;
    updateFilmstripFromScroll?.("smooth", p()?.currIndex ?? 0);
    const c: HTMLElement | undefined = p()?.container;
    if (!c) return;
    c.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
    c.style.transform = `translate3d(${target}px,0px,0px)`;
    // mainScroll.x now equals getCurrSlideX() so isShifted() is false.
    p()?.appendHeavy?.();
  };

  const onTrackpadSwipe = (e: WheelEvent) => {
    if (e.ctrlKey) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();

    swipeOffset += e.deltaX;
    setX(baseX() - swipeOffset);

    const pswp = p();
    const photoCount = getLightboxPhotos().length;
    const currentIndex = pswp?.currIndex ?? 0;
    const dragProgress = swipeOffset / slideWidth();
    const isWrapping =
      (currentIndex === 0 && dragProgress < 0) ||
      (currentIndex === photoCount - 1 && dragProgress > 0);
    const filmstripPosition = isWrapping
      ? currentIndex
      : Math.min(photoCount - 1, Math.max(0, currentIndex + dragProgress));
    updateFilmstripFromScroll?.("auto", filmstripPosition);

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(snapBack, 100);

    if (Math.abs(swipeOffset) > 120) {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      const goNext = swipeOffset > 0;
      swipeOffset = 0;
      isFastBrowsing = true;
      pendingCurrItemUpdate = true;
      if (goNext) lightbox?.pswp?.next();
      else lightbox?.pswp?.prev();
    }
  };

  lightbox.on("openingAnimationStart", () => {
    lightbox?.pswp?.element?.addEventListener("wheel", onTrackpadSwipe, { passive: false });
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
    lightbox?.pswp?.element?.removeEventListener("wheel", onTrackpadSwipe);
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    swipeOffset = 0;
    pendingCurrItemUpdate = false;
    isFastBrowsing = false;
    lightbox?.pswp?.element?.classList.remove("pswp--opening");
    triggerEl?.focus();
    triggerEl = null;
  });

  // Inject EXIF panel into PhotoSwipe UI
  lightbox.on("uiRegister", () => {
    let filmstripEl: HTMLElement | null = null;
    const useInstantFilmstripScroll = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resolveFilmstripScrollBehavior = (behavior: ScrollBehavior) =>
      useInstantFilmstripScroll() ? "auto" : behavior;
    const syncFilmstripVisibility = () => {
      if (!filmstripEl) return;
      filmstripEl.toggleAttribute("inert", isFilmstripHidden);
      filmstripEl.setAttribute("aria-hidden", String(isFilmstripHidden));
    };

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
      name: "thumbnail-filmstrip-toggle",
      order: 10,
      isButton: true,
      appendTo: "root",
      title: "Hide thumbnails",
      html: "",
      onInit: (el, pswp) => {
        const hasFilmstrip = getLightboxPhotos().length > 1;
        if (!hasFilmstrip) {
          el.remove();
          return;
        }

        const iconHost = document.createElement("span");
        let iconApp: ReturnType<typeof createApp> | null = null;

        el.classList.add("pswp-thumbstrip-toggle");
        el.setAttribute("aria-controls", "pswp-thumbstrip");
        el.appendChild(iconHost);

        const renderIcon = () => {
          iconApp?.unmount();
          iconHost.innerHTML = "";
          iconApp = createApp(isFilmstripHidden ? PanelBottomOpen : PanelBottomClose, {
            size: 16,
            strokeWidth: 2,
            "aria-hidden": "true",
          });
          iconApp.mount(iconHost);
        };

        const syncToggleState = () => {
          pswp.element?.classList.toggle("pswp--thumbstrip-hidden", isFilmstripHidden);
          el.setAttribute("aria-label", isFilmstripHidden ? "Show thumbnails" : "Hide thumbnails");
          el.setAttribute("title", isFilmstripHidden ? "Show thumbnails" : "Hide thumbnails");
          el.setAttribute("aria-pressed", String(isFilmstripHidden));
          syncFilmstripVisibility();
          renderIcon();
          pswp.updateSize(true);
        };

        el.addEventListener("click", () => {
          isFilmstripHidden = !isFilmstripHidden;
          syncToggleState();
          if (!isFilmstripHidden) updateFilmstripFromScroll?.("auto");
        });

        syncToggleState();
        pswp.on("destroy", () => {
          iconApp?.unmount();
          iconApp = null;
        });
      },
    });

    lightbox!.pswp!.ui!.registerElement({
      name: "thumbnail-filmstrip",
      order: 11,
      isButton: false,
      appendTo: "root",
      html: "",
      onInit: (el, pswp) => {
        const photos = getLightboxPhotos();
        if (photos.length < 2) {
          el.remove();
          return;
        }

        el.className = "pswp-thumbstrip";
        el.id = "pswp-thumbstrip";
        el.setAttribute("aria-label", "Photo thumbnails");
        filmstripEl = el;
        syncFilmstripVisibility();

        const buttons = photos.map((photo, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "pswp-thumbstrip-button";
          button.setAttribute("aria-label", photo.title || photo.alt || `Photo ${index + 1}`);

          const img = document.createElement("img");
          img.src = photo.thumb;
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";

          button.appendChild(img);
          button.addEventListener("click", () => {
            pswp.goTo(index);
          });

          el.appendChild(button);
          return button;
        });

        const updateActiveThumbnail = (
          behavior: ScrollBehavior = "smooth",
          positionOverride = pswp.currIndex
        ) => {
          const position = Math.min(buttons.length - 1, Math.max(0, positionOverride));
          const activeIndex = Math.round(position);

          buttons.forEach((button, index) => {
            const isActive = index === activeIndex;
            if (isActive) button.setAttribute("aria-current", "true");
            else button.removeAttribute("aria-current");
          });

          window.requestAnimationFrame(() => {
            const lowerIndex = Math.floor(position);
            const upperIndex = Math.min(buttons.length - 1, lowerIndex + 1);
            const mix = position - lowerIndex;
            const lowerButton = buttons[lowerIndex];
            const upperButton = buttons[upperIndex];
            const lowerCenter = lowerButton.offsetLeft + lowerButton.offsetWidth / 2;
            const upperCenter = upperButton.offsetLeft + upperButton.offsetWidth / 2;
            const targetCenter = lowerCenter + (upperCenter - lowerCenter) * mix;

            el.scrollTo({
              left: Math.max(0, targetCenter - el.clientWidth / 2),
              behavior: resolveFilmstripScrollBehavior(behavior),
            });
          });
        };

        updateFilmstripFromScroll = updateActiveThumbnail;
        updateActiveThumbnail("auto", pswp.currIndex);
        pswp.on("change", () => updateActiveThumbnail("smooth", pswp.currIndex));
        pswp.on("slideActivate", () => updateActiveThumbnail("smooth", pswp.currIndex));
        pswp.on("initialZoomInEnd", () => updateActiveThumbnail("auto", pswp.currIndex));
        pswp.on("destroy", () => {
          filmstripEl = null;
          updateFilmstripFromScroll = null;
        });
      },
    });

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

  // Block img.src assignment for slides navigated through during fast trackpad browse.
  // contentLoadImage fires inside loadImage() after the img element is already created
  // and sizes are calculated — preventing it leaves the element intact (so zoom/pan math
  // still works) but keeps content.state === 'idle'. snapBack() calls loadImage() again
  // once the user settles, which is now unblocked.
  lightbox.on("contentLoadImage", (e) => {
    if (isFastBrowsing) e.preventDefault();
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
    void syncViewerLayout();
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
        ...(photo.width && photo.height
          ? { 'data-pswp-width': photo.width, 'data-pswp-height': photo.height }
          : {}),
      }"
      data-pswp
      :data-explicit="photo.isExplicit || undefined"
      :data-pswp-src="photo.src"
      :data-pswp-msrc="photo.thumb"
      :data-cropped="true"
      :data-category="photo.category"
      class="group block overflow-hidden rounded-lg bg-surface-alt transition-transform duration-150"
      :class="[props.itemClass, props.alwaysShowText ? 'cursor-pointer text-left' : 'relative']"
      :style="[
        props.alwaysShowText ? undefined : 'aspect-ratio: 1 / 1',
        pressedPhoto === photo.src ? { scale: '0.97' } : {},
        !introReady ? { opacity: 0 } : {},
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

@keyframes photo-viewer-fade-in {
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

.pswp-thumbstrip {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  z-index: 1;
  display: flex;
  gap: 6px;
  justify-content: flex-start;
  width: max-content;
  max-width: min(1040px, calc(100vw - 48px));
  margin: 0 auto;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 5px 0 8px;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  scrollbar-width: none;
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.pswp-thumbstrip::-webkit-scrollbar {
  display: none;
}

.pswp-thumbstrip-button {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid rgba(244, 231, 212, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  opacity: 0.68;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease,
    opacity 150ms ease,
    transform 150ms ease;
}

.pswp-thumbstrip-button:hover,
.pswp-thumbstrip-button:focus-visible,
.pswp-thumbstrip-button[aria-current] {
  background: rgba(255, 255, 255, 0.14);
  opacity: 1;
}

.pswp-thumbstrip-button:focus-visible {
  outline: 2px solid #f4e7d4;
  outline-offset: 2px;
}

.pswp-thumbstrip-button[aria-current] {
  border-color: rgba(244, 231, 212, 0.72);
  box-shadow:
    0 8px 22px rgba(0, 0, 0, 0.26),
    0 0 0 1px rgba(244, 231, 212, 0.2);
  transform: translateY(-3px);
}

.pswp-thumbstrip-button img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.pswp--thumbstrip-hidden .pswp-thumbstrip {
  pointer-events: none;
  opacity: 0;
  transform: translateY(18px) scale(0.98);
}

.pswp__button.pswp-thumbstrip-toggle {
  position: absolute;
  bottom: 76px;
  left: 18px;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 999px;
  background: rgba(18, 18, 20, 0.36);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
  color: #f4e7d4;
  backdrop-filter: blur(16px) saturate(1.12);
  transition:
    background-color 150ms ease,
    opacity 150ms ease,
    transform 150ms ease;
}

.pswp__button.pswp-thumbstrip-toggle:hover,
.pswp__button.pswp-thumbstrip-toggle:focus-visible,
.pswp__button.pswp-thumbstrip-toggle[aria-pressed="true"] {
  background: rgba(244, 231, 212, 0.18);
  opacity: 1;
}

.pswp__button.pswp-thumbstrip-toggle[aria-pressed="true"] {
  transform: none;
}

.pswp--thumbstrip-hidden .pswp__button.pswp-thumbstrip-toggle {
  bottom: 18px;
}

.pswp-thumbstrip-toggle span {
  display: grid;
  place-items: center;
}

@media (max-width: 767px) {
  .pswp-exif-wrap {
    right: 12px;
    bottom: 132px;
    max-width: calc(100vw - 24px);
    padding: 8px 12px;
  }

  .pswp-exif-wrap table {
    font-size: 11px;
    line-height: 1.5;
  }

  .pswp-thumbstrip {
    right: 10px;
    bottom: 10px;
    left: 10px;
    justify-content: flex-start;
    max-width: calc(100vw - 20px);
  }

  .pswp-thumbstrip-button {
    width: 40px;
    height: 40px;
  }

  .pswp__button.pswp-thumbstrip-toggle {
    bottom: 66px;
    left: 12px;
    width: 40px;
    height: 40px;
  }

  .pswp--thumbstrip-hidden .pswp__button.pswp-thumbstrip-toggle {
    bottom: 14px;
  }
}
</style>
