import { useCallback } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { MapPin } from 'lucide-react';
import { getEntryDisplayDate } from '../../store/journalStore';
import { getMoodColor } from '../../utils/sentiment';
import type { JournalEntry } from '../../types';

const WAR_DAY_ONE = new Date('2026-02-28T00:00:00');

/** Convert number to Roman numerals */
function toRoman(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) {
      result += syms[i];
      n -= vals[i];
    }
  }
  return result;
}

interface TomePageProps {
  entry: JournalEntry;
  chapterNumber: number;
  registerRef: (entryId: string, el: Element | null) => void;
}

export default function TomePage({ entry, chapterNumber, registerRef }: TomePageProps) {
  const refCallback = useCallback(
    (el: HTMLDivElement | null) => registerRef(entry.id, el),
    [entry.id, registerRef]
  );

  const displayDate = getEntryDisplayDate(entry);
  const dayNumber = differenceInCalendarDays(new Date(displayDate), WAR_DAY_ONE) + 1;
  const moodColor = getMoodColor(entry.mood, entry.moodColor);

  const photos = entry.photos.filter((p) => p.dataUrl || p.remoteUrl);

  const locationText = [
    entry.location.city || entry.location.placeName,
    entry.location.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="tome-page-wrap" ref={refCallback} data-entry-id={entry.id}>
      <div className="tome-page" data-reveal>
        {/* Chapter heading */}
        <p className="tome-page__chapter">
          Day {dayNumber} &middot; Chapter {toRoman(chapterNumber)}
        </p>
        <p className="tome-page__date">
          {format(new Date(displayDate), 'EEEE, the do \'of\' MMMM, yyyy')}
        </p>

        {/* Title */}
        <h2 className="tome-page__title">{entry.title}</h2>

        {/* Location */}
        {locationText && (
          <p className="tome-page__location">
            <MapPin size={11} />
            <span>{locationText}</span>
          </p>
        )}

        {/* Mood */}
        {entry.mood && (
          <p className="tome-page__mood">
            <span className="tome-page__mood-dot" style={{ background: moodColor }} />
            <span>{entry.mood}</span>
          </p>
        )}

        {/* Prose with illuminated drop cap */}
        <div className="tome-page__prose">
          {entry.content.split('\n').map((paragraph, i) =>
            paragraph.trim() ? <p key={i}>{paragraph}</p> : null
          )}
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="tome-page__photos">
            {photos.map((photo) => (
              <div key={photo.id} className="tome-page__photo-wrap">
                <img
                  src={photo.dataUrl || photo.remoteUrl}
                  alt={photo.caption || 'Journal photo'}
                  loading="lazy"
                />
                {photo.caption && (
                  <p className="tome-page__photo-caption">{photo.caption}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* News / Tidings */}
        {entry.newsHeadline && (
          <div className="tome-page__news">
            <p className="tome-page__news-label">Tidings from the World</p>
            <p className="tome-page__news-text">{entry.newsHeadline}</p>
          </div>
        )}

        {/* Ornamental fleuron at bottom */}
        <p className="tome-page__fleuron" aria-hidden="true">
          &#x2766; &#x2726; &#x2767;
        </p>
      </div>
    </div>
  );
}
