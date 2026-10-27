import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, parseParams } from '../src/handler.js';
import { RepoLoader } from '../src/loader.js';

const week = Date.UTC(2024, 0, 7) / 1000;
const payload = [
  [week, 1000, -100],
  [week + 7 * 86400, 200, -50],
];

function githubStub(routes: Record<string, { status: number; body?: unknown }>): typeof fetch {
  const calls: string[] = [];
  const f = (async (input: unknown) => {
    const url = String(input);
    calls.push(url);
    const match = Object.entries(routes).find(([repo]) => url.includes(`/repos/${repo}/`));
    const r = match?.[1] ?? { status: 404 };
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return Object.assign(f, { calls });
}

function makeHandler(routes: Record<string, { status: number; body?: unknown }>) {
  const fetchStub = githubStub(routes);
  const loader = new RepoLoader({ fetch: fetchStub, sleep: async () => undefined, retries: 1, now: () => (week + 7 * 86400) * 1000 });
  const handler = createHandler({ loader, now: () => new Date(Date.UTC(2024, 0, 20)) });
  return { handler, calls: (fetchStub as unknown as { calls: string[] }).calls };
}

const get = (handler: ReturnType<typeof createHandler>, path: string) => handler(new Request(`http://localhost${path}`));

test('parseParams merges, validates and de-duplicates repos', () => {
  const p = parseParams(new URL('http://x/svg?repos=a/b,c/d&repo=a/b&repos=bad&type=added&theme=dark&width=99999&height=1'));
  assert.deepEqual(p.repos, ['a/b', 'c/d']);
  assert.deepEqual(p.invalid, ['bad']);
  assert.equal(p.type, 'added');
  assert.equal(p.theme, 'dark');
  assert.equal(p.width, 2400);
  assert.equal(p.height, 200);
});

test('GET / serves the web UI', async () => {
  const { handler } = makeHandler({});
  const res = await get(handler, '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  assert.match(await res.text(), /Lines of Code History/);
});

test('GET /svg renders a chart with caching headers', async () => {
  const { handler, calls } = makeHandler({ 'a/b': { status: 200, body: payload } });
  const res = await get(handler, '/svg?repos=a/b');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /image\/svg\+xml/);
  assert.match(res.headers.get('cache-control') ?? '', /max-age=21600/);
  const body = await res.text();
  assert.ok(body.includes('a/b · Lines of code'));
  assert.ok(body.includes('>1,050</text>'), 'final net value is labelled');
  assert.ok(body.includes('data: GitHub'));

  await get(handler, '/svg?repos=a/b&theme=dark');
  assert.equal(calls.length, 1, 'second request is served from cache');
});

test('GET /svg with no repos explains itself with a 400 image', async () => {
  const { handler } = makeHandler({});
  const res = await get(handler, '/svg');
  assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type') ?? '', /svg/);
  assert.match(await res.text(), /repos=owner\/name/);
});

test('GET /svg for a missing repo returns a readable error image', async () => {
  const { handler } = makeHandler({});
  const res = await get(handler, '/svg?repos=nobody/nothing');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(await res.text(), /was not found on GitHub/);
});

test('GET /svg with a mix of good and bad repos charts the good ones and notes the rest', async () => {
  const { handler } = makeHandler({ 'a/b': { status: 200, body: payload } });
  const res = await get(handler, '/svg?repos=a/b,x/y');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('data-series="a/b"'));
  assert.ok(body.includes('x/y: x/y was not found'));
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
});

test('GET /svg while GitHub is computing returns a short-lived placeholder', async () => {
  const { handler } = makeHandler({ 'a/b': { status: 202, body: {} } });
  const res = await get(handler, '/svg?repos=a/b');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=30');
  assert.match(await res.text(), /still computing/);
});

test('GET /api/loc returns weekly data and summaries', async () => {
  const { handler } = makeHandler({ 'a/b': { status: 200, body: payload } });
  const res = await get(handler, '/api/loc?repos=a/b,missing/repo');
  assert.equal(res.status, 200);
  const data = (await res.json()) as { repos: Array<{ repo: string; summary: { net: number }; weeks: Array<{ week: string; net: number; added: number }> }>; errors: Array<{ repo: string; code: string }> };
  assert.equal(data.repos.length, 1);
  assert.equal(data.repos[0]!.summary.net, 1050);
  assert.deepEqual(data.repos[0]!.weeks.map((w) => w.net), [900, 1050]);
  assert.deepEqual(data.repos[0]!.weeks.map((w) => w.added), [1000, 1200]);
  assert.equal(data.repos[0]!.weeks[0]!.week, '2024-01-07');
  assert.deepEqual(data.errors, [{ repo: 'missing/repo', code: 'not_found', message: 'missing/repo was not found on GitHub (private repositories need a token)' }]);
});

test('GET /api/loc propagates the error status when nothing loaded', async () => {
  const { handler } = makeHandler({ 'big/repo': { status: 422 } });
  assert.equal((await get(handler, '/api/loc?repos=big/repo')).status, 422);
  assert.equal((await get(handler, '/api/loc')).status, 400);
});

test('unknown routes and methods', async () => {
  const { handler } = makeHandler({});
  assert.equal((await get(handler, '/nope')).status, 404);
  assert.equal((await handler(new Request('http://localhost/svg', { method: 'POST' }))).status, 405);
  assert.equal((await get(handler, '/healthz')).status, 200);
});
