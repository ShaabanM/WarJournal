import { startTransition, useEffect, useRef, useState } from 'react';
import { Filter, Search, Sparkles, X } from 'lucide-react';
import { useJournalStore, useSortedEntries } from '../store/journalStore';
import { MOODS } from '../constants/moods';
import { format } from 'date-fns';
import { getExcerpt, getLocationLabel, sortEntriesReverseChronologically } from '../utils/journal';

export default function SearchBar() {
  const shellRef = useRef<HTMLDivElement>(null);
  const {
    entries,
    searchQuery,
    setSearchQuery,
    filterMood,
    setFilterMood,
    flyToEntry,
  } = useJournalStore();
  const filteredEntries = useSortedEntries();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const activeFilters = Boolean(searchQuery.trim() || filterMood);
  const visibleResults = sortEntriesReverseChronologically(filteredEntries).slice(0, 6);
  const resultLabel = activeFilters
    ? `${filteredEntries.length} match${filteredEntries.length === 1 ? '' : 'es'}`
    : `${entries.length} total dispatches`;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterMood(null);
  };

  return (
    <div className="search-shell" ref={shellRef}>
      <div className={`search-bar ${isOpen ? 'is-open' : ''}`}>
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search places, people, moments, tags..."
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const nextValue = e.target.value;
            startTransition(() => {
              setSearchQuery(nextValue);
            });
          }}
        />
        {searchQuery ? (
          <button className="btn-icon-sm" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : null}
        <button
          className={`btn-icon-sm filter-btn ${filterMood ? 'active' : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Toggle filters"
        >
          <Filter size={14} />
        </button>
      </div>

      {(isOpen || activeFilters) && (
        <div className="search-popover">
          <div className="search-popover-header">
            <div>
              <p className="search-popover-label">Journal explorer</p>
              <strong>{resultLabel}</strong>
            </div>
            {activeFilters ? (
              <button className="btn-text" onClick={clearFilters}>
                Clear filters
              </button>
            ) : (
              <div className="search-popover-badge">
                <Sparkles size={14} />
                <span>Live map filtering</span>
              </div>
            )}
          </div>

          <div className="filter-panel">
            <div className="filter-label">Filter by emotional weather</div>
            <div className="filter-moods">
              <button
                className={`filter-mood-btn ${!filterMood ? 'selected' : ''}`}
                onClick={() => setFilterMood(null)}
              >
                <span>All</span>
              </button>
              {MOODS.map((mood) => (
                <button
                  key={mood.value}
                  className={`filter-mood-btn ${filterMood === mood.value ? 'selected' : ''}`}
                  onClick={() => setFilterMood(filterMood === mood.value ? null : mood.value)}
                >
                  <span>{mood.emoji}</span>
                  <span>{mood.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="search-results">
            {visibleResults.length > 0 ? (
              visibleResults.map((entry) => (
                <button
                  key={entry.id}
                  className="search-result-card"
                  onClick={() => {
                    flyToEntry(entry);
                    setIsOpen(false);
                  }}
                >
                  <div className="search-result-header">
                    <span>{format(new Date(entry.timestamp), 'MMM d, yyyy')}</span>
                    <span>{getLocationLabel(entry.location)}</span>
                  </div>
                  <h4>{entry.title}</h4>
                  <p>{getExcerpt(entry.content, 88)}</p>
                </button>
              ))
            ) : (
              <div className="search-empty-state">
                <h4>No dispatches match yet</h4>
                <p>Try a different place name, mood, tag, or clear the current filters.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
