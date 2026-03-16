import { create } from 'zustand';
import type { JournalEntry, AppSettings } from '../types';
import * as db from '../utils/db';
import { publishEntries, fetchPublishedEntries, deriveGitHubInfo } from '../utils/github';

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

interface JournalState {
  entries: JournalEntry[];
  selectedEntry: JournalEntry | null;
  settings: AppSettings;
  isLoading: boolean;
  isPublishing: boolean;
  viewMode: 'reader' | 'author';
  mapCenter: [number, number];
  mapZoom: number;
  searchQuery: string;
  filterMood: string | null;
  showEntryDetail: boolean;
  activeEntryId: string | null;
  toasts: Toast[];

  // Actions
  loadEntries: () => Promise<void>;
  loadPublishedEntries: () => Promise<void>;
  loadSettings: () => Promise<void>;
  addEntry: (entry: JournalEntry) => Promise<void>;
  updateEntry: (entry: JournalEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  selectEntry: (entry: JournalEntry | null) => void;
  setViewMode: (mode: 'reader' | 'author') => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setSearchQuery: (query: string) => void;
  setFilterMood: (mood: string | null) => void;
  setShowEntryDetail: (show: boolean) => void;
  setActiveEntryId: (id: string | null) => void;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: number) => void;
  publish: () => Promise<boolean>;
  syncEntries: () => Promise<void>;
  flyToEntry: (entry: JournalEntry) => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  selectedEntry: null,
  settings: {
    authorName: 'Traveler',
    mapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  isLoading: false,
  isPublishing: false,
  viewMode: 'reader',
  mapCenter: [20, 30],
  mapZoom: 2.5,
  searchQuery: '',
  filterMood: null,
  showEntryDetail: false,
  activeEntryId: null,
  toasts: [],

  loadEntries: async () => {
    set({ isLoading: true });
    const entries = await db.getAllEntries();
    set({ entries, isLoading: false });
  },

  loadPublishedEntries: async () => {
    set({ isLoading: true });
    const { settings } = get();

    // Load local published entries only (don't leak drafts into reader view)
    const localEntries = (await db.getAllEntries()).filter((e) => e.isPublished);

    // Determine GitHub owner/repo: use settings if available, otherwise derive from URL
    let owner = settings.githubOwner;
    let repo = settings.githubRepo;

    if (!owner || !repo) {
      const derived = deriveGitHubInfo();
      if (derived) {
        owner = derived.owner;
        repo = derived.repo;
      }
    }

    // Then try to load remote/published entries
    let remoteEntries: JournalEntry[] = [];

    if (owner && repo) {
      remoteEntries = await fetchPublishedEntries(owner, repo);
    }

    // Last resort: try the bundled static data file
    if (remoteEntries.length === 0) {
      try {
        const res = await fetch(import.meta.env.BASE_URL + 'data/entries.json');
        if (res.ok) {
          const data = await res.json();
          remoteEntries = data.entries || [];
        }
      } catch { /* ignore */ }
    }

    // Merge: local entries take priority (they may be newer), remote fills gaps
    const mergedMap = new Map<string, JournalEntry>();
    for (const entry of remoteEntries) {
      mergedMap.set(entry.id, entry);
    }
    for (const entry of localEntries) {
      mergedMap.set(entry.id, entry); // local overwrites remote for same ID
    }

    const merged = Array.from(mergedMap.values());
    set({ entries: merged, isLoading: false });
  },

  loadSettings: async () => {
    const settings = await db.getSettings();
    // Apply theme to DOM
    const theme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    set({ settings });
  },

  addEntry: async (entry) => {
    await db.saveEntry(entry);
    const entries = await db.getAllEntries();
    set({ entries });
  },

  updateEntry: async (entry) => {
    await db.saveEntry({ ...entry, updatedAt: new Date().toISOString() });
    const entries = await db.getAllEntries();
    set({ entries, selectedEntry: entry });
  },

  deleteEntry: async (id) => {
    await db.deleteEntry(id);
    const entries = await db.getAllEntries();
    set({ entries, selectedEntry: null, showEntryDetail: false });
  },

  selectEntry: (entry) => {
    set({ selectedEntry: entry, showEntryDetail: !!entry });
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterMood: (mood) => set({ filterMood: mood }),
  setShowEntryDetail: (show) => set({ showEntryDetail: show }),
  setActiveEntryId: (id) => set({ activeEntryId: id }),

  saveSettings: async (settings) => {
    await db.saveSettings(settings);
    set({ settings });
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    const { settings } = get();
    const updated = { ...settings, theme };
    db.saveSettings(updated);
    set({ settings: updated });
  },

  showToast: (message, type = 'info') => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { message, type, id }] }));
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  publish: async () => {
    const { settings } = get();
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) {
      return false;
    }
    set({ isPublishing: true });

    const owner = settings.githubOwner;
    const repo = settings.githubRepo;

    // 1. Read ALL local entries from IndexedDB (both published and drafts)
    const allLocalEntries = await db.getAllEntries();
    const localById = new Map<string, JournalEntry>();
    for (const e of allLocalEntries) {
      localById.set(e.id, e);
    }

    // 2. Fetch existing remote entries so we MERGE instead of overwrite
    let remoteEntries: JournalEntry[] = [];
    try {
      remoteEntries = await fetchPublishedEntries(owner, repo);
    } catch {
      // If remote fetch fails, proceed with local-only
    }

    // 3. Smart merge with photo preservation:
    //    - For entries that exist both locally and remotely: keep the one
    //      with the newer updatedAt, BUT always merge photos from both
    //      (local dataUrl + remote remoteUrl) so photo data is never lost.
    //    - For entries only on remote: keep them (from other devices).
    //    - For entries only local and published: add them.
    //    - For entries only local and draft: skip (don't publish).
    const mergedMap = new Map<string, JournalEntry>();

    // Helper: merge photos from two versions of the same entry.
    // Preserves local dataUrl and remote remoteUrl for each photo.
    const mergePhotos = (primary: JournalEntry, secondary: JournalEntry): JournalEntry => {
      const photoMap = new Map(primary.photos.map((p) => [p.id, { ...p }]));
      for (const sp of secondary.photos) {
        const existing = photoMap.get(sp.id);
        if (existing) {
          // Merge: prefer non-empty values from either side
          if (!existing.dataUrl && sp.dataUrl) existing.dataUrl = sp.dataUrl;
          if (!existing.remoteUrl && sp.remoteUrl) existing.remoteUrl = sp.remoteUrl;
        } else {
          photoMap.set(sp.id, { ...sp });
        }
      }
      return { ...primary, photos: Array.from(photoMap.values()) };
    };

    // Start with remote entries
    for (const remote of remoteEntries) {
      const local = localById.get(remote.id);

      if (!local) {
        // Entry exists remotely but NOT locally — from another device. Keep it.
        mergedMap.set(remote.id, remote);
      } else if (!local.isPublished) {
        // Entry exists locally as draft (unpublished) — author wants it removed
        // from the public feed. Don't add it to merged.
      } else {
        // Both exist and local is published — keep newer, merge photos from both
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();
        const winner = localTime >= remoteTime ? local : remote;
        const loser = localTime >= remoteTime ? remote : local;
        mergedMap.set(remote.id, mergePhotos(winner, loser));
      }
    }

    // Add local-only published entries (new entries from this device)
    for (const local of allLocalEntries) {
      if (local.isPublished && !mergedMap.has(local.id)) {
        mergedMap.set(local.id, local);
      }
    }

    const merged = Array.from(mergedMap.values());

    const result = await publishEntries(
      { token: settings.githubToken, owner, repo },
      merged
    );

    // Save remoteUrls back to local IndexedDB so we don't re-upload next time
    if (result.success) {
      for (const entry of result.entries) {
        const localEntry = localById.get(entry.id);
        if (localEntry) {
          // Merge remoteUrls into local entry (preserve local dataUrl)
          const updatedPhotos = localEntry.photos.map((lp) => {
            const published = entry.photos.find((pp) => pp.id === lp.id);
            return published?.remoteUrl ? { ...lp, remoteUrl: published.remoteUrl } : lp;
          });
          await db.saveEntry({ ...localEntry, photos: updatedPhotos });
        }
      }
      // Refresh entries in store
      const entries = await db.getAllEntries();
      set({ entries });
    }

    set({ isPublishing: false });
    return result.success;
  },

  syncEntries: async () => {
    const { settings, showToast: toast } = get();
    const owner = settings.githubOwner;
    const repo = settings.githubRepo;

    if (!owner || !repo) {
      const derived = deriveGitHubInfo();
      if (!derived) {
        toast('Cannot sync — GitHub not configured', 'error');
        return;
      }
    }

    set({ isLoading: true });

    try {
      const remoteEntries = await fetchPublishedEntries(
        owner || deriveGitHubInfo()!.owner,
        repo || deriveGitHubInfo()!.repo
      );

      if (remoteEntries.length === 0) {
        toast('No remote entries found', 'info');
        set({ isLoading: false });
        return;
      }

      // Merge remote entries into local IndexedDB
      const localEntries = await db.getAllEntries();
      const localById = new Map(localEntries.map((e) => [e.id, e]));
      let added = 0;
      let updated = 0;

      for (const remote of remoteEntries) {
        const local = localById.get(remote.id);
        if (!local) {
          // New entry from another device — import it
          await db.saveEntry(remote);
          added++;
        } else {
          // Exists locally — update if remote is newer
          const localTime = new Date(local.updatedAt).getTime();
          const remoteTime = new Date(remote.updatedAt).getTime();
          if (remoteTime > localTime) {
            // Preserve local photo data (remote has stripped photos)
            const merged = { ...remote, photos: local.photos };
            await db.saveEntry(merged);
            updated++;
          }
        }
      }

      // Refresh the entries list
      const entries = await db.getAllEntries();
      set({ entries, isLoading: false });
      toast(`Synced: ${added} new, ${updated} updated from remote`, 'success');
    } catch (err) {
      console.error('Sync failed:', err);
      toast('Sync failed — check your connection', 'error');
      set({ isLoading: false });
    }
  },

  flyToEntry: (entry) => {
    set({
      mapCenter: [entry.location.lng, entry.location.lat],
      mapZoom: 10,
      selectedEntry: entry,
      showEntryDetail: true,
    });
  },
}));

// Derived selectors
export function useFilteredEntries(): JournalEntry[] {
  const entries = useJournalStore((s) => s.entries);
  const searchQuery = useJournalStore((s) => s.searchQuery);
  const filterMood = useJournalStore((s) => s.filterMood);

  return entries.filter((entry) => {
    if (filterMood && entry.mood !== filterMood) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q) ||
        entry.location.placeName?.toLowerCase().includes(q) ||
        entry.location.city?.toLowerCase().includes(q) ||
        entry.location.country?.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q)) ||
        entry.mood?.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

/** Returns the display date for an entry — prefers manualDate over timestamp */
export function getEntryDisplayDate(entry: JournalEntry): string {
  return entry.manualDate || entry.timestamp;
}

export function useSortedEntries(): JournalEntry[] {
  const entries = useFilteredEntries();
  return [...entries].sort(
    (a, b) =>
      new Date(getEntryDisplayDate(a)).getTime() -
      new Date(getEntryDisplayDate(b)).getTime()
  );
}
