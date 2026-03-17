import { Fragment, useCallback, useEffect, useRef } from 'react';
import { useJournalStore, useSortedEntries } from '../../store/journalStore';
import { useScrollObserver } from '../../hooks/useScrollObserver';
import { useArtReveal } from '../../hooks/useArtReveal';
import WorldMap from '../WorldMap';
import ArtHero from './ArtHero';
import ArtEntry from './ArtEntry';
import ArtNav from './ArtNav';
import '../../art.css';

export default function ArtReaderView() {
  const {
    isLoading,
    activeEntryId,
    loadEntries,
    loadSettings,
    setActiveEntryId,
  } = useJournalStore();

  const sorted = useSortedEntries();
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Load data
  useEffect(() => {
    loadSettings();
    loadEntries();
  }, [loadSettings, loadEntries]);

  // Scroll observer (reuse existing hook)
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

  const scrollToEntry = useCallback((entryId: string) => {
    const el = entryRefs.current.get(entryId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Art reveal animations
  useArtReveal();

  // Force dark theme for art mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  if (isLoading) {
    return (
      <div className="art-mode" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="art-label">Loading journal...</span>
      </div>
    );
  }

  return (
    <div className="art-mode">
      {/* Fixed background map */}
      <div className="art-map-bg">
        <WorldMap />
      </div>

      {/* Overlays */}
      <div className="art-grain" />
      <div className="art-vignette" />

      {/* Floating nav */}
      <ArtNav
        entries={sorted}
        activeEntryId={activeEntryId}
        onEntryClick={scrollToEntry}
      />

      {/* View toggle */}
      <a
        href="#"
        className="art-view-toggle"
        onClick={(e) => {
          e.preventDefault();
          window.location.hash = '';
        }}
      >
        Standard View
      </a>

      {/* Main scrollable content */}
      <main className="art-scroll">
        <ArtHero entries={sorted} />

        {sorted.map((entry, index) => (
          <Fragment key={entry.id}>
            <ArtEntry entry={entry} registerRef={registerRef} />

            {/* Divider + optional map window between entries */}
            {index < sorted.length - 1 && (
              <>
                <div className="art-divider-wrap">
                  <div className="art-divider" />
                </div>

                {/* Map window every 2 entries */}
                {(index + 1) % 2 === 0 && (
                  <div className="art-map-window" />
                )}
              </>
            )}
          </Fragment>
        ))}

        {/* End */}
        {sorted.length > 0 && (
          <div className="art-end" data-reveal>
            <div className="art-end__line" />
            <p className="art-end__text">
              {sorted[sorted.length - 1]?.location.city ||
                sorted[sorted.length - 1]?.location.country ||
                'Somewhere'}{' '}
              — the journey continues.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
