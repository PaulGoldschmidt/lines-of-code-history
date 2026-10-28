import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { globToRegExp, localCodeFrequency, makePathFilter, numstatPath } from '../src/git-local.js';
import { cumulative } from '../src/series.js';

const DAY = 86400;
const base = Date.UTC(2024, 0, 7) / 1000; // Sunday

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'loc-history-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
  const git = (args: string[], at?: number) =>
    execFileSync('git', ['-C', dir, ...args], { env: at ? { ...env, GIT_AUTHOR_DATE: `${at} +0000`, GIT_COMMITTER_DATE: `${at} +0000` } : env, stdio: 'pipe' });
  git(['init', '-q', '-b', 'main']);
  mkdirSync(join(dir, 'vendor'));
  writeFileSync(join(dir, 'a.txt'), 'one\ntwo\nthree\n');
  writeFileSync(join(dir, 'vendor', 'lib.js'), 'x\n'.repeat(100));
  git(['add', '.']);
  git(['commit', '-q', '-m', 'first'], base + DAY);
  writeFileSync(join(dir, 'a.txt'), 'one\nthree\nfour\nfive\n');
  writeFileSync(join(dir, 'b.bin'), Buffer.from([0, 1, 2, 0, 3]));
  git(['add', '.']);
  git(['commit', '-q', '-m', 'second'], base + 2 * 7 * DAY + DAY);
  return dir;
}

test('globToRegExp and makePathFilter', () => {
  assert.ok(globToRegExp('package-lock.json').test('web/package-lock.json'));
  assert.ok(!globToRegExp('package-lock.json').test('web/package-lock.json.bak'));
  assert.ok(globToRegExp('vendor/**').test('vendor/a/b.js'));
  assert.ok(!globToRegExp('vendor/**').test('src/vendor/a.js'));
  assert.ok(globToRegExp('*.min.js').test('dist/app.min.js'));
  assert.ok(globToRegExp('src/*.ts').test('src/a.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/x/a.ts'));
  const only = makePathFilter(['src/**'], ['**/*.test.ts']);
  assert.ok(only('src/a.ts'));
  assert.ok(!only('src/a.test.ts'));
  assert.ok(!only('lib/a.ts'));
});

test('numstatPath resolves rename notation', () => {
  assert.equal(numstatPath('a.txt'), 'a.txt');
  assert.equal(numstatPath('old.txt => new.txt'), 'new.txt');
  assert.equal(numstatPath('src/{old => new}/file.ts'), 'src/new/file.ts');
  assert.equal(numstatPath('src/{ => sub}/file.ts'), 'src/sub/file.ts');
});

test('localCodeFrequency walks history, buckets by week and honours excludes', async () => {
  const dir = makeRepo();
  const until = base + 4 * 7 * DAY;
  const rows = await localCodeFrequency(dir, { untilSeconds: until });
  assert.equal(rows.length, 5, 'first commit week through the "until" week');
  assert.deepEqual(rows[0], { week: base, additions: 103, deletions: 0 });
  assert.deepEqual(rows[1], { week: base + 7 * DAY, additions: 0, deletions: 0 });
  assert.deepEqual(rows[2], { week: base + 14 * DAY, additions: 2, deletions: 1 }, 'one line removed, two added');
  const net = cumulative(rows, 'net');
  assert.equal(net[net.length - 1]!.value, 104, 'total equals the lines in the tree');

  const filtered = await localCodeFrequency(dir, { untilSeconds: until, exclude: ['vendor/**'] });
  assert.equal(filtered[0]!.additions, 3);
  assert.equal(cumulative(filtered, 'net').pop()!.value, 4);
});

test('localCodeFrequency rejects on a bad path', async () => {
  await assert.rejects(localCodeFrequency(join(tmpdir(), 'definitely-not-a-repo-' + Date.now())), /git/);
});

test('exclude globs match file names with non-ASCII characters', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loc-history-utf8-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com', GIT_AUTHOR_DATE: `${base + DAY} +0000`, GIT_COMMITTER_DATE: `${base + DAY} +0000` };
  const git = (args: string[]) => execFileSync('git', ['-C', dir, ...args], { env, stdio: 'pipe' });
  git(['init', '-q', '-b', 'main']);
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'caf\u00e9.md'), 'a\nb\nc\nd\n');
  writeFileSync(join(dir, 'code.txt'), 'x\n');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'utf8']);
  const rows = await localCodeFrequency(dir, { exclude: ['docs/**'], untilSeconds: base + DAY });
  assert.equal(rows.reduce((n, r) => n + r.additions, 0), 1, 'the four lines of docs/caf\u00e9.md are excluded');
});
