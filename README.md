# Lines of Code History

See how the lines of code in a GitHub repository changed over time. It is [star-history](https://github.com/star-history/star-history), but for code: give it `owner/repo`, get an SVG chart you can embed in your README, and it keeps itself up to date.

<a href="https://loc-history.com/?repos=PaulGoldschmidt/lines-of-code-history">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://loc-history.com/svg?repos=PaulGoldschmidt/lines-of-code-history&theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://loc-history.com/svg?repos=PaulGoldschmidt/lines-of-code-history&theme=light">
    <img alt="Lines of code history of this repository" src="https://loc-history.com/svg?repos=PaulGoldschmidt/lines-of-code-history&theme=light">
  </picture>
</a>

That is this repository's own chart, served live by [loc-history.com](https://loc-history.com). Several repositories on one chart, for example express and star-history:

<a href="https://loc-history.com/?repos=expressjs/express,star-history/star-history">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://loc-history.com/svg?repos=expressjs/express,star-history/star-history&theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://loc-history.com/svg?repos=expressjs/express,star-history/star-history&theme=light">
    <img alt="Lines of code history of expressjs/express and star-history/star-history" src="https://loc-history.com/svg?repos=expressjs/express,star-history/star-history&theme=light">
  </picture>
</a>

Prefer it hand-drawn, counted from the first commit? Add `style=sketch` and `axis=timeline`, here for vitejs/vite:

<a href="https://loc-history.com/?repos=vitejs/vite&style=sketch&axis=timeline">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://loc-history.com/svg?repos=vitejs/vite&style=sketch&axis=timeline&theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://loc-history.com/svg?repos=vitejs/vite&style=sketch&axis=timeline&theme=light">
    <img alt="Sketch-style lines of code timeline of vitejs/vite" src="https://loc-history.com/svg?repos=vitejs/vite&style=sketch&axis=timeline&theme=light">
  </picture>
</a>

Two ways to use it:

- **Hosted chart, zero setup.** Run the small server (or point at someone's instance) and embed `/svg?repos=owner/repo` like a badge. Data comes from GitHub's statistics API.
- **GitHub Action, no server.** A workflow in your repo renders the chart from the full git history and commits the SVG. Works for repositories of any size and lets you exclude lockfiles or vendored code.

## Embed a chart in your README

With an instance running at `https://loc-history.com`:

```markdown
[![Lines of Code History](https://loc-history.com/svg?repos=owner/repo)](https://loc-history.com/?repos=owner/repo)
```

Light and dark aware, switching with the reader's GitHub theme:

```html
<a href="https://loc-history.com/?repos=owner/repo">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://loc-history.com/svg?repos=owner/repo&theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://loc-history.com/svg?repos=owner/repo&theme=light">
    <img alt="Lines of Code History" src="https://loc-history.com/svg?repos=owner/repo&theme=light">
  </picture>
</a>
```

The web UI at `/` builds these snippets for you, previews the chart with a hover readout, and shows the weekly numbers as a table.

### `/svg` parameters

| Parameter | Values | Default |
| --- | --- | --- |
| `repos` | Comma-separated `owner/name`, up to 8. GitHub URLs are accepted too. | required |
| `type` | `net`: lines of code (additions minus deletions). `added`: cumulative lines added. | `net` |
| `theme` | `light`, `dark`, or `auto` (follows `prefers-color-scheme`) | `light` |
| `style` | `clean`, or `sketch` for a hand-drawn look. Its handwriting text is drawn as glyph outlines, so it renders the same everywhere, including through GitHub's image proxy, which blocks fonts. | `clean` |
| `axis` | `date` plots calendar time. `timeline` starts every repository at its first commit, so growth curves can be compared directly. | `date` |
| `width`, `height` | Pixels. 320 to 2400 wide, 200 to 1600 high. | `800`, `480` |

`/api/loc?repos=owner/name` returns the same data as JSON: one row per week with additions, deletions, cumulative net and cumulative added lines, plus a summary per repository.

Charts are cached for six hours (`Cache-Control` is set accordingly, so GitHub's image proxy caches them too). After that the last result is still served instantly while a fresh one loads in the background, and the cache is written to disk so a restart does not start cold.

## Run your own instance

Requires Node 18 or newer.

```bash
npm install
npm run build
GITHUB_TOKEN=ghp_yourtoken npm start      # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Optional but recommended. Without it GitHub allows 60 API requests per hour per IP; with it 5,000. A token with `repo` scope also makes private repositories work. |
| `PORT` | Listen port, default `3000`. |
| `LOC_CACHE_TTL_SECONDS` | How long a result counts as fresh, in memory and in `Cache-Control`, default `21600`. |
| `LOC_STALE_SECONDS` | How much longer a stale result is still served while it refreshes in the background, default `604800` (7 days). `0` disables stale serving. |
| `LOC_CACHE_DIR` | Directory for the on-disk cache, so a restart does not start cold. Unset means memory only. The Docker image sets it to `/data`. |
| `LOC_CACHE_MAX_REPOS` | Repositories kept in memory, least recently used evicted first, default `5000`. |
| `LOC_MAX_CONCURRENT_FETCHES` | GitHub requests in flight at once, default `8`. Keeps the token clear of GitHub's secondary rate limits. |
| `LOC_MAX_QUEUED_FETCHES` | Requests allowed to wait for a slot before new ones get a short-lived "busy" placeholder, default `200`. |
| `LOC_STATS_RETRIES` | How often a single request re-polls GitHub while it computes statistics, default `5` (1.5 s apart). |

With Docker:

```bash
docker build -t lines-of-code-history .
docker run -p 3000:3000 -e GITHUB_TOKEN=ghp_yourtoken -v loc-cache:/data lines-of-code-history
```

The request handler is a plain `(Request) => Promise<Response>` function (`createHandler()` in `src/handler.ts`) with no Node-specific code, so it also runs on Cloudflare Workers, Deno, Bun or Vercel with a few lines of glue. Keep in mind that the cache lives in process memory unless `LOC_CACHE_DIR` points at a writable directory.

## The GitHub Action

Renders the chart from the repository's own git history and leaves it in the working tree for you to commit. Embed it with a relative path, for example `![Lines of code](./loc-history.svg)`.

```yaml
# .github/workflows/loc-history.yml
name: Lines of code history
on:
  push:
    branches: [main]
  schedule:
    - cron: '17 3 * * 1'
  workflow_dispatch:
permissions:
  contents: write
jobs:
  chart:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0                       # the whole history is needed
      - uses: PaulGoldschmidt/lines-of-code-history@v1
        id: loc
        with:
          path: loc-history.svg
          theme: auto
          exclude: package-lock.json,**/*.lock,vendor/**
      - run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add loc-history.svg
          git diff --cached --quiet || git commit -m "update lines of code chart (${{ steps.loc.outputs.total_lines }} lines)"
          git push
```

The full example lives in [`examples/loc-history.yml`](examples/loc-history.yml).

| Input | Default | Meaning |
| --- | --- | --- |
| `path` | `loc-history.svg` | Where to write the chart. |
| `type` | `net` | `net` or `added`, as above. |
| `theme` | `auto` | `light`, `dark` or `auto`. |
| `width`, `height` | `800`, `480` | Chart size in pixels. |
| `label` | the repository name | Series label in the chart title. |
| `exclude` | empty | Comma-separated globs of paths not to count. Patterns without a slash match file names anywhere (`*.lock`), patterns with a slash match from the repository root (`vendor/**`). |
| `ref` | `HEAD` | Git ref whose first-parent history is walked. |
| `data` | empty | Optional path for a JSON dump of the weekly numbers. |

Outputs: `total_lines` (lines of code at the last data point) and `svg_path`. The step summary shows the total as well.

## The CLI

The same renderer as a command. It takes GitHub repositories, local clones, or a mix:

```bash
npm run cli -- expressjs/express --out express.svg
npm run cli -- . --exclude package-lock.json --exclude 'vendor/**' --out loc-history.svg
npm run cli -- expressjs/express koajs/koa fastify/fastify --theme dark --type added --out frameworks.svg
npm run cli -- ~/src/my-repo --label me/my-repo --json > data.json
```

`npm link` puts it on your `PATH` as `loc-history`. Run it with `--help` for all options. `GITHUB_TOKEN` is picked up from the environment.

## How the numbers are computed

**Hosted charts** use GitHub's [`stats/code_frequency`](https://docs.github.com/rest/metrics/statistics#get-the-weekly-commit-activity) endpoint, which reports lines added and removed per week on the default branch. The running total of additions minus deletions is the number of lines in the repository that week. Keep in mind:

- Every line of every text file counts, including lockfiles, vendored and generated code. Binary files do not count.
- Weeks start on Sunday 00:00 UTC. The chart runs to the current week even when nothing changed.
- GitHub computes these statistics lazily. The first request for a repository usually gets HTTP 202 and, for large repositories, the job can take a minute or more. The server polls for a few seconds, then returns a short-lived "still computing" image and keeps polling in the background, so a page reload shows the chart.
- GitHub does not compute statistics for repositories with more than 10,000 commits (HTTP 422). Use the Action or the CLI with a clone for those.
- Private repositories need a token that can read them.

**The Action and the CLI's local mode** run `git log --first-parent --numstat` over the given ref. Following first parents means the running total always equals the lines in the checked-out tree (minus excludes), with a feature branch counted when it lands. Binary files are skipped, renames follow git's own detection, and `--exclude`/`--include` globs filter paths before counting. A shallow clone has incomplete history, so the Action refuses to run on one and the CLI warns.

The two sources agree on the final total but can differ along the way: GitHub counts commits where they happened, the local mode where they were merged.

## Development

```bash
npm install
npm test          # builds, then runs node --test against dist/test/*.test.js
npm run dev       # builds and starts the server
```

## License

[MIT](LICENSE)
