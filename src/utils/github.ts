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

export async function fetchPublishedEntries(
  owner: string,
  repo: string
): Promise<JournalEntry[]> {
  try {
    // Try fetching from GitHub Pages first (faster, no auth needed)
    const pagesUrl = `https://${owner}.github.io/${repo}/data/entries.json`;
    let res = await fetch(pagesUrl);

    if (!res.ok) {
      // Fallback to raw GitHub content
      res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/main/data/entries.json`
      );
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
