import { useJournalStore, useSortedEntries } from '../store/journalStore';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';

const MOOD_EMOJI: Record<string, string> = {
  hopeful: '🌅', anxious: '😰', grateful: '🙏', reflective: '🪞',
  determined: '💪', somber: '🌧️', joyful: '✨', exhausted: '😮‍💨',
};

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

export default function Timeline() {
  const entries = useSortedEntries();
  const { flyToEntry, selectedEntry } = useJournalStore();

  if (entries.length === 0) return null;

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
            <div className="timeline-month-label">{month}</div>
            {monthEntries.map((entry) => {
              const moodColor = entry.mood ? MOOD_COLORS[entry.mood] : '#f0a500';
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
                      {entry.mood && <span className="timeline-mood">{MOOD_EMOJI[entry.mood]}</span>}
                    </div>
                    <div className="timeline-title">{entry.title}</div>
                    <div className="timeline-location">
                      <MapPin size={10} />
                      {entry.location.city || entry.location.country || 'Unknown'}
                    </div>
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
