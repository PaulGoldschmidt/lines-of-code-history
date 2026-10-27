#!/usr/bin/env node
import http from 'node:http';
import { createHandler } from './handler.js';
import { RepoLoader } from './loader.js';
import { sendResponse, toRequest } from './node-adapter.js';

const port = Number(process.env.PORT ?? 3000);
const ttlSeconds = Number(process.env.LOC_CACHE_TTL_SECONDS ?? 6 * 60 * 60);

const loader = new RepoLoader({
  token: process.env.GITHUB_TOKEN,
  ttlMs: ttlSeconds * 1000,
  retries: process.env.LOC_STATS_RETRIES ? Number(process.env.LOC_STATS_RETRIES) : undefined,
});
const handler = createHandler({ loader, maxAgeSeconds: ttlSeconds });

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  try {
    const response = await handler(toRequest(req, process.env.LOC_PUBLIC_PROTOCOL ?? 'http'));
    await sendResponse(res, response);
    console.log(`${req.method} ${req.url} -> ${response.status} ${Date.now() - started}ms`);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('internal error');
  }
});

server.listen(port, () => {
  console.log(`lines-of-code-history listening on http://localhost:${port}`);
  if (!process.env.GITHUB_TOKEN) console.log('no GITHUB_TOKEN set: GitHub allows 60 unauthenticated API requests per hour');
});
