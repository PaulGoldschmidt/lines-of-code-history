import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const run = promisify(execFile);
const cli = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js');

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'loc-cli-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main'], { env });
  writeFileSync(join(dir, 'a.txt'), 'one\ntwo\n');
  execFileSync('git', ['-C', dir, 'add', '.'], { env });
  execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'first'], { env });
  return dir;
}

test('cli renders an SVG for a local clone and writes JSON data', async () => {
  const dir = makeRepo();
  const out = join(dir, 'chart.svg');
  const data = join(dir, 'data.json');
  const { stderr } = await run(process.execPath, [cli, dir, '--label', 'me/repo', '--out', out, '--data', data, '--theme', 'auto']);
  assert.match(stderr, /me\/repo: 2 lines/);
  const svg = readFileSync(out, 'utf8');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('me/repo: Lines of code'));
  assert.match(svg, /lines-of-code-history \/ \d{4}-\d{2}-\d{2}</);
  assert.ok(!svg.includes('data:'));
  const json = JSON.parse(readFileSync(data, 'utf8')) as { repos: Array<{ repo: string; summary: { net: number } }> };
  assert.equal(json.repos[0]!.repo, 'me/repo');
  assert.equal(json.repos[0]!.summary.net, 2);
});

test('cli --json prints data to stdout', async () => {
  const dir = makeRepo();
  const { stdout } = await run(process.execPath, [cli, dir, '--json']);
  const json = JSON.parse(stdout) as { source: string; repos: unknown[] };
  assert.equal(json.source, 'git');
  assert.equal(json.repos.length, 1);
});

test('cli explains usage and rejects bad arguments', async () => {
  await assert.rejects(run(process.execPath, [cli]), (e: { code: number; stderr: string }) => e.code === 2 && /Usage/.test(e.stderr));
  await assert.rejects(run(process.execPath, [cli, 'not a repo']), (e: { code: number; stderr: string }) => e.code === 2 && /neither a directory nor an owner\/repo/.test(e.stderr));
});
