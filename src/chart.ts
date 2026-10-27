import { WEEK_MS, isoDate } from './series.js';
import { SKETCH_FONT_DATA_URI, SKETCH_FONT_FAMILY } from './sketch-font.js';
import type { Point } from './types.js';

export type Theme = 'light' | 'dark' | 'auto';
type Mode = 'light' | 'dark';
/** `clean` is the default look; `sketch` is hand-drawn in the spirit of xkcd and star-history. */
export type ChartStyle = 'clean' | 'sketch';
/** `date` plots calendar time; `timeline` aligns every series at its first commit. */
export type XAxis = 'date' | 'timeline';

export interface ChartSeries {
  label: string;
  points: Point[];
}

export interface ChartOptions {
  width?: number;
  height?: number;
  /** `auto` follows the viewer's `prefers-color-scheme`. */
  theme?: Theme;
  style?: ChartStyle;
  xAxis?: XAxis;
  title?: string;
  subtitle?: string;
  /** Small text, bottom right. */
  footer?: string;
  /** Small text, bottom left (e.g. repositories that could not be loaded). */
  note?: string;
  /** Accessible description for the SVG `<title>`. */
  description?: string;
  now?: Date;
}

/** Categorical palette, fixed order, stepped separately for light and dark surfaces. */
export const SERIES_COLORS: Record<Mode, readonly string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
export const MAX_SERIES = SERIES_COLORS.light.length;

const INK: Record<Mode, { surface: string; primary: string; secondary: string; muted: string; grid: string; axis: string }> = {
  light: { surface: '#fcfcfb', primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
  dark: { surface: '#1a1a19', primary: '#f0efec', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
};

export const DEFAULT_WIDTH = 800;
export const DEFAULT_HEIGHT = 480;
export const MIN_WIDTH = 320;
export const MAX_WIDTH = 2400;
export const MIN_HEIGHT = 200;
export const MAX_HEIGHT = 1600;

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SKETCH_FONT = `'${SKETCH_FONT_FAMILY}', 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive`;
const PAD = 16;
const SKETCH_FILTER_ID = 'lh-wobble';

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function parseTheme(value: string | null | undefined): Theme {
  const v = (value ?? '').toLowerCase();
  return v === 'dark' || v === 'auto' ? v : 'light';
}

export function parseStyle(value: string | null | undefined): ChartStyle {
  const v = (value ?? '').toLowerCase();
  return v === 'sketch' || v === 'xkcd' || v === 'hand' ? 'sketch' : 'clean';
}

export function parseXAxis(value: string | null | undefined): XAxis {
  const v = (value ?? '').toLowerCase();
  return v === 'timeline' || v === 'aligned' || v === 'relative' ? 'timeline' : 'date';
}

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** 1234567 → "1,234,567" */
export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** 1234567 → "1.23M", 2500 → "2.5k", −300 → "−300" */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  const units: Array<[number, string]> = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [div, suffix] of units) {
    if (abs >= div) {
      const v = abs / div;
      return sign + trimZeros(v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)) + suffix;
    }
  }
  return sign + trimZeros(Number.isInteger(abs) ? String(abs) : abs.toFixed(1));
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Rough text width for layout; the renderer is a browser, so this only needs to be safe. */
export function textWidth(s: string, fontSize: number): number {
  return s.length * fontSize * 0.58;
}

/** "Nice" axis ticks covering [min, max] with roughly `target` steps; `integer` keeps steps >= 1. */
export function niceTicks(min: number, max: number, target = 5, integer = false): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (max - min < 1e-9) max = min + 1;
  const rough = (max - min) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  if (integer && step < 1) step = 1;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)) + 1);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(decimals)));
  return ticks;
}

