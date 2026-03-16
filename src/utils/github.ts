import type { JournalEntry } from '../types';

const GITHUB_API = 'https://api.github.com';

// Serialise all publish calls so only one runs at a time
let publishQueue: Promise<boolean> = Promise.resolve(true);

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

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

async function getFileSha(config: GitHubConfig, path: string): Promise<string | null> {
  const res = await githubFetch(config, `/contents/${path}`);
  if (res.ok) {
    const data = await res.json();
    return data.sha;
  }
  return null;
}

/**
 * Strip large photo dataUrls from entries before publishing to GitHub.
 * Keeps photo metadata (id, caption, timestamp) but removes the actual base64 image data
 * to prevent the entries.json file from growing unbounded.
 */
function stripPhotosForPublish(entries: JournalEntry[]): JournalEntry[] {
  return entries.map((entry) => ({
    ...entry,
    photos: entry.photos.map((p) => ({
      ...p,
      dataUrl: '', // Remove base64 data — photos live only in local IndexedDB
    })),
  }));
}

/**
 * Low-level PUT to GitHub Contents API with automatic 409 retry.
 * On 409 (SHA conflict), re-fetches SHA and retries up to `maxRetries` times.
 */
async function putFileWithRetry(
  config: GitHubConfig,
  path: string,
  content: string,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const sha = await getFileSha(config, path);

    const body: Record<string, unknown> = {
      message: `Update journal entries - ${new Date().toLocaleDateString()}`,
      content,
      branch: 'main',
    };
    if (sha) body.sha = sha;

    const res = await githubFetch(config, `/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (res.ok) return true;

    // 409 = SHA conflict (another device published in between)
    if (res.status === 409 && attempt < maxRetries) {
      console.warn(`Publish 409 conflict (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
      continue;
    }

    console.error(`Publish failed: ${res.status} ${res.statusText}`);
    return false;
  }
  return false;
}

/**
 * Publish a set of entries to GitHub.
 *
 * All calls are serialised (queued) so only one PUT runs at a time.
 * Each call builds the content fresh from whatever entries are passed in,
 * and the PUT itself retries on 409 SHA conflicts.
 */
export async function publishEntries(
  config: GitHubConfig,
  entries: JournalEntry[]
): Promise<boolean> {
  // Chain onto the queue so concurrent calls run sequentially
  const job = publishQueue.then(async () => {
    try {
      const data = {
        entries: stripPhotosForPublish(entries),
        exportedAt: new Date().toISOString(),
        totalEntries: entries.length,
      };

      const encoder = new TextEncoder();
      const bytes = encoder.encode(JSON.stringify(data, null, 2));
      // Convert to base64 without deprecated btoa/unescape
      let binary = '';
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      const content = btoa(binary);

      return await putFileWithRetry(config, 'data/entries.json', content);
    } catch (err) {
      console.error('Failed to publish entries:', err);
      return false;
    }
  });

  publishQueue = job.catch(() => false); // keep the chain alive even on error
  return job;
}

/**
 * Derive GitHub owner/repo from the current deployment URL.
 * Works for:
 * - GitHub Pages: https://shaabanm.github.io/WarJournal/
 * - Custom domains: https://moshaaban.com/WarJournal/
 * - Any deployment using the Vite base path (e.g. /WarJournal/)
 *
 * Falls back to repo name from the Vite base path + a well-known owner
 * when the URL doesn't match *.github.io (e.g. custom domains).
 */
export function deriveGitHubInfo(): { owner: string; repo: string } | null {
  try {
    const host = window.location.hostname; // e.g. "shaabanm.github.io" or "moshaaban.com"
    const path = window.location.pathname; // e.g. "/WarJournal/" or "/WarJournal/index.html"

    // Method 1: Parse from *.github.io URL
    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '');
      const repo = path.split('/').filter(Boolean)[0] || '';
      if (owner && repo) {
        return { owner, repo };
      }
    }

    // Method 2: Derive from Vite base path (handles custom domains like moshaaban.com)
    // The base path (e.g. "/WarJournal/") gives us the repo name.
    // We use the known GitHub owner since custom domains don't encode it.
    const basePath = import.meta.env.BASE_URL || '/'; // e.g. "/WarJournal/"
    const repoFromBase = basePath.split('/').filter(Boolean)[0];
    if (repoFromBase) {
      // Known owner for this project — custom domains don't encode the GitHub username
      return { owner: 'ShaabanM', repo: repoFromBase };
    }
  } catch {
    // not on GitHub Pages or custom domain
  }
  return null;
}

export async function fetchPublishedEntries(
  owner: string,
  repo: string
): Promise<JournalEntry[]> {
  // Cache-bust to avoid stale CDN/browser caches
  const cacheBust = `_t=${Date.now()}`;

  try {
    // Try raw GitHub content first (always up-to-date, no build/cache lag)
    let res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/data/entries.json?${cacheBust}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      // Fallback to GitHub Pages static file
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
