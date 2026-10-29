import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fillWeeks, weekStart } from './series.js';
/**
 * Converts a glob to a RegExp. `**` matches across directories, `*` and `?` within one
 * path segment. A pattern without a slash matches the file's basename anywhere in the tree.
 */
export function globToRegExp(glob) {
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') {
                re += '.*';
                i++;
                if (glob[i + 1] === '/')
                    i++;
            }
            else {
                re += '[^/]*';
            }
        }
        else if (c === '?')
            re += '[^/]';
        else
            re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(glob.includes('/') ? `^${re}$` : `(^|/)${re}$`);
}
export function makePathFilter(include = [], exclude = []) {
    const inc = include.filter(Boolean).map(globToRegExp);
    const exc = exclude.filter(Boolean).map(globToRegExp);
    return (path) => (inc.length === 0 || inc.some((re) => re.test(path))) && !exc.some((re) => re.test(path));
}
/** Resolves git's rename notation (`a => b`, `dir/{old => new}/file`) to the new path. */
export function numstatPath(raw) {
    if (!raw.includes(' => '))
        return raw;
    return raw.includes('{') ? raw.replace(/\{[^{}]* => ([^{}]*)\}/g, '$1').replace(/\/\//g, '/') : raw.split(' => ').pop();
}
/**
 * Computes the weekly lines added/removed in a local git repository by walking the
 * first-parent history of `ref`, which makes the running total equal the lines in the tree.
 */
export function localCodeFrequency(repoPath, opts = {}) {
    const filter = makePathFilter(opts.include, opts.exclude);
    // quotePath=false keeps non-ASCII file names unquoted, so the include/exclude globs see the real path.
    const args = ['-C', repoPath, '-c', 'core.quotePath=false', 'log', '--first-parent', '-m', '--reverse', '--format=%x1e%ct', '--numstat', opts.ref ?? 'HEAD', '--'];
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        const byWeek = new Map();
        let current = null;
        let stderr = '';
        child.on('error', (err) => reject(new Error(`could not run git: ${err.message}`)));
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => (stderr += chunk));
        const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
        lines.on('line', (line) => {
            if (line.startsWith('\x1e')) {
                const ts = Number(line.slice(1).trim());
                if (Number.isFinite(ts)) {
                    const week = weekStart(ts);
                    current = byWeek.get(week) ?? { week, additions: 0, deletions: 0 };
                    byWeek.set(week, current);
                }
                else {
                    current = null;
                }
                return;
            }
            if (!current)
                return;
            const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
            if (!m || m[1] === '-' || m[2] === '-')
                return; // binary files carry no line counts
            if (!filter(numstatPath(m[3])))
                return;
            current.additions += Number(m[1]);
            current.deletions += Number(m[2]);
        });
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`git log exited with code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
                return;
            }
            const rows = [...byWeek.values()].sort((a, b) => a.week - b.week);
            resolve(fillWeeks(rows, opts.untilSeconds ?? Math.floor(Date.now() / 1000)));
        });
    });
}
/** True when the repository is a shallow clone, in which case history (and totals) are incomplete. */
export function isShallow(repoPath) {
    return new Promise((resolve) => {
        const child = spawn('git', ['-C', repoPath, 'rev-parse', '--is-shallow-repository'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => (out += chunk));
        child.on('error', () => resolve(false));
        child.on('close', () => resolve(out.trim() === 'true'));
    });
}
//# sourceMappingURL=git-local.js.map