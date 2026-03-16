import { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { getEntryDisplayDate } from '../store/journalStore';
import { getMoodColor } from '../utils/sentiment';
import type { JournalEntry } from '../types';

interface TimelineProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onEntryClick: (entryId: string) => void;
}

export default function Timeline({ entries, activeEntryId, onEntryClick }: TimelineProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active entry into view in sidebar
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeEntryId]);

  if (entries.length === 0) return null;

  // Group by month
  const grouped = entries.reduce<Record<string, JournalEntry[]>>((acc, entry) => {
    const key = format(new Date(getEntryDisplayDate(entry)), 'MMMM yyyy');
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="sidebar-timeline">
      <div className="sidebar-timeline__track">
        {Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month} className="sidebar-timeline__month">
            <div className="sidebar-timeline__month-label">{month}</div>
            {monthEntries.map((entry) => {
              const moodColor = getMoodColor(entry.mood);
              const isActive = activeEntryId === entry.id;

              return (
                <button
                  key={entry.id}
                  ref={isActive ? activeRef : undefined}
                  className={`sidebar-timeline__entry ${isActive ? 'active' : ''}`}
                  onClick={() => onEntryClick(entry.id)}
                  style={{ '--entry-color': moodColor } as React.CSSProperties}
                >
                  <div className="sidebar-timeline__dot" />
                  <div className="sidebar-timeline__info">
                    <span className="sidebar-timeline__date">
                      {format(new Date(getEntryDisplayDate(entry)), 'MMM d')}
                    </span>
                    <span className="sidebar-timeline__city">
                      <MapPin size={9} />
                      {entry.location.city || entry.location.country || '?'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
