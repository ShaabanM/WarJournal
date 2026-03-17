import type { JournalEntry } from '../../types';

interface ArtNavProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onEntryClick: (entryId: string) => void;
}

export default function ArtNav({ entries, activeEntryId, onEntryClick }: ArtNavProps) {
  if (entries.length === 0) return null;

  return (
    <nav className="art-nav" aria-label="Entry navigation">
      {entries.map((entry) => (
        <button
          key={entry.id}
          className={`art-nav__dot ${activeEntryId === entry.id ? 'art-nav__dot--active' : ''}`}
          onClick={() => onEntryClick(entry.id)}
          aria-label={entry.title}
          title={entry.title}
        />
      ))}
    </nav>
  );
}
