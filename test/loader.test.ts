import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubError } from '../src/github.js';
import { RepoLoader } from '../src/loader.js';
import { FileCacheStore, type CacheStore, type StoredRepo } from '../src/store.js';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const week = Date.UTC(2024, 0, 7) / 1000;
const payload = [[week, 10, -1]];

function sequence(statuses: number[], body: () => unknown = () => payload) {
  const calls: string[] = [];
  const f = (async (input: unknown) => {
    calls.push(String(input));
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]!;
    return new Response(status === 200 ? JSON.stringify(body()) : '{}', { status });
  }) as typeof fetch;
  return { fetch: f, calls };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}

test('loader caches results and de-duplicates concurrent requests', async () => {
  const { fetch, calls } = sequence([200]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined });
  const [a, b] = await Promise.all([loader.load('a/b'), loader.load('https://github.com/a/b')]);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
  await loader.load('a/b');
  assert.equal(calls.length, 1);
});

test('loader remembers hard errors for a while', async () => {
  const { fetch, calls } = sequence([404]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined });
  await assert.rejects(loader.load('a/b'), (e: unknown) => e instanceof GitHubError && e.code === 'not_found');
  await assert.rejects(loader.load('a/b'), (e: unknown) => e instanceof GitHubError && e.code === 'not_found');
  assert.equal(calls.length, 1);
});

test('loader keeps polling in the background after a pending result', async () => {
  const { fetch, calls } = sequence([202, 202, 202, 202, 200]);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let slept = 0;
  // retries: 0 keeps the foreground request from sleeping, so the first sleep is the background poller's.
  const loader = new RepoLoader({ fetch, sleep: () => (slept++ === 0 ? gate : Promise.resolve()), retries: 0, backgroundPollMs: 1 });
  await assert.rejects(loader.load('a/b'), (e: unknown) => e instanceof GitHubError && e.code === 'pending');
  assert.equal(calls.length, 1, 'foreground request gave up after its budget');
  assert.equal(loader.isPolling('a/b'), true);
  release();
  await settle();
  assert.equal(loader.isPolling('a/b'), false);
  assert.equal(calls.length, 5, 'background polling continued until GitHub answered 200');
  const rows = await loader.load('a/b');
  assert.equal(rows[0]!.additions, 10);
  assert.equal(calls.length, 5, 'served from cache');
});

test('loader stops background polling on a hard error and respects the attempt cap', async () => {
  const { fetch, calls } = sequence([202, 202, 404]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined, retries: 0, backgroundPollMs: 1 });
  await assert.rejects(loader.load('a/b'));
  await settle();
  assert.equal(calls.length, 3);
  await assert.rejects(loader.load('a/b'), (e: unknown) => e instanceof GitHubError && e.code === 'not_found');

  const capped = sequence([202]);
  const loader2 = new RepoLoader({ fetch: capped.fetch, sleep: async () => undefined, retries: 0, backgroundPollMs: 1, backgroundPollAttempts: 3 });
  await assert.rejects(loader2.load('c/d'));
  await settle();
  assert.equal(capped.calls.length, 4, 'one foreground request plus three background attempts');
});

test('requests during background polling do not hit GitHub', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { fetch, calls } = sequence([202, 200]);
  const loader = new RepoLoader({ fetch, sleep: () => gate, retries: 0 });
  await assert.rejects(loader.load('a/b'));
  assert.equal(loader.isPolling('a/b'), true);
  await assert.rejects(loader.load('a/b'), (e: unknown) => e instanceof GitHubError && e.code === 'pending');
  assert.equal(calls.length, 1);
  release();
  await settle();
  assert.equal((await loader.load('a/b')).length, 1 + Math.floor((Date.now() / 1000 - week) / (7 * 86400)));
});

test('loader serves stale results immediately and refreshes them in the background', async () => {
  let t = 0;
  let add = 10;
  const { fetch, calls } = sequence([200], () => [[week, add, -1]]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined, now: () => t, ttlMs: 100, staleMs: 1000 });
  assert.equal((await loader.load('a/b'))[0]!.additions, 10);
  t = 150;
  add = 20;
  assert.equal((await loader.load('a/b'))[0]!.additions, 10, 'stale value answered without waiting');
  await settle();
  assert.equal(calls.length, 2, 'one background refresh');
  assert.equal((await loader.load('a/b'))[0]!.additions, 20, 'refreshed value is fresh again');
  assert.equal(calls.length, 2);
});

test('loader keeps serving stale data when the refresh fails and does not hammer GitHub', async () => {
  let t = 0;
  const { fetch, calls } = sequence([200, 500, 500]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined, now: () => t, ttlMs: 100, staleMs: 1000, retries: 0 });
  await loader.load('a/b');
  t = 200;
  assert.equal((await loader.load('a/b')).length, 1);
  await settle();
  assert.equal((await loader.load('a/b')).length, 1, 'still served while the upstream error is remembered');
  await settle();
  assert.equal(calls.length, 2, 'the remembered error throttles further refreshes');
});

