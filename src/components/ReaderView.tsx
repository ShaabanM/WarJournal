import { useState, useEffect } from 'react';
import { BookOpen, Clock } from 'lucide-react';
import { useJournalStore, useSortedEntries } from '../store/journalStore';
import WorldMap from './WorldMap';
import EntryDetail from './EntryDetail';
import Timeline from './Timeline';
import SearchBar from './SearchBar';
import { getTotalDistance } from '../utils/geo';

type Panel = 'none' | 'timeline' | 'search';

export default function ReaderView() {
  const {
    entries, showEntryDetail, selectedEntry, isLoading,
    loadPublishedEntries, setViewMode, loadSettings
  } = useJournalStore();
  const sorted = useSortedEntries();
  const [activePanel, setActivePanel] = useState<Panel>('none');

  useEffect(() => {
    loadSettings().then(() => loadPublishedEntries());
  }, []);

  const totalDistance = sorted.length > 1
    ? getTotalDistance(sorted.map((e) => e.location))
    : 0;

  const countries = new Set(sorted.map((e) => e.location.country).filter(Boolean));
  const latestEntry = sorted[sorted.length - 1];

  const togglePanel = (panel: Panel) => {
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  return (
    <div className="reader-view">
      {/* Map fills the background */}
      <WorldMap />

      {/* Top bar */}
      <div className="reader-top-bar">
        <div className="reader-brand">
          <div className="brand-icon">
            <BookOpen size={20} />
          </div>
          <div className="brand-text">
            <h1>War Journal</h1>
            <p className="brand-subtitle">A journey through conflict</p>
          </div>
        </div>
        <SearchBar />
      </div>

      {/* Stats strip */}
      {entries.length > 0 && (
        <div className="reader-stats">
          <div className="stat-item">
            <span className="stat-value">{entries.length}</span>
            <span className="stat-label">Entries</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{Math.round(totalDistance).toLocaleString()}</span>
            <span className="stat-label">km traveled</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{countries.size}</span>
            <span className="stat-label">Countries</span>
          </div>
          {latestEntry && (
            <>
              <div className="stat-divider" />
              <div className="stat-item stat-latest">
                <span className="stat-value">{latestEntry.location.city || latestEntry.location.country || '?'}</span>
                <span className="stat-label">Last seen</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom panel controls */}
      <div className="reader-bottom-controls">
        <button
          className={`panel-toggle ${activePanel === 'timeline' ? 'active' : ''}`}
          onClick={() => togglePanel('timeline')}
        >
          <Clock size={16} />
          <span>Timeline</span>
        </button>
      </div>

      {/* Timeline panel */}
      {activePanel === 'timeline' && (
        <div className="reader-bottom-panel">
          <Timeline />
        </div>
      )}

      {/* Entry detail side panel */}
      {showEntryDetail && selectedEntry && <EntryDetail />}

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
