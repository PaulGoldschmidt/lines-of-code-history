// Regenerates src/sketch-font.ts from assets/fonts/PatrickHand-Regular.ttf.
//
// Sketch-style charts draw their text as glyph outlines rather than through a web font:
// GitHub's image proxy serves images with `default-src 'none'`, which blocks even an
// embedded @font-face, so a font could never be relied on inside a README. Outlines
// render identically everywhere. Only the characters the charts can produce are kept.
import { readFileSync, writeFileSync } from 'node:fs';

const CHARS = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)).concat(['…', '’', '×', 'ä', 'ö', 'ü', 'ß', 'é', 'è', 'á', 'ñ']);

const buf = readFileSync(new URL('../assets/fonts/PatrickHand-Regular.ttf', import.meta.url));
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const u8 = (o) => dv.getUint8(o);
const u16 = (o) => dv.getUint16(o);
const i16 = (o) => dv.getInt16(o);
const u32 = (o) => dv.getUint32(o);

const tables = {};
for (let i = 0, n = u16(4); i < n; i++) {
  const rec = 12 + 16 * i;
  tables[String.fromCharCode(u8(rec), u8(rec + 1), u8(rec + 2), u8(rec + 3))] = { off: u32(rec + 8), len: u32(rec + 12) };
}
const need = (t) => { if (!tables[t]) throw new Error(`missing table ${t}`); return tables[t].off; };

const head = need('head');
const unitsPerEm = u16(head + 18);
const longLoca = i16(head + 50) === 1;
const numGlyphs = u16(need('maxp') + 4);
const hhea = need('hhea');
const ascender = i16(hhea + 4);
const descender = i16(hhea + 6);
const numHMetrics = u16(hhea + 34);
const hmtx = need('hmtx');
const loca = need('loca');
const glyf = need('glyf');

function advance(gid) {
  const i = Math.min(gid, numHMetrics - 1);
  return u16(hmtx + 4 * i);
}
function glyphRange(gid) {
  const a = longLoca ? u32(loca + 4 * gid) : 2 * u16(loca + 2 * gid);
  const b = longLoca ? u32(loca + 4 * (gid + 1)) : 2 * u16(loca + 2 * (gid + 1));
  return [glyf + a, b - a];
}

// cmap: prefer a format 4 subtable (BMP), fall back to format 12.
function buildCmap() {
  const cmap = need('cmap');
  const map = new Map();
  for (let i = 0, n = u16(cmap + 2); i < n; i++) {
    const sub = cmap + u32(cmap + 4 + 8 * i + 4);
    const format = u16(sub);
    if (format === 4) {
      const segX2 = u16(sub + 6);
      const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = u16(ends + 2 * s), start = u16(starts + 2 * s), delta = i16(deltas + 2 * s), ro = u16(ranges + 2 * s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid;
          if (ro === 0) gid = (c + delta) & 0xffff;
          else {
            const addr = ranges + 2 * s + ro + 2 * (c - start);
            gid = u16(addr);
            if (gid) gid = (gid + delta) & 0xffff;
          }
          if (gid && !map.has(c)) map.set(c, gid);
        }
      }
    } else if (format === 12) {
      const groups = u32(sub + 12);
      for (let g = 0; g < groups; g++) {
        const p = sub + 16 + 12 * g;
        const start = u32(p), end = u32(p + 4), gid0 = u32(p + 8);
        for (let c = start; c <= end; c++) if (!map.has(c)) map.set(c, gid0 + (c - start));
      }
    }
  }
  return map;
}
const cmap = buildCmap();

