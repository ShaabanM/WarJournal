import { useJournalStore, useSortedEntries } from '../store/journalStore';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { DEFAULT_MOOD_COLOR, getMoodMeta } from '../constants/moods';
import { getExcerpt, getLocationLabel } from '../utils/journal';

export default function Timeline() {
  const entries = useSortedEntries();
  const { flyToEntry, selectedEntry } = useJournalStore();

  if (entries.length === 0) {
    return (
      <div className="timeline timeline-empty">
        <h3>No dispatches to show yet</h3>
        <p>Published entries will appear here in chronological order.</p>
      </div>
    );
  }

  // Group by month
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const key = format(new Date(entry.timestamp), 'MMMM yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="timeline">
      <div className="timeline-track">
        {Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month} className="timeline-month">
            <div className="timeline-month-label">
              <span>{month}</span>
              <span>{monthEntries.length} entries</span>
            </div>
            {monthEntries.map((entry) => {
              const mood = getMoodMeta(entry.mood);
              const moodColor = mood?.color ?? DEFAULT_MOOD_COLOR;
              const isSelected = selectedEntry?.id === entry.id;

              return (
                <button
                  key={entry.id}
                  className={`timeline-entry ${isSelected ? 'selected' : ''}`}
                  onClick={() => flyToEntry(entry)}
                  style={{ '--entry-color': moodColor } as React.CSSProperties}
                >
                  <div className="timeline-dot" />
                  <div className="timeline-connector" />
                  <div className="timeline-content">
                    <div className="timeline-date">
                      {format(new Date(entry.timestamp), 'MMM d')}
                      {mood ? <span className="timeline-mood">{mood.emoji}</span> : null}
                    </div>
                    <div className="timeline-title">{entry.title}</div>
                    <div className="timeline-location">
                      <MapPin size={10} />
                      {getLocationLabel(entry.location)}
                    </div>
                    <p className="timeline-excerpt">{getExcerpt(entry.content, 110)}</p>
                  </div>
                  {entry.photos.length > 0 && (
                    <img
                      src={entry.photos[0].dataUrl}
                      alt=""
                      className="timeline-thumb"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
