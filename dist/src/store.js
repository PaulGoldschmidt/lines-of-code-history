import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { setImmediate as breathe } from 'node:timers/promises';
import { normalizeRows } from './series.js';
const FORMAT = 2;
/**
 * Persists the repository cache as JSON lines (a header, then one repository per line),
 * written to a temp file and renamed into place. Writing one line at a time and yielding
 * between batches keeps a large snapshot from stalling request handling.
 */
export class FileCacheStore {
    now;
    file;
    constructor(dir, now = Date.now) {
        this.now = now;
        this.file = path.join(dir, 'repo-cache.jsonl');
    }
    async load() {
        let text;
        try {
            text = await readFile(this.file, 'utf8');
        }
        catch (err) {
            if (err.code === 'ENOENT')
                return [];
            throw err;
        }
        const [head, ...lines] = text.split('\n');
        if (!head)
            return [];
        const header = JSON.parse(head);
        if (header.version !== FORMAT)
            return [];
        const t = this.now();
        const out = [];
        for (const line of lines) {
            if (!line)
                continue;
            const r = JSON.parse(line);
            if (r.expires > t)
                out.push({ key: r.key, freshUntil: r.freshUntil, expires: r.expires, value: normalizeRows(r.rows) });
        }
        return out;
    }
    async save(entries) {
        await mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.${process.pid}.tmp`;
        const ws = createWriteStream(tmp);
        const finished = once(ws, 'finish');
        const write = async (obj) => {
            if (!ws.write(`${JSON.stringify(obj)}\n`))
                await once(ws, 'drain');
        };
        await write({ version: FORMAT, savedAt: this.now() });
        let n = 0;
        for (const e of entries) {
            const line = { key: e.key, freshUntil: e.freshUntil, expires: e.expires, rows: e.value.map((r) => [r.week, r.additions, r.deletions]) };
            await write(line);
            if (++n % 50 === 0)
                await breathe();
        }
        ws.end();
        await finished;
        await rename(tmp, this.file);
    }
}
//# sourceMappingURL=store.js.map