import type { WeeklyRow } from './types.js';
export type GitHubErrorCode = 'invalid_repo' | 'not_found' | 'too_large' | 'pending' | 'rate_limited' | 'forbidden' | 'busy' | 'upstream';
export declare class GitHubError extends Error {
    readonly code: GitHubErrorCode;
    readonly status?: number | undefined;
    /** For `rate_limited`: when GitHub's quota resets, epoch milliseconds. */
    readonly resetAt?: number | undefined;
    constructor(code: GitHubErrorCode, message: string, status?: number | undefined, 
    /** For `rate_limited`: when GitHub's quota resets, epoch milliseconds. */
    resetAt?: number | undefined);
    /** True when the same request is expected to succeed shortly (worth an automatic retry). */
    get transient(): boolean;
    /** Status to use when relaying this error to our own API clients. */
    get httpStatus(): number;
}
/**
 * Accepts `owner/name`, `github.com/owner/name`, `https://github.com/owner/name.git`,
 * `git@github.com:owner/name`, or a deep link like `github.com/owner/name/tree/main`.
 * Returns the canonical `owner/name` or null when the input is not a repository.
 */
export declare function parseRepo(input: string): string | null;
export interface GitHubClientOptions {
    /** Personal access token; raises the rate limit from 60 to 5,000 requests per hour. */
    token?: string;
    fetch?: typeof fetch;
    /** How often to re-poll while GitHub computes statistics (HTTP 202). */
    retries?: number;
    retryDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    apiBase?: string;
    userAgent?: string;
    now?: () => number;
}
export declare const DEFAULT_RETRIES = 5;
export declare const DEFAULT_RETRY_DELAY_MS = 1500;
export declare const DEFAULT_USER_AGENT = "lines-of-code-history/0.1";
/**
 * Loads the weekly additions/deletions history of a repository from GitHub's
 * `stats/code_frequency` endpoint and returns one row per week up to the current week.
 */
export declare function fetchCodeFrequency(repo: string, opts?: GitHubClientOptions): Promise<WeeklyRow[]>;
