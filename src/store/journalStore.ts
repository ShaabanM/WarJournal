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
    // Always read fresh from IndexedDB to avoid race conditions
    // (handleSave calls addEntry then publish fire-and-forget)
    const allEntries = await db.getAllEntries();
    const published = allEntries.filter((e) => e.isPublished);
    const success = await publishEntries(
      {
        token: settings.githubToken,
        owner: settings.githubOwner,
        repo: settings.githubRepo,
      },
      published
    );
    set({ isPublishing: false });
    return success;
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
