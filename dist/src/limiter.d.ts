export declare class LimiterFullError extends Error {
    constructor(message?: string);
}
/**
 * Bounds how many tasks run at once and how many may wait for a slot.
 * Protects the GitHub token from secondary rate limits and keeps a flood of
 * cold repositories from piling up unbounded work.
 */
export declare class Limiter {
    readonly maxConcurrent: number;
    readonly maxQueued: number;
    private running;
    private readonly queue;
    constructor(maxConcurrent: number, maxQueued?: number);
    get active(): number;
    get waiting(): number;
    /**
     * Runs `task` once a slot is free. Without `wait`, a full queue refuses the task with
     * `LimiterFullError`; with it, the task always waits (for self-throttled background work).
     */
    run<T>(task: () => Promise<T>, { wait }?: {
        wait?: boolean | undefined;
    }): Promise<T>;
}
