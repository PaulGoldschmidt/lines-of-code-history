#!/usr/bin/env node
import { statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderChart, parseTheme, parseStyle, parseXAxis, formatNumber } from './chart.js';
import { isShallow, localCodeFrequency } from './git-local.js';
import { fetchCodeFrequency, parseRepo } from './github.js';
import { cumulative, describeChart, isoDate, parseSeriesType, summarize } from './series.js';
import type { WeeklyRow } from './types.js';

const USAGE = `Usage: loc-history <owner/repo | path/to/clone> [...more] [options]

Draws an SVG chart of how many lines of code a repository had over time.
Each argument is either a GitHub repository (fetched via the GitHub API) or a
path to a local git clone (walked with git log; no commit limit, supports excludes).

Options:
  --type <net|added>      net lines of code (default) or cumulative lines added
  --theme <light|dark|auto>
  --style <clean|sketch>  clean (default) or a hand-drawn look
  --axis <date|timeline>  calendar dates (default) or time since each repository's first commit
  --width <px> --height <px>
  --out <file.svg>        write the SVG here instead of stdout
  --json                  print the weekly data as JSON instead of an SVG
  --data <file.json>      also write the weekly data as JSON to this file
  --label <name>          series label (repeat once per argument, in order)
  --exclude <glob>        ignore matching paths in local clones (repeatable)
  --include <glob>        only count matching paths in local clones (repeatable)
  --ref <git-ref>         history to walk in local clones (default HEAD)
  --title <text>          override the chart title
  -h, --help

Environment:
  GITHUB_TOKEN            raises the GitHub API rate limit (60 -> 5000 requests/hour)
`;

interface Source {
  label: string;
  load(): Promise<WeeklyRow[]>;
  kind: 'github' | 'git';
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      type: { type: 'string', default: 'net' },
      theme: { type: 'string', default: 'light' },
      style: { type: 'string', default: 'clean' },
      axis: { type: 'string', default: 'date' },
      width: { type: 'string' },
      height: { type: 'string' },
      out: { type: 'string' },
      json: { type: 'boolean', default: false },
      data: { type: 'string' },
      label: { type: 'string', multiple: true, default: [] },
      exclude: { type: 'string', multiple: true, default: [] },
      include: { type: 'string', multiple: true, default: [] },
      ref: { type: 'string' },
      title: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || positionals.length === 0) {
    process.stderr.write(USAGE);
    return values.help ? 0 : 2;
  }

  const sources: Source[] = [];
  for (const [i, arg] of positionals.entries()) {
    const label = values.label[i];
    if (isDirectory(arg)) {
      const path = resolve(arg);
      if (await isShallow(path)) {
        process.stderr.write(`warning: ${path} is a shallow clone; history and totals will be incomplete (use fetch-depth: 0)\n`);
      }
      sources.push({
        label: label ?? basename(path),
        kind: 'git',
        load: () => localCodeFrequency(path, { ref: values.ref, include: values.include, exclude: values.exclude }),
      });
      continue;
    }
    const repo = parseRepo(arg);
    if (!repo) {
      process.stderr.write(`error: "${arg}" is neither a directory nor an owner/repo\n`);
      return 2;
    }
    sources.push({ label: label ?? repo, kind: 'github', load: () => fetchCodeFrequency(repo, { token: process.env.GITHUB_TOKEN }) });
  }

  const type = parseSeriesType(values.type);
  const results = await Promise.all(sources.map(async (s) => ({ ...s, rows: await s.load() })));
  const now = new Date();

  for (const r of results) {
    const summary = summarize(r.rows);
    process.stderr.write(
      `${r.label}: ${formatNumber(summary.net)} lines (+${formatNumber(summary.additions)} / -${formatNumber(summary.deletions)} since ${summary.firstWeek})\n`,
    );
  }

  const data = {
    generatedAt: now.toISOString(),
    source: results.every((r) => r.kind === 'github') ? 'github' : results.every((r) => r.kind === 'git') ? 'git' : 'mixed',
    repos: results.map((r) => {
      const net = cumulative(r.rows, 'net');
      const added = cumulative(r.rows, 'added');
      return {
        repo: r.label,
        summary: summarize(r.rows),
        weeks: r.rows.map((row, i) => ({
          week: isoDate(new Date(row.week * 1000)),
          additions: row.additions,
          deletions: row.deletions,
          net: net[i]!.value,
          added: added[i]!.value,
        })),
      };
    }),
  };
  if (values.data) await writeFile(values.data, JSON.stringify(data, null, 2));
  if (values.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return 0;
  }

  const xAxis = parseXAxis(values.axis);
  const { title, subtitle } = describeChart(type, results.map((r) => r.label), xAxis);
  const svg = renderChart(
    results.map((r) => ({ label: r.label, points: cumulative(r.rows, type) })),
    {
      title: values.title ?? title,
      subtitle,
      theme: parseTheme(values.theme),
      style: parseStyle(values.style),
      xAxis,
      width: values.width ? Number(values.width) : undefined,
      height: values.height ? Number(values.height) : undefined,
      now,
    },
  );
  if (values.out) {
    await writeFile(values.out, svg);
    process.stderr.write(`wrote ${values.out}\n`);
  } else {
    process.stdout.write(svg + '\n');
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
