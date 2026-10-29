import type { Point, RepoSummary, SeriesType, WeeklyRow } from './types.js';
export declare const WEEK_SECONDS: number;
export declare const WEEK_MS: number;
/** Floors a unix-seconds timestamp to the start of its week (Sunday 00:00 UTC), as GitHub does. */
export declare function weekStart(unixSeconds: number): number;
export declare function isoDate(d?: Date): string;
/**
 * Validates GitHub's raw `[week, additions, deletions][]` payload, normalises deletions to
 * positive numbers, merges rows that fall in the same week and sorts ascending.
 */
export declare function normalizeRows(raw: unknown): WeeklyRow[];
/**
 * Returns one row per week from the first row up to `untilSeconds` (default: the last row),
 * inserting zero rows for weeks without activity so a chart line runs to "now".
 * Input must be sorted ascending; rows inside the same week are merged.
 */
export declare function fillWeeks(rows: WeeklyRow[], untilSeconds?: number): WeeklyRow[];
/** Running total per week: net lines (additions minus deletions) or cumulative additions. */
export declare function cumulative(rows: WeeklyRow[], type: SeriesType): Point[];
export declare function summarize(rows: WeeklyRow[]): RepoSummary;
/** Chart title and subtitle for a measure and the labels being plotted. */
export declare function describeChart(type: SeriesType, labels: string[], xAxis?: 'date' | 'timeline'): {
    title: string;
    subtitle: string;
};
export declare function parseSeriesType(value: string | null | undefined): SeriesType;
