import { useEffect, useRef } from 'react';

/**
 * Scroll-triggered reveal animations.
 * Elements with `data-reveal` get `.revealed` class when they enter the viewport.
 * Reveals once, never un-reveals.
 */
export function useArtReveal(rootMargin = '0px 0px -5% 0px', threshold = 0.05) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).classList.add('revealed');
          observerRef.current?.unobserve(entry.target);
        }
      },
      { rootMargin, threshold }
    );

    // Observe existing elements
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      observerRef.current?.observe(el);
    });

    // Watch for dynamically added elements
    const mutObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.hasAttribute('data-reveal')) observerRef.current?.observe(node);
          node.querySelectorAll('[data-reveal]').forEach((c) => observerRef.current?.observe(c));
        }
      }
    });
    mutObs.observe(document.body, { childList: true, subtree: true });

    return () => {
      observerRef.current?.disconnect();
      mutObs.disconnect();
    };
  }, [rootMargin, threshold]);
}
