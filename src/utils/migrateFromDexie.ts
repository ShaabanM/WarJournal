/**
 * One-time migration: copy settings from the old Dexie IndexedDB to localStorage,
 * then delete the old database. Runs once on app startup.
 * Uses raw IndexedDB API (not Dexie) so this works after Dexie is removed.
 */
import { getSettings, saveSettings } from './settings';

export async function migrateFromDexie(): Promise<void> {
  const MIGRATED_KEY = 'warjournal-migrated';
  if (localStorage.getItem(MIGRATED_KEY)) return; // already done

  try {
    // Check if the old DB exists by trying to open it
    const dbRequest = indexedDB.open('WarJournalDB');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      dbRequest.onsuccess = () => resolve(dbRequest.result);
      dbRequest.onerror = () => reject(dbRequest.error);
      // If the DB doesn't exist, onsuccess still fires but with no stores
    });

    // Read old settings if the store exists
    if (db.objectStoreNames.contains('settings')) {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const oldSettings = await new Promise<Record<string, unknown> | null>((resolve) => {
        const req = store.get(1);
        req.onsuccess = () => resolve(req.result as Record<string, unknown> | null);
        req.onerror = () => resolve(null);
      });

      if (oldSettings) {
        // Merge old settings into current localStorage settings
        const current = getSettings();
        const merged = { ...current };
        if (oldSettings.authorName) merged.authorName = oldSettings.authorName as string;
        if (oldSettings.githubToken) merged.githubToken = oldSettings.githubToken as string;
        if (oldSettings.githubOwner) merged.githubOwner = oldSettings.githubOwner as string;
        if (oldSettings.githubRepo) merged.githubRepo = oldSettings.githubRepo as string;
        if (oldSettings.authorPin) merged.authorPin = oldSettings.authorPin as string;
        if (oldSettings.theme) merged.theme = oldSettings.theme as 'dark' | 'light';
        saveSettings(merged);
      }
    }

    db.close();

    // Delete the old database
    indexedDB.deleteDatabase('WarJournalDB');
  } catch {
    // Old DB doesn't exist or can't be read — that's fine
  }

  localStorage.setItem(MIGRATED_KEY, '1');
}