export interface TimeTick {
  t: number;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type Unit = 'week' | 'month' | 'year';
const CANDIDATES: Array<[Unit, number]> = [
  ['week', 1], ['week', 2], ['month', 1], ['month', 2], ['month', 3], ['month', 6],
  ['year', 1], ['year', 2], ['year', 5], ['year', 10], ['year', 20], ['year', 50],
];

function fmtDay(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function generateTicks(unit: Unit, step: number, t0: number, t1: number): TimeTick[] {
  const out: TimeTick[] = [];
  const d0 = new Date(t0);
  if (unit === 'year') {
    let y = d0.getUTCFullYear();
    if (Date.UTC(y, 0, 1) < t0) y++;
    while (y % step !== 0) y++;
    for (; Date.UTC(y, 0, 1) <= t1; y += step) out.push({ t: Date.UTC(y, 0, 1), label: String(y) });
  } else if (unit === 'month') {
    let y = d0.getUTCFullYear();
    let m = d0.getUTCMonth();
    if (Date.UTC(y, m, 1) < t0) m++;
    while (m % step !== 0) m++;
    for (;;) {
      y += Math.floor(m / 12);
      m %= 12;
      const t = Date.UTC(y, m, 1);
      if (t > t1) break;
      out.push({ t, label: `${MONTHS[m]} ${y}` });
      m += step;
    }
  } else {
    const d = new Date(t0);
    let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay());
    if (t < t0) t += WEEK_MS;
    for (; t <= t1; t += WEEK_MS * step) {
      const w = new Date(t);
      out.push({ t, label: `${MONTHS[w.getUTCMonth()]} ${w.getUTCDate()}` });
    }
  }
  return out;
}

/** Calendar-aligned x-axis ticks: the finest interval whose labels fit in `availableWidth` pixels. */
export function timeTicks(t0: number, t1: number, availableWidth: number, fontSize = 11): TimeTick[] {
  for (const [unit, step] of CANDIDATES) {
    const ticks = generateTicks(unit, step, t0, t1);
    const widest = Math.max(0, ...ticks.map((t) => textWidth(t.label, fontSize)));
    if (ticks.length * (widest + 24) <= availableWidth) {
      if (ticks.length >= 2) return ticks;
      break;
    }
  }
  return [
    { t: t0, label: fmtDay(t0) },
    { t: t1, label: fmtDay(t1) },
  ];
}

const DAY_MS = 86400 * 1000;
const MONTH_MS = 30.436875 * DAY_MS;
const YEAR_MS = 365.2425 * DAY_MS;
const ELAPSED_CANDIDATES: Array<[number, string, number]> = [
  [WEEK_MS, 'wk', 1], [WEEK_MS, 'wk', 2], [MONTH_MS, 'mo', 1], [MONTH_MS, 'mo', 2], [MONTH_MS, 'mo', 3], [MONTH_MS, 'mo', 6],
  [YEAR_MS, 'yr', 1], [YEAR_MS, 'yr', 2], [YEAR_MS, 'yr', 5], [YEAR_MS, 'yr', 10], [YEAR_MS, 'yr', 20], [YEAR_MS, 'yr', 50],
];

/** Ticks for an elapsed-time axis starting at 0: the finest of weeks, months or years whose labels fit. */
export function elapsedTicks(span: number, availableWidth: number, fontSize = 11): TimeTick[] {
  for (const [unit, name, step] of ELAPSED_CANDIDATES) {
    const ticks: TimeTick[] = [];
    for (let n = 0; n * step * unit <= span + unit * step * 0.001; n++) {
      const k = n * step;
      ticks.push({ t: k * unit, label: k === 0 ? '0' : `${k} ${name}` });
    }
    const widest = Math.max(0, ...ticks.map((t) => textWidth(t.label, fontSize)));
    if (ticks.length * (widest + 24) <= availableWidth) {
      if (ticks.length >= 2) return ticks;
      break;
    }
  }
  return [
    { t: 0, label: '0' },
    { t: span, label: `${Math.max(1, Math.round(span / DAY_MS))} days` },
  ];
}

function modeRules(mode: Mode): string {
  const k = INK[mode];
  const series = SERIES_COLORS[mode].map((c, i) => `.lh-s${i}{stroke:${c};fill:${c}}`).join('');
  return (
    `.lh-bg{fill:${k.surface}}.lh-title{fill:${k.primary}}.lh-sub,.lh-label,.lh-end{fill:${k.secondary}}` +
    `.lh-tick,.lh-foot{fill:${k.muted}}.lh-grid{stroke:${k.grid}}.lh-axis,.lh-leader{stroke:${k.axis}}` +
    `.lh-ring{fill:${k.surface}}.lh-msg{fill:${k.secondary}}${series}`
  );
}

// Series colours are set per `.lh-sN` class on both stroke and fill. The element-type-qualified
// selectors below are more specific, so they win regardless of rule order or theme blocks.
const STATIC_RULES =
  '.lh-title{font-size:16px;font-weight:600}.lh-sub,.lh-label{font-size:12px}' +
  '.lh-tick{font-size:11px;font-variant-numeric:tabular-nums}.lh-end{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}' +
  '.lh-foot{font-size:10px}.lh-msg{font-size:13px}' +
  '.lh-grid,.lh-axis,.lh-leader{stroke-width:1;shape-rendering:crispEdges}' +
  'path.lh-line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}' +
  'path.lh-area{stroke:none;opacity:.1}rect.lh-swatch{stroke:none}circle.lh-mark{stroke:none}';

// Sketch: a handwriting face (embedded, since GitHub's image proxy allows no external loads),
// slightly larger text to compensate for its lighter weight, a heavier wobbly line and a
// dashed grid. The wobble itself is an SVG displacement filter applied to the marks group.
const SKETCH_RULES =
  `@font-face{font-family:'${SKETCH_FONT_FAMILY}';src:url(${SKETCH_FONT_DATA_URI}) format('woff2')}` +
  '.lh-title{font-size:19px;font-weight:400}.lh-sub,.lh-label{font-size:13.5px}' +
  '.lh-tick{font-size:12.5px}.lh-end{font-size:12.5px;font-weight:400}.lh-foot{font-size:11.5px}.lh-msg{font-size:15px}' +
  '.lh-grid,.lh-axis,.lh-leader{stroke-width:1;shape-rendering:auto;stroke-linecap:round}.lh-grid{stroke-dasharray:3 6}' +
  '.lh-axis{stroke-width:1.5}' +
  'path.lh-line{fill:none;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}' +
  'path.lh-area{stroke:none;opacity:.12}rect.lh-swatch{stroke:none}circle.lh-mark{stroke:none}';

function styleBlock(theme: Theme, style: ChartStyle = 'clean'): string {
  const base = style === 'sketch' ? SKETCH_RULES : STATIC_RULES;
  const css =
    theme === 'auto'
      ? `${base}${modeRules('light')}@media (prefers-color-scheme:dark){${modeRules('dark')}}`
      : `${base}${modeRules(theme)}`;
  return `<style>${css}</style>`;
}

function sketchFilter(W: number, H: number): string {
  // Low-frequency fractal noise displaces strokes by up to ~2px, like a hand that is steady but not a ruler.
  return (
    `<filter id="${SKETCH_FILTER_ID}" x="-2%" y="-2%" width="104%" height="104%" filterUnits="userSpaceOnUse" ` +
    `color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(0.9 / Math.sqrt(W)).toFixed(4)} ${(0.9 / Math.sqrt(H)).toFixed(4)}" numOctaves="2" seed="7" result="n"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>`
  );
}

function fontFor(style: ChartStyle): string {
  return style === 'sketch' ? SKETCH_FONT : FONT;
}

function dimensions(opts: ChartOptions): { W: number; H: number } {
  return {
    W: clamp(Math.round(opts.width ?? DEFAULT_WIDTH), MIN_WIDTH, MAX_WIDTH),
    H: clamp(Math.round(opts.height ?? DEFAULT_HEIGHT), MIN_HEIGHT, MAX_HEIGHT),
  };
}

function truncate(s: string, maxWidth: number, fontSize: number): string {
  if (textWidth(s, fontSize) <= maxWidth) return s;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.58)) - 1);
  return s.slice(0, chars) + '…';
}

