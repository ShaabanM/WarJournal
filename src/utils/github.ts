import type { JournalEntry } from '../types';

const GITHUB_API = 'https://api.github.com';

// Mutex to prevent concurrent publishes (which cause 409 SHA conflicts)
let publishInProgress: Promise<boolean> | null = null;

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

async function doPublish(
  config: GitHubConfig,
  entries: JournalEntry[]
): Promise<boolean> {
  try {
    const data = {
      entries: stripPhotosForPublish(entries),
      exportedAt: new Date().toISOString(),
      totalEntries: entries.length,
    };

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const path = 'data/entries.json';
    const sha = await getFileSha(config, path);

    const body: Record<string, unknown> = {
      message: `Update journal entries - ${new Date().toLocaleDateString()}`,
      content,
      branch: 'main',
    };

    if (sha) {
      body.sha = sha;
    }

    const res = await githubFetch(config, `/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to publish entries:', err);
    return false;
  }
}

/**
 * Publish entries to GitHub with a mutex to prevent concurrent writes.
 * If a publish is already in progress, waits for it to complete then retries
 * with fresh data to avoid 409 SHA conflicts.
 */
export async function publishEntries(
  config: GitHubConfig,
  entries: JournalEntry[]
): Promise<boolean> {
  // If a publish is already in progress, wait for it then retry with latest data
  if (publishInProgress) {
    await publishInProgress;
  }

  const promise = doPublish(config, entries);
  publishInProgress = promise;

  try {
    return await promise;
  } finally {
    publishInProgress = null;
  }
}

/**
 * Derive GitHub owner/repo from the current deployment URL.
 * Works for GitHub Pages URLs like https://shaabanm.github.io/WarJournal/
 */
export function deriveGitHubInfo(): { owner: string; repo: string } | null {
  try {
    const host = window.location.hostname; // e.g. "shaabanm.github.io"
    const path = window.location.pathname; // e.g. "/WarJournal/" or "/WarJournal/index.html"

    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '');
      const repo = path.split('/').filter(Boolean)[0] || '';
      if (owner && repo) {
        return { owner, repo };
      }
    }
  } catch {
    // not on GitHub Pages
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
