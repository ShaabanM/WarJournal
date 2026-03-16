import { useState } from 'react';
import { X, MapPin, Calendar, Clock, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { useJournalStore, useSortedEntries } from '../store/journalStore';
import { format } from 'date-fns';
import { formatCoordinates } from '../utils/geo';
import { getMoodMeta } from '../constants/moods';
import { getLocationLabel, getReadingTimeMinutes } from '../utils/journal';

export default function EntryDetail() {
  const { selectedEntry, setShowEntryDetail, flyToEntry } = useJournalStore();
  const entries = useSortedEntries();
  const [photoState, setPhotoState] = useState<{ entryId: string; index: number }>({
    entryId: '',
    index: 0,
  });

  if (!selectedEntry) return null;
  const photoIndex = photoState.entryId === selectedEntry.id ? photoState.index : 0;

  const currentIndex = entries.findIndex((e) => e.id === selectedEntry.id);
  const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;
  const nextEntry = currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null;

  const navigateTo = (entry: typeof prevEntry) => {
    if (entry) {
      flyToEntry(entry);
    }
  };

  const mood = getMoodMeta(selectedEntry.mood);
  const moodColor = mood?.color;
  const primaryLocation = getLocationLabel(selectedEntry.location);

  return (
    <div className="entry-detail">
      <div className="entry-detail-header">
        <div>
          <p className="eyebrow">Dispatch detail</p>
          <span className="entry-detail-reading-time">
            {getReadingTimeMinutes(selectedEntry.content)} min read
          </span>
        </div>
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
                onClick={() =>
                  setPhotoState({
                    entryId: selectedEntry.id,
                    index: Math.max(0, photoIndex - 1),
                  })
                }
                disabled={photoIndex === 0}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="photo-counter">{photoIndex + 1} / {selectedEntry.photos.length}</span>
              <button
                className="btn-icon photo-nav-btn"
                onClick={() =>
                  setPhotoState({
                    entryId: selectedEntry.id,
                    index: Math.min(selectedEntry.photos.length - 1, photoIndex + 1),
                  })
                }
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
            <span>{mood?.emoji}</span>
            <span>{mood?.label}</span>
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
              {primaryLocation}
              {selectedEntry.location.country && primaryLocation !== selectedEntry.location.country
                ? `, ${selectedEntry.location.country}`
                : ''}
            </span>
          </div>
          <div className="meta-item">
            <Tag size={14} />
            <span>{formatCoordinates(selectedEntry.location.lat, selectedEntry.location.lng)}</span>
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
        <span className="nav-index">
          {currentIndex >= 0 ? `${currentIndex + 1} of ${entries.length}` : 'Preview mode'}
        </span>
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
