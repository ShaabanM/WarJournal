import { useEffect, useRef, useCallback } from 'react';

interface UseScrollObserverOptions {
  /** IntersectionObserver root element */
  root?: Element | null;
  /** Trigger zone — center 20% of viewport by default */
  rootMargin?: string;
  /** Minimum visibility threshold */
  threshold?: number;
  /** Callback when active entry changes */
  onActiveChange: (entryId: string) => void;
}

/**
 * Scroll observer hook for scrollytelling.
 * Watches registered entry elements and fires onActiveChange
 * when an entry enters the center trigger zone.
 */
export function useScrollObserver({
  root = null,
  rootMargin = '-40% 0px -40% 0px',
  threshold = 0,
  onActiveChange,
}: UseScrollObserverOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<string, Element>>(new Map());
  const callbackRef = useRef(onActiveChange);

  // Keep callback ref fresh
  callbackRef.current = onActiveChange;

  // Create / recreate observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const entryId = (entry.target as HTMLElement).dataset.entryId;
            if (entryId) {
              callbackRef.current(entryId);
            }
          }
        }
      },
      { root, rootMargin, threshold }
    );

    // Observe any elements already registered
    elementsRef.current.forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [root, rootMargin, threshold]);

  /** Register an entry card element for observation */
  const registerStep = useCallback((entryId: string, element: Element | null) => {
    if (element) {
      elementsRef.current.set(entryId, element);
      observerRef.current?.observe(element);
    } else {
      const existing = elementsRef.current.get(entryId);
      if (existing) {
        observerRef.current?.unobserve(existing);
        elementsRef.current.delete(entryId);
      }
    }
  }, []);

  return { registerStep };
}
