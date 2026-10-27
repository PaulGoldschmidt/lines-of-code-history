/** The single-page web UI: pick repositories, preview the chart, copy an embed snippet. */
export function renderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lines of Code History</title>
<meta name="description" content="See how the lines of code in a GitHub repository changed over time. Like star-history, but for code. Embeddable SVG charts for your README.">
<style>
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink-2:#52514e;--muted:#898781;--border:rgba(11,11,11,.1);--accent:#2a78d6;--accent-ink:#fff;--code:#f0efec}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink-2:#c3c2b7;--muted:#898781;--border:rgba(255,255,255,.1);--accent:#3987e5;--code:#262624}}
:root[data-theme=dark]{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink-2:#c3c2b7;--muted:#898781;--border:rgba(255,255,255,.1);--accent:#3987e5;--code:#262624}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:0 16px}
header.wrap{padding-top:40px;padding-bottom:8px}
h1{font-size:28px;margin:0 0 6px;letter-spacing:-.01em}
h2{font-size:16px;margin:0 0 8px}
.lede{color:var(--ink-2);margin:0;max-width:640px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin:16px 0}
form.controls{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:12px;align-items:end}
label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ink-2)}
input,select,button{font:inherit;color:inherit;border:1px solid var(--border);border-radius:6px;background:var(--page);padding:8px 10px;min-height:40px}
input{min-width:0}
input:focus,select:focus{outline:2px solid var(--accent);outline-offset:1px}
button.primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:600;cursor:pointer;padding:8px 16px}
button.ghost{background:transparent;cursor:pointer;font-size:12px;min-height:28px;padding:3px 10px}
button.ghost:hover{border-color:var(--accent)}
.chart{position:relative;padding:8px}
.chart.loading #chart{opacity:.45;transition:opacity .15s}
#chart svg{display:block;width:100%;height:auto;border-radius:6px}
.status{margin:8px 8px 4px;font-size:13px;color:var(--ink-2)}
.status b{color:var(--ink);font-weight:600}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:12px;box-shadow:0 4px 16px rgba(0,0,0,.12);white-space:nowrap;z-index:2}
.tip .d{color:var(--muted);margin-bottom:2px}
.tip .row{display:flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.snippet{margin:12px 0}
.snippet-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--ink-2);margin-bottom:4px}
pre{margin:0;background:var(--code);border-radius:6px;padding:10px 12px;font-size:12.5px;line-height:1.45;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
code{background:var(--code);border-radius:4px;padding:1px 5px;font-size:.92em}
details summary{cursor:pointer;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:10px;font-variant-numeric:tabular-nums}
th,td{text-align:right;padding:4px 8px;border-bottom:1px solid var(--border)}
th:first-child,td:first-child{text-align:left}
th{color:var(--ink-2);font-weight:600;position:sticky;top:0;background:var(--surface)}
.table-wrap{max-height:420px;overflow:auto}
footer.wrap{padding:24px 16px 48px;color:var(--muted);font-size:13px}
a{color:var(--accent)}
[hidden]{display:none!important}
@media (max-width:720px){form.controls{grid-template-columns:1fr 1fr}form.controls label:first-child{grid-column:1/-1}button.primary{grid-column:1/-1}}
</style>
</head>
<body>
<header class="wrap">
  <h1>Lines of Code History</h1>
  <p class="lede">See how the lines of code in a GitHub repository changed over time. Like <a href="https://star-history.com">star-history</a>, but for code. Enter a repo, get an SVG you can embed in your README.</p>
</header>
<main class="wrap">
  <form id="form" class="card controls" autocomplete="off">
    <label>Repositories (comma-separated)
      <input id="repos" name="repos" placeholder="owner/repo, owner/other-repo" spellcheck="false" autofocus>
    </label>
    <label>Measure
      <select id="type" name="type">
        <option value="net">Net lines of code</option>
        <option value="added">Cumulative lines added</option>
      </select>
    </label>
    <label>Theme
      <select id="theme" name="theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="auto">Auto</option>
      </select>
    </label>
    <button class="primary" type="submit">Draw chart</button>
  </form>

  <section class="card chart" id="chartCard" hidden>
    <div id="chart" aria-live="polite"></div>
    <div id="tip" class="tip" hidden></div>
    <p class="status" id="status"></p>
  </section>

  <section class="card" id="embedCard" hidden>
    <h2>Embed it</h2>
    <p class="lede" style="font-size:13px">Paste one of these into your README. The HTML variant switches between light and dark with the reader's GitHub theme.</p>
    <div class="snippet"><div class="snippet-head"><span>Markdown</span><button class="ghost" type="button" data-copy="md">Copy</button></div><pre id="md"></pre></div>
    <div class="snippet"><div class="snippet-head"><span>HTML, light/dark aware</span><button class="ghost" type="button" data-copy="html">Copy</button></div><pre id="html"></pre></div>
    <div class="snippet"><div class="snippet-head"><span>Image URL</span><button class="ghost" type="button" data-copy="url">Copy</button></div><pre id="url"></pre></div>
    <p class="lede" style="font-size:13px">URL options: <code>type=net|added</code>, <code>theme=light|dark|auto</code>, <code>width</code>, <code>height</code>. The same data is available as <a id="jsonLink" href="#" target="_blank" rel="noopener">JSON</a>.</p>
  </section>

  <section class="card" id="tableCard" hidden>
    <details><summary>Data table</summary><div class="table-wrap" id="table"></div></details>
  </section>
</main>
<footer class="wrap">
  <p>Numbers come from GitHub's weekly code-frequency statistics: every line in every text file counts, lockfiles and vendored code included. GitHub does not compute these statistics for repositories with more than 10,000 commits; for those, render the chart from a clone with the CLI or the GitHub Action. Charts are cached for a few hours.</p>
  <p><a href="https://github.com/PaulGoldschmidt/lines-of-code-history">Source on GitHub</a></p>
</footer>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $('form'), reposInput = $('repos'), typeSel = $('type'), themeSel = $('theme');
  var chartCard = $('chartCard'), chart = $('chart'), tip = $('tip'), status = $('status');
  var embedCard = $('embedCard'), tableCard = $('tableCard');
  var current = null; // { data, svgUrl }
  var drawId = 0;

  function parseRepos(text) {
    var seen = {}, out = [];
    text.split(/[,\\s]+/).forEach(function (r) {
      r = r.trim().replace(/^(?:https?:\\/\\/)?(?:www\\.)?github\\.com\\//i, '').replace(/\\.git$/i, '').replace(/\\/+$/, '');
      var parts = r.split('/');
      if (parts.length >= 2) r = parts[0] + '/' + parts[1];
      if (r && !seen[r]) { seen[r] = 1; out.push(r); }
    });
    return out;
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function init() {
    var p = new URLSearchParams(location.search);
    var hash = location.hash.replace(/^#/, '');
    var repos = p.get('repos') || p.get('repo') || (hash && hash.indexOf('/') > -1 ? hash.split('&')[0] : '');
    if (repos) reposInput.value = parseRepos(repos).join(', ');
    if (p.get('type')) typeSel.value = p.get('type') === 'added' ? 'added' : 'net';
    themeSel.value = p.get('theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (repos) draw();
  }

  function draw() {
    var repos = parseRepos(reposInput.value);
    if (!repos.length) { reposInput.focus(); return; }
    var q = new URLSearchParams({ repos: repos.join(','), type: typeSel.value, theme: themeSel.value });
    history.replaceState(null, '', '?' + q.toString());
    var svgUrl = location.origin + '/svg?' + q.toString();
    var jsonUrl = location.origin + '/api/loc?repos=' + encodeURIComponent(repos.join(','));
    var id = ++drawId;
    chartCard.hidden = false;
    chartCard.classList.add('loading');
    status.textContent = 'Loading ' + repos.join(', ') + '\\u2026';
    tip.hidden = true;

    Promise.all([
      fetch(svgUrl, { cache: 'no-cache' }).then(function (r) { return r.text(); }),
      fetch(jsonUrl, { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      if (id !== drawId) return;
      chart.innerHTML = res[0];
      chartCard.classList.remove('loading');
      current = { data: res[1], svgUrl: svgUrl };
      var pending = (res[1].errors || []).some(function (e) { return e.code === 'pending'; });
      renderStatus(res[1], pending);
      renderEmbed(repos, svgUrl, jsonUrl);
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
    var parts = (data.repos || []).map(function (r) {
      var s = r.summary;
      return '<b>' + esc(r.repo) + '</b>: ' + fmt(s.net) + ' lines (+' + fmt(s.additions) + ' / \\u2212' + fmt(s.deletions) + ' since ' + esc(s.firstWeek) + ')';
    });
    (data.errors || []).forEach(function (e) { parts.push('<b>' + esc(e.repo) + '</b>: ' + esc(e.message)); });
    if (pending) parts.push('GitHub is computing the statistics (this can take a minute for large repositories). Retrying automatically\\u2026');
    status.innerHTML = parts.join('<br>') || 'No data.';
  }

  function renderEmbed(repos, svgUrl, jsonUrl) {
    var pageUrl = location.origin + '/?' + new URLSearchParams({ repos: repos.join(','), type: typeSel.value }).toString();
    var light = svgUrl.replace(/theme=[a-z]+/, 'theme=light');
    var dark = svgUrl.replace(/theme=[a-z]+/, 'theme=dark');
    $('md').textContent = '[![Lines of Code History](' + svgUrl + ')](' + pageUrl + ')';
    $('html').textContent = '<a href="' + pageUrl + '">\\n  <picture>\\n    <source media="(prefers-color-scheme: dark)" srcset="' + dark + '">\\n    <source media="(prefers-color-scheme: light)" srcset="' + light + '">\\n    <img alt="Lines of Code History" src="' + light + '">\\n  </picture>\\n</a>';
    $('url').textContent = svgUrl;
    $('jsonLink').href = jsonUrl;
    embedCard.hidden = false;
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

  function attachHover() {
    var svg = chart.querySelector('svg');
    if (!svg || !svg.dataset.plot) return;
    var plot = svg.dataset.plot.split(',').map(Number), xr = svg.dataset.x.split(',').map(Number);
    var vb = svg.viewBox.baseVal;
    var paths = [].slice.call(svg.querySelectorAll('path.lh-line'));
    var colors = {};
    paths.forEach(function (p) { colors[p.dataset.series] = getComputedStyle(p).stroke; });
    var cross = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cross.setAttribute('y1', plot[1]); cross.setAttribute('y2', plot[3]);
    cross.setAttribute('stroke', 'currentColor'); cross.setAttribute('stroke-opacity', '0.35'); cross.setAttribute('stroke-width', '1');
    cross.setAttribute('visibility', 'hidden');
    svg.appendChild(cross);
    var week = 7 * 86400 * 1000;

    svg.addEventListener('mousemove', function (e) {
      var rect = svg.getBoundingClientRect();
      var px = (e.clientX - rect.left) * (vb.width / rect.width);
      if (px < plot[0] || px > plot[2]) { hide(); return; }
      var t = xr[0] + ((px - plot[0]) / (plot[2] - plot[0])) * (xr[1] - xr[0]);
      var wk = Math.round(t / week) * week;
      var d = new Date(wk);
      var day = (d.getUTCDay() + 3) % 7; // weeks start on Sunday; align to the nearest Sunday 00:00 UTC
      wk = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay() + (day > 3 ? 7 : 0));
      var iso = new Date(wk).toISOString().slice(0, 10);
      var rows = [];
      (current.data.repos || []).forEach(function (r) {
        var w = r.weeks.find(function (x) { return x.week === iso; });
        if (!w) return;
        var val = typeSel.value === 'added' ? w.added : w.net;
        rows.push('<div class="row"><span class="dot" style="background:' + colors[r.repo] + '"></span>' + esc(r.repo) + ' <b>' + fmt(val) + '</b> <span style="color:var(--muted)">(+' + fmt(w.additions) + ' / \\u2212' + fmt(w.deletions) + ')</span></div>');
      });
      if (!rows.length) { hide(); return; }
      var cx = plot[0] + ((wk - xr[0]) / (xr[1] - xr[0])) * (plot[2] - plot[0]);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = '<div class="d">Week of ' + iso + '</div>' + rows.join('');
      tip.hidden = false;
      var card = chartCard.getBoundingClientRect();
      var left = e.clientX - card.left + 14, top = e.clientY - card.top + 14;
      if (left + tip.offsetWidth > card.width - 8) left = e.clientX - card.left - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = top + 'px';
    });
    svg.addEventListener('mouseleave', hide);
    function hide() { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); }
  }

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = $(btn.dataset.copy).textContent;
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done);
      else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
    });
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); draw(); });
  typeSel.addEventListener('change', function () { if (current) draw(); });
  themeSel.addEventListener('change', function () { if (current) draw(); });
  init();
})();
</script>
</body>
</html>
`;
}
