import Dexie, { type Table } from 'dexie';
import type { JournalEntry, AppSettings } from '../types';

class WarJournalDB extends Dexie {
  entries!: Table<JournalEntry, string>;
  settings!: Table<AppSettings & { id: number }, number>;

  constructor() {
    super('WarJournalDB');
    this.version(1).stores({
      entries: 'id, timestamp, isPublished, [location.lat+location.lng]',
      settings: 'id',
    });
  }
}

export const db = new WarJournalDB();

// Entry CRUD
export async function getAllEntries(): Promise<JournalEntry[]> {
  return db.entries.orderBy('timestamp').reverse().toArray();
}

export async function getPublishedEntries(): Promise<JournalEntry[]> {
  return db.entries.where('isPublished').equals(1).reverse().sortBy('timestamp');
}

export async function getEntry(id: string): Promise<JournalEntry | undefined> {
  return db.entries.get(id);
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  await db.entries.put(entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.get(1);
  return settings ?? {
    id: 1,
    authorName: 'Traveler',
    mapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ ...settings, id: 1 });
}

// Export all data as JSON (for publishing)
export async function exportAllData(): Promise<{ entries: JournalEntry[]; exportedAt: string }> {
  const entries = await getPublishedEntries();
  return {
    entries,
    exportedAt: new Date().toISOString(),
  };
}
