import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_USER_AGENT, GitHubError, fetchCodeFrequency, parseRepo } from '../src/github.js';

test('parseRepo accepts the usual spellings', () => {
  assert.equal(parseRepo('star-history/star-history'), 'star-history/star-history');
  assert.equal(parseRepo('  Owner/Repo.js  '), 'Owner/Repo.js');
  assert.equal(parseRepo('https://github.com/owner/repo'), 'owner/repo');
  assert.equal(parseRepo('https://github.com/owner/repo.git'), 'owner/repo');
  assert.equal(parseRepo('github.com/owner/repo/tree/main/src'), 'owner/repo');
  assert.equal(parseRepo('git@github.com:owner/repo.git'), 'owner/repo');
  assert.equal(parseRepo('https://github.com/owner/repo?tab=readme'), 'owner/repo');
  assert.equal(parseRepo('a/b/anything/else'), 'a/b', 'extra path segments are ignored');
});

test('parseRepo rejects junk', () => {
  for (const bad of ['', 'owner', 'owner/', '/repo', '-owner/repo', 'owner/re po', 'owner/<svg>', 'o'.repeat(40) + '/r']) {
    assert.equal(parseRepo(bad), null, bad);
  }
});

function fakeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>): typeof fetch {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers });
  }) as typeof fetch;
}

const week = Date.UTC(2024, 0, 7) / 1000;
const payload = [
  [week, 100, -10],
  [week + 7 * 86400, 20, -5],
];

test('fetchCodeFrequency normalises the payload and extends to now', async () => {
  const rows = await fetchCodeFrequency('a/b', { fetch: fakeFetch([{ status: 200, body: payload }]), now: () => (week + 3 * 7 * 86400) * 1000 });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { week, additions: 100, deletions: 10 });
  assert.deepEqual(rows[3], { week: week + 3 * 7 * 86400, additions: 0, deletions: 0 });
});

test('fetchCodeFrequency polls through 202 responses', async () => {
  const slept: number[] = [];
  const rows = await fetchCodeFrequency('a/b', {
    fetch: fakeFetch([{ status: 202, body: {} }, { status: 202, body: {} }, { status: 200, body: payload }]),
    sleep: async (ms) => void slept.push(ms),
    retryDelayMs: 7,
    now: () => (week + 7 * 86400) * 1000,
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(slept, [7, 7]);
});

test('fetchCodeFrequency maps GitHub statuses to error codes', async () => {
  const code = async (responses: Parameters<typeof fakeFetch>[0]) => {
    try {
      await fetchCodeFrequency('a/b', { fetch: fakeFetch(responses), sleep: async () => undefined, retries: 1 });
      return 'ok';
    } catch (err) {
      assert.ok(err instanceof GitHubError);
      return err.code;
    }
  };
  assert.equal(await code([{ status: 202, body: {} }]), 'pending');
  assert.equal(await code([{ status: 404 }]), 'not_found');
  assert.equal(await code([{ status: 422 }]), 'too_large');
  assert.equal(await code([{ status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' } }]), 'rate_limited');
  assert.equal(await code([{ status: 403, headers: { 'x-ratelimit-remaining': '10' } }]), 'forbidden');
  assert.equal(await code([{ status: 429 }]), 'rate_limited');
  assert.equal(await code([{ status: 500 }]), 'upstream');
  assert.equal(await code([{ status: 204 }]), 'ok');
  await assert.rejects(fetchCodeFrequency('nope', { fetch: fakeFetch([{ status: 200, body: [] }]) }), (e: unknown) => e instanceof GitHubError && e.code === 'invalid_repo');
});

test('fetchCodeFrequency sends auth and API headers', async () => {
  let seen: Headers | undefined;
  const f = (async (_url: unknown, init?: RequestInit) => {
    seen = new Headers(init?.headers);
    return new Response('[]', { status: 200 });
  }) as typeof fetch;
  await fetchCodeFrequency('a/b', { fetch: f, token: 'tok' });
  assert.equal(seen?.get('authorization'), 'Bearer tok');
  assert.equal(seen?.get('x-github-api-version'), '2022-11-28');
  assert.ok(seen?.get('user-agent'));
});

test('the User-Agent sent to GitHub contains no URL', async () => {
  // Regression: with a URL in the agent string GitHub answered 202 forever for uncomputed repositories.
  let sent: Headers | undefined;
  const f = (async (_input: unknown, init?: RequestInit) => {
    sent = new Headers(init?.headers);
    return new Response(JSON.stringify([[Date.UTC(2024, 0, 7) / 1000, 1, 0]]), { status: 200 });
  }) as typeof fetch;
  await fetchCodeFrequency('a/b', { fetch: f });
  const ua = sent?.get('user-agent') ?? '';
  assert.equal(ua, DEFAULT_USER_AGENT);
  assert.ok(!/:\/\/|\(/.test(ua), ua);
});
