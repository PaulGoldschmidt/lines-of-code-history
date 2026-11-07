import type { CacheEntry } from './cache.js';
import type { WeeklyRow } from './types.js';
/** A cache entry together with its repository key, the unit of persistence. */
export interface StoredRepo extends CacheEntry<WeeklyRow[]> {
    key: string;
}
export interface CacheStore {
    load(): Promise<StoredRepo[]>;
    save(entries: StoredRepo[]): Promise<void>;
}
/**
 * Persists the repository cache as JSON lines (a header, then one repository per line),
 * written to a temp file and renamed into place. Writing one line at a time and yielding
 * between batches keeps a large snapshot from stalling request handling.
 */
export declare class FileCacheStore implements CacheStore {
    private readonly now;
    readonly file: string;
    constructor(dir: string, now?: () => number);
    load(): Promise<StoredRepo[]>;
    save(entries: StoredRepo[]): Promise<void>;
}
