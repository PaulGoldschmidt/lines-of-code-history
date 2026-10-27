import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, formatCompact, formatNumber, niceTicks, renderChart, renderMessage, timeTicks } from '../src/chart.js';

const WEEK = 7 * 86400 * 1000;
const start = Date.UTC(2023, 0, 1);
const linear = (n: number, step: number) => Array.from({ length: n }, (_, i) => ({ t: start + i * WEEK, value: i * step }));

test('formatCompact', () => {
  assert.equal(formatCompact(0), '0');
  assert.equal(formatCompact(999), '999');
  assert.equal(formatCompact(2500), '2.5k');
  assert.equal(formatCompact(12500), '12.5k');
  assert.equal(formatCompact(125000), '125k');
  assert.equal(formatCompact(1234567), '1.23M');
  assert.equal(formatCompact(-300), '−300');
  assert.equal(formatNumber(1234567.4), '1,234,567');
});

test('niceTicks produces clean steps that cover the domain', () => {
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(0, 1, 5), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  const t = niceTicks(0, 123456, 5);
  assert.equal(t[0], 0);
  assert.ok(t[t.length - 1]! >= 123456);
  assert.ok(t.length >= 4 && t.length <= 8);
  assert.deepEqual(niceTicks(0, 0), [0, 0.2, 0.4, 0.6, 0.8, 1]);
  assert.deepEqual(niceTicks(0, 0, 5, true), [0, 1]);
  assert.deepEqual(niceTicks(0, 3, 5, true), [0, 1, 2, 3]);
});

test('timeTicks picks calendar-aligned labels that fit the available width', () => {
  const twoYears = timeTicks(start, start + 104 * WEEK, 640);
  assert.ok(twoYears.length >= 4 && twoYears.length <= 8, String(twoYears.length));
  assert.ok(twoYears.every((t) => /^[A-Z][a-z]{2} \d{4}$/.test(t.label)));
  const decade = timeTicks(start, start + 520 * WEEK, 640);
  assert.ok(decade.length >= 5);
  assert.ok(decade.every((t) => /^\d{4}$/.test(t.label)));
  const narrow = timeTicks(start, start + 520 * WEEK, 200);
  assert.ok(narrow.length >= 2 && narrow.length < decade.length);
  const tiny = timeTicks(start, start + 2 * 86400 * 1000, 640);
  assert.equal(tiny.length, 2);
});

test('renderChart draws one line per series, a legend for several, an area for one', () => {
  const one = renderChart([{ label: 'a/b', points: linear(20, 100) }], { width: 800, height: 480 });
  assert.ok(one.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480"'));
  assert.equal((one.match(/class="lh-s0 lh-line"/g) ?? []).length, 1);
  assert.ok(one.includes('lh-area'));
  assert.ok(!one.includes('lh-swatch"'), 'single series has no legend');
  assert.ok(one.includes('>1,900</text>'), 'end label shows the final value');

  const two = renderChart(
    [
      { label: 'a/b', points: linear(20, 100) },
      { label: 'c/d', points: linear(20, 50) },
    ],
    { width: 800, height: 480 },
  );
  assert.equal((two.match(/lh-line"/g) ?? []).length, 2);
  assert.equal((two.match(/lh-swatch"/g) ?? []).length, 2);
  assert.ok(!two.includes('lh-area"'));
});

test('line paths are never filled, whatever the rule order or theme', () => {
  for (const theme of ['light', 'dark', 'auto'] as const) {
    const svg = renderChart([{ label: 'a', points: linear(5, 1) }], { theme });
    const css = svg.match(/<style>([^]*?)<\/style>/)![1]!;
    // Colour rules set fill on .lh-sN; the fill:none rule must be more specific than a lone class.
    assert.ok(css.includes('path.lh-line{fill:none'), theme);
    assert.ok(!/(^|})\.lh-line\{/.test(css), theme);
    assert.ok(css.includes('circle.lh-mark{stroke:none}'));
  }
});

test('renderChart escapes labels and clamps dimensions', () => {
  const svg = renderChart([{ label: '<script>alert(1)</script>', points: linear(3, 1) }], { width: 10, height: 10000 });
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('width="320" height="1600"'));
});

test('renderChart handles converging end labels with leader lines', () => {
  const svg = renderChart([
    { label: 'a', points: linear(10, 10) },
    { label: 'b', points: linear(10, 10.1) },
    { label: 'c', points: linear(10, 9.9) },
  ]);
  assert.ok(svg.includes('lh-leader'));
});

test('theme=auto embeds a prefers-color-scheme block; dark uses the dark surface', () => {
  const auto = renderChart([{ label: 'a', points: linear(3, 1) }], { theme: 'auto' });
  assert.ok(auto.includes('@media (prefers-color-scheme:dark)'));
  const dark = renderChart([{ label: 'a', points: linear(3, 1) }], { theme: 'dark' });
  assert.ok(dark.includes('.lh-bg{fill:#1a1a19}'));
  assert.ok(!dark.includes('@media'));
});

test('renderMessage wraps long text and escapes it', () => {
  const svg = renderMessage('Title', 'word '.repeat(60) + '<b>', { width: 320 });
  assert.ok((svg.match(/<text class="lh-msg"/g) ?? []).length > 1);
  assert.ok(svg.includes('&lt;b&gt;'));
  assert.equal(escapeXml(`"&'`), '&quot;&amp;&#39;');
});

test('empty series falls back to a message', () => {
  const svg = renderChart([{ label: 'a', points: [] }]);
  assert.ok(svg.includes('No data to plot.'));
});
