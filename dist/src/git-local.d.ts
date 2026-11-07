import type { WeeklyRow } from './types.js';
export interface LocalOptions {
    /** Git ref whose first-parent history to walk. Default HEAD. */
    ref?: string;
    /** Glob patterns; when given, only matching paths count. */
    include?: string[];
    /** Glob patterns of paths to ignore (e.g. `package-lock.json`, `vendor/**`). */
    exclude?: string[];
    /** Extend the series with zero weeks up to this time (unix seconds). Default: now. */
    untilSeconds?: number;
}
/**
 * Converts a glob to a RegExp. `**` matches across directories, `*` and `?` within one
 * path segment. A pattern without a slash matches the file's basename anywhere in the tree.
 */
export declare function globToRegExp(glob: string): RegExp;
export declare function makePathFilter(include?: string[], exclude?: string[]): (path: string) => boolean;
/** Resolves git's rename notation (`a => b`, `dir/{old => new}/file`) to the new path. */
export declare function numstatPath(raw: string): string;
/**
 * Computes the weekly lines added/removed in a local git repository by walking the
 * first-parent history of `ref`, which makes the running total equal the lines in the tree.
 */
export declare function localCodeFrequency(repoPath: string, opts?: LocalOptions): Promise<WeeklyRow[]>;
/** True when the repository is a shallow clone, in which case history (and totals) are incomplete. */
export declare function isShallow(repoPath: string): Promise<boolean>;