test('loader limits concurrent GitHub requests and refuses when the queue is full', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let active = 0;
  let peak = 0;
  const fetchFn = (async () => {
    active++;
    peak = Math.max(peak, active);
    await gate;
    active--;
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  const loader = new RepoLoader({ fetch: fetchFn, sleep: async () => undefined, maxConcurrentFetches: 2, maxQueuedFetches: 1 });
  const a = loader.load('a/1');
  const b = loader.load('a/2');
  const c = loader.load('a/3');
  await assert.rejects(loader.load('a/4'), (e: unknown) => e instanceof GitHubError && e.code === 'busy' && e.httpStatus === 503);
  assert.deepEqual(loader.stats(), { repos: 0, polling: 0, fetching: 2, waiting: 1 });
  release();
  await Promise.all([a, b, c]);
  assert.equal(peak, 2);
  assert.equal(loader.stats().repos, 3);
});

test('loader persists results to a store and restores them with their freshness', async () => {
  let t = 1_000_000;
  const saved: StoredRepo[][] = [];
  const store: CacheStore = {
    load: async () => saved.at(-1) ?? [],
    save: async (entries) => {
      saved.push(entries);
    },
  };
  const { fetch, calls } = sequence([200]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined, now: () => t, ttlMs: 100, staleMs: 1000, store, persistDelayMs: 1 });
  await loader.load('a/b');
  await loader.flush();
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0]!.map((e) => [e.key, e.freshUntil, e.expires]), [['a/b', t + 100, t + 1100]]);

  t += 150;
  const restored = new RepoLoader({ fetch, sleep: async () => undefined, now: () => t, ttlMs: 100, staleMs: 1000, store });
  assert.equal(await restored.restore(), 1);
  assert.equal((await restored.load('a/b')).length, 1, 'served from the restored (now stale) entry');
  await settle();
  assert.equal(calls.length, 2, 'stale entry triggered exactly one refresh');

  t += 5000;
  const expired = new RepoLoader({ fetch, sleep: async () => undefined, now: () => t, store });
  assert.equal(await expired.restore(), 1, 'the in-memory test store returns everything; the cache drops the expired entry');
  assert.equal(expired.stats().repos, 0);
});

test('file store round-trips entries through disk atomically', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'loc-cache-'));
  try {
    const store = new FileCacheStore(dir, () => 0);
    assert.deepEqual(await store.load(), []);
    const entries = [{ key: 'a/b', value: [{ week, additions: 10, deletions: 1 }], freshUntil: 5, expires: 9 }];
    await store.save(entries);
    assert.deepEqual(await store.load(), entries);
    assert.deepEqual(await new FileCacheStore(dir, () => 9).load(), [], 'expired entries are skipped before their rows are parsed');
    assert.deepEqual(
      (await readdir(dir)).filter((f) => f.endsWith('.tmp')),
      [],
      'no temp file left behind',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loader collapses a burst of changes into one write per minimum interval', async () => {
  let t = 0;
  const writes: number[] = [];
  const store: CacheStore = { load: async () => [], save: async (entries) => void writes.push(entries.length) };
  const { fetch } = sequence([200]);
  const loader = new RepoLoader({ fetch, sleep: async () => undefined, now: () => t, store, persistDelayMs: 1, persistMinIntervalMs: 1000 });
  await loader.load('a/1');
  await loader.flush();
  assert.deepEqual(writes, [1]);
  await loader.load('a/2');
  await loader.load('a/3');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(writes, [1], 'the next write waits for the minimum interval');
  await loader.flush();
  assert.deepEqual(writes, [1, 3], 'an explicit flush writes everything that changed');
  await loader.flush();
  assert.deepEqual(writes, [1, 3], 'nothing changed, nothing written');
});

test('background polling waits for a fetch slot instead of being refused as busy', async () => {
  let releasePoller!: () => void;
  const pollerGate = new Promise<void>((r) => (releasePoller = r));
  let releaseSlow!: () => void;
  const slowGate = new Promise<void>((r) => (releaseSlow = r));
  let abCalls = 0;
  const fetchFn = (async (input: unknown) => {
    const url = String(input);
    if (url.includes('x/slow')) await slowGate;
    const status = url.includes('a/b') && abCalls++ === 0 ? 202 : 200;
    return new Response(JSON.stringify(payload), { status });
  }) as typeof fetch;
  let slept = 0;
  const loader = new RepoLoader({
    fetch: fetchFn,
    sleep: () => (slept++ === 0 ? pollerGate : Promise.resolve()),
    retries: 0,
    backgroundPollMs: 1,
    maxConcurrentFetches: 1,
    maxQueuedFetches: 0,
  });
  await assert.rejects(loader.load('a/b'), (e: unknown) => e instanceof GitHubError && e.code === 'pending');
  const slow = loader.load('x/slow');
  await settle();
  releasePoller();
  await settle();
  assert.deepEqual(loader.stats(), { repos: 0, polling: 1, fetching: 1, waiting: 1 }, 'the poller queues behind the slow fetch');
  await assert.rejects(loader.load('y/z'), (e: unknown) => e instanceof GitHubError && e.code === 'busy' && e.transient);
  releaseSlow();
  await slow;
  await settle();
  assert.equal(loader.isPolling('a/b'), false);
  assert.equal(abCalls, 2, 'the poller got its turn once the slot freed up');
  assert.equal(loader.stats().repos, 2);
});

test('once GitHub reports an exhausted quota, every repository fails fast until the reset', async () => {
  let t = 1_000_000;
  const calls: string[] = [];
  const fetchFn = (async (input: unknown) => {
    calls.push(String(input));
    return new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String((t + 5000) / 1000) } });
  }) as typeof fetch;
  const loader = new RepoLoader({ fetch: fetchFn, sleep: async () => undefined, now: () => t, retries: 0 });
  await assert.rejects(loader.load('a/one'), (e: unknown) => e instanceof GitHubError && e.code === 'rate_limited');
  await assert.rejects(loader.load('a/two'), (e: unknown) => e instanceof GitHubError && e.code === 'rate_limited' && e.resetAt === t + 5000);
  await assert.rejects(loader.load('a/three'));
  assert.equal(calls.length, 1, 'only the first repository reached GitHub');
  t += 6000;
  await assert.rejects(loader.load('a/two'));
  assert.equal(calls.length, 2, 'requests resume after the reset time');
});
