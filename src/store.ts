import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CacheEntry } from './cache.js';
import { normalizeRows } from './series.js';
import type { WeeklyRow } from './types.js';

/** A cache entry together with its repository key, the unit of persistence. */
export interface StoredRepo extends CacheEntry<WeeklyRow[]> {
  key: string;
}

export interface CacheStore {
  load(): Promise<StoredRepo[]>;
  save(entries: StoredRepo[]): Promise<void>;
}

interface FileFormat {
  version: 1;
  savedAt: number;
  repos: Array<{ key: string; freshUntil: number; expires: number; rows: Array<[number, number, number]> }>;
}

/** Persists the repository cache as one JSON file, written atomically via a temp file and rename. */
export class FileCacheStore implements CacheStore {
  readonly file: string;

  constructor(
    dir: string,
    private readonly now: () => number = Date.now,
  ) {
    this.file = path.join(dir, 'repo-cache.json');
  }

  async load(): Promise<StoredRepo[]> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const parsed = JSON.parse(text) as Partial<FileFormat>;
    if (parsed.version !== 1 || !Array.isArray(parsed.repos)) return [];
    const t = this.now();
    return parsed.repos
      .filter((r) => r.expires > t)
      .map((r) => ({ key: r.key, freshUntil: r.freshUntil, expires: r.expires, value: normalizeRows(r.rows) }));
  }

  async save(entries: StoredRepo[]): Promise<void> {
    const data: FileFormat = {
      version: 1,
      savedAt: this.now(),
      repos: entries.map((e) => ({
        key: e.key,
        freshUntil: e.freshUntil,
        expires: e.expires,
        rows: e.value.map((r) => [r.week, r.additions, r.deletions] as [number, number, number]),
      })),
    };
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, this.file);
  }
}
