import { create } from 'zustand';
import type { JournalEntry, AppSettings } from '../types';
import * as db from '../utils/db';
import { publishEntries, fetchPublishedEntries } from '../utils/github';
import { sortEntriesChronologically } from '../utils/journal';

interface JournalState {
  entries: JournalEntry[];
  selectedEntry: JournalEntry | null;
  previewEntry: JournalEntry | null;
  settings: AppSettings;
  isLoading: boolean;
  isPublishing: boolean;
  viewMode: 'reader' | 'author';
  mapCenter: [number, number];
  mapZoom: number;
  searchQuery: string;
  filterMood: string | null;
  showEntryDetail: boolean;

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
  saveSettings: (settings: AppSettings) => Promise<void>;
  publish: () => Promise<boolean>;
  flyToEntry: (entry: JournalEntry) => void;
  previewEntryOnMap: (entry: JournalEntry) => void;
  clearPreviewEntry: () => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  selectedEntry: null,
  previewEntry: null,
  settings: {
    authorName: 'Traveler',
    journalTitle: 'War Journal',
    journalSubtitle: 'Field notes from a world unspooling in real time.',
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

  loadEntries: async () => {
    set({ isLoading: true });
    const entries = await db.getAllEntries();
    set({ entries, isLoading: false });
  },

  loadPublishedEntries: async () => {
    set({ isLoading: true });
    const { settings } = get();

    // Always load local entries first — author's entries on this device
    const localEntries = (await db.getAllEntries()).filter((entry) => entry.isPublished);

    // Then try to load remote/published entries
    let remoteEntries: JournalEntry[] = [];

    if (settings.githubOwner && settings.githubRepo) {
      remoteEntries = await fetchPublishedEntries(settings.githubOwner, settings.githubRepo);
    }

    // If no remote entries found, try the bundled data file
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
    set((state) => ({
      selectedEntry: entry,
      showEntryDetail: !!entry,
      previewEntry:
        entry && !entry.isPublished && state.previewEntry?.id === entry.id ? state.previewEntry : null,
    }));
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterMood: (mood) => set({ filterMood: mood }),
  setShowEntryDetail: (show) => set({ showEntryDetail: show }),

  saveSettings: async (settings) => {
    await db.saveSettings(settings);
    set({ settings });
  },

  publish: async () => {
    const { settings, entries } = get();
    if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) {
      return false;
    }
    set({ isPublishing: true });
    const published = entries.filter((e) => e.isPublished);
    const success = await publishEntries(
      {
        token: settings.githubToken,
        owner: settings.githubOwner,
        repo: settings.githubRepo,
      },
      published
    );
    if (success) {
      const updatedSettings = {
        ...settings,
        lastPublishedAt: new Date().toISOString(),
      };
      await db.saveSettings(updatedSettings);
      set({ settings: updatedSettings, isPublishing: false });
      return true;
    }

    set({ isPublishing: false });
    return success;
  },

  flyToEntry: (entry) => {
    set({
      mapCenter: [entry.location.lng, entry.location.lat],
      mapZoom: 10,
      selectedEntry: entry,
      showEntryDetail: true,
      previewEntry: entry.isPublished ? null : get().previewEntry,
    });
  },

  previewEntryOnMap: (entry) => {
    set({
      mapCenter: [entry.location.lng, entry.location.lat],
      mapZoom: 10,
      selectedEntry: entry,
      showEntryDetail: true,
      previewEntry: entry,
    });
  },

  clearPreviewEntry: () => set({ previewEntry: null }),
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
        entry.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

export function useSortedEntries(): JournalEntry[] {
  const entries = useFilteredEntries();
  return sortEntriesChronologically(entries);
}
