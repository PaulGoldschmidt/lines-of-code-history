import { TtlCache } from './cache.js';
import { GitHubError, fetchCodeFrequency, parseRepo, type GitHubClientOptions } from './github.js';
import type { WeeklyRow } from './types.js';

export interface LoaderOptions extends GitHubClientOptions {
  /** How long a successful result is served from memory. Default 6 hours. */
  ttlMs?: number;
  /** How long "repo missing / too large / forbidden" results are remembered. Default 10 minutes. */
  errorTtlMs?: number;
  maxEntries?: number;
  /**
   * GitHub computes statistics lazily and can take a minute or more for large repositories.
   * When a request's own polling budget runs out, the loader keeps polling in the background
   * this often (default every 5 s) for at most `backgroundPollAttempts` tries (default 36),
   * so the next request for the same repository is served from cache.
   */
  backgroundPollMs?: number;
  backgroundPollAttempts?: number;
}

const HOUR = 60 * 60 * 1000;
const PENDING_TTL = 15 * 1000;

/**
 * Fetches repository statistics with an in-memory cache, request de-duplication and
 * background polling, so a README embed hit many times a minute costs one GitHub request per TTL.
 */
export class RepoLoader {
  private readonly cache: TtlCache<WeeklyRow[] | GitHubError>;
  private readonly inflight = new Map<string, Promise<WeeklyRow[]>>();
  private readonly polling = new Set<string>();

  constructor(private readonly opts: LoaderOptions = {}) {
    this.cache = new TtlCache(opts.maxEntries ?? 500, opts.now);
  }

  /** True while the loader is polling GitHub for this repository in the background. */
  isPolling(repo: string): boolean {
    return this.polling.has(parseRepo(repo) ?? repo);
  }

  async load(repo: string): Promise<WeeklyRow[]> {
    const key = parseRepo(repo);
    if (!key) throw new GitHubError('invalid_repo', `"${repo}" is not a valid owner/name`);

    const hit = this.cache.get(key);
    if (hit) {
      if (hit instanceof GitHubError) throw hit;
      return hit;
    }
    if (this.polling.has(key)) throw this.pendingError(key);

    let pending = this.inflight.get(key);
    if (!pending) {
      pending = fetchCodeFrequency(key, this.opts)
        .then(
          (rows) => {
            this.cache.set(key, rows, this.opts.ttlMs ?? 6 * HOUR);
            return rows;
          },
          (err: unknown) => {
            this.remember(key, err);
            if (err instanceof GitHubError && err.code === 'pending') this.pollInBackground(key);
            throw err;
          },
        )
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    return pending;
  }

  private pendingError(key: string): GitHubError {
    return new GitHubError('pending', `GitHub is still computing statistics for ${key}; try again in a moment`, 202);
  }

  private remember(key: string, err: unknown): void {
    if (!(err instanceof GitHubError)) return;
    const ttl = this.errorTtl(err);
    if (ttl > 0) this.cache.set(key, err, ttl);
  }

  private errorTtl(err: GitHubError): number {
    switch (err.code) {
      case 'not_found':
      case 'too_large':
      case 'forbidden':
        return this.opts.errorTtlMs ?? 10 * 60 * 1000;
      case 'rate_limited':
        return 60 * 1000;
      case 'pending':
        return PENDING_TTL;
      case 'upstream':
        return 30 * 1000;
      default:
        return 0;
    }
  }

  private pollInBackground(key: string): void {
    const attempts = this.opts.backgroundPollAttempts ?? 36;
    if (attempts <= 0 || this.polling.has(key)) return;
    this.polling.add(key);
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const delay = this.opts.backgroundPollMs ?? 5000;

    void (async () => {
      try {
        for (let i = 0; i < attempts; i++) {
          await sleep(delay);
          try {
            const rows = await fetchCodeFrequency(key, { ...this.opts, retries: 0 });
            this.cache.set(key, rows, this.opts.ttlMs ?? 6 * HOUR);
            return;
          } catch (err) {
            this.remember(key, err);
            if (!(err instanceof GitHubError) || err.code !== 'pending') return;
          }
        }
      } finally {
        this.polling.delete(key);
      }
    })();
  }
}
