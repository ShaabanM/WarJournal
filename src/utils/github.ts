import type { JournalEntry } from '../types';

const GITHUB_API = 'https://api.github.com';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface EntriesFile {
  entries: JournalEntry[];
  sha: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function githubFetch(
  config: GitHubConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GITHUB_API}/repos/${config.owner}/${config.repo}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/** Encode a string to base64, handling Unicode correctly */
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Decode base64 to string, handling Unicode correctly */
function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Mutation queue — serialises all writes so only one PUT is in flight at a time
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mutationQueue: Promise<any> = Promise.resolve();

export function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const job = mutationQueue.then(fn);
  mutationQueue = job.catch(() => {}); // swallow so queue doesn't break
  return job;
}

// ---------------------------------------------------------------------------
// Authenticated API operations (author mode)
// ---------------------------------------------------------------------------

/**
 * Fetch entries.json via the GitHub Contents API.
 * Returns the entries array AND the file SHA (needed for PUT conflict detection).
 */
export async function fetchEntriesFromApi(config: GitHubConfig): Promise<EntriesFile> {
  const res = await githubFetch(config, '/contents/data/entries.json');

  if (!res.ok) {
    if (res.status === 404) {
      // File doesn't exist yet — that's fine, start with empty
      return { entries: [], sha: '' };
    }
    throw new Error(`Failed to fetch entries: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const content = fromBase64(data.content.replace(/\n/g, '')); // GitHub returns multi-line base64
  const parsed = JSON.parse(content);
  return {
    entries: parsed.entries || [],
    sha: data.sha,
  };
}

/**
 * Write entries.json to GitHub. Uses SHA for optimistic concurrency.
 * Retries up to `maxRetries` times on 409 (SHA conflict from another device).
 *
 * On retry, re-fetches the latest file to get the current SHA.
 * The caller provides a `buildEntries` callback that receives the current entries
 * and returns the desired new entries. This allows the retry to merge properly.
 */
export async function putEntries(
  config: GitHubConfig,
  entries: JournalEntry[],
  sha: string,
  maxRetries = 3
): Promise<{ success: boolean; sha: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let currentSha = sha;

    // On retry, re-fetch to get latest SHA
    if (attempt > 0) {
      try {
        const latest = await fetchEntriesFromApi(config);
        currentSha = latest.sha;
      } catch {
        return { success: false, sha };
      }
    }

    const payload = {
      entries: stripPhotosForStorage(entries),
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
    };

    const content = toBase64(JSON.stringify(payload, null, 2));

    const body: Record<string, unknown> = {
      message: `Update journal entries - ${new Date().toLocaleDateString()}`,
      content,
      branch: 'main',
    };
    if (currentSha) body.sha = currentSha;

    const res = await githubFetch(config, '/contents/data/entries.json', {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const result = await res.json();
      return { success: true, sha: result.content.sha };
    }

    if (res.status === 409 && attempt < maxRetries) {
      console.warn(`409 conflict (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
      continue;
    }

    console.error(`putEntries failed: ${res.status} ${res.statusText}`);
    return { success: false, sha: currentSha };
  }

  return { success: false, sha };
}

/**
 * Strip local dataUrl from photos before storing in entries.json.
 * Only remoteUrl is persisted — dataUrl is transient (in-memory only).
 */
function stripPhotosForStorage(entries: JournalEntry[]): JournalEntry[] {
  return entries.map((entry) => ({
    ...entry,
    photos: entry.photos.map((p) => ({
      ...p,
      dataUrl: '', // Never store base64 in entries.json
    })),
  }));
}

/**
 * Upload a single photo to the GitHub repo.
 * Returns the raw.githubusercontent.com URL on success, or null on failure.
 */
export async function uploadPhoto(
  config: GitHubConfig,
  entryId: string,
  photoDataUrl: string,
  photoId: string
): Promise<string | null> {
  try {
    // Extract raw base64 from data URL (strip "data:image/jpeg;base64," prefix)
    const base64Match = photoDataUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!base64Match) return null;
    const base64Data = base64Match[1];

    const path = `data/photos/${entryId}/${photoId}.jpg`;

    // Check if file already exists
    const checkRes = await githubFetch(config, `/contents/${path}`);
    if (checkRes.ok) {
      // Already uploaded — return the URL
      return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/main/${path}`;
    }

    const body = {
      message: `Upload photo ${photoId}`,
      content: base64Data,
      branch: 'main',
    };

    const res = await githubFetch(config, `/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/main/${path}`;
    }

    console.warn(`Failed to upload photo ${photoId}: ${res.status}`);
    return null;
  } catch (err) {
    console.warn(`Failed to upload photo ${photoId}:`, err);
    return null;
  }
}

/**
 * Delete all photo files for an entry (best-effort, fire-and-forget).
 */
export async function deletePhotosForEntry(
  config: GitHubConfig,
  entryId: string,
  photoIds: string[]
): Promise<void> {
  for (const photoId of photoIds) {
    try {
      const path = `data/photos/${entryId}/${photoId}.jpg`;
      const checkRes = await githubFetch(config, `/contents/${path}`);
      if (!checkRes.ok) continue;

      const { sha } = await checkRes.json();
      await githubFetch(config, `/contents/${path}`, {
        method: 'DELETE',
        body: JSON.stringify({
          message: `Delete photo ${photoId}`,
          sha,
          branch: 'main',
        }),
      });
    } catch {
      // Best-effort — don't fail the operation
    }
  }
}

// ---------------------------------------------------------------------------
// Unauthenticated read (reader mode)
// ---------------------------------------------------------------------------

/**
 * Fetch published entries from raw.githubusercontent.com (no auth needed).
 * Uses cache-busting to avoid stale CDN/browser caches.
 */
export async function fetchPublishedEntries(
  owner: string,
  repo: string
): Promise<JournalEntry[]> {
  const cacheBust = `_t=${Date.now()}`;

  try {
    // 1) GitHub API (Contents) — always immediately consistent, no CDN lag.
    //    Works without auth for public repos (60 req/hr rate limit).
    try {
      const apiRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/data/entries.json`,
        { cache: 'no-store', headers: { Accept: 'application/vnd.github.v3.raw' } }
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        return data.entries || [];
      }
    } catch {
      // API failed (rate limit or network) — fall through to CDN
    }

    // 2) Raw GitHub CDN — usually fast, but can lag ~5 min after commits
    let res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/data/entries.json?${cacheBust}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      // 3) GitHub Pages static file — updated after each deploy
      const pagesUrl = `https://${owner}.github.io/${repo}/data/entries.json?${cacheBust}`;
      res = await fetch(pagesUrl, { cache: 'no-store' });
    }

    if (res.ok) {
      const data = await res.json();
      return data.entries || [];
    }

    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Derive GitHub owner/repo from the current deployment URL.
 * Works for *.github.io and custom domains using the Vite base path.
 */
export function deriveGitHubInfo(): { owner: string; repo: string } | null {
  try {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // Method 1: Parse from *.github.io URL
    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '');
      const repo = path.split('/').filter(Boolean)[0] || '';
      if (owner && repo) {
        return { owner, repo };
      }
    }

    // Method 2: Derive from Vite base path (handles custom domains)
    const basePath = import.meta.env.BASE_URL || '/';
    const repoFromBase = basePath.split('/').filter(Boolean)[0];
    if (repoFromBase) {
      return { owner: 'ShaabanM', repo: repoFromBase };
    }
  } catch {
    // not on GitHub Pages or custom domain
  }
  return null;
}
