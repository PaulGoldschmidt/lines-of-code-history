#!/usr/bin/env node
import http from 'node:http';
import { createHandler } from './handler.js';
import { RepoLoader } from './loader.js';
import { sendResponse, toRequest } from './node-adapter.js';
import { FileCacheStore } from './store.js';
const env = process.env;
const num = (name) => {
    const raw = env[name];
    if (!raw)
        return undefined;
    const value = Number(raw);
    if (Number.isFinite(value))
        return value;
    console.warn(`ignoring ${name}=${JSON.stringify(raw)}: not a number, using the default`);
    return undefined;
};
const seconds = (name) => {
    const value = num(name);
    return value === undefined ? undefined : value * 1000;
};
const port = num('PORT') ?? 3000;
const ttlSeconds = num('LOC_CACHE_TTL_SECONDS') ?? 6 * 60 * 60;
const store = env.LOC_CACHE_DIR ? new FileCacheStore(env.LOC_CACHE_DIR) : undefined;
const loader = new RepoLoader({
    token: env.GITHUB_TOKEN,
    ttlMs: ttlSeconds * 1000,
    staleMs: seconds('LOC_STALE_SECONDS'),
    maxEntries: num('LOC_CACHE_MAX_REPOS'),
    maxConcurrentFetches: num('LOC_MAX_CONCURRENT_FETCHES'),
    maxQueuedFetches: num('LOC_MAX_QUEUED_FETCHES'),
    retries: num('LOC_STATS_RETRIES'),
    store,
    log: (message) => console.log(message),
});
const handler = createHandler({ loader, maxAgeSeconds: ttlSeconds });
const server = http.createServer(async (req, res) => {
    const started = Date.now();
    try {
        const response = await handler(toRequest(req));
        await sendResponse(res, response);
        console.log(`${req.method} ${req.url} -> ${response.status} ${Date.now() - started}ms`);
    }
    catch (err) {
        console.error(err);
        if (!res.headersSent)
            res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('internal error');
    }
});
async function main() {
    if (store) {
        try {
            const restored = await loader.restore();
            console.log(`restored ${restored} repositories from ${store.file}`);
        }
        catch (err) {
            console.error(`could not restore cache from ${store.file}:`, err);
        }
    }
    server.listen(port, () => {
        console.log(`lines-of-code-history listening on http://localhost:${port}`);
        if (!env.GITHUB_TOKEN)
            console.log('no GITHUB_TOKEN set: GitHub allows 60 unauthenticated API requests per hour');
        if (!store)
            console.log('no LOC_CACHE_DIR set: the cache lives in memory only and is lost on restart');
    });
}
let stopping = false;
async function shutdown(signal) {
    if (stopping)
        return;
    stopping = true;
    console.log(`${signal} received, flushing cache`);
    server.close();
    const timer = setTimeout(() => process.exit(0), 5000);
    timer.unref();
    await loader.flush();
    process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
void main();
//# sourceMappingURL=server.js.map