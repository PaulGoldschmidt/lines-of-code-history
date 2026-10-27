import { fillWeeks, normalizeRows } from './series.js';
import type { WeeklyRow } from './types.js';

export type GitHubErrorCode =
  | 'invalid_repo'
  | 'not_found'
  | 'too_large'
  | 'pending'
  | 'rate_limited'
  | 'forbidden'
  | 'upstream';

export class GitHubError extends Error {
  constructor(
    public readonly code: GitHubErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }

  /** Status to use when relaying this error to our own API clients. */
  get httpStatus(): number {
    switch (this.code) {
      case 'invalid_repo':
        return 400;
      case 'not_found':
        return 404;
      case 'too_large':
        return 422;
      case 'forbidden':
        return 403;
      case 'pending':
      case 'rate_limited':
        return 503;
      default:
        return 502;
    }
  }
}

// GitHub user/org names: alphanumerics and hyphens, max 39 chars, no leading hyphen.
// Repository names: alphanumerics, '.', '-', '_', max 100 chars.
const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;

/**
 * Accepts `owner/name`, `github.com/owner/name`, `https://github.com/owner/name.git`,
 * `git@github.com:owner/name`, or a deep link like `github.com/owner/name/tree/main`.
 * Returns the canonical `owner/name` or null when the input is not a repository.
 */
export function parseRepo(input: string): string | null {
  let s = input.trim();
  s = s.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
  s = s.replace(/^git@github\.com:/i, '');
  s = s.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const repo = `${parts[0]}/${parts[1]!.replace(/\.git$/i, '')}`;
  if (repo === '.' || repo === '..') return null;
  return REPO_RE.test(repo) ? repo : null;
}

export interface GitHubClientOptions {
  /** Personal access token; raises the rate limit from 60 to 5,000 requests per hour. */
  token?: string;
  fetch?: typeof fetch;
  /** How often to re-poll while GitHub computes statistics (HTTP 202). */
  retries?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  apiBase?: string;
  userAgent?: string;
  now?: () => number;
}

export const DEFAULT_RETRIES = 5;
export const DEFAULT_RETRY_DELAY_MS = 1500;

/**
 * Loads the weekly additions/deletions history of a repository from GitHub's
 * `stats/code_frequency` endpoint and returns one row per week up to the current week.
 */
export async function fetchCodeFrequency(repo: string, opts: GitHubClientOptions = {}): Promise<WeeklyRow[]> {
  const canonical = parseRepo(repo);
  if (!canonical) throw new GitHubError('invalid_repo', `"${repo}" is not a valid owner/name`);

  const doFetch = opts.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') throw new Error('global fetch is unavailable; pass options.fetch');
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const delay = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const now = opts.now ?? Date.now;
  const url = `${opts.apiBase ?? 'https://api.github.com'}/repos/${canonical}/stats/code_frequency`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': opts.userAgent ?? 'lines-of-code-history (+https://github.com/PaulGoldschmidt/lines-of-code-history)',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  for (let attempt = 0; ; attempt++) {
    const res = await doFetch(url, { headers });
    if (res.status === 200) {
      const body: unknown = await res.json();
      return fillWeeks(normalizeRows(body), Math.floor(now() / 1000));
    }
    // Drain the body so keep-alive connections can be reused.
    void res.arrayBuffer().catch(() => undefined);

    if (res.status === 204) return [];
    if (res.status === 202) {
      if (attempt >= retries) {
        throw new GitHubError('pending', `GitHub is still computing statistics for ${canonical}; try again in a moment`, 202);
      }
      await sleep(delay);
      continue;
    }
    if (res.status === 404) {
      throw new GitHubError('not_found', `${canonical} was not found on GitHub (private repositories need a token)`, 404);
    }
    if (res.status === 422) {
      throw new GitHubError(
        'too_large',
        `${canonical} has more than 10,000 commits, which GitHub's statistics API does not support; render it from a local clone with the CLI or the GitHub Action instead`,
        422,
      );
    }
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (res.status === 429 || remaining === '0') {
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        const when = Number.isFinite(reset) && reset > 0 ? ` (resets ${new Date(reset * 1000).toISOString()})` : '';
        throw new GitHubError('rate_limited', `GitHub API rate limit exceeded${when}; set GITHUB_TOKEN to raise it`, res.status);
      }
      throw new GitHubError('forbidden', `GitHub refused access to ${canonical} (HTTP 403)`, 403);
    }
    throw new GitHubError('upstream', `GitHub returned HTTP ${res.status} for ${canonical}`, res.status);
  }
}