function f(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

function footerText(opts: ChartOptions): string {
  return opts.footer ?? `lines-of-code-history / ${isoDate(opts.now)}`;
}

/** Renders a multi-series line chart as a standalone SVG document. */
export function renderChart(seriesIn: ChartSeries[], opts: ChartOptions = {}): string {
  const { W, H } = dimensions(opts);
  const theme = opts.theme ?? 'light';
  const style = opts.style ?? 'clean';
  const xAxis = opts.xAxis ?? 'date';
  const kept = seriesIn.slice(0, MAX_SERIES).filter((s) => s.points.length > 0);
  if (kept.length === 0) return renderMessage(opts.title ?? 'Lines of code', 'No data to plot.', opts);
  // Timeline mode re-bases every series at its own first point, so growth curves start together.
  const starts = kept.map((s) => s.points[0]!.t);
  const series: ChartSeries[] =
    xAxis === 'timeline'
      ? kept.map((s, i) => ({ label: s.label, points: s.points.map((p) => ({ t: p.t - starts[i]!, value: p.value })) }))
      : kept;

  const compact = H < 300;
  // Font sizes used for layout estimates; the sketch face is set larger (see SKETCH_RULES).
  const fs = style === 'sketch' ? { title: 19, label: 13.5, tick: 12.5 } : { title: 16, label: 12, tick: 11 };
  const title = truncate(opts.title ?? 'Lines of code', W - 2 * PAD, fs.title);
  const subtitle = compact ? undefined : opts.subtitle && truncate(opts.subtitle, W - 2 * PAD, fs.label);
  const titleY = PAD + 17;
  const subtitleY = titleY + 18;
  let cursor = subtitle ? subtitleY + 8 : titleY + 8;

  // Legend: only for two or more series; a single series is named by the title.
  const legend: Array<{ x: number; y: number; index: number; label: string }> = [];
  if (series.length >= 2) {
    let lx = PAD;
    let ly = cursor + 12;
    series.forEach((s, index) => {
      const label = truncate(s.label, W * 0.6, fs.label);
      const w = 12 + 6 + textWidth(label, fs.label) + 18;
      if (lx > PAD && lx + w - 18 > W - PAD) {
        lx = PAD;
        ly += 18;
      }
      legend.push({ x: lx, y: ly, index, label });
      lx += w;
    });
    cursor = ly + 10;
  }
  const plotTop = cursor + 12;

  const footer = footerText(opts);
  const footY = H - PAD + 4;
  const plotBottom = footY - 14 - 20;

  // Y domain always includes zero; headroom keeps the line off the top gridline.
  let minV = Infinity;
  let maxV = -Infinity;
  let minT = Infinity;
  let maxT = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.value < minV) minV = p.value;
      if (p.value > maxV) maxV = p.value;
      if (p.t < minT) minT = p.t;
      if (p.t > maxT) maxT = p.t;
    }
  }
  let v0 = Math.min(0, minV);
  let v1 = Math.max(0, maxV);
  if (v1 - v0 < 1) v1 = v0 + 1;
  v1 += (v1 - v0) * 0.04;
  const plotH = plotBottom - plotTop;
  const yTicks = niceTicks(v0, v1, clamp(Math.round(plotH / 55), 2, 8), true);
  v0 = yTicks[0]!;
  v1 = yTicks[yTicks.length - 1]!;

  const yLabelW = Math.max(...yTicks.map((v) => textWidth(formatCompact(v), fs.tick)));
  const plotLeft = PAD + yLabelW + 10;
  const endLabels = series.map((s) => formatNumber(s.points[s.points.length - 1]!.value));
  const endLabelW = Math.max(...endLabels.map((l) => textWidth(l, fs.tick)));
  const plotRight = W - PAD - endLabelW - 12;
  const plotW = plotRight - plotLeft;

  let t0 = minT;
  let t1 = maxT;
  if (t1 - t0 < WEEK_MS) {
    t0 -= WEEK_MS / 2;
    t1 += WEEK_MS / 2;
  }
  if (xAxis === 'timeline') t0 = 0;
  const xTicks = xAxis === 'timeline' ? elapsedTicks(t1, plotW, fs.tick) : timeTicks(t0, t1, plotW, fs.tick);
  const x = (t: number): number => plotLeft + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number): number => plotBottom - ((v - v0) / (v1 - v0)) * plotH;

  const parts: string[] = [];
  parts.push(`<rect class="lh-bg" width="${W}" height="${H}"/>`);
  parts.push(`<text class="lh-title" x="${PAD}" y="${titleY}">${escapeXml(title)}</text>`);
  if (subtitle) parts.push(`<text class="lh-sub" x="${PAD}" y="${subtitleY}">${escapeXml(subtitle)}</text>`);
  for (const item of legend) {
    parts.push(`<rect class="lh-s${item.index} lh-swatch" x="${item.x}" y="${item.y - 10}" width="12" height="12" rx="3"/>`);
    parts.push(`<text class="lh-label" x="${item.x + 18}" y="${item.y}">${escapeXml(item.label)}</text>`);
  }

  // Grid, axes and tick labels. Strokes go into one group so the sketch filter can wobble them together.
  const marks: string[] = [];
  const text: string[] = [];
  for (const v of yTicks) {
    const yy = f(y(v));
    const cls = v === 0 ? 'lh-axis' : 'lh-grid';
    marks.push(`<line class="${cls}" x1="${f(plotLeft)}" x2="${f(plotRight)}" y1="${yy}" y2="${yy}"/>`);
    text.push(`<text class="lh-tick" x="${f(plotLeft - 8)}" y="${f(y(v) + 4)}" text-anchor="end">${escapeXml(formatCompact(v))}</text>`);
  }
  if (!yTicks.includes(v0) || v0 !== 0) {
    marks.push(`<line class="lh-axis" x1="${f(plotLeft)}" x2="${f(plotRight)}" y1="${f(plotBottom)}" y2="${f(plotBottom)}"/>`);
  }
  for (const tick of xTicks) {
    const xx = f(x(tick.t));
    marks.push(`<line class="lh-axis" x1="${xx}" x2="${xx}" y1="${f(plotBottom)}" y2="${f(plotBottom + 4)}"/>`);
    text.push(`<text class="lh-tick" x="${xx}" y="${f(plotBottom + 17)}" text-anchor="middle">${escapeXml(tick.label)}</text>`);
  }

  // Marks: area wash for a single series, 2px lines, end dots with a surface ring.
  const ends: Array<{ index: number; cx: number; cy: number; label: string; ly: number }> = [];
  series.forEach((s, index) => {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${f(x(p.t))},${f(y(p.value))}`).join('');
    if (series.length === 1) {
      const first = s.points[0]!;
      const last = s.points[s.points.length - 1]!;
      marks.push(`<path class="lh-s${index} lh-area" d="${d}L${f(x(last.t))},${f(y(0))}L${f(x(first.t))},${f(y(0))}Z"/>`);
    }
    marks.push(`<path class="lh-s${index} lh-line" data-series="${escapeXml(s.label)}" data-start="${starts[index]}" d="${d}"/>`);
    const last = s.points[s.points.length - 1]!;
    ends.push({ index, cx: x(last.t), cy: y(last.value), label: endLabels[index]!, ly: y(last.value) });
  });

  // End labels: keep 13px apart; a label that had to move gets a leader line back to its dot.
  const sorted = [...ends].sort((a, b) => a.cy - b.cy);
  const minY = plotTop + 6;
  const maxY = plotBottom - 2;
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    cur.ly = clamp(cur.ly, minY, maxY);
    if (i > 0 && cur.ly - sorted[i - 1]!.ly < 13) cur.ly = sorted[i - 1]!.ly + 13;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const cur = sorted[i]!;
    if (cur.ly > maxY) cur.ly = maxY;
    if (i < sorted.length - 1 && sorted[i + 1]!.ly - cur.ly < 13) cur.ly = sorted[i + 1]!.ly - 13;
  }
  for (const e of ends) {
    const lx = plotRight + 10;
    if (Math.abs(e.ly - e.cy) > 1.5) {
      marks.push(`<line class="lh-leader" x1="${f(e.cx + 7)}" y1="${f(e.cy)}" x2="${f(lx - 3)}" y2="${f(e.ly)}"/>`);
    }
  }
  for (const e of ends) {
    marks.push(`<circle class="lh-ring" cx="${f(e.cx)}" cy="${f(e.cy)}" r="6"/>`);
    marks.push(`<circle class="lh-s${e.index} lh-mark" cx="${f(e.cx)}" cy="${f(e.cy)}" r="4"/>`);
  }
  for (const e of ends) {
    text.push(`<text class="lh-end" x="${f(plotRight + 10)}" y="${f(e.ly + 4)}">${escapeXml(e.label)}</text>`);
  }
  if (style === 'sketch') {
    parts.push(sketchFilter(W, H), `<g filter="url(#${SKETCH_FILTER_ID})">${marks.join('')}</g>`);
  } else {
    parts.push(...marks);
  }
  parts.push(...text);

  // Footer.
  parts.push(`<text class="lh-foot" x="${W - PAD}" y="${footY}" text-anchor="end">${escapeXml(footer)}</text>`);
  if (opts.note) {
    const room = W - 2 * PAD - textWidth(footer, 10) - 16;
    if (room > 60) parts.push(`<text class="lh-foot" x="${PAD}" y="${footY}">${escapeXml(truncate(opts.note, room, 10))}</text>`);
  }

  const description =
    opts.description ??
    `${title}. ${series.map((s, i) => `${s.label}: ${endLabels[i]}`).join('; ')} as of ${isoDate(opts.now)}.`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lh-title" ` +
    `font-family="${escapeXml(fontFor(style))}" data-plot="${f(plotLeft)},${f(plotTop)},${f(plotRight)},${f(plotBottom)}" ` +
    `data-x="${t0},${t1}" data-y="${v0},${v1}" data-axis="${xAxis}" data-style="${style}">` +
    `<title id="lh-title">${escapeXml(description)}</title>${styleBlock(theme, style)}${parts.join('')}</svg>`
  );
}

