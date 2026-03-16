import { useCallback } from 'react';
import { MapPin, Tag, Newspaper } from 'lucide-react';
import { format } from 'date-fns';
import { getEntryDisplayDate } from '../store/journalStore';
import type { JournalEntry } from '../types';

const MOOD_COLORS: Record<string, string> = {
  hopeful: '#4ade80',
  anxious: '#f97316',
  grateful: '#a78bfa',
  reflective: '#60a5fa',
  determined: '#f59e0b',
  somber: '#6b7280',
  joyful: '#fbbf24',
  exhausted: '#ef4444',
};

const MOOD_EMOJI: Record<string, string> = {
  hopeful: '\u{1F305}', anxious: '\u{1F630}', grateful: '\u{1F64F}', reflective: '\u{1FA9E}',
  determined: '\u{1F4AA}', somber: '\u{1F327}\u{FE0F}', joyful: '\u2728', exhausted: '\u{1F62E}\u200D\u{1F4A8}',
};

interface ScrollyEntryProps {
  entry: JournalEntry;
  isActive: boolean;
  index: number;
  registerRef: (entryId: string, el: Element | null) => void;
}

export default function ScrollyEntry({ entry, isActive, index, registerRef }: ScrollyEntryProps) {
  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      registerRef(entry.id, el);
    },
    [entry.id, registerRef]
  );

  const displayDate = getEntryDisplayDate(entry);
  const moodColor = entry.mood ? MOOD_COLORS[entry.mood] : undefined;
  const dayNumber = index + 1;

  return (
    <div
      ref={refCallback}
      data-entry-id={entry.id}
      className={`scrolly-entry ${isActive ? 'scrolly-entry--active' : ''}`}
    >
      {/* Day number and date header */}
      <div className="scrolly-entry__header">
        <div className="scrolly-entry__day">
          <span className="scrolly-entry__day-num">Day {dayNumber}</span>
          <span className="scrolly-entry__date">
            {format(new Date(displayDate), 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
        <div className="scrolly-entry__location">
          <MapPin size={14} />
          <span>
            {entry.location.city || entry.location.placeName || 'Unknown'}
            {entry.location.country ? `, ${entry.location.country}` : ''}
          </span>
        </div>
      </div>

      {/* Mood badge */}
      {entry.mood && (
        <div
          className="scrolly-entry__mood"
          style={{ '--mood-color': moodColor } as React.CSSProperties}
        >
          <span>{MOOD_EMOJI[entry.mood] || ''}</span>
          <span>{entry.mood}</span>
        </div>
      )}

      {/* Title */}
      <h2 className="scrolly-entry__title">{entry.title}</h2>

      {/* Journal content */}
      <div className="scrolly-entry__content">
        {entry.content.split('\n').map((paragraph, i) => (
          paragraph.trim() ? <p key={i}>{paragraph}</p> : null
        ))}
      </div>

      {/* Photos */}
      {entry.photos.length > 0 && (
        <div className="scrolly-entry__photos">
          {entry.photos.map((photo) => (
            <div key={photo.id} className="scrolly-entry__photo-wrap">
              <img
                src={photo.dataUrl}
                alt={photo.caption || 'Journal photo'}
                className="scrolly-entry__photo"
                loading="lazy"
              />
              {photo.caption && (
                <p className="scrolly-entry__photo-caption">{photo.caption}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* News section */}
      {entry.newsHeadline && (
        <div className="scrolly-entry__news">
          <div className="scrolly-entry__news-header">
            <Newspaper size={14} />
            <span>The World That Day</span>
          </div>
          <p className="scrolly-entry__news-text">{entry.newsHeadline}</p>
        </div>
      )}

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="scrolly-entry__tags">
          {entry.tags.map((tag) => (
            <span key={tag} className="scrolly-entry__tag">
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
