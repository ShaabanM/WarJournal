import { useEffect, useRef } from 'react';

/**
 * Scroll-triggered reveal animations for art mode.
 * Elements with `data-reveal` attribute get `.art-revealed` class
 * when they enter the viewport. Reveals once, never un-reveals.
 *
 * Elements with `data-reveal-stagger` get their children revealed
 * one-by-one with CSS transition-delay.
 */
export function useArtReveal(
  rootMargin = '0px 0px -8% 0px',
  threshold = 0.1,
  staggerDelay = 100
) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const el = entry.target as HTMLElement;
          el.classList.add('art-revealed');

          // Stagger children
          if (el.hasAttribute('data-reveal-stagger')) {
            const children = el.children;
            for (let i = 0; i < children.length; i++) {
              const child = children[i] as HTMLElement;
              child.style.transitionDelay = `${i * staggerDelay}ms`;
              child.classList.add('art-revealed');
            }
          }

          observerRef.current?.unobserve(el);
        }
      },
      { rootMargin, threshold }
    );

    // Observe all current [data-reveal] elements
    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach((el) => observerRef.current?.observe(el));

    // MutationObserver to catch dynamically added elements
    const mutObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.hasAttribute('data-reveal')) {
            observerRef.current?.observe(node);
          }
          node.querySelectorAll('[data-reveal]').forEach((child) => {
            observerRef.current?.observe(child);
          });
        }
      }
    });

    mutObs.observe(document.body, { childList: true, subtree: true });

    return () => {
      observerRef.current?.disconnect();
      mutObs.disconnect();
    };
  }, [rootMargin, threshold, staggerDelay]);
}
