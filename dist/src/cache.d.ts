export interface CacheEntry<V> {
    value: V;
    /** Epoch ms until which the entry counts as fresh. */
    freshUntil: number;
    /** Epoch ms after which the entry is dropped even for stale reads. */
    expires: number;
}
export type CacheHit<V> = CacheEntry<V> & {
    fresh: boolean;
};
/**
 * In-memory LRU cache with per-entry freshness and an optional stale window.
 * Reads refresh recency, so under pressure the least recently used entry is evicted first.
 */
export declare class TtlCache<V> {
    readonly maxEntries: number;
    private readonly now;
    private readonly map;
    constructor(maxEntries?: number, now?: () => number);
    /** The value if it is still fresh, otherwise undefined. */
    get(key: string): V | undefined;
    /** The value while it is fresh or within its stale window, tagged with its freshness. */
    peek(key: string): CacheHit<V> | undefined;
    /**
     * Stores a value that is fresh for `ttlMs` and may still be served as stale for a further `staleMs`.
     */
    set(key: string, value: V, ttlMs: number, staleMs?: number): void;
    /** Stores an entry with absolute timestamps, used when restoring a persisted cache. */
    setEntry(key: string, entry: CacheEntry<V>): void;
    delete(key: string): void;
    /** Live entries, least recently used first. Does not touch recency. */
    entries(): IterableIterator<[string, CacheEntry<V>]>;
    get size(): number;
}
