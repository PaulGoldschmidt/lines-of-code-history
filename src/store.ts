import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { setImmediate as breathe } from 'node:timers/promises';
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

const FORMAT = 2;
interface Header {
  version: number;
  savedAt: number;
}
interface Line {
  key: string;
  freshUntil: number;
  expires: number;
  rows: Array<[number, number, number]>;
}

/**
 * Persists the repository cache as JSON lines (a header, then one repository per line),
 * written to a temp file and renamed into place. Writing one line at a time and yielding
 * between batches keeps a large snapshot from stalling request handling.
 */
export class FileCacheStore implements CacheStore {
  readonly file: string;

  constructor(
    dir: string,
    private readonly now: () => number = Date.now,
  ) {
    this.file = path.join(dir, 'repo-cache.jsonl');
  }

  async load(): Promise<StoredRepo[]> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const [head, ...lines] = text.split('\n');
    if (!head) return [];
    const header = JSON.parse(head) as Partial<Header>;
    if (header.version !== FORMAT) return [];
    const t = this.now();
    const out: StoredRepo[] = [];
    for (const line of lines) {
      if (!line) continue;
      const r = JSON.parse(line) as Line;
      if (r.expires > t) out.push({ key: r.key, freshUntil: r.freshUntil, expires: r.expires, value: normalizeRows(r.rows) });
    }
    return out;
  }

  async save(entries: StoredRepo[]): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    const ws = createWriteStream(tmp);
    const finished = once(ws, 'finish');
    const write = async (obj: unknown): Promise<void> => {
      if (!ws.write(`${JSON.stringify(obj)}\n`)) await once(ws, 'drain');
    };
    await write({ version: FORMAT, savedAt: this.now() } satisfies Header);
    let n = 0;
    for (const e of entries) {
      const line: Line = { key: e.key, freshUntil: e.freshUntil, expires: e.expires, rows: e.value.map((r) => [r.week, r.additions, r.deletions]) };
      await write(line);
      if (++n % 50 === 0) await breathe();
    }
    ws.end();
    await finished;
    await rename(tmp, this.file);
  }
}
