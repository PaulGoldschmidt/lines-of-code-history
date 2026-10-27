import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cumulative, describeChart, fillWeeks, normalizeRows, parseSeriesType, summarize, weekStart, WEEK_SECONDS } from '../src/series.js';

const SUNDAY = Date.UTC(2024, 0, 7) / 1000; // 2024-01-07 is a Sunday

test('weekStart floors to Sunday 00:00 UTC', () => {
  assert.equal(weekStart(SUNDAY), SUNDAY);
  assert.equal(weekStart(SUNDAY + 3 * 86400 + 5), SUNDAY);
  assert.equal(weekStart(SUNDAY + 6 * 86400 + 86399), SUNDAY);
  assert.equal(weekStart(SUNDAY + 7 * 86400), SUNDAY + WEEK_SECONDS);
});

test('normalizeRows makes deletions positive, merges duplicate weeks and sorts', () => {
  const rows = normalizeRows([
    [SUNDAY + WEEK_SECONDS, 5, -2],
    [SUNDAY, 10, -3],
    [SUNDAY + 86400, 1, -1],
  ]);
  assert.deepEqual(rows, [
    { week: SUNDAY, additions: 11, deletions: 4 },
    { week: SUNDAY + WEEK_SECONDS, additions: 5, deletions: 2 },
  ]);
});

test('normalizeRows rejects malformed payloads', () => {
  assert.throws(() => normalizeRows({}), TypeError);
  assert.throws(() => normalizeRows([[1, 2]]), TypeError);
  assert.throws(() => normalizeRows([['x', 2, 3]]), TypeError);
});

test('fillWeeks inserts zero weeks and extends to the requested time', () => {
  const rows = fillWeeks(
    [
      { week: SUNDAY, additions: 10, deletions: 0 },
      { week: SUNDAY + 3 * WEEK_SECONDS, additions: 2, deletions: 1 },
    ],
    SUNDAY + 5 * WEEK_SECONDS + 100,
  );
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((r) => r.additions), [10, 0, 0, 2, 0, 0]);
  assert.equal(rows[5]!.week, SUNDAY + 5 * WEEK_SECONDS);
  assert.deepEqual(fillWeeks([]), []);
});

test('cumulative sums net and added series', () => {
  const rows = [
    { week: SUNDAY, additions: 10, deletions: 0 },
    { week: SUNDAY + WEEK_SECONDS, additions: 5, deletions: 8 },
  ];
  assert.deepEqual(cumulative(rows, 'net').map((p) => p.value), [10, 7]);
  assert.deepEqual(cumulative(rows, 'added').map((p) => p.value), [10, 15]);
  assert.equal(cumulative(rows, 'net')[0]!.t, SUNDAY * 1000);
});

test('summarize reports totals and date range', () => {
  const s = summarize([
    { week: SUNDAY, additions: 10, deletions: 0 },
    { week: SUNDAY + WEEK_SECONDS, additions: 5, deletions: 8 },
  ]);
  assert.deepEqual(s, { firstWeek: '2024-01-07', lastWeek: '2024-01-14', weeks: 2, additions: 15, deletions: 8, net: 7 });
});

test('describeChart names a single series in the title', () => {
  assert.equal(describeChart('net', ['a/b']).title, 'a/b / Lines of code');
  assert.equal(describeChart('added', ['a/b', 'c/d']).title, 'Lines of code added');
});

test('parseSeriesType defaults to net', () => {
  assert.equal(parseSeriesType('added'), 'added');
  assert.equal(parseSeriesType('ADDED'), 'added');
  assert.equal(parseSeriesType('nonsense'), 'net');
  assert.equal(parseSeriesType(null), 'net');
});
