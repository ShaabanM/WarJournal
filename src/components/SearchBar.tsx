import { Search, X } from 'lucide-react';
import { useJournalStore } from '../store/journalStore';

export default function SearchBar() {
  const { searchQuery, setSearchQuery } = useJournalStore();

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
      </div>
    </div>
  );
}