function wrapWords(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
}

/** Renders a chart-sized placeholder carrying a message (errors, "still computing", usage hints). */
export function renderMessage(title: string, message: string, opts: ChartOptions = {}): string {
  const { W, H } = dimensions(opts);
  const theme = opts.theme ?? 'light';
  const style = opts.style ?? 'clean';
  const lines = wrapWords(message, Math.max(16, Math.floor((W - 2 * PAD) / (13 * 0.55))));
  const lineHeight = 18;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2 + 4;
  const body = lines
    .map((l, i) => `<text class="lh-msg" x="${W / 2}" y="${f(startY + i * lineHeight)}" text-anchor="middle">${escapeXml(l)}</text>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="lh-title" font-family="${escapeXml(fontFor(style))}">` +
    `<title id="lh-title">${escapeXml(`${title}: ${message}`)}</title>${styleBlock(theme, style)}` +
    `<rect class="lh-bg" width="${W}" height="${H}"/>` +
    `<text class="lh-title" x="${PAD}" y="${PAD + 17}">${escapeXml(truncate(title, W - 2 * PAD, 16))}</text>${body}` +
    `<text class="lh-foot" x="${W - PAD}" y="${H - PAD + 4}" text-anchor="end">${escapeXml(footerText(opts))}</text></svg>`
  );
}
