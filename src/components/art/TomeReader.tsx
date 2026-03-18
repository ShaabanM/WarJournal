import { Fragment, useCallback, useEffect, useRef } from 'react';
import { useJournalStore, useSortedEntries } from '../../store/journalStore';
import { useScrollObserver } from '../../hooks/useScrollObserver';
import { useArtReveal } from '../../hooks/useArtReveal';
import WorldMap from '../WorldMap';
import TomeTitle from './TomeTitle';
import TomePage from './TomePage';
import '../../tome.css';

export default function TomeReader() {
  const { isLoading, loadEntries, loadSettings, setActiveEntryId } = useJournalStore();
  const sorted = useSortedEntries();
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Load data
  useEffect(() => {
    loadSettings();
    loadEntries();
  }, [loadSettings, loadEntries]);

  // Force light theme — parchment map looks best in light mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // Scroll observer → map flies to active entry
  const handleActiveChange = useCallback(
    (entryId: string) => setActiveEntryId(entryId),
    [setActiveEntryId]
  );
  const { registerStep } = useScrollObserver({
    root: null,
    onActiveChange: handleActiveChange,
  });

  const registerRef = useCallback(
    (entryId: string, el: Element | null) => {
      registerStep(entryId, el);
      if (el) entryRefs.current.set(entryId, el as HTMLElement);
      else entryRefs.current.delete(entryId);
    },
    [registerStep]
  );

  // Scroll-triggered reveals
  useArtReveal();

  if (isLoading) {
    return (
      <div className="tome" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', color: '#8b7355' }}>
          Unrolling the parchment...
        </span>
      </div>
    );
  }

  return (
    <div className="tome">
      {/* FIXED: Full-viewport parchment map */}
      <div className="tome-map">
        <WorldMap />
      </div>

      {/* FIXED: Overlays */}
      <div className="tome-vignette" />
      <div className="tome-noise" />

      {/* View toggle */}
      <a
        href="#"
        className="tome-toggle"
        onClick={(e) => {
          e.preventDefault();
          window.location.hash = '';
        }}
      >
        Standard View
      </a>

      {/* SCROLL: Narrative pages floating over the map */}
      <main className="tome-scroll">
        {/* Title page */}
        <TomeTitle entries={sorted} />

        {/* Entry pages with dividers between */}
        {sorted.map((entry, index) => (
          <Fragment key={entry.id}>
            <TomePage
              entry={entry}
              chapterNumber={index + 1}
              registerRef={registerRef}
            />

            {/* Ornamental divider between pages */}
            {index < sorted.length - 1 && (
              <div className="tome-divider" aria-hidden="true">
                &#x25C6;&mdash;&#x25C6;&mdash;&#x25C6;
              </div>
            )}
          </Fragment>
        ))}

        {/* End */}
        {sorted.length > 0 && (
          <div className="tome-end" data-reveal>
            <p className="tome-end__text">
              The journey continues&hellip;
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
