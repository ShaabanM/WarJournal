# War Journal

**A live, interactive travel journal for documenting your journey through conflict — and sharing it with the people who care about you.**

War Journal is a Progressive Web App (PWA) that combines GPS tracking, voice dictation, photo uploads, and a cinematic world map into a single tool. You write entries each evening from wherever you are. Your friends and family follow along in real-time on a beautiful dark-themed map, reading your words, seeing your photos, and knowing where you are and how you're feeling.

Think of it as an interactive, geographic blog — a war correspondent's diary that anyone can follow.

---

## Table of Contents

- [Features](#features)
- [Live Demo](#live-demo)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Usage](#usage)
  - [Reader View (Public)](#reader-view-public)
  - [Author View (Private)](#author-view-private)
  - [Creating a Journal Entry](#creating-a-journal-entry)
  - [Publishing Entries](#publishing-entries)
- [Deployment](#deployment)
  - [GitHub Pages (Recommended)](#github-pages-recommended)
  - [Custom Domain](#custom-domain)
- [Architecture](#architecture)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
  - [Data Model](#data-model)
  - [Data Flow](#data-flow)
- [Configuration](#configuration)
  - [GitHub Publishing Setup](#github-publishing-setup)
  - [Map Customization](#map-customization)
- [PWA & Offline Support](#pwa--offline-support)
- [Future Roadmap (LLM Integration)](#future-roadmap-llm-integration)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### For the Author
- **GPS Auto-Detection** — Opens the app, automatically captures your coordinates with reverse geocoding (city, country)
- **Voice Dictation** — Tap the mic and speak. The Web Speech API transcribes your words in real-time. Edit the text afterward if needed
- **Photo Uploads** — Attach multiple photos per entry. Images are automatically compressed client-side (resized, JPEG 70%) to keep things lightweight
- **Mood Tracking** — Tag each entry with one of 8 moods: hopeful, anxious, grateful, reflective, determined, somber, joyful, exhausted
- **Tagging** — Add comma-separated tags for categorization and future search
- **Draft & Publish** — Save entries as drafts (local only) or publish them immediately
- **Offline-First** — Entries are stored locally in IndexedDB. Write even without internet; publish when you're back online

### For the Reader (Friends & Family)
- **Interactive World Map** — A full-screen dark cinematic map (CartoDB Dark Matter) with your journey drawn as a glowing golden line
- **Mood-Colored Markers** — Each entry is a dot on the map, color-coded by mood. The latest entry pulses to show where you are now
- **Entry Detail Panel** — Click any marker to read the full journal entry, browse photos, and navigate between entries
- **Timeline** — A chronological timeline panel grouped by month, scrollable, with mood indicators
- **Search & Filter** — Full-text search across titles, content, locations, and tags. Filter by mood
- **Live Stats** — Entry count, total kilometers traveled, countries visited, last known location
- **Mobile Optimized** — Fully responsive. Works beautifully on phones, tablets, and desktops

### Technical
- **Progressive Web App** — Installable on your phone's home screen. Works offline
- **Zero Backend** — Entirely static. Hosted on GitHub Pages. Data is stored as JSON in the repo
- **GitHub API Publishing** — Author pushes entries directly to the repo via the GitHub API from the browser
- **LLM-Ready Data Model** — Fields for embeddings, emotion clusters, and semantic tags built into the schema

---

## Live Demo

**https://shaabanm.github.io/WarJournal/**

- Default view: Reader map (what your friends and family see)
- Author view: Append `#author` to the URL or tap the small book icon in the bottom-right corner

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/ShaabanM/WarJournal.git
cd WarJournal

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the development server
npm run dev
```

This starts a local dev server at `http://localhost:5173`. Changes hot-reload instantly.

Other available commands:

```bash
npm run build      # Type-check and build for production
npm run preview    # Preview the production build locally
npm run lint       # Run ESLint
```

---

## Usage

### Reader View (Public)

This is the default view at the root URL. It's what you share with friends and family.

- **Map** — Pan, zoom, and explore the journey. The golden dashed line connects entries chronologically
- **Markers** — Click any marker to open the entry detail panel on the right
- **Timeline** — Click the "Timeline" button at the bottom to expand a scrollable list of all entries
- **Search** — Use the search bar (top-right) to find entries by text, location, or tags. Click the filter icon to filter by mood
- **Stats** — The stats strip (top-left) shows journey totals at a glance

### Author View (Private)

Access by navigating to `#author` or tapping the book icon (bottom-right of the reader view).

- **Entry List** — See all your entries (published and drafts) with status badges
- **New Entry** — Tap the golden "New Entry" button to start writing
- **Edit/Delete** — Use the pencil/trash icons on any entry card
- **Settings** — Tap the gear icon to configure your name and GitHub publishing credentials
- **Publish All** — Pushes all published entries to your GitHub repo as a JSON file, triggering a Pages rebuild

### Creating a Journal Entry

1. Tap **New Entry** in the author view
2. **Location** auto-detects via GPS. Wait for the green confirmation showing your city/country
3. **Title** (optional) — Give the entry a name, or leave blank for an auto-generated one
4. **Content** — Type or tap the **mic button** to dictate. Speak naturally; punctuation is inferred. Tap the mic again to stop. You can edit the transcription afterward
5. **Mood** — Tap "How are you feeling?" and select a mood from the grid
6. **Photos** — Tap the camera icon to attach photos from your device. They're compressed automatically
7. **Tags** — Add comma-separated tags (e.g., `border crossing, night, exhaustion`)
8. **Save Draft** or **Publish** — Drafts stay local. Published entries are visible to readers once you push to GitHub

### Publishing Entries

Entries live in your browser's IndexedDB until you publish them to GitHub. To set up publishing:

1. Go to **Settings** (gear icon in author view)
2. Enter your **GitHub username** and **repository name** (e.g., `ShaabanM` / `WarJournal`)
3. Create a [GitHub Personal Access Token](https://github.com/settings/tokens/new) with `repo` scope
4. Paste the token into the **Personal Access Token** field
5. Click **Save Settings**

Now whenever you hit **Publish All** in the author view, all published entries are committed as `data/entries.json` to your repo. GitHub Pages auto-rebuilds and readers see the updates within minutes.

---

## Deployment

### GitHub Pages (Recommended)

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys on every push to `main`.

**Setup:**

1. Push the repo to GitHub
2. Go to **Settings → Pages** in your GitHub repo
3. Set **Source** to **GitHub Actions**
4. Done. Every push to `main` triggers a build and deploy

Your site will be available at `https://<username>.github.io/WarJournal/`

### Custom Domain

To use a custom domain:

1. Add a `CNAME` file to the `public/` directory with your domain:
   ```
   journal.yourdomain.com
   ```
2. Update `vite.config.ts` to change the `base` path:
   ```ts
   base: '/',  // instead of '/WarJournal/'
   ```
3. Update `public/manifest.json` to reflect the new paths (`start_url`, `scope`, icon `src`)
4. Configure DNS per [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

## Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 19 + TypeScript | UI components and type safety |
| **Build** | Vite 8 | Fast dev server and optimized production builds |
| **Map** | MapLibre GL JS | Open-source map rendering (WebGL) |
| **Map Tiles** | CartoDB Dark Matter | Beautiful dark base map (free, no API key) |
| **State** | Zustand | Lightweight, hook-based state management |
| **Storage** | Dexie.js (IndexedDB) | Client-side persistent storage |
| **Publishing** | GitHub REST API | Commit entries as JSON to the repo from the browser |
| **Hosting** | GitHub Pages | Free static site hosting with CI/CD |
| **Icons** | Lucide React | Clean, consistent icon set |
| **Dates** | date-fns | Date formatting and manipulation |
| **PWA** | Custom Service Worker | Offline caching and installability |

### Project Structure

```
WarJournal/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD pipeline
├── public/
│   ├── data/
│   │   └── entries.json        # Published journal data (committed via GitHub API)
│   ├── favicon.svg             # App icon (globe + journal)
│   ├── icon-192.png            # PWA icon (192x192)
│   ├── icon-512.png            # PWA icon (512x512)
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   └── .nojekyll               # Bypass Jekyll on GitHub Pages
├── src/
│   ├── components/
│   │   ├── AuthorView.tsx      # Author dashboard: entry list, stats, actions
│   │   ├── EntryDetail.tsx     # Side panel: full entry with photos, navigation
│   │   ├── NewEntry.tsx        # Entry creation: GPS, voice, photos, mood, tags
│   │   ├── ReaderView.tsx      # Public reader: map + overlays + panels
│   │   ├── SearchBar.tsx       # Search input + mood filter dropdown
│   │   ├── Settings.tsx        # Author settings: profile, GitHub credentials
│   │   ├── Timeline.tsx        # Chronological entry list grouped by month
│   │   └── WorldMap.tsx        # MapLibre GL map with journey line + markers
│   ├── hooks/
│   │   ├── useGeolocation.ts   # GPS position + reverse geocoding
│   │   └── useSpeechToText.ts  # Web Speech API voice dictation
│   ├── store/
│   │   └── journalStore.ts     # Zustand store: entries, settings, UI state
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces (JournalEntry, etc.)
│   ├── utils/
│   │   ├── db.ts               # Dexie.js IndexedDB wrapper (CRUD)
│   │   ├── geo.ts              # Geocoding, distance calculation, formatting
│   │   ├── github.ts           # GitHub API: publish entries, fetch published data
│   │   └── photos.ts           # Client-side image compression
│   ├── App.tsx                 # Root component: view mode router
│   ├── App.css                 # All styles (cinematic dark theme)
│   ├── main.tsx                # Entry point
│   └── registerSW.ts           # Service worker registration
├── index.html                  # HTML shell
├── vite.config.ts              # Vite configuration (base path, build output)
├── tsconfig.json               # TypeScript config
└── package.json
```

### Data Model

```typescript
interface JournalEntry {
  id: string;              // UUID
  timestamp: string;       // ISO 8601 datetime
  location: {
    lat: number;
    lng: number;
    placeName?: string;    // Reverse geocoded display name
    city?: string;
    country?: string;
  };
  title: string;
  content: string;         // Journal text (plain text)
  mood?: 'hopeful' | 'anxious' | 'grateful' | 'reflective'
       | 'determined' | 'somber' | 'joyful' | 'exhausted';
  photos: {
    id: string;
    dataUrl: string;       // Base64 compressed JPEG
    caption?: string;
    timestamp: string;
  }[];
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// Future LLM integration
interface EntryEmbedding {
  entryId: string;
  embedding: number[];     // Vector embedding for semantic search
  emotionCluster?: string; // Cluster label from emotion analysis
  semanticTags?: string[]; // Auto-generated tags from content
}
```

### Data Flow

```
┌─────────────────────────────────────────────────┐
│                   AUTHOR DEVICE                  │
│                                                  │
│  GPS + Voice + Photos + Text                     │
│         │                                        │
│         ▼                                        │
│  ┌─────────────┐    ┌──────────────────┐        │
│  │  IndexedDB   │───▶│  GitHub API PUT   │       │
│  │  (Dexie.js)  │    │  data/entries.json│       │
│  └─────────────┘    └────────┬─────────┘        │
│                              │                   │
└──────────────────────────────┼───────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   GitHub Repository  │
                    │  data/entries.json   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   GitHub Pages CDN   │
                    │  Static Site + JSON  │
                    └──────────┬──────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────┐
│                  READER BROWSER                  │
│                                                  │
│  Fetches entries.json → Renders map + entries    │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Configuration

### GitHub Publishing Setup

1. Go to [GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens/new)
2. Create a token with the **`repo`** scope
3. In the app, go to Author View → Settings (gear icon)
4. Enter:
   - **GitHub Username**: your GitHub username
   - **Repository Name**: the name of this repo (e.g., `WarJournal`)
   - **Personal Access Token**: the token you just created
5. Save. Now "Publish All" will commit entries directly to the repo

> **Security Note**: Your GitHub token is stored in your browser's localStorage on your device only. It is never committed to the repo or sent anywhere except to the GitHub API.

### Map Customization

The default map style is [CartoDB Dark Matter](https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json) — a free, beautiful dark basemap that requires no API key.

To change the map style, modify the style URL in `src/components/WorldMap.tsx`:

```typescript
style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
```

Compatible styles include any [MapLibre GL style spec](https://maplibre.org/maplibre-style-spec/) JSON URL, such as:
- [MapTiler](https://www.maptiler.com/) (free tier, needs API key)
- [Stadia Maps](https://stadiamaps.com/) (free tier)
- Self-hosted [OpenMapTiles](https://openmaptiles.org/)

---

## PWA & Offline Support

War Journal is a full Progressive Web App:

- **Installable** — On mobile, use "Add to Home Screen" to install it as a native-feeling app
- **Offline Writing** — Entries are saved to IndexedDB locally. You can write entries with no internet connection
- **Offline Map** — Previously viewed map tiles are cached by the service worker
- **Background Sync** — When you regain connectivity, publish your entries to GitHub

The service worker (`public/sw.js`) uses a **stale-while-revalidate** strategy for static assets and **network-first** for data files, ensuring readers always see the latest entries when online but can still browse cached content offline.

---

## Future Roadmap (LLM Integration)

The data model is designed with LLM-powered features in mind. Planned integrations:

| Feature | Description | Status |
|---------|-------------|--------|
| **Semantic Search** | Search entries by meaning, not just keywords. "Find entries where I felt scared" | Planned |
| **Emotion Clustering** | Automatically group entries by emotional tone using sentiment analysis | Planned |
| **Auto-Tagging** | Generate tags from entry content using an LLM | Planned |
| **RAG Chatbot** | "What happened the week I was in Turkey?" — conversational search over your journal | Planned |
| **Journey Summary** | Auto-generate weekly/monthly narrative summaries of your travels | Planned |
| **Embedding Search** | Vector embeddings for each entry, enabling similarity search | Planned |

The `EntryEmbedding` interface in `src/types/index.ts` is already defined and ready for these features.

---

## Contributing

Contributions are welcome. This is an open-source project born from a real need — documenting life during wartime.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run the build to ensure everything passes (`npm run build`)
5. Commit with a descriptive message
6. Push to your fork and open a Pull Request

### Development Notes

- All styles are in `src/App.css` — a single, well-organized CSS file with CSS custom properties for theming
- The state store (`src/store/journalStore.ts`) uses Zustand with derived selectors for filtered/sorted entries
- Map markers are created as DOM elements (not MapLibre GL markers) for full CSS control over animations
- Voice dictation uses the Web Speech API (`webkitSpeechRecognition`) — works in Chrome, Edge, and Safari. Firefox has limited support

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <em>Built during wartime. For those who need to be heard, and those who need to know.</em>
</p>
