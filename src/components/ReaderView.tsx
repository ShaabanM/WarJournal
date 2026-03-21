import { useEffect, useRef, useCallback, useState } from 'react';
import { BookOpen, Search, X, Sun, Moon } from 'lucide-react';
import { useJournalStore, useSortedEntries, getEntryDisplayDate } from '../store/journalStore';
import WorldMap from './WorldMap';
import ScrollyEntry from './ScrollyEntry';
import Timeline from './Timeline';
import JourneyDashboard from './JourneyDashboard';
import { useScrollObserver } from '../hooks/useScrollObserver';
import { getTotalDistance } from '../utils/geo';

export default function ReaderView() {
  const {
    isLoading, activeEntryId,
    loadEntries, setViewMode, loadSettings,
    setActiveEntryId, searchQuery, setSearchQuery,
    settings, setTheme,
  } = useJournalStore();
  const sorted = useSortedEntries();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const entryRefsMap = useRef<Map<string, HTMLElement>>(new Map());
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    loadSettings();
    loadEntries();
  }, []);

  // Scroll observer — fires when entry enters center 20% of viewport
  const handleActiveChange = useCallback(
    (entryId: string) => {
      setActiveEntryId(entryId);
    },
    [setActiveEntryId]
  );

  const { registerStep } = useScrollObserver({
    root: null, // viewport
    onActiveChange: handleActiveChange,
  });

  // Wrapper to track refs for programmatic scrolling
  const registerRef = useCallback(
    (entryId: string, el: Element | null) => {
      registerStep(entryId, el);
      if (el) {
        entryRefsMap.current.set(entryId, el as HTMLElement);
      } else {
        entryRefsMap.current.delete(entryId);
      }
    },
    [registerStep]
  );

  const scrollToEntry = useCallback((entryId: string) => {
    const el = entryRefsMap.current.get(entryId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // Stats
  const totalDistance = sorted.length > 1
    ? getTotalDistance(sorted.map((e) => e.location))
    : 0;
  const countries = new Set(sorted.map((e) => e.location.country).filter(Boolean));
  // Count distinct cities by clustering nearby locations (within ~25 km)
  const cities = (() => {
    const clusters: { lat: number; lng: number; name: string }[] = [];
    for (const e of sorted) {
      const name = e.location.city || e.location.placeName || '';
      if (!name) continue;
      const nearby = clusters.find((c) => {
        const dlat = c.lat - e.location.lat;
        const dlng = c.lng - e.location.lng;
        return Math.sqrt(dlat * dlat + dlng * dlng) < 0.25; // ~25 km
      });
      if (!nearby) {
        clusters.push({ lat: e.location.lat, lng: e.location.lng, name });
      }
    }
    return clusters;
  })();
  const latestEntry = sorted[sorted.length - 1];
  const dateRange = sorted.length > 0
    ? `${new Date(getEntryDisplayDate(sorted[0])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(getEntryDisplayDate(sorted[sorted.length - 1])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : '';

  return (
    <div className="scrolly-layout">
      {/* Fixed sidebar — desktop */}
      <aside className="scrolly-sidebar">
        <div className="scrolly-sidebar__brand">
          <div className="scrolly-sidebar__brand-icon">
            <BookOpen size={18} />
          </div>
          <div className="scrolly-sidebar__brand-text">
            <h1>War Journal</h1>
            <p>A journey through conflict</p>
          </div>
          <button
            className="btn-icon theme-toggle"
            onClick={() => setTheme(settings.theme === 'light' ? 'dark' : 'light')}
            title={settings.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {settings.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="scrolly-sidebar__search">
          <div className="scrolly-search-bar">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="btn-icon-sm" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <Timeline
          entries={sorted}
          activeEntryId={activeEntryId}
          onEntryClick={scrollToEntry}
        />

        <div
          className="scrolly-sidebar__stats scrolly-sidebar__stats--clickable"
          onClick={() => setShowDashboard(true)}
          title="View journey dashboard"
        >
          <div className="sidebar-stat">
            <span className="sidebar-stat__value">{cities.length}</span>
            <span className="sidebar-stat__label">cities</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat__value">{Math.round(totalDistance).toLocaleString()}</span>
            <span className="sidebar-stat__label">km</span>
          </div>
          <div className="sidebar-stat">
            <span className="sidebar-stat__value">{countries.size}</span>
            <span className="sidebar-stat__label">countries</span>
          </div>
        </div>
      </aside>

      {/* Journey Dashboard Modal */}
      {showDashboard && (
        <JourneyDashboard
          onClose={() => setShowDashboard(false)}
          totalDistance={totalDistance}
          cityCount={cities.length}
          countryCount={countries.size}
        />
      )}

      {/* Main scroll area */}
      <main className="scrolly-main" ref={scrollContainerRef}>
        {/* Hero section — 100vh */}
        <section className="scrolly-hero">
          <div className="scrolly-hero__content">
            <h1 className="scrolly-hero__title">War Journal</h1>
            <p className="scrolly-hero__subtitle">
              A journey through conflict — told one day at a time
            </p>
            {sorted.length > 0 && (
              <div className="scrolly-hero__meta">
                <span>{dateRange}</span>
                <span className="scrolly-hero__dot"></span>
                <span>{cities.length} cities</span>
                <span className="scrolly-hero__dot"></span>
                <span>{countries.size} countries</span>
              </div>
            )}
            <div className="scrolly-hero__scroll-hint">
              <span>Scroll to begin</span>
              <div className="scrolly-hero__arrow" />
            </div>
          </div>
        </section>

        {/* Sticky map + scrolling entries */}
        <section className="scrolly-section">
          <div className="scrolly-map-sticky">
            <WorldMap />
          </div>

          <div className="scrolly-entries">
            {sorted.map((entry, index) => (
              <ScrollyEntry
                key={entry.id}
                entry={entry}
                index={index}
                isActive={activeEntryId === entry.id}
                registerRef={registerRef}
              />
            ))}

            {/* End marker — triggers map zoom-out to full route */}
            {sorted.length > 0 && (
              <div
                className="scrolly-end"
                data-entry-id="journey-end"
                ref={(el) => registerRef('journey-end', el)}
              >
                <div className="scrolly-end__line" />
                <p className="scrolly-end__text">
                  {latestEntry?.location.city || latestEntry?.location.country || 'Somewhere'} — the journey continues.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Mobile bottom timeline */}
      <nav className="scrolly-mobile-timeline">
        {sorted.map((entry) => {
          const isActive = activeEntryId === entry.id;
          return (
            <button
              key={entry.id}
              className={`scrolly-mobile-dot ${isActive ? 'active' : ''}`}
              onClick={() => scrollToEntry(entry.id)}
              title={entry.title}
            />
          );
        })}
      </nav>

      {/* Loading state */}
      {isLoading && (
        <div className="reader-loading">
          <div className="loading-spinner" />
          <span>Loading journal entries...</span>
        </div>
      )}

      {/* Author mode link (subtle) */}
      <button
        className="author-mode-link"
        onClick={() => setViewMode('author')}
        title="Author mode"
      >
        <BookOpen size={14} />
      </button>
    </div>
  );
}
