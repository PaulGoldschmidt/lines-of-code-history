import { MAX_SERIES, parseTheme, renderChart, renderMessage, type Theme, MIN_WIDTH, MAX_WIDTH, MIN_HEIGHT, MAX_HEIGHT, DEFAULT_WIDTH, DEFAULT_HEIGHT, clamp } from './chart.js';
import { GitHubError, parseRepo } from './github.js';
import { RepoLoader, type LoaderOptions } from './loader.js';
import { renderPage } from './page.js';
import { cumulative, describeChart, isoDate, parseSeriesType, summarize } from './series.js';
import type { SeriesType, WeeklyRow } from './types.js';

export interface HandlerOptions {
  loader?: RepoLoader;
  /** Used to build a loader when none is given. */
  loaderOptions?: LoaderOptions;
  /** `Cache-Control` max-age for successful charts and data. Default 6 hours. */
  maxAgeSeconds?: number;
  now?: () => Date;
}

export type FetchHandler = (request: Request) => Promise<Response>;

interface Params {
  repos: string[];
  invalid: string[];
  type: SeriesType;
  theme: Theme;
  width: number;
  height: number;
}

export function parseParams(url: URL): Params {
  const raw = [...url.searchParams.getAll('repos'), ...url.searchParams.getAll('repo')]
    .flatMap((v) => v.split(/[,\s]+/))
    .map((v) => v.trim())
    .filter(Boolean);
  const repos: string[] = [];
  const invalid: string[] = [];
  for (const r of raw) {
    const canonical = parseRepo(r);
    if (!canonical) invalid.push(r);
    else if (!repos.includes(canonical)) repos.push(canonical);
  }
  const num = (name: string, fallback: number, lo: number, hi: number): number => {
    const v = Number(url.searchParams.get(name));
    return Number.isFinite(v) && v > 0 ? clamp(Math.round(v), lo, hi) : fallback;
  };
  return {
    repos,
    invalid,
    type: parseSeriesType(url.searchParams.get('type')),
    theme: parseTheme(url.searchParams.get('theme')),
    width: num('width', DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH),
    height: num('height', DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT),
  };
}

interface LoadOutcome {
  ok: Array<{ repo: string; rows: WeeklyRow[] }>;
  failed: Array<{ repo: string; code: string; message: string; status: number }>;
}

function describeError(err: unknown): { code: string; message: string; status: number } {
  if (err instanceof GitHubError) return { code: err.code, message: err.message, status: err.httpStatus };
  return { code: 'internal', message: err instanceof Error ? err.message : String(err), status: 500 };
}

async function loadAll(loader: RepoLoader, repos: string[]): Promise<LoadOutcome> {
  const settled = await Promise.allSettled(repos.map((r) => loader.load(r)));
  const out: LoadOutcome = { ok: [], failed: [] };
  settled.forEach((result, i) => {
    const repo = repos[i]!;
    if (result.status === 'fulfilled') out.ok.push({ repo, rows: result.value });
    else out.failed.push({ repo, ...describeError(result.reason) });
  });
  return out;
}

const COMMON_HEADERS = { 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' };

function svgResponse(body: string, status: number, cacheControl: string): Response {
  return new Response(body, {
    status,
    headers: { ...COMMON_HEADERS, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': cacheControl },
  });
}

function jsonResponse(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...COMMON_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  });
}

/** Creates a fetch-style request handler serving the web UI, the SVG endpoint and the JSON API. */
export function createHandler(options: HandlerOptions = {}): FetchHandler {
  const loader = options.loader ?? new RepoLoader(options.loaderOptions);
  const maxAge = options.maxAgeSeconds ?? 6 * 60 * 60;
  const now = options.now ?? (() => new Date());
  const okCache = `public, max-age=${maxAge}, s-maxage=${maxAge}`;

  async function svg(url: URL): Promise<Response> {
    const params = parseParams(url);
    const frame = { width: params.width, height: params.height, theme: params.theme, now: now() };
    if (params.repos.length === 0) {
      const hint =
        params.invalid.length > 0
          ? `Not a GitHub repository: ${params.invalid.join(', ')}. Use owner/name.`
          : 'Add ?repos=owner/name to the URL (comma-separate several). Options: type=net|added, theme=light|dark|auto, width, height.';
      return svgResponse(renderMessage('Lines of code history', hint, frame), 400, 'no-store');
    }
    const repos = params.repos.slice(0, MAX_SERIES);
    const { ok, failed } = await loadAll(loader, repos);
    const notes: string[] = [];
    if (params.repos.length > MAX_SERIES) notes.push(`showing the first ${MAX_SERIES} repositories`);
    if (params.invalid.length > 0) notes.push(`ignored: ${params.invalid.join(', ')}`);
    for (const fail of failed) notes.push(`${fail.repo}: ${fail.message}`);

    if (ok.length === 0) {
      const pending = failed.every((fail) => fail.code === 'pending' || fail.code === 'busy');
      const message = failed.map((fail) => fail.message).join(' ');
      return svgResponse(
        renderMessage('Lines of code history', pending ? `${message}. This image refreshes itself.` : message, frame),
        200,
        pending ? 'public, max-age=30' : 'no-store',
      );
    }

    const labels = ok.map((o) => o.repo);
    const { title, subtitle } = describeChart(params.type, labels);
    const chart = renderChart(
      ok.map((o) => ({ label: o.repo, points: cumulative(o.rows, params.type) })),
      {
        ...frame,
        title,
        subtitle,
        footer: `lines-of-code-history / data: GitHub / ${isoDate(now())}`,
        note: notes.length > 0 ? notes.join(' / ') : undefined,
      },
    );
    return svgResponse(chart, 200, failed.length > 0 ? 'public, max-age=300' : okCache);
  }

  async function api(url: URL): Promise<Response> {
    const params = parseParams(url);
    if (params.repos.length === 0) {
      return jsonResponse(
        { error: params.invalid.length ? `invalid repository: ${params.invalid.join(', ')}` : 'missing ?repos=owner/name' },
        400,
        'no-store',
      );
    }
    const repos = params.repos.slice(0, MAX_SERIES);
    const { ok, failed } = await loadAll(loader, repos);
    const body = {
      generatedAt: now().toISOString(),
      source: 'github',
      repos: ok.map((o) => {
        const net = cumulative(o.rows, 'net');
        const added = cumulative(o.rows, 'added');
        return {
          repo: o.repo,
          summary: summarize(o.rows),
          weeks: o.rows.map((r, i) => ({
            week: isoDate(new Date(r.week * 1000)),
            additions: r.additions,
            deletions: r.deletions,
            net: net[i]!.value,
            added: added[i]!.value,
          })),
        };
      }),
      errors: failed.map(({ repo, code, message }) => ({ repo, code, message })),
    };
    const status = ok.length > 0 ? 200 : (failed[0]?.status ?? 500);
    return jsonResponse(body, status, status === 200 && failed.length === 0 ? okCache : 'no-store');
  }

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      switch (path) {
        case '/':
        case '/index.html':
          return new Response(renderPage(), {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
          });
        case '/svg':
        case '/svg/':
        case '/chart.svg':
          return await svg(url);
        case '/api/loc':
        case '/api':
          return await api(url);
        case '/healthz':
          return jsonResponse({ ok: true, ...loader.stats() }, 200, 'no-store');
        case '/favicon.ico':
          return new Response(null, { status: 204 });
        default:
          return new Response('not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
      }
    } catch (err) {
      console.error(err);
      return new Response('internal error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  };
}
