import { useCallback } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { MapPin } from 'lucide-react';
import { getEntryDisplayDate } from '../../store/journalStore';
import { getMoodColor } from '../../utils/sentiment';
import type { JournalEntry } from '../../types';

const WAR_DAY_ONE = new Date('2026-02-28T00:00:00');

interface ArtEntryProps {
  entry: JournalEntry;
  registerRef: (entryId: string, el: Element | null) => void;
}

export default function ArtEntry({ entry, registerRef }: ArtEntryProps) {
  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      registerRef(entry.id, el);
    },
    [entry.id, registerRef]
  );

  const displayDate = getEntryDisplayDate(entry);
  const dayNumber = differenceInCalendarDays(new Date(displayDate), WAR_DAY_ONE) + 1;
  const moodColor = getMoodColor(entry.mood, entry.moodColor);

  const validPhotos = entry.photos.filter((p) => p.dataUrl || p.remoteUrl);
  const hasPhotos = validPhotos.length > 0;
  const heroPhoto = hasPhotos ? validPhotos[0] : null;
  const galleryPhotos = validPhotos.slice(1);

  const locationText = [
    entry.location.city || entry.location.placeName,
    entry.location.country,
  ]
    .filter(Boolean)
    .join(', ');

  const dateLabel = `Day ${dayNumber} — ${format(new Date(displayDate), 'MMMM d, yyyy')}`;

  return (
    <div
      ref={refCallback}
      className="art-entry"
      data-entry-id={entry.id}
    >
      {/* --- HERO: Photo or Typography variant --- */}
      {hasPhotos && heroPhoto ? (
        <div className="art-entry__photo-hero">
          <img
            src={heroPhoto.dataUrl || heroPhoto.remoteUrl}
            alt={heroPhoto.caption || entry.title}
            loading="lazy"
          />
          <div className="art-entry__photo-scrim" />
          <div className="art-entry__photo-info" data-reveal>
            <span className="art-label">{dateLabel}</span>
            <h2 className="art-entry__photo-title">{entry.title}</h2>
            {locationText && (
              <div className="art-entry__photo-location">
                <MapPin size={12} />
                <span>{locationText}</span>
              </div>
            )}
            {entry.mood && (
              <div className="art-entry__photo-mood">
                <span
                  className="art-entry__mood-dot"
                  style={{ background: moodColor }}
                />
                <span>{entry.mood}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="art-entry__type-hero">
          <div className="art-entry__day-bg" aria-hidden="true">
            {dayNumber}
          </div>
          <div data-reveal>
            <span className="art-label">{dateLabel}</span>
            <h2 className="art-entry__type-title">{entry.title}</h2>
            {locationText && (
              <div className="art-entry__photo-location">
                <MapPin size={12} />
                <span>{locationText}</span>
              </div>
            )}
            {entry.mood && (
              <div className="art-entry__photo-mood">
                <span
                  className="art-entry__mood-dot"
                  style={{ background: moodColor }}
                />
                <span>{entry.mood}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- PROSE --- */}
      <div className="art-prose" data-reveal data-reveal-stagger>
        {entry.content.split('\n').map((paragraph, i) =>
          paragraph.trim() ? <p key={i}>{paragraph}</p> : null
        )}
      </div>

      {/* --- GALLERY (additional photos) --- */}
      {galleryPhotos.length > 0 && (
        <div className="art-gallery" data-reveal>
          {galleryPhotos.map((photo) => (
            <figure key={photo.id}>
              <img
                src={photo.dataUrl || photo.remoteUrl}
                alt={photo.caption || 'Journal photo'}
                loading="lazy"
              />
              {photo.caption && <figcaption>{photo.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {/* --- NEWS --- */}
      {entry.newsHeadline && (
        <div className="art-news" data-reveal>
          <div className="art-news__card">
            <span className="art-label">The World That Day</span>
            <p className="art-news__headline">{entry.newsHeadline}</p>
          </div>
        </div>
      )}

      {/* --- TAGS --- */}
      {entry.tags.length > 0 && (
        <div className="art-tags">
          {entry.tags.map((tag) => (
            <span key={tag} className="art-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
