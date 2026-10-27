import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/cache.js';

test('cache evicts the least recently used entry, not the oldest inserted', () => {
  let t = 0;
  const cache = new TtlCache<number>(2, () => t);
  cache.set('a', 1, 1000);
  cache.set('b', 2, 1000);
  assert.equal(cache.get('a'), 1, 'touch a so b becomes least recently used');
  cache.set('c', 3, 1000);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
});

test('cache serves stale entries within the stale window and drops them after', () => {
  let t = 0;
  const cache = new TtlCache<string>(10, () => t);
  cache.set('k', 'v', 100, 400);
  t = 50;
  assert.deepEqual(cache.peek('k')?.fresh, true);
  assert.equal(cache.get('k'), 'v');
  t = 150;
  assert.equal(cache.get('k'), undefined, 'get only returns fresh values');
  assert.deepEqual(cache.peek('k'), { value: 'v', fresh: false, freshUntil: 100, expires: 500 });
  t = 500;
  assert.equal(cache.peek('k'), undefined);
  assert.equal(cache.size, 0);
});

test('cache entries can be restored with absolute timestamps and listed', () => {
  let t = 1000;
  const cache = new TtlCache<number>(10, () => t);
  cache.setEntry('expired', { value: 0, freshUntil: 500, expires: 900 });
  cache.setEntry('stale', { value: 1, freshUntil: 900, expires: 5000 });
  cache.setEntry('fresh', { value: 2, freshUntil: 2000, expires: 5000 });
  assert.deepEqual(
    Array.from(cache.entries(), ([k, e]) => [k, e.value]),
    [
      ['stale', 1],
      ['fresh', 2],
    ],
  );
  assert.equal(cache.peek('stale')?.fresh, false);
  assert.equal(cache.get('fresh'), 2);
});
