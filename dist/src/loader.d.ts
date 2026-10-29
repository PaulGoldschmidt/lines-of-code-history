import { type GitHubClientOptions } from './github.js';
import type { CacheStore } from './store.js';
import type { WeeklyRow } from './types.js';
export interface LoaderOptions extends GitHubClientOptions {
    /** How long a successful result is served as fresh. Default 6 hours. */
    ttlMs?: number;
    /**
     * How much longer a result may be served after it went stale while a refresh runs in the
     * background (stale-while-revalidate). Default 7 days. 0 disables stale serving.
     */
    staleMs?: number;
    /** How long "repo missing / too large / forbidden" results are remembered. Default 10 minutes. */
    errorTtlMs?: number;
    /** Repositories kept in memory, least recently used evicted first. Default 5000. */
    maxEntries?: number;
    /**
     * GitHub computes statistics lazily and can take a minute or more for large repositories.
     * When a request's own polling budget runs out, the loader keeps polling in the background
     * this often (default every 5 s) for at most `backgroundPollAttempts` tries (default 36),
     * so the next request for the same repository is served from cache.
     */
    backgroundPollMs?: number;
    backgroundPollAttempts?: number;
    /** GitHub requests in flight at once. Default 8, which stays clear of GitHub's secondary limits. */
    maxConcurrentFetches?: number;
    /** Requests allowed to wait for a slot before new ones are refused with `busy`. Default 200. */
    maxQueuedFetches?: number;
    /** Where to persist successful results across restarts. Default none. */
    store?: CacheStore;
    /** Quiet time after a change before the store is written. Default 5 s. */
    persistDelayMs?: number;
    /** Least time between two writes, so a flood of new repositories collapses into one. Default 60 s. */
    persistMinIntervalMs?: number;
    log?: (message: string) => void;
}
export interface LoaderStats {
    repos: number;
    polling: number;
    fetching: number;
    waiting: number;
}
/**
 * Fetches repository statistics with an LRU cache, stale-while-revalidate, request de-duplication,
 * a concurrency limit towards GitHub, background polling and optional persistence, so a README
 * embed hit many times a minute costs one GitHub request per TTL and survives restarts.
 */
export declare class RepoLoader {
    private readonly opts;
    private readonly rows;
    private readonly errors;
    private readonly inflight;
    private readonly polling;
    private readonly limiter;
    private readonly now;
    /** Set while a write is scheduled; doubles as the "unsaved changes" flag. */
    private persistTimer;
    private lastPersist;
    private persisting;
    /** GitHub's quota is global, so once it is exhausted every repository fails fast until this time. */
    private rateLimitedUntil;
    constructor(opts?: LoaderOptions);
    /** True while the loader is polling GitHub for this repository in the background. */
    isPolling(repo: string): boolean;
    stats(): LoaderStats;
    load(repo: string): Promise<WeeklyRow[]>;
    /** Restores persisted results from the store. Returns how many repositories were loaded. */
    restore(): Promise<number>;
    /** Writes unsaved changes to the store now. Never rejects; failures are logged. */
    flush(): Promise<void>;
    private refresh;
    private fetch;
    private rateLimited;
    private rateLimitError;
    private pendingError;
    private remember;
    private rememberError;
    /** How long to remember a failure per repository. `busy` is global and costs nothing to retry, so it is not kept. */
    private errorTtl;
    private schedulePersist;
    private pollInBackground;
}
