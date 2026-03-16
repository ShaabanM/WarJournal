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
  mood?: 'hopeful' | 'anxious' | 'grateful' | 'reflective' | 'determined' | 'somber' | 'joyful' | 'exhausted';
  photos: EntryPhoto[];
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EntryPhoto {
  id: string;
  dataUrl: string; // base64 compressed
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
}

export type ViewMode = 'reader' | 'author';

// For future LLM integration
export interface EntryEmbedding {
  entryId: string;
  embedding: number[];
  emotionCluster?: string;
  semanticTags?: string[];
}
