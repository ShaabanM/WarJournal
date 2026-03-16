import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';
import type { GeoLocation, JournalEntry } from '../types';
import { getMoodMeta } from '../constants/moods';

const WORDS_PER_MINUTE = 200;

export function sortEntriesChronologically(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function sortEntriesReverseChronologically(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getLatestEntry(entries: JournalEntry[]): JournalEntry | null {
  return sortEntriesChronologically(entries).at(-1) ?? null;
}

export function getFirstEntry(entries: JournalEntry[]): JournalEntry | null {
  return sortEntriesChronologically(entries)[0] ?? null;
}

export function getPublishedCount(entries: JournalEntry[]): number {
  return entries.filter((entry) => entry.isPublished).length;
}

export function getDraftCount(entries: JournalEntry[]): number {
  return entries.filter((entry) => !entry.isPublished).length;
}

export function getTotalPhotos(entries: JournalEntry[]): number {
  return entries.reduce((total, entry) => total + entry.photos.length, 0);
}

export function getUniqueCountries(entries: JournalEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.location.country).filter(Boolean))] as string[];
}

export function getWordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function getTotalWordCount(entries: JournalEntry[]): number {
  return entries.reduce((total, entry) => total + getWordCount(entry.content), 0);
}

export function getReadingTimeMinutes(text: string): number {
  return Math.max(1, Math.ceil(getWordCount(text) / WORDS_PER_MINUTE));
}

export function getJourneyRangeLabel(entries: JournalEntry[]): string {
  if (entries.length === 0) return 'No dispatches yet';
  const ordered = sortEntriesChronologically(entries);
  const first = ordered[0];
  const last = ordered.at(-1)!;

  if (first.id === last.id) {
    return format(new Date(first.timestamp), 'MMMM d, yyyy');
  }

  return `${format(new Date(first.timestamp), 'MMM d, yyyy')} to ${format(new Date(last.timestamp), 'MMM d, yyyy')}`;
}

export function getJourneyDurationLabel(entries: JournalEntry[]): string {
  if (entries.length < 2) return 'First dispatch logged today';
  const ordered = sortEntriesChronologically(entries);
  const first = new Date(ordered[0].timestamp);
  const last = new Date(ordered.at(-1)!.timestamp);
  const days = differenceInCalendarDays(last, first);
  if (days <= 0) return 'Multiple updates in one day';
  if (days === 1) return '2-day journey arc';
  return `${days + 1}-day journey arc`;
}

export function getRelativeTimestampLabel(timestamp?: string): string {
  if (!timestamp) return 'Never';
  return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
}

export function getLocationLabel(location: GeoLocation): string {
  return location.city || location.placeName || location.country || 'Unknown location';
}

export function getExcerpt(content: string, maxLength = 150): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function getMoodBreakdown(entries: JournalEntry[]): Array<{
  mood: JournalEntry['mood'];
  count: number;
  label: string;
  emoji: string;
  color: string;
}> {
  const counts = new Map<JournalEntry['mood'], number>();

  for (const entry of entries) {
    if (!entry.mood) continue;
    counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([mood, count]) => {
      const meta = getMoodMeta(mood);
      return {
        mood,
        count,
        label: meta?.label ?? 'Unknown',
        emoji: meta?.emoji ?? '📝',
        color: meta?.color ?? '#f0a500',
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function getDistinctTags(entries: JournalEntry[]): string[] {
  return [...new Set(entries.flatMap((entry) => entry.tags))].sort((a, b) =>
    a.localeCompare(b)
  );
}