/** Returns the outline of a glyph as SVG path data in font units (y up), or '' for empty glyphs. */
function outline(gid, depth = 0) {
  const [off, len] = glyphRange(gid);
  if (len === 0) return '';
  const contours = i16(off);
  if (contours < 0) return composite(off, depth);
  const endPts = [];
  let p = off + 10;
  for (let c = 0; c < contours; c++, p += 2) endPts.push(u16(p));
  const nPts = contours ? endPts[contours - 1] + 1 : 0;
  const insLen = u16(p);
  p += 2 + insLen;
  const flags = [];
  while (flags.length < nPts) {
    const f = u8(p++);
    flags.push(f);
    if (f & 8) { let r = u8(p++); while (r--) flags.push(f); }
  }
  const xs = [], ys = [];
  let v = 0;
  for (const f of flags) {
    if (f & 2) { const d = u8(p++); v += f & 16 ? d : -d; } else if (!(f & 16)) { v += i16(p); p += 2; }
    xs.push(v);
  }
  v = 0;
  for (const f of flags) {
    if (f & 4) { const d = u8(p++); v += f & 32 ? d : -d; } else if (!(f & 32)) { v += i16(p); p += 2; }
    ys.push(v);
  }
  let d = '';
  let start = 0;
  for (const end of endPts) {
    const pts = [];
    for (let i = start; i <= end; i++) pts.push({ x: xs[i], y: ys[i], on: (flags[i] & 1) !== 0 });
    start = end + 1;
    if (!pts.length) continue;
    // Start on an on-curve point; synthesise one between two off-curve points if needed.
    let first = pts.findIndex((q) => q.on);
    let seq;
    if (first === -1) {
      const mid = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2, on: true };
      seq = [mid, ...pts];
    } else {
      seq = pts.slice(first).concat(pts.slice(0, first));
    }
    d += `M${seq[0].x} ${seq[0].y}`;
    let ctrl = null;
    for (let i = 1; i <= seq.length; i++) {
      const q = seq[i % seq.length];
      if (q.on) {
        d += ctrl ? `Q${ctrl.x} ${ctrl.y} ${q.x} ${q.y}` : `L${q.x} ${q.y}`;
        ctrl = null;
      } else if (ctrl) {
        const mid = { x: (ctrl.x + q.x) / 2, y: (ctrl.y + q.y) / 2 };
        d += `Q${ctrl.x} ${ctrl.y} ${mid.x} ${mid.y}`;
        ctrl = q;
      } else {
        ctrl = q;
      }
    }
    d += 'Z';
  }
  return d;
}

function composite(off, depth) {
  if (depth > 4) return '';
  let p = off + 10;
  let d = '';
  for (;;) {
    const flags = u16(p), gid = u16(p + 2);
    p += 4;
    let dx, dy;
    if (flags & 1) { dx = i16(p); dy = i16(p + 2); p += 4; } else { dx = (u8(p) << 24) >> 24; dy = (u8(p + 1) << 24) >> 24; p += 2; }
    let a = 1, b = 0, c = 0, e = 1;
    const f2 = (o) => i16(o) / 16384;
    if (flags & 8) { a = e = f2(p); p += 2; }
    else if (flags & 0x40) { a = f2(p); e = f2(p + 2); p += 4; }
    else if (flags & 0x80) { a = f2(p); b = f2(p + 2); c = f2(p + 4); e = f2(p + 6); p += 8; }
    const sub = outline(gid, depth + 1);
    d += sub.replace(/([MLQ])([^MLQZ]+)/g, (_, cmd, coords) => {
      const nums = coords.trim().split(/\s+/).map(Number);
      const out = [];
      for (let i = 0; i < nums.length; i += 2) {
        const x = nums[i], y = nums[i + 1];
        out.push(`${round(a * x + c * y + dx)} ${round(b * x + e * y + dy)}`);
      }
      return cmd + out.join(' ');
    });
    if (!(flags & 0x20)) break;
  }
  return d;
}
const round = (n) => Math.round(n * 10) / 10;

const glyphs = {};
let missing = [];
for (const ch of CHARS) {
  const gid = cmap.get(ch.codePointAt(0));
  if (gid === undefined) { missing.push(ch); continue; }
  glyphs[ch] = [advance(gid), outline(gid)];
}
if (missing.length) console.warn('no glyph for:', missing.join(' '));

const out = `// Generated by scripts/embed-font.mjs from assets/fonts/PatrickHand-Regular.ttf. Do not edit by hand.
// Patrick Hand by Patrick Wagesreiter, SIL Open Font License 1.1 (assets/fonts/PatrickHand-OFL.txt).
// Glyph outlines in font units (y up), so sketch-style text renders without any font being loaded.
export const SKETCH_FONT_FAMILY = 'Patrick Hand';
export const SKETCH_UNITS_PER_EM = ${unitsPerEm};
export const SKETCH_ASCENDER = ${ascender};
export const SKETCH_DESCENDER = ${descender};
/** char -> [advance width, SVG path data] */
export const SKETCH_GLYPHS: Record<string, readonly [number, string]> = ${JSON.stringify(glyphs)};
`;
writeFileSync(new URL('../src/sketch-font.ts', import.meta.url), out);
console.log(`wrote src/sketch-font.ts: ${Object.keys(glyphs).length} glyphs, ${out.length} bytes, ${numGlyphs} glyphs in font`);
