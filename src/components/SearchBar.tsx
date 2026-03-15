import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { useJournalStore } from '../store/journalStore';

const MOODS = [
  { value: 'hopeful', emoji: '🌅', label: 'Hopeful' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' },
  { value: 'grateful', emoji: '🙏', label: 'Grateful' },
  { value: 'reflective', emoji: '🪞', label: 'Reflective' },
  { value: 'determined', emoji: '💪', label: 'Determined' },
  { value: 'somber', emoji: '🌧️', label: 'Somber' },
  { value: 'joyful', emoji: '✨', label: 'Joyful' },
  { value: 'exhausted', emoji: '😮‍💨', label: 'Exhausted' },
];

export default function SearchBar() {
  const { searchQuery, setSearchQuery, filterMood, setFilterMood } = useJournalStore();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="search-bar-container">
      <div className="search-bar">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search entries, places, feelings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="btn-icon-sm" onClick={() => setSearchQuery('')}>
            <X size={14} />
          </button>
        )}
        <button
          className={`btn-icon-sm filter-btn ${filterMood ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={14} />
        </button>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-label">Filter by mood</div>
          <div className="filter-moods">
            <button
              className={`filter-mood-btn ${!filterMood ? 'selected' : ''}`}
              onClick={() => setFilterMood(null)}
            >
              All
            </button>
            {MOODS.map((m) => (
              <button
                key={m.value}
                className={`filter-mood-btn ${filterMood === m.value ? 'selected' : ''}`}
                onClick={() => setFilterMood(filterMood === m.value ? null : m.value)}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
