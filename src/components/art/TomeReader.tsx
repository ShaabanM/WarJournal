import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useJournalStore, useSortedEntries } from '../../store/journalStore';
import { useScrollObserver } from '../../hooks/useScrollObserver';
import { useArtReveal } from '../../hooks/useArtReveal';
import WorldMap from '../WorldMap';
import TomeTitle from './TomeTitle';
import TomePage from './TomePage';
import '../../tome.css';

export default function TomeReader() {
  const { isLoading, activeEntryId, loadEntries, loadSettings, setActiveEntryId } = useJournalStore();
  const sorted = useSortedEntries();
  const entryRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [scrollProgress, setScrollProgress] = useState(0);

  // Load data
  useEffect(() => {
    loadSettings();
    loadEntries();
  }, [loadSettings, loadEntries]);

  // Force light theme — parchment map looks best in light mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // Scroll progress tracking
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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

  const scrollToEntry = useCallback((entryId: string) => {
    const el = entryRefs.current.get(entryId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Scroll-triggered reveals
  useArtReveal();

  if (isLoading) {
    return (
      <div className="tome" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontStyle: 'italic', color: '#8b7355' }}>
          Unrolling the parchment&hellip;
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

      {/* FIXED: Scroll progress bar */}
      <div className="tome-progress" style={{ width: `${scrollProgress}%` }} />

      {/* FIXED: Navigation dots */}
      {sorted.length > 0 && (
        <nav className="tome-nav" aria-label="Chapter navigation">
          {sorted.map((entry) => (
            <button
              key={entry.id}
              className={`tome-nav__dot ${activeEntryId === entry.id ? 'tome-nav__dot--active' : ''}`}
              onClick={() => scrollToEntry(entry.id)}
              aria-label={entry.title}
              title={entry.title}
            />
          ))}
        </nav>
      )}

      {/* View toggle */}
      <a
        href="#"
        className="tome-toggle"
        onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
      >
        Standard View
      </a>

      {/* SCROLL: Narrative pages floating over the map */}
      <main className="tome-scroll">
        <TomeTitle entries={sorted} />

        {sorted.map((entry, index) => (
          <Fragment key={entry.id}>
            <TomePage
              entry={entry}
              chapterNumber={index + 1}
              isActive={activeEntryId === entry.id}
              registerRef={registerRef}
            />

            {index < sorted.length - 1 && (
              <div className="tome-divider" aria-hidden="true">
                &#x25C6;&mdash;&#x25C6;&mdash;&#x25C6;
              </div>
            )}
          </Fragment>
        ))}

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
