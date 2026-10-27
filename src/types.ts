/** One week of churn, normalised from GitHub's `stats/code_frequency` shape. */
export interface WeeklyRow {
  /** Start of the week (Sunday 00:00 UTC) as unix seconds. */
  week: number;
  /** Lines added during the week. */
  additions: number;
  /** Lines removed during the week, as a positive number. */
  deletions: number;
}

/**
 * What a chart measures.
 * - `net`: lines of code in the repository (cumulative additions minus deletions)
 * - `added`: cumulative lines added, ignoring deletions
 */
export type SeriesType = 'net' | 'added';

export const SERIES_TYPES: readonly SeriesType[] = ['net', 'added'];

export interface Point {
  /** Unix milliseconds. */
  t: number;
  value: number;
}

export interface RepoSummary {
  firstWeek: string;
  lastWeek: string;
  weeks: number;
  additions: number;
  deletions: number;
  /** Lines of code at the end of the series (additions minus deletions). */
  net: number;
}
