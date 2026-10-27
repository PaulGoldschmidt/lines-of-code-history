import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubError } from '../src/github.js';
import { RepoLoader } from '../src/loader.js';

const week = Date.UTC(2024, 0, 7) / 1000;
const payload = [[week, 10, -1]];

function sequence(statuses: number[]) {
  const calls: string[] = [];
  const f = (async (input: unknown) => {
    calls.push(String(input));
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]!;
    return new Response(status === 200 ? JSON.stringify(payload) : '{}', { status });
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
