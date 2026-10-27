import { SERIES_COLORS } from './chart.js';

const REPO_URL = 'https://github.com/PaulGoldschmidt/lines-of-code-history';

/** Repositories offered as one-click examples. All are within GitHub's 10,000-commit statistics limit. */
const EXAMPLES = ['expressjs/express', 'SchmiedmayerLab/MyHeartCounts-Firebase', 'vitejs/vite', 'fastapi/fastapi', 'star-history/star-history'];

/** The single-page web UI: pick repositories, preview the chart, share or embed it. */
export function renderPage(): string {
  const examples = EXAMPLES.map((r) => `<button type="button" class="example" data-repo="${r}">${r}</button>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lines of Code History</title>
<meta name="description" content="The lines-of-code history graph for GitHub repositories. Like star-history, but for code. Compare repositories and embed a live SVG chart in your README.">
<meta property="og:title" content="Lines of Code History">
<meta property="og:description" content="See how the lines of code in a GitHub repository changed over time, and embed the chart in your README.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232a78d6'/%3E%3Cpath d='M6 23 L12 17 L17 20 L26 9' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
<style>
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink-2:#52514e;--muted:#898781;--border:rgba(11,11,11,.1);--border-strong:rgba(11,11,11,.2);--accent:#2a78d6;--accent-ink:#fff;--accent-soft:rgba(42,120,214,.1);--code:#f0efec;--shadow:0 4px 16px rgba(0,0,0,.12)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink-2:#c3c2b7;--muted:#898781;--border:rgba(255,255,255,.1);--border-strong:rgba(255,255,255,.22);--accent:#3987e5;--accent-soft:rgba(57,135,229,.16);--code:#262624;--shadow:0 4px 16px rgba(0,0,0,.5)}}
:root[data-theme=dark]{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink-2:#c3c2b7;--muted:#898781;--border:rgba(255,255,255,.1);--border-strong:rgba(255,255,255,.22);--accent:#3987e5;--accent-soft:rgba(57,135,229,.16);--code:#262624;--shadow:0 4px 16px rgba(0,0,0,.5)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent)}
button{font:inherit;color:inherit;cursor:pointer}
[hidden]{display:none!important}
.wrap{max-width:980px;margin:0 auto;padding:0 16px}

/* header */
.top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--page) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.top .wrap{display:flex;align-items:center;gap:8px;height:56px}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:700;letter-spacing:-.01em;margin-right:auto}
.brand svg{width:26px;height:26px;flex:none}
.nav a,.nav button{display:inline-flex;align-items:center;gap:6px;color:var(--ink-2);text-decoration:none;font-size:14px;padding:6px 10px;border-radius:6px;border:1px solid transparent;background:none}
.nav a:hover,.nav button:hover{color:var(--ink);background:var(--accent-soft)}
.nav svg{width:18px;height:18px}
.nav{display:flex;align-items:center;gap:2px}
@media (max-width:640px){.nav .text{display:none}}

/* hero */
.hero{padding:44px 0 8px;text-align:center}
h1{font-size:clamp(26px,4.4vw,38px);line-height:1.15;margin:0 0 10px;letter-spacing:-.02em}
.lede{color:var(--ink-2);margin:0 auto;max-width:600px;font-size:16px}
h2{font-size:16px;margin:0 0 8px}

/* cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin:16px 0}
.picker{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-height:48px;padding:6px 6px 6px 10px;border:1px solid var(--border-strong);border-radius:10px;background:var(--page);cursor:text}
.picker:focus-within{outline:2px solid var(--accent);outline-offset:1px;border-color:transparent}
.picker input{flex:1 1 220px;min-width:0;border:0;background:transparent;color:inherit;font:inherit;padding:6px 4px;outline:none}
.chip{display:inline-flex;align-items:center;gap:7px;padding:4px 6px 4px 10px;border-radius:999px;background:var(--accent-soft);font-size:14px;font-weight:500;max-width:100%}
.chip .dot{width:9px;height:9px}
.chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip button{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:0;border-radius:50%;background:transparent;color:var(--ink-2);font-size:16px;line-height:1;padding:0}
.chip button:hover{background:var(--border-strong);color:var(--ink)}
.go{background:var(--accent);color:var(--accent-ink);border:0;border-radius:8px;font-weight:600;padding:9px 16px;min-height:38px;white-space:nowrap}
.go:disabled{opacity:.45;cursor:default}
.hint{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:12px 2px 0;font-size:13px;color:var(--muted)}
.example{border:0;background:none;color:var(--accent);padding:0;font-size:13px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px}
.example:hover{text-decoration-color:currentColor}
.hint .sep{margin-left:auto}
.ghost{background:transparent;border:1px solid var(--border);border-radius:6px;font-size:12.5px;min-height:28px;padding:3px 10px;color:var(--ink-2)}
.ghost:hover{border-color:var(--accent);color:var(--ink)}

/* chart card */
.chart{padding:12px}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 2px 10px}
.seg{display:inline-flex;border:1px solid var(--border-strong);border-radius:8px;overflow:hidden}
.seg button{border:0;background:transparent;padding:6px 12px;font-size:13.5px;color:var(--ink-2)}
.seg button+button{border-left:1px solid var(--border-strong)}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-ink)}
.actions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}
.actions button,.actions a{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:6px 11px;font-size:13.5px;color:var(--ink);text-decoration:none}
.actions button:hover,.actions a:hover{border-color:var(--accent)}
.actions svg{width:15px;height:15px;color:var(--ink-2)}
.actions .primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:600}
.actions .primary svg{color:inherit}
.sample{padding:12px}
.sample a{display:block;border-radius:8px}
.sample img{display:block;width:100%;height:auto;border-radius:8px}
.stage{position:relative}
.chart.loading #chart{opacity:.45;transition:opacity .15s}
#chart svg{display:block;width:100%;height:auto;border-radius:8px}
.status{margin:10px 4px 2px;font-size:13px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:4px 18px}
.status b{color:var(--ink);font-weight:600}
.status .dot{margin-right:6px;vertical-align:1px}
.note{margin:6px 4px 0;font-size:13px;color:var(--muted)}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;box-shadow:var(--shadow);white-space:nowrap;z-index:2}
.tip .d{color:var(--muted);margin-bottom:2px}
.tip .row{display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--ink);color:var(--page);padding:8px 14px;border-radius:8px;font-size:13.5px;box-shadow:var(--shadow);z-index:20;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.show{opacity:1}

/* embed dialog */
dialog{border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);padding:0;width:min(680px,calc(100vw - 32px));box-shadow:var(--shadow)}
dialog::backdrop{background:rgba(0,0,0,.45)}
.dlg-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)}
.dlg-head h2{margin:0}
.dlg-body{padding:14px 18px 18px}
.tabs{display:inline-flex;gap:2px;border-bottom:1px solid var(--border);width:100%;margin-bottom:12px}
.tabs button{border:0;background:none;padding:8px 12px;color:var(--ink-2);border-bottom:2px solid transparent;margin-bottom:-1px;font-size:14px}
.tabs button[aria-selected=true]{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}
.snippet-head{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-2);margin-bottom:6px}
pre{margin:0;background:var(--code);border-radius:8px;padding:10px 12px;font-size:12.5px;line-height:1.45;overflow-x:auto;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
code{background:var(--code);border-radius:4px;padding:1px 5px;font-size:.92em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.small{font-size:13px;color:var(--ink-2);margin:10px 0 0}
.preview{margin-top:14px;border:1px dashed var(--border-strong);border-radius:8px;padding:8px}
.preview img{display:block;width:100%;height:auto}

/* table + footer */
details summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:10px;font-variant-numeric:tabular-nums}
th,td{text-align:right;padding:4px 8px;border-bottom:1px solid var(--border)}
th:first-child,td:first-child{text-align:left}
th{color:var(--ink-2);font-weight:600;position:sticky;top:0;background:var(--surface)}
.table-wrap{max-height:420px;overflow:auto}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:28px 0 8px}
.feature h3{font-size:14.5px;margin:0 0 4px}
.feature p{margin:0;font-size:13.5px;color:var(--ink-2)}
footer.wrap{padding:28px 16px 56px;color:var(--muted);font-size:13px;border-top:1px solid var(--border);margin-top:32px}
footer p{margin:0 0 8px}
</style>
</head>
<body>
<div class="top"><div class="wrap">
  <a class="brand" href="/" aria-label="Lines of Code History home">
    <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)"/><path d="M6 23 L12 17 L17 20 L26 9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span>Lines of Code History</span>
  </a>
  <nav class="nav" aria-label="Site">
    <a href="${REPO_URL}#the-github-action"><span class="text">Action</span></a>
    <a href="${REPO_URL}#the-cli"><span class="text">CLI</span></a>
    <a href="${REPO_URL}#svg-parameters"><span class="text">API</span></a>
    <button type="button" id="themeBtn" aria-label="Toggle dark mode" title="Toggle dark mode">
      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    </button>
    <a href="${REPO_URL}" aria-label="Source on GitHub" title="Source on GitHub">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
      <span class="text">GitHub</span>
    </a>
  </nav>
</div></div>

<main class="wrap">
  <section class="hero">
    <h1>The lines-of-code history graph<br>for GitHub repositories</h1>
    <p class="lede">Like <a href="https://star-history.com">star-history</a>, but for code. Add one or more repositories, compare how they grew, and embed the live chart in your README.</p>
  </section>

  <form id="form" class="card" autocomplete="off">
    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div class="picker" id="picker" style="flex:1 1 320px">
        <span id="chips" style="display:contents"></span>
        <input id="repoInput" placeholder="owner/repo or a GitHub URL" spellcheck="false" autofocus aria-label="Repository">
      </div>
      <button class="go" type="submit" id="goBtn">View LOC history</button>
    </div>
    <div class="hint">
      <span>Try:</span>${examples}
      <button type="button" class="ghost sep" id="clearBtn" hidden>Clear all</button>
    </div>
  </form>

  <section class="card sample" id="sampleCard">
    <a href="/?repos=expressjs/express,pallets/flask" id="sampleLink" aria-label="Open the example comparison of express and flask">
      <img id="sampleImg" alt="Example chart: lines of code of expressjs/express and pallets/flask over time" src="/svg?repos=expressjs/express,pallets/flask&amp;theme=auto&amp;width=960&amp;height=440">
    </a>
    <p class="note" style="text-align:center;margin-top:8px">Example: expressjs/express compared with pallets/flask. Click it to start from there.</p>
  </section>

  <section class="card chart" id="chartCard" hidden>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Measure">
        <button type="button" data-type="net" aria-pressed="true">Net lines</button>
        <button type="button" data-type="added" aria-pressed="false">Lines added</button>
      </div>
      <div class="seg" role="group" aria-label="X axis">
        <button type="button" data-axis="date" aria-pressed="true" title="Calendar dates">Date</button>
        <button type="button" data-axis="timeline" aria-pressed="false" title="Time since each repository's first commit">Timeline</button>
      </div>
      <div class="seg" role="group" aria-label="Style">
        <button type="button" data-style="clean" aria-pressed="true">Clean</button>
        <button type="button" data-style="sketch" aria-pressed="false" title="Hand-drawn look">Sketch</button>
      </div>
      <div class="actions">
        <button type="button" id="embedBtn" class="primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>Embed</button>
        <button type="button" id="shareBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>Share</button>
        <button type="button" id="svgBtn" title="Download as SVG"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>SVG</button>
        <button type="button" id="pngBtn" title="Download as PNG">PNG</button>
        <button type="button" id="csvBtn" title="Download the weekly data as CSV">CSV</button>
        <a id="jsonLink" href="#" target="_blank" rel="noopener" title="Open the weekly data as JSON">JSON</a>
      </div>
    </div>
    <div class="stage">
      <div id="chart" aria-live="polite"></div>
      <div id="tip" class="tip" hidden></div>
    </div>
    <p class="status" id="status"></p>
    <p class="note" id="note" hidden></p>
  </section>

  <section class="card" id="tableCard" hidden>
    <details><summary>Weekly data</summary><div class="table-wrap" id="table"></div></details>
  </section>

  <section class="features" id="about">
    <div class="feature"><h3>Live, zero setup</h3><p>Charts come straight from GitHub's statistics and refresh themselves. Paste one line into a README and forget about it.</p></div>
    <div class="feature"><h3>Your look, your axis</h3><p>Clean or hand-drawn sketch style, calendar dates or a timeline that starts every repository at its first commit, light or dark.</p></div>
    <div class="feature"><h3>Any size of repository</h3><p>GitHub's API stops at 10,000 commits. The <a href="${REPO_URL}#the-github-action">GitHub Action</a> and <a href="${REPO_URL}#the-cli">CLI</a> render from a clone instead and can exclude lockfiles or vendored code.</p></div>
  </section>
</main>

<dialog id="embedDlg" aria-labelledby="dlgTitle">
  <div class="dlg-head"><h2 id="dlgTitle">Embed this chart</h2><button type="button" class="ghost" id="dlgClose">Close</button></div>
  <div class="dlg-body">
    <div class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="md" aria-selected="true">Markdown</button>
      <button type="button" role="tab" data-tab="html" aria-selected="false">HTML, light/dark aware</button>
      <button type="button" role="tab" data-tab="url" aria-selected="false">Image URL</button>
    </div>
    <div data-pane="md"><div class="snippet-head"><span>Paste into your README. Follows the reader's light or dark setting.</span><button class="ghost" type="button" data-copy="md">Copy</button></div><pre id="md"></pre></div>
    <div data-pane="html" hidden><div class="snippet-head"><span>Switches with the reader's GitHub theme</span><button class="ghost" type="button" data-copy="html">Copy</button></div><pre id="html"></pre></div>
    <div data-pane="url" hidden><div class="snippet-head"><span>Direct link to the SVG. Swap <code>theme=auto</code> for <code>light</code> or <code>dark</code> to pin it.</span><button class="ghost" type="button" data-copy="url">Copy</button></div><pre id="url"></pre></div>
    <p class="small">Options: <code>type=net|added</code>, <code>axis=date|timeline</code>, <code>style=clean|sketch</code>, <code>theme=auto|light|dark</code>, <code>width</code> (320 to 2400), <code>height</code> (200 to 1600). The image is cached for six hours and refreshes itself after that.</p>
    <div class="preview"><img id="previewImg" alt="Preview of the embedded chart"></div>
  </div>
</dialog>
<div class="toast" id="toast" role="status"></div>

<footer class="wrap">
  <p>Numbers come from GitHub's weekly code-frequency statistics: every line in every text file counts, lockfiles and vendored code included. Weeks start on Sunday, and the first request for a repository can take GitHub a minute or two to compute.</p>
  <p><a href="${REPO_URL}">Source on GitHub</a> / <a href="${REPO_URL}#run-your-own-instance">Run your own instance</a> / <a href="${REPO_URL}#how-the-numbers-are-computed">How the numbers are computed</a> / Made by <a href="https://paul-goldschmidt.de">Paul Goldschmidt</a></p>
</footer>
<script>
(function () {
  var PALETTE = ${JSON.stringify(SERIES_COLORS)};
  var MAX_REPOS = PALETTE.light.length;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), input = $('repoInput'), chipsEl = $('chips'), picker = $('picker'), goBtn = $('goBtn'), clearBtn = $('clearBtn');
  var chartCard = $('chartCard'), chart = $('chart'), tip = $('tip'), status = $('status'), note = $('note'), tableCard = $('tableCard');
  var dlg = $('embedDlg'), toast = $('toast'), themeBtn = $('themeBtn'), sampleCard = $('sampleCard');
  var repos = [];
  var type = 'net';
  var axis = 'date';
  var style = 'clean';
  var current = null; // { data: json, svg: text, svgUrl: string, jsonUrl: string }
  var drawId = 0;
  var toastTimer;

  function parseRepos(text) {
    var out = [];
    String(text).split(/[,\\s]+/).forEach(function (r) {
      r = r.trim().replace(/^(?:https?:\\/\\/)?(?:www\\.)?github\\.com\\//i, '').replace(/\\.git$/i, '').replace(/\\/+$/, '');
      var parts = r.split('/');
      if (parts.length >= 2) r = parts[0] + '/' + parts[1];
      if (/^[\\w.-]+\\/[\\w.-]+$/.test(r)) out.push(r);
    });
    return out;
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mode() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function colorOf(i) { return PALETTE[mode()][i % MAX_REPOS]; }
  function say(text) {
    toast.textContent = text; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
  }
  function download(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function copy(text, done) {
    var ok = function () { say(done || 'Copied to clipboard'); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(ok, function () { legacy(); });
    else legacy();
    function legacy() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok(); }
  }

  /* theme */
  function applyTheme(t, save) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.setAttribute('data-theme', 'light');
    themeBtn.querySelector('.sun').hidden = t === 'dark';
    themeBtn.querySelector('.moon').hidden = t !== 'dark';
    if (save) { try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ } }
  }
  function initialTheme() {
    var p = new URLSearchParams(location.search).get('theme');
    if (p === 'dark' || p === 'light') return p;
    var saved = null; try { saved = localStorage.getItem('theme'); } catch (e) { /* private mode */ }
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  themeBtn.addEventListener('click', function () {
    applyTheme(mode() === 'dark' ? 'light' : 'dark', true);
    renderChips();
    if (repos.length) draw();
  });

  /* repository picker */
  function renderChips() {
    chipsEl.innerHTML = repos.map(function (r, i) {
      return '<span class="chip"><span class="dot" style="background:' + colorOf(i) + '"></span><span>' + esc(r) + '</span><button type="button" data-remove="' + esc(r) + '" aria-label="Remove ' + esc(r) + '">&times;</button></span>';
    }).join('');
    clearBtn.hidden = repos.length === 0;
    input.placeholder = repos.length ? (repos.length >= MAX_REPOS ? 'Up to ' + MAX_REPOS + ' repositories' : 'Add another repository to compare') : 'owner/repo or a GitHub URL';
    input.disabled = repos.length >= MAX_REPOS;
  }
  function addFromInput() {
    var added = 0;
    parseRepos(input.value).forEach(function (r) {
      var key = r.toLowerCase();
      if (repos.length >= MAX_REPOS) return;
      if (repos.some(function (x) { return x.toLowerCase() === key; })) return;
      repos.push(r); added++;
    });
    input.value = '';
    renderChips();
    return added;
  }
  function removeRepo(r) {
    repos = repos.filter(function (x) { return x !== r; });
    renderChips();
    if (repos.length) draw(); else reset();
  }
  function reset() {
    current = null; drawId++;
    chartCard.hidden = true; tableCard.hidden = true; sampleCard.hidden = false;
    history.replaceState(null, '', location.pathname);
    input.focus();
  }
  picker.addEventListener('click', function (e) { if (e.target === picker || e.target === chipsEl) input.focus(); });
  chipsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove]');
    if (btn) removeRepo(btn.getAttribute('data-remove'));
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !input.value && repos.length) { e.preventDefault(); removeRepo(repos[repos.length - 1]); }
    if ((e.key === ',' || e.key === ' ') && parseRepos(input.value).length) { e.preventDefault(); addFromInput(); }
  });
  input.addEventListener('paste', function () { setTimeout(function () { if (parseRepos(input.value).length > 1) addFromInput(); }, 0); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    addFromInput();
    if (repos.length) draw(); else input.focus();
  });
  clearBtn.addEventListener('click', function () { repos = []; renderChips(); reset(); });
  $('sampleLink').addEventListener('click', function (e) {
    e.preventDefault();
    repos = ['expressjs/express', 'pallets/flask'];
    renderChips();
    draw();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.querySelectorAll('.example').forEach(function (b) {
    b.addEventListener('click', function () {
      var r = b.getAttribute('data-repo');
      if (repos.indexOf(r) === -1 && repos.length < MAX_REPOS) repos.push(r);
      renderChips();
      draw();
    });
  });
  function setSeg(attr, value) {
    document.querySelectorAll('.seg [data-' + attr + ']').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-' + attr) === value)); });
  }
  document.querySelectorAll('.seg [data-type],.seg [data-axis],.seg [data-style]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.hasAttribute('data-type')) { type = b.getAttribute('data-type'); setSeg('type', type); }
      if (b.hasAttribute('data-axis')) { axis = b.getAttribute('data-axis'); setSeg('axis', axis); }
      if (b.hasAttribute('data-style')) { style = b.getAttribute('data-style'); setSeg('style', style); }
      if (repos.length) draw();
    });
  });

  /* drawing */
  function options() {
    var o = { repos: repos.join(',') };
    if (type !== 'net') o.type = type;
    if (axis !== 'date') o.axis = axis;
    if (style !== 'clean') o.style = style;
    return o;
  }
  function query() { var o = options(); o.theme = mode(); return new URLSearchParams(o); }
  function draw() {
    var q = query();
    history.replaceState(null, '', '?' + q.toString());
    var svgUrl = location.origin + '/svg?' + q.toString();
    var jsonUrl = location.origin + '/api/loc?' + new URLSearchParams({ repos: repos.join(',') }).toString();
    var id = ++drawId;
    chartCard.hidden = false; sampleCard.hidden = true;
    chartCard.classList.add('loading');
    status.innerHTML = 'Loading ' + repos.map(esc).join(', ') + '\\u2026';
    note.hidden = true;
    tip.hidden = true;
    $('jsonLink').href = jsonUrl;

    Promise.all([
      fetch(svgUrl, { cache: 'no-cache' }).then(function (r) { return r.text(); }),
      fetch(jsonUrl, { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      if (id !== drawId) return;
      chart.innerHTML = res[0];
      chartCard.classList.remove('loading');
      current = { data: res[1], svg: res[0], svgUrl: svgUrl, jsonUrl: jsonUrl };
      var pending = (res[1].errors || []).some(function (e) { return e.transient; });
      renderStatus(res[1], pending);
      renderEmbed(svgUrl);
      renderTable(res[1]);
      attachHover();
      // GitHub computes statistics lazily; the server keeps polling, so ask again in a bit.
      if (pending) setTimeout(function () { if (id === drawId) draw(); }, 8000);
    }).catch(function (err) {
      if (id !== drawId) return;
      chartCard.classList.remove('loading');
      status.textContent = 'Could not load the chart: ' + err.message;
    });
  }

  function renderStatus(data, pending) {
    var byRepo = {};
    (data.repos || []).forEach(function (r) { byRepo[r.repo.toLowerCase()] = r; });
    var errs = {};
    (data.errors || []).forEach(function (e) { errs[e.repo.toLowerCase()] = e; });
    var parts = repos.map(function (name, i) {
      var r = byRepo[name.toLowerCase()], e = errs[name.toLowerCase()];
      var dot = '<span class="dot" style="background:' + colorOf(i) + '"></span>';
      if (r) {
        var s = r.summary;
        var headline = type === 'added' ? fmt(s.additions) + ' lines added' : fmt(s.net) + ' lines';
        return '<span>' + dot + '<b>' + esc(r.repo) + '</b> ' + headline + ' <span style="color:var(--muted)">(+' + fmt(s.additions) + ' / -' + fmt(s.deletions) + ' since ' + esc(s.firstWeek) + ')</span></span>';
      }
      if (e) return '<span>' + dot + '<b>' + esc(name) + '</b> <span style="color:var(--muted)">' + esc(e.message) + '</span></span>';
      return '';
    });
    status.innerHTML = parts.join('');
    note.hidden = !pending;
    if (pending) note.textContent = 'Retrying automatically every few seconds\\u2026';
  }

  function renderEmbed(svgUrl) {
    var pageUrl = location.origin + '/?' + new URLSearchParams(options()).toString();
    var auto = svgUrl.replace(/theme=[a-z]+/, 'theme=auto');
    var light = svgUrl.replace(/theme=[a-z]+/, 'theme=light');
    var dark = svgUrl.replace(/theme=[a-z]+/, 'theme=dark');
    $('md').textContent = '[![Lines of Code History](' + auto + ')](' + pageUrl + ')';
    $('html').textContent = '<a href="' + pageUrl + '">\\n  <picture>\\n    <source media="(prefers-color-scheme: dark)" srcset="' + dark + '">\\n    <source media="(prefers-color-scheme: light)" srcset="' + light + '">\\n    <img alt="Lines of Code History" src="' + light + '">\\n  </picture>\\n</a>';
    $('url').textContent = auto;
    $('previewImg').src = svgUrl;
  }

  function renderTable(data) {
    var html = '';
    (data.repos || []).forEach(function (r) {
      html += '<table><caption style="text-align:left;font-weight:600;padding:8px 0">' + esc(r.repo) + '</caption><thead><tr><th>Week of</th><th>Added</th><th>Removed</th><th>Lines of code</th><th>Lines added, total</th></tr></thead><tbody>';
      r.weeks.forEach(function (w) {
        html += '<tr><td>' + w.week + '</td><td>' + fmt(w.additions) + '</td><td>' + fmt(w.deletions) + '</td><td>' + fmt(w.net) + '</td><td>' + fmt(w.added) + '</td></tr>';
      });
      html += '</tbody></table>';
    });
    $('table').innerHTML = html;
    tableCard.hidden = !html;
  }

  /* hover crosshair */
  function attachHover() {
    var svg = chart.querySelector('svg');
    if (!svg || !svg.dataset.plot) return;
    var plot = svg.dataset.plot.split(',').map(Number), xr = svg.dataset.x.split(',').map(Number);
    var timeline = svg.dataset.axis === 'timeline';
    var vb = svg.viewBox.baseVal;
    var colors = {}, starts = {};
    [].slice.call(svg.querySelectorAll('path.lh-line')).forEach(function (p) { colors[p.dataset.series] = getComputedStyle(p).stroke; starts[p.dataset.series] = Number(p.dataset.start); });
    var cross = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cross.setAttribute('y1', plot[1]); cross.setAttribute('y2', plot[3]);
    cross.setAttribute('stroke', 'currentColor'); cross.setAttribute('stroke-opacity', '0.35'); cross.setAttribute('stroke-width', '1');
    cross.setAttribute('visibility', 'hidden');
    svg.appendChild(cross);
    var week = 7 * 86400 * 1000;
    var stage = chart.parentNode;

    svg.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var px = (e.clientX - rect.left) * (vb.width / rect.width);
      if (px < plot[0] || px > plot[2]) { hide(); return; }
      var t = xr[0] + ((px - plot[0]) / (plot[2] - plot[0])) * (xr[1] - xr[0]);
      var wk, head;
      if (timeline) {
        wk = Math.round(t / week) * week; // elapsed, in whole weeks
        var weeks = Math.round(wk / week);
        head = weeks < 1 ? 'First week' : weeks < 9 ? 'Week ' + weeks : weeks < 104 ? (weeks / 4.348).toFixed(1).replace(/\\.0$/, '') + ' months in' : (weeks / 52.18).toFixed(1).replace(/\\.0$/, '') + ' years in';
      } else {
        wk = Math.round(t / week) * week;
        var d = new Date(wk);
        var day = (d.getUTCDay() + 3) % 7; // weeks start on Sunday; align to the nearest Sunday 00:00 UTC
        wk = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay() + (day > 3 ? 7 : 0));
        head = 'Week of ' + new Date(wk).toISOString().slice(0, 10);
      }
      var rows = [];
      (current.data.repos || []).forEach(function (r) {
        var at = timeline ? starts[r.repo] + wk : wk;
        var iso = new Date(at).toISOString().slice(0, 10);
        var w = r.weeks.find(function (x) { return x.week === iso; });
        if (!w) return;
        var val = type === 'added' ? w.added : w.net;
        rows.push('<div class="row"><span class="dot" style="background:' + colors[r.repo] + '"></span>' + esc(r.repo) + ' <b>' + fmt(val) + '</b> <span style="color:var(--muted)">(+' + fmt(w.additions) + ' / -' + fmt(w.deletions) + (timeline ? ', ' + iso : '') + ')</span></div>');
      });
      if (!rows.length) { hide(); return; }
      var cx = plot[0] + ((wk - xr[0]) / (xr[1] - xr[0])) * (plot[2] - plot[0]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = '<div class="d">' + head + '</div>' + rows.join('');
      tip.hidden = false;
      var box = stage.getBoundingClientRect();
      var left = e.clientX - box.left + 14, top = e.clientY - box.top + 14;
      if (left + tip.offsetWidth > box.width - 8) left = e.clientX - box.left - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = top + 'px';
    });
    svg.addEventListener('mouseleave', hide);
    function hide() { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); }
  }

  /* actions */
  function fileStem() { return 'loc-history-' + repos.map(function (r) { return r.replace('/', '-'); }).join('-vs-'); }
  $('embedBtn').addEventListener('click', function () { if (current) dlg.showModal(); });
  $('dlgClose').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.querySelectorAll('[role=tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      dlg.querySelectorAll('[role=tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
      dlg.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== tab.getAttribute('data-tab'); });
    });
  });
  dlg.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () { copy($(btn.getAttribute('data-copy')).textContent, 'Snippet copied'); });
  });
  $('shareBtn').addEventListener('click', function () {
    var url = location.href;
    if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function () { /* dismissed */ });
    else copy(url, 'Link copied');
  });
  $('svgBtn').addEventListener('click', function () {
    if (current) download(fileStem() + '.svg', new Blob([current.svg], { type: 'image/svg+xml' }));
  });
  $('pngBtn').addEventListener('click', function () {
    if (!current) return;
    var svgEl = chart.querySelector('svg');
    var w = svgEl ? svgEl.viewBox.baseVal.width : 800, h = svgEl ? svgEl.viewBox.baseVal.height : 480;
    var img = new Image();
    var url = URL.createObjectURL(new Blob([current.svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = function () {
      var scale = 2, canvas = document.createElement('canvas');
      canvas.width = w * scale; canvas.height = h * scale;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = mode() === 'dark' ? '#1a1a19' : '#fcfcfb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) { if (blob) download(fileStem() + '.png', blob); }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); say('Could not render a PNG in this browser'); };
    img.src = url;
  });
  $('csvBtn').addEventListener('click', function () {
    if (!current) return;
    var lines = ['repo,week,additions,deletions,lines_of_code,lines_added_total'];
    (current.data.repos || []).forEach(function (r) {
      r.weeks.forEach(function (w) { lines.push([r.repo, w.week, w.additions, w.deletions, w.net, w.added].join(',')); });
    });
    download(fileStem() + '.csv', new Blob([lines.join('\\n') + '\\n'], { type: 'text/csv' }));
  });

  /* boot */
  function init() {
    applyTheme(initialTheme(), false);
    var p = new URLSearchParams(location.search);
    var hash = location.hash.replace(/^#/, '');
    var fromUrl = p.get('repos') || p.get('repo') || (hash && hash.indexOf('/') > -1 ? hash.split('&')[0] : '');
    repos = parseRepos(fromUrl).slice(0, MAX_REPOS);
    if (p.get('type') === 'added') { type = 'added'; setSeg('type', type); }
    if (p.get('axis') === 'timeline') { axis = 'timeline'; setSeg('axis', axis); }
    if (p.get('style') === 'sketch') { style = 'sketch'; setSeg('style', style); }
    renderChips();
    if (repos.length) draw();
  }
  init();
})();
</script>
</body>
</html>
`;
}
