import { animate, stagger } from "animejs";

/**
 * Scroll-triggered entrance animations.
 *
 * Usage in templates:
 *   - `data-animate` on any element to fade+slide it in when it enters the viewport
 *   - `data-animate-stagger` on a container to animate all `[data-animate]` children
 *     together in a staggered cascade when the first child becomes visible
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
    // Mark done so CSS rule `[data-animate-done]` makes them visible immediately
    targets.forEach((el) => (el.dataset.animateDone = ""));
    return;
  }

  const triggeredGroups = new WeakSet<Element>();

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        obs.unobserve(entry.target);

        const el = entry.target as HTMLElement;
        const group = el.closest<HTMLElement>("[data-animate-stagger]");

        if (group && !triggeredGroups.has(group)) {
          // Animate all not-yet-done items in the stagger group together
          triggeredGroups.add(group);
          const groupEls = Array.from(
            group.querySelectorAll<HTMLElement>("[data-animate]:not([data-animate-done])")
          );
          groupEls.forEach((e) => {
            obs.unobserve(e);
            e.dataset.animateDone = "";
            delete e.dataset.animateQueued;
          });
          animate(groupEls, {
            opacity: [0, 1],
            translateY: [22, 0],
            duration: 520,
            ease: "out(3)",
            delay: stagger(65),
          });
        } else if (!group) {
          // Standalone element
          el.dataset.animateDone = "";
          animate(el, {
            opacity: [0, 1],
            translateY: [18, 0],
            duration: 480,
            ease: "out(3)",
          });
        }
        // If group already triggered — just skip (already animating)
      }
    },
    { threshold: 0.05, rootMargin: "0px 0px 0px 0px" }
  );

  targets.forEach((el) => {
    el.dataset.animateQueued = ""; // prevent double-observe if called twice
    observer.observe(el);
  });
}
