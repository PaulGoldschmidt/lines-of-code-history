/**
 * In-memory LRU cache with per-entry freshness and an optional stale window.
 * Reads refresh recency, so under pressure the least recently used entry is evicted first.
 */
export class TtlCache {
    maxEntries;
    now;
    map = new Map();
    constructor(maxEntries = 500, now = Date.now) {
        this.maxEntries = maxEntries;
        this.now = now;
    }
    /** The value if it is still fresh, otherwise undefined. */
    get(key) {
        const hit = this.peek(key);
        return hit?.fresh ? hit.value : undefined;
    }
    /** The value while it is fresh or within its stale window, tagged with its freshness. */
    peek(key) {
        const entry = this.map.get(key);
        if (!entry)
            return undefined;
        const t = this.now();
        if (entry.expires <= t) {
            this.map.delete(key);
            return undefined;
        }
        this.map.delete(key);
        this.map.set(key, entry);
        return { ...entry, fresh: entry.freshUntil > t };
    }
    /**
     * Stores a value that is fresh for `ttlMs` and may still be served as stale for a further `staleMs`.
     */
    set(key, value, ttlMs, staleMs = 0) {
        const freshUntil = this.now() + Math.max(0, ttlMs);
        this.setEntry(key, { value, freshUntil, expires: freshUntil + Math.max(0, staleMs) });
    }
    /** Stores an entry with absolute timestamps, used when restoring a persisted cache. */
    setEntry(key, entry) {
        if (entry.expires <= this.now())
            return;
        this.map.delete(key);
        if (this.map.size >= this.maxEntries) {
            const oldest = this.map.keys().next().value;
            if (oldest !== undefined)
                this.map.delete(oldest);
        }
        this.map.set(key, entry);
    }
    delete(key) {
        this.map.delete(key);
    }
    /** Live entries, least recently used first. Does not touch recency. */
    *entries() {
        const t = this.now();
        for (const [key, entry] of this.map) {
            if (entry.expires > t)
                yield [key, entry];
        }
    }
    get size() {
        return this.map.size;
    }
}
//# sourceMappingURL=cache.js.map