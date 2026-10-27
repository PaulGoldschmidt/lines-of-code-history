import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CacheEntry } from './cache.js';
import type { WeeklyRow } from './types.js';

export interface StoredRepo {
  key: string;
  rows: WeeklyRow[];
  freshUntil: number;
  expires: number;
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

  constructor(dir: string, name = 'repo-cache.json') {
    this.file = path.join(dir, name);
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
    return parsed.repos.map((r) => ({
      key: r.key,
      freshUntil: r.freshUntil,
      expires: r.expires,
      rows: r.rows.map(([week, additions, deletions]) => ({ week, additions, deletions })),
    }));
  }

  async save(entries: StoredRepo[]): Promise<void> {
    const data: FileFormat = {
      version: 1,
      savedAt: Date.now(),
      repos: entries.map((e) => ({
        key: e.key,
        freshUntil: e.freshUntil,
        expires: e.expires,
        rows: e.rows.map((r) => [r.week, r.additions, r.deletions] as [number, number, number]),
      })),
    };
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, this.file);
  }
}

export function toStored(key: string, entry: CacheEntry<WeeklyRow[]>): StoredRepo {
  return { key, rows: entry.value, freshUntil: entry.freshUntil, expires: entry.expires };
}
