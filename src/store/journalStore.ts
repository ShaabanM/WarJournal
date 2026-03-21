import { create } from 'zustand';
import type { JournalEntry, EntryPhoto } from '../types';
import {
  fetchEntriesFromApi,
  fetchPublishedEntries,
  putEntries,
  uploadPhoto,
  deletePhotosForEntry,
  deriveGitHubInfo,
  enqueueMutation,
} from '../utils/github';
import {
  getSettings as readSettings,
  saveSettings as writeSettings,
} from '../utils/settings';
import type { AppSettings } from '../types';

interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

interface JournalState {
  entries: JournalEntry[];
  entriesSha: string;
  selectedEntry: JournalEntry | null;
  settings: AppSettings;
  isLoading: boolean;
  isSaving: boolean;
  viewMode: 'reader' | 'author' | 'map';
  mapCenter: [number, number];
  mapZoom: number;
  searchQuery: string;
  filterMood: string | null;
  showEntryDetail: boolean;
  activeEntryId: string | null;
  toasts: Toast[];

  // Actions
  loadEntries: () => Promise<void>;
  loadSettings: () => void;
  addEntry: (entry: JournalEntry) => Promise<void>;
  updateEntry: (entry: JournalEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  selectEntry: (entry: JournalEntry | null) => void;
  setViewMode: (mode: 'reader' | 'author' | 'map') => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setSearchQuery: (query: string) => void;
  setFilterMood: (mood: string | null) => void;
  setShowEntryDetail: (show: boolean) => void;
  setActiveEntryId: (id: string | null) => void;
  saveSettings: (settings: AppSettings) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: number) => void;
  flyToEntry: (entry: JournalEntry) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGitHubConfig(settings: AppSettings): GitHubConfig | null {
  if (!settings.githubToken || !settings.githubOwner || !settings.githubRepo) {
    return null;
  }
  return {
    token: settings.githubToken,
    owner: settings.githubOwner,
    repo: settings.githubRepo,
  };
}

/**
 * Upload any photos that have a local dataUrl but no remoteUrl yet.
 * Returns the photos array with remoteUrls populated (dataUrl cleared).
 */
async function uploadEntryPhotos(
  config: GitHubConfig,
  entryId: string,
  photos: EntryPhoto[]
): Promise<EntryPhoto[]> {
  const result: EntryPhoto[] = [];
  for (const photo of photos) {
    if (photo.remoteUrl) {
      // Already uploaded — just keep remoteUrl, clear dataUrl
      result.push({ ...photo, dataUrl: '' });
      continue;
    }
    if (!photo.dataUrl) {
      result.push(photo);
      continue;
    }
    // New photo — upload it
    const remoteUrl = await uploadPhoto(config, entryId, photo.dataUrl, photo.id);
    result.push({
      ...photo,
      dataUrl: '', // never persist base64
      remoteUrl: remoteUrl || undefined,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  entriesSha: '',
  selectedEntry: null,
  settings: {
    authorName: 'Traveler',
    mapStyle: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  isLoading: false,
  isSaving: false,
  viewMode: 'reader',
  mapCenter: [20, 30],
  mapZoom: 2.5,
  searchQuery: '',
  filterMood: null,
  showEntryDetail: false,
  activeEntryId: null,
  toasts: [],

  // -------------------------------------------------------------------------
  // Load entries — different behaviour for author vs reader mode
  // -------------------------------------------------------------------------

  loadEntries: async () => {
    set({ isLoading: true });
    const { settings, viewMode } = get();

    const config = getGitHubConfig(settings);

    if (viewMode === 'author' && config) {
      // Author mode: fetch via API (gets SHA for mutations)
      try {
        const { entries, sha } = await fetchEntriesFromApi(config);
        set({ entries, entriesSha: sha, isLoading: false });
      } catch (err) {
        console.error('Failed to load entries from API:', err);
        get().showToast('Failed to load entries — check your connection', 'error');
        set({ isLoading: false });
      }
    } else {
      // Reader mode: fetch from raw.githubusercontent.com (no auth)
      let owner = settings.githubOwner;
      let repo = settings.githubRepo;

      if (!owner || !repo) {
        const derived = deriveGitHubInfo();
        if (derived) {
          owner = derived.owner;
          repo = derived.repo;
        }
      }

      if (owner && repo) {
        try {
          const allEntries = await fetchPublishedEntries(owner, repo);
          // Reader only sees published entries
          const entries = allEntries.filter((e) => e.isPublished);
          set({ entries, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      } else {
        // Last resort: try the bundled static data file
        try {
          const res = await fetch(import.meta.env.BASE_URL + 'data/entries.json');
          if (res.ok) {
            const data = await res.json();
            const entries = (data.entries || []).filter((e: JournalEntry) => e.isPublished);
            set({ entries, isLoading: false });
          } else {
            set({ entries: [], isLoading: false });
          }
        } catch {
          set({ entries: [], isLoading: false });
        }
      }
    }
  },

  // -------------------------------------------------------------------------
  // Settings (synchronous — localStorage)
  // -------------------------------------------------------------------------

  loadSettings: () => {
    const settings = readSettings();
    const theme = settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    set({ settings });
  },

  saveSettings: (settings) => {
    writeSettings(settings);
    set({ settings });
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    const { settings } = get();
    const updated = { ...settings, theme };
    writeSettings(updated);
    set({ settings: updated });
  },

  // -------------------------------------------------------------------------
  // CRUD — every mutation goes directly to GitHub
  // -------------------------------------------------------------------------

  addEntry: async (entry) => {
    const { entries, entriesSha, settings, showToast: toast } = get();
    const config = getGitHubConfig(settings);

    if (!config) {
      toast('GitHub not configured — cannot save entry', 'error');
      return;
    }

    set({ isSaving: true });

    try {
      // Upload photos first
      const uploadedPhotos = await uploadEntryPhotos(config, entry.id, entry.photos);
      const entryWithRemotePhotos = { ...entry, photos: uploadedPhotos };

      // Optimistic update
      const newEntries = [...entries, entryWithRemotePhotos];
      set({ entries: newEntries });

      // Persist to GitHub (serialised via mutation queue)
      const result = await enqueueMutation(() =>
        putEntries(config, newEntries, entriesSha)
      );

      if (result.success) {
        set({ entriesSha: result.sha, isSaving: false });
        toast('Entry saved', 'success');
      } else {
        // Rollback
        set({ entries, isSaving: false });
        toast('Failed to save — check your connection and try again', 'error');
      }
    } catch (err) {
      console.error('addEntry failed:', err);
      set({ entries, isSaving: false });
      get().showToast('Failed to save — unexpected error', 'error');
    }
  },

  updateEntry: async (entry) => {
    const { entries, entriesSha, settings, showToast: toast } = get();
    const config = getGitHubConfig(settings);

    if (!config) {
      toast('GitHub not configured — cannot update entry', 'error');
      return;
    }

    set({ isSaving: true });

    try {
      // Upload any new photos
      const uploadedPhotos = await uploadEntryPhotos(config, entry.id, entry.photos);
      const updatedEntry = {
        ...entry,
        updatedAt: new Date().toISOString(),
        photos: uploadedPhotos,
      };

      // Optimistic update
      const newEntries = entries.map((e) => (e.id === entry.id ? updatedEntry : e));
      set({ entries: newEntries, selectedEntry: updatedEntry });

      // Persist to GitHub
      const result = await enqueueMutation(() =>
        putEntries(config, newEntries, entriesSha)
      );

      if (result.success) {
        set({ entriesSha: result.sha, isSaving: false });
        toast('Entry updated', 'success');
      } else {
        set({ entries, isSaving: false });
        toast('Failed to update — check your connection and try again', 'error');
      }
    } catch (err) {
      console.error('updateEntry failed:', err);
      set({ entries, isSaving: false });
      get().showToast('Failed to update — unexpected error', 'error');
    }
  },

  deleteEntry: async (id) => {
    const { entries, entriesSha, settings, showToast: toast } = get();
    const config = getGitHubConfig(settings);

    if (!config) {
      toast('GitHub not configured — cannot delete entry', 'error');
      return;
    }

    const entryToDelete = entries.find((e) => e.id === id);

    // Optimistic removal
    const newEntries = entries.filter((e) => e.id !== id);
    set({ entries: newEntries, selectedEntry: null, showEntryDetail: false, isSaving: true });

    try {
      const result = await enqueueMutation(() =>
        putEntries(config, newEntries, entriesSha)
      );

      if (result.success) {
        set({ entriesSha: result.sha, isSaving: false });
        toast('Entry deleted', 'success');

        // Best-effort: clean up photo files (fire and forget)
        if (entryToDelete?.photos.length) {
          deletePhotosForEntry(
            config,
            id,
            entryToDelete.photos.map((p) => p.id)
          ).catch(() => {});
        }
      } else {
        // Rollback
        set({ entries, isSaving: false });
        toast('Failed to delete — check your connection and try again', 'error');
      }
    } catch (err) {
      console.error('deleteEntry failed:', err);
      set({ entries, isSaving: false });
      get().showToast('Failed to delete — unexpected error', 'error');
    }
  },

  // -------------------------------------------------------------------------
  // UI state
  // -------------------------------------------------------------------------

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

  showToast: (message, type = 'info') => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { message, type, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
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

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

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
