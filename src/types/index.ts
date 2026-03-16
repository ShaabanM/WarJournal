export interface GeoLocation {
  lat: number;
  lng: number;
  placeName?: string;
  country?: string;
  city?: string;
}

export interface JournalEntry {
  id: string;
  timestamp: string; // ISO 8601
  location: GeoLocation;
  title: string;
  content: string;
  mood?: string; // Free text. Old values ('hopeful', etc.) still valid.
  photos: EntryPhoto[];
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  newsHeadline?: string; // Author's summary of the day's world news
  manualDate?: string; // ISO date when author picks a past date
}

export interface EntryPhoto {
  id: string;
  dataUrl: string; // base64 compressed (local only)
  remoteUrl?: string; // GitHub raw URL (for readers without local data)
  caption?: string;
  timestamp: string;
}

export interface AppSettings {
  githubToken?: string;
  githubRepo?: string;
  githubOwner?: string;
  authorName: string;
  authorPin?: string; // simple pin for author access
  mapStyle: string;
  theme?: 'dark' | 'light';
}

export type ViewMode = 'reader' | 'author';

// For future LLM integration
export interface EntryEmbedding {
  entryId: string;
  embedding: number[];
  emotionCluster?: string;
  semanticTags?: string[];
}
