import { TtlCache } from './cache.js';
import { GitHubError, fetchCodeFrequency, parseRepo } from './github.js';
import { Limiter, LimiterFullError } from './limiter.js';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PENDING_TTL = 15 * 1000;
/**
 * Fetches repository statistics with an LRU cache, stale-while-revalidate, request de-duplication,
 * a concurrency limit towards GitHub, background polling and optional persistence, so a README
 * embed hit many times a minute costs one GitHub request per TTL and survives restarts.
 */
export class RepoLoader {
    opts;
    rows;
    errors;
    inflight = new Map();
    polling = new Set();
    limiter;
    now;
    /** Set while a write is scheduled; doubles as the "unsaved changes" flag. */
    persistTimer;
    lastPersist = 0;
    persisting = Promise.resolve();
    /** GitHub's quota is global, so once it is exhausted every repository fails fast until this time. */
    rateLimitedUntil = 0;
    constructor(opts = {}) {
        this.opts = opts;
        const max = opts.maxEntries ?? 5000;
        this.now = opts.now ?? Date.now;
        this.rows = new TtlCache(max, this.now);
        this.errors = new TtlCache(max, this.now);
        this.limiter = new Limiter(opts.maxConcurrentFetches ?? 8, opts.maxQueuedFetches ?? 200);
    }
    /** True while the loader is polling GitHub for this repository in the background. */
    isPolling(repo) {
        return this.polling.has(parseRepo(repo) ?? repo);
    }
    stats() {
        return { repos: this.rows.size, polling: this.polling.size, fetching: this.limiter.active, waiting: this.limiter.waiting };
    }
    async load(repo) {
        const key = parseRepo(repo);
        if (!key)
            throw new GitHubError('invalid_repo', `"${repo}" is not a valid owner/name`);
        const hit = this.rows.peek(key);
        if (hit?.fresh)
            return hit.value;
        const error = this.errors.get(key);
        if (hit) {
            // Stale: answer now, refresh behind the scenes unless a recent attempt already failed or is polling.
            if (!error && !this.polling.has(key) && !this.rateLimited())
                this.refresh(key).catch(() => undefined);
            return hit.value;
        }
        if (error)
            throw error;
        if (this.rateLimited())
            throw this.rateLimitError();
        if (this.polling.has(key))
            throw this.pendingError(key);
        return this.refresh(key);
    }
    /** Restores persisted results from the store. Returns how many repositories were loaded. */
    async restore() {
        if (!this.opts.store)
            return 0;
        const entries = await this.opts.store.load();
        for (const entry of entries)
            this.rows.setEntry(entry.key, entry);
        return entries.length;
    }
    /** Writes unsaved changes to the store now. Never rejects; failures are logged. */
    async flush() {
        const store = this.opts.store;
        if (!store || !this.persistTimer)
            return this.persisting;
        clearTimeout(this.persistTimer);
        this.persistTimer = undefined;
        this.lastPersist = this.now();
        const snapshot = Array.from(this.rows.entries(), ([key, entry]) => ({ key, ...entry }));
        this.persisting = this.persisting
            .then(() => store.save(snapshot))
            .catch((err) => this.opts.log?.(`cache persist failed: ${err instanceof Error ? err.message : String(err)}`));
        return this.persisting;
    }
    refresh(key) {
        let pending = this.inflight.get(key);
        if (!pending) {
            pending = this.fetch(key, this.opts)
                .then((rows) => {
                this.remember(key, rows);
                return rows;
            }, (err) => {
                this.rememberError(key, err);
                if (err instanceof GitHubError && err.code === 'pending')
                    this.pollInBackground(key);
                throw err;
            })
                .finally(() => this.inflight.delete(key));
            this.inflight.set(key, pending);
        }
        return pending;
    }
    async fetch(key, opts, wait = false) {
        try {
            return await this.limiter.run(() => fetchCodeFrequency(key, opts), { wait });
        }
        catch (err) {
            if (err instanceof LimiterFullError) {
                throw new GitHubError('busy', `too many repositories are being fetched right now; try ${key} again in a moment`, 503);
            }
            throw err;
        }
    }
    rateLimited() {
        return this.now() < this.rateLimitedUntil;
    }
    rateLimitError() {
        const until = new Date(this.rateLimitedUntil).toISOString();
        return new GitHubError('rate_limited', `GitHub API rate limit exceeded (resets ${until}); set GITHUB_TOKEN to raise it`, 403, this.rateLimitedUntil);
    }
    pendingError(key) {
        return new GitHubError('pending', `GitHub is still computing statistics for ${key}; try again in a moment`, 202);
    }
    remember(key, rows) {
        this.rows.set(key, rows, this.opts.ttlMs ?? 6 * HOUR, this.opts.staleMs ?? 7 * DAY);
        this.errors.delete(key);
        this.schedulePersist();
    }
    rememberError(key, err) {
        if (!(err instanceof GitHubError))
            return;
        if (err.code === 'rate_limited')
            this.rateLimitedUntil = Math.max(this.rateLimitedUntil, err.resetAt ?? this.now() + 60 * 1000);
        const ttl = this.errorTtl(err);
        if (ttl > 0)
            this.errors.set(key, err, ttl);
    }
    /** How long to remember a failure per repository. `busy` is global and costs nothing to retry, so it is not kept. */
    errorTtl(err) {
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
    schedulePersist() {
        if (!this.opts.store || this.persistTimer)
            return;
        const delay = this.opts.persistDelayMs ?? 5000;
        const minInterval = this.opts.persistMinIntervalMs ?? 60 * 1000;
        const wait = Math.max(delay, this.lastPersist + minInterval - this.now());
        this.persistTimer = setTimeout(() => void this.flush(), wait);
        this.persistTimer.unref?.();
    }
    pollInBackground(key) {
        const attempts = this.opts.backgroundPollAttempts ?? 36;
        if (attempts <= 0 || this.polling.has(key))
            return;
        this.polling.add(key);
        const sleep = this.opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
        const delay = this.opts.backgroundPollMs ?? 5000;
        void (async () => {
            try {
                for (let i = 0; i < attempts; i++) {
                    await sleep(delay);
                    try {
                        // The poller is self-throttled, so it waits for a slot instead of being refused.
                        const rows = await this.fetch(key, { ...this.opts, retries: 0 }, true);
                        this.remember(key, rows);
                        return;
                    }
                    catch (err) {
                        this.rememberError(key, err);
                        if (!(err instanceof GitHubError) || err.code !== 'pending')
                            return;
                    }
                }
            }
            finally {
                this.polling.delete(key);
            }
        })();
    }
}
//# sourceMappingURL=loader.js.map