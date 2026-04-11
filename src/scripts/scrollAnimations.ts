import { animate } from "animejs";

/**
 * Scroll-triggered entrance animations.
 *
 * Usage in templates:
 *   - `data-animate` on any element to fade+slide it in when it enters the viewport
 *   - `data-animate-stagger` on a container to animate all `[data-animate]` children
 *     together in a staggered cascade when the first child becomes visible
 *   - `data-animate-on-load-only` on an element or stagger container to animate
 *     only when it is already visible during the initial page load
 *
 * Respects `prefers-reduced-motion` — skips all animations if enabled.
 * Safe to call multiple times (skips already-processed elements via `data-animate-done`).
 */
export function initScrollAnimations(): void {
  if (typeof window === "undefined") return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const targets = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-animate]:not([data-animate-done]):not([data-animate-queued])"
    )
  );
  if (!targets.length) return;

  if (prefersReduced) {
    targets.forEach((el) => (el.dataset.animateDone = ""));
    return;
  }

  const triggeredGroups = new WeakSet<Element>();

  function isInViewport(el: HTMLElement) {
    const { top, right, bottom, left } = el.getBoundingClientRect();
    return top < window.innerHeight && bottom > 0 && left < window.innerWidth && right > 0;
  }

  function markDone(el: HTMLElement, obs?: IntersectionObserver) {
    obs?.unobserve(el);
    el.style.opacity = String(parseFloat(el.dataset.opacity ?? "1"));
    el.style.transform = "translateY(0)";
    el.dataset.animateDone = "";
    delete el.dataset.animateQueued;
  }

  function revealWithoutAnimation(el: HTMLElement, obs?: IntersectionObserver) {
    const group = el.closest<HTMLElement>("[data-animate-stagger]");

    if (group && !triggeredGroups.has(group)) {
      triggeredGroups.add(group);
      const groupEls = Array.from(
        group.querySelectorAll<HTMLElement>("[data-animate]:not([data-animate-done])")
      );
      groupEls.forEach((groupEl) => markDone(groupEl, obs));
      return;
    }

    if (!group) {
      markDone(el, obs);
    }
  }

  function triggerEl(el: HTMLElement, obs?: IntersectionObserver) {
    if ("animateDone" in el.dataset) return; // already handled

    obs?.unobserve(el);
    const group = el.closest<HTMLElement>("[data-animate-stagger]");

    if (group && !triggeredGroups.has(group)) {
      triggeredGroups.add(group);
      const groupEls = Array.from(
        group.querySelectorAll<HTMLElement>("[data-animate]:not([data-animate-done])")
      );
      groupEls.forEach((e) => {
        obs?.unobserve(e);
        e.dataset.animateDone = "";
        delete e.dataset.animateQueued;
      });
      groupEls.forEach((e, i) => {
        const targetOpacity = parseFloat(e.dataset.opacity ?? "1");
        animate(e, {
          opacity: [0, targetOpacity],
          translateY: [22, 0],
          duration: 520,
          ease: "out(3)",
          delay: i * 65,
          onComplete() {
            e.style.opacity = String(targetOpacity);
            e.style.transform = "translateY(0)";
          },
        });
      });
    } else if (!group) {
      const targetOpacity = parseFloat(el.dataset.opacity ?? "1");
      el.dataset.animateDone = "";
      animate(el, {
        opacity: [0, targetOpacity],
        translateY: [18, 0],
        duration: 480,
        ease: "out(3)",
        onComplete() {
          el.style.opacity = String(targetOpacity);
          el.style.transform = "translateY(0)";
        },
      });
    }
  }

  const deferredTargets: HTMLElement[] = [];
  const handledLoadOnlyOwners = new WeakSet<Element>();

  targets.forEach((el) => {
    const loadOnlyOwner = el.closest<HTMLElement>("[data-animate-on-load-only]");

    if (!loadOnlyOwner) {
      deferredTargets.push(el);
      return;
    }

    if (handledLoadOnlyOwners.has(loadOnlyOwner)) {
      return;
    }

    handledLoadOnlyOwners.add(loadOnlyOwner);

    if (isInViewport(loadOnlyOwner)) {
      triggerEl(el);
      return;
    }

    revealWithoutAnimation(el);
  });

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        triggerEl(entry.target as HTMLElement, obs);
      }
    },
    { threshold: 0.05, rootMargin: "0px 0px 0px 0px" }
  );

  deferredTargets.forEach((el) => {
    el.dataset.animateQueued = "";
    observer.observe(el);
  });

  // Fallback for real mobile: IntersectionObserver can miss elements already in
  // the viewport if it fires before layout is fully committed. After two frames
  // (ensuring paint + layout are settled) we manually trigger anything that is
  // visibly in the viewport but hasn't been animated yet.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      for (const el of deferredTargets) {
        if ("animateDone" in el.dataset) continue;
        const { top, bottom } = el.getBoundingClientRect();
        if (top < vh && bottom > 0) {
          triggerEl(el, observer);
        }
      }
    });
  });
}
