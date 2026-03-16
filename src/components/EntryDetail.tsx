import { useState } from 'react';
import { X, MapPin, Calendar, Clock, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { useJournalStore, useSortedEntries } from '../store/journalStore';
import { getMoodColor } from '../utils/sentiment';
import { format } from 'date-fns';
import { formatCoordinates } from '../utils/geo';

export default function EntryDetail() {
  const { selectedEntry, setShowEntryDetail, flyToEntry } = useJournalStore();
  const entries = useSortedEntries();
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!selectedEntry) return null;

  const currentIndex = entries.findIndex((e) => e.id === selectedEntry.id);
  const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const nextEntry = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  const navigateTo = (entry: typeof prevEntry) => {
    if (entry) {
      setPhotoIndex(0);
      flyToEntry(entry);
    }
  };

  const moodColor = getMoodColor(selectedEntry.mood);

  return (
    <div className="entry-detail">
      <div className="entry-detail-header">
        <button className="btn-icon" onClick={() => setShowEntryDetail(false)}>
          <X size={18} />
        </button>
      </div>

      {/* Photos */}
      {selectedEntry.photos.length > 0 && (
        <div className="entry-detail-photos">
          <img
            src={selectedEntry.photos[photoIndex]?.dataUrl}
            alt={selectedEntry.photos[photoIndex]?.caption || 'Journal photo'}
            className="entry-detail-photo"
          />
          {selectedEntry.photos.length > 1 && (
            <div className="photo-nav">
              <button
                className="btn-icon photo-nav-btn"
                onClick={() => setPhotoIndex(Math.max(0, photoIndex - 1))}
                disabled={photoIndex === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="photo-counter">{photoIndex + 1} / {selectedEntry.photos.length}</span>
              <button
                className="btn-icon photo-nav-btn"
                onClick={() => setPhotoIndex(Math.min(selectedEntry.photos.length - 1, photoIndex + 1))}
                disabled={photoIndex === selectedEntry.photos.length - 1}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="entry-detail-body">
        {/* Mood badge */}
        {selectedEntry.mood && (
          <div className="entry-detail-mood" style={{ '--mood-color': moodColor } as React.CSSProperties}>
            <span>{selectedEntry.mood}</span>
          </div>
        )}

        <h2 className="entry-detail-title">{selectedEntry.title}</h2>

        <div className="entry-detail-meta">
          <div className="meta-item">
            <Calendar size={14} />
            <span>{format(new Date(selectedEntry.timestamp), 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <div className="meta-item">
            <Clock size={14} />
            <span>{format(new Date(selectedEntry.timestamp), 'h:mm a')}</span>
          </div>
          <div className="meta-item">
            <MapPin size={14} />
            <span>
              {selectedEntry.location.city || selectedEntry.location.placeName || formatCoordinates(selectedEntry.location.lat, selectedEntry.location.lng)}
              {selectedEntry.location.country ? `, ${selectedEntry.location.country}` : ''}
            </span>
          </div>
        </div>

        <div className="entry-detail-content">
          {selectedEntry.content.split('\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {selectedEntry.tags.length > 0 && (
          <div className="entry-detail-tags">
            {selectedEntry.tags.map((tag) => (
              <span key={tag} className="tag">
                <Tag size={12} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="entry-detail-nav">
        <button
          className="btn-nav"
          onClick={() => navigateTo(prevEntry)}
          disabled={!prevEntry}
        >
          <ChevronLeft size={16} />
          <span>{prevEntry ? format(new Date(prevEntry.timestamp), 'MMM d') : 'Start'}</span>
        </button>
        <span className="nav-index">{currentIndex + 1} of {entries.length}</span>
        <button
          className="btn-nav"
          onClick={() => navigateTo(nextEntry)}
          disabled={!nextEntry}
        >
          <span>{nextEntry ? format(new Date(nextEntry.timestamp), 'MMM d') : 'Latest'}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
