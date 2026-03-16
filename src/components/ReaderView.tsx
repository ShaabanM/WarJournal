import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BookOpen,
  Compass,
  Crosshair,
  Globe2,
  RadioTower,
  Shield,
  TimerReset,
} from 'lucide-react';
import { useJournalStore, useSortedEntries } from '../store/journalStore';
import EntryDetail from './EntryDetail';
import Timeline from './Timeline';
import SearchBar from './SearchBar';
import { getTotalDistance } from '../utils/geo';
import {
  getExcerpt,
  getFirstEntry,
  getJourneyDurationLabel,
  getJourneyRangeLabel,
  getLatestEntry,
  getLocationLabel,
  getMoodBreakdown,
  getUniqueCountries,
  sortEntriesReverseChronologically,
} from '../utils/journal';

const WorldMap = lazy(() => import('./WorldMap'));

type Panel = 'none' | 'timeline';

export default function ReaderView() {
  const {
    entries,
    settings,
    showEntryDetail,
    selectedEntry,
    previewEntry,
    isLoading,
    loadPublishedEntries,
    setViewMode,
    loadSettings,
    flyToEntry,
  } = useJournalStore();
  const visibleEntries = useSortedEntries();
  const [activePanel, setActivePanel] = useState<Panel>('none');

  useEffect(() => {
    void loadSettings().then(() => loadPublishedEntries());
  }, [loadPublishedEntries, loadSettings]);

  const totalDistance =
    visibleEntries.length > 1
      ? getTotalDistance(visibleEntries.map((entry) => entry.location))
      : 0;
  const uniqueCountries = getUniqueCountries(entries);
  const latestEntry = getLatestEntry(entries);
  const firstEntry = getFirstEntry(entries);
  const recentEntries = sortEntriesReverseChronologically(visibleEntries).slice(0, 4);
  const moodBreakdown = getMoodBreakdown(entries).slice(0, 4);
  const filteredCount = visibleEntries.length;

  return (
    <div className="reader-view">
      <Suspense
        fallback={
          <div className="map-loading-shell">
            <div className="map-loading-copy">
              <p className="eyebrow">Map engine</p>
              <h2>Loading the theater map</h2>
              <p>The story cards are ready. Terrain and route overlays are on their way.</p>
            </div>
          </div>
        }
      >
        <WorldMap />
      </Suspense>

      <div className="reader-atmosphere" />

      <div className="reader-top-bar">
        <div className="reader-brand">
          <div className="brand-icon">
            <BookOpen size={20} />
          </div>
          <div className="brand-text">
            <p className="eyebrow">Public journal</p>
            <h1>{settings.journalTitle || 'War Journal'}</h1>
            <p className="brand-subtitle">
              {settings.journalSubtitle || 'A journey through conflict, documented in real time.'}
            </p>
          </div>
        </div>

        <div className="reader-top-actions">
          <SearchBar />
          <button
            className={`panel-toggle ${activePanel === 'timeline' ? 'active' : ''}`}
            onClick={() => setActivePanel((current) => (current === 'timeline' ? 'none' : 'timeline'))}
          >
            <RadioTower size={16} />
            <span>Timeline</span>
          </button>
        </div>
      </div>

      <div className="reader-layout">
        <aside className="reader-left-stack">
          <section className="reader-card mission-card">
            <p className="eyebrow">Story overview</p>
            <h2>{settings.authorName || 'Traveler'} is documenting the route live</h2>
            <p>
              The map tracks each published dispatch as the journey moves across borders, cities,
              and emotional states.
            </p>

            <div className="mission-meta">
              <span>{getJourneyRangeLabel(entries)}</span>
              <span>{getJourneyDurationLabel(entries)}</span>
              <span>{filteredCount} visible dispatches</span>
            </div>
            {previewEntry && !previewEntry.isPublished ? (
              <div className="preview-banner">
                You are previewing an unpublished draft on the map. Reader cards and stats still reflect the public story only.
              </div>
            ) : null}
          </section>

          {entries.length > 0 ? (
            <section className="reader-card reader-stats">
              <div className="stat-item">
                <span className="stat-value">{entries.length}</span>
                <span className="stat-label">Dispatches</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{Math.round(totalDistance).toLocaleString()}</span>
                <span className="stat-label">KM traced</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{uniqueCountries.length}</span>
                <span className="stat-label">Countries</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{latestEntry ? getLocationLabel(latestEntry.location) : 'N/A'}</span>
                <span className="stat-label">Last known</span>
              </div>
            </section>
          ) : null}

          {moodBreakdown.length > 0 ? (
            <section className="reader-card reader-legend-card">
              <div className="card-heading">
                <h3>Emotional weather</h3>
                <Compass size={16} />
              </div>
              <div className="tone-list">
                {moodBreakdown.map((tone) => (
                  <div key={tone.label} className="tone-row">
                    <div className="tone-label">
                      <span>{tone.emoji}</span>
                      <span>{tone.label}</span>
                    </div>
                    <div className="tone-bar-track">
                      <div
                        className="tone-bar-fill"
                        style={{
                          width: `${(tone.count / entries.length) * 100}%`,
                          background: tone.color,
                        }}
                      />
                    </div>
                    <span className="tone-count">{tone.count}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>

        <aside className="reader-right-stack">
          {latestEntry ? (
            <section className="reader-card latest-dispatch-card">
              <div className="card-heading">
                <h3>Latest dispatch</h3>
                <Globe2 size={16} />
              </div>
              <strong>{latestEntry.title}</strong>
              <p>{getExcerpt(latestEntry.content, 148)}</p>
              <div className="latest-dispatch-meta">
                <span>{getLocationLabel(latestEntry.location)}</span>
                <span>{new Date(latestEntry.timestamp).toLocaleString()}</span>
              </div>
              <button className="btn btn-primary" onClick={() => flyToEntry(latestEntry)}>
                <Crosshair size={16} />
                <span>Open latest on map</span>
              </button>
            </section>
          ) : null}

          {recentEntries.length > 0 ? (
            <section className="reader-card recent-dispatches-card">
              <div className="card-heading">
                <h3>Recent dispatches</h3>
                <RadioTower size={16} />
              </div>
              <div className="recent-dispatch-list">
                {recentEntries.map((entry) => (
                  <button
                    key={entry.id}
                    className="recent-dispatch-item"
                    onClick={() => flyToEntry(entry)}
                  >
                    <div>
                      <strong>{entry.title}</strong>
                      <p>{getLocationLabel(entry.location)}</p>
                    </div>
                    <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="reader-card quick-actions-card">
            <div className="card-heading">
              <h3>Quick jumps</h3>
              <TimerReset size={16} />
            </div>
            <div className="quick-action-buttons">
              <button
                className="btn btn-ghost"
                onClick={() => firstEntry && flyToEntry(firstEntry)}
                disabled={!firstEntry}
              >
                <TimerReset size={16} />
                <span>Start at the beginning</span>
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => latestEntry && flyToEntry(latestEntry)}
                disabled={!latestEntry}
              >
                <Crosshair size={16} />
                <span>Jump to latest</span>
              </button>
            </div>
          </section>
        </aside>
      </div>

      {activePanel === 'timeline' ? (
        <div className="reader-bottom-panel">
          <Timeline />
        </div>
      ) : null}

      {showEntryDetail && selectedEntry ? <EntryDetail /> : null}

      {isLoading ? (
        <div className="reader-loading">
          <div className="loading-spinner" />
          <span>Loading journal entries...</span>
        </div>
      ) : null}

      <button
        className="author-mode-link"
        onClick={() => setViewMode('author')}
        title="Author mode"
      >
        <Shield size={14} />
        <span>Private Desk</span>
      </button>
    </div>
  );
}
