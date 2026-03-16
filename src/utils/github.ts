import type { JournalEntry } from '../types';

const GITHUB_API = 'https://api.github.com';

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

export async function publishEntries(
  config: GitHubConfig,
  entries: JournalEntry[]
): Promise<boolean> {
  try {
    const data = {
      entries,
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
  try {
    // Try raw GitHub content first (always up-to-date, no build/cache lag)
    let res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/data/entries.json`
    );

    if (!res.ok) {
      // Fallback to GitHub Pages static file
      const pagesUrl = `https://${owner}.github.io/${repo}/data/entries.json`;
      res = await fetch(pagesUrl);
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
