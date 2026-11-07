export const WEEK_SECONDS = 7 * 24 * 60 * 60;
export const WEEK_MS = WEEK_SECONDS * 1000;
/** Floors a unix-seconds timestamp to the start of its week (Sunday 00:00 UTC), as GitHub does. */
export function weekStart(unixSeconds) {
    const d = new Date(unixSeconds * 1000);
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay());
    return Math.floor(start / 1000);
}
export function isoDate(d = new Date()) {
    return d.toISOString().slice(0, 10);
}
/**
 * Validates GitHub's raw `[week, additions, deletions][]` payload, normalises deletions to
 * positive numbers, merges rows that fall in the same week and sorts ascending.
 */
export function normalizeRows(raw) {
    if (!Array.isArray(raw))
        throw new TypeError('expected an array of weekly rows');
    const byWeek = new Map();
    for (const row of raw) {
        if (!Array.isArray(row) || row.length < 3)
            throw new TypeError('malformed weekly row');
        const [week, additions, deletions] = row;
        if (![week, additions, deletions].every((n) => typeof n === 'number' && Number.isFinite(n))) {
            throw new TypeError('malformed weekly row');
        }
        const w = weekStart(week);
        const current = byWeek.get(w) ?? { week: w, additions: 0, deletions: 0 };
        current.additions += Math.abs(additions);
        current.deletions += Math.abs(deletions);
        byWeek.set(w, current);
    }
    return [...byWeek.values()].sort((a, b) => a.week - b.week);
}
/**
 * Returns one row per week from the first row up to `untilSeconds` (default: the last row),
 * inserting zero rows for weeks without activity so a chart line runs to "now".
 * Input must be sorted ascending; rows inside the same week are merged.
 */
export function fillWeeks(rows, untilSeconds) {
    const first = rows[0];
    if (!first)
        return [];
    const lastRow = rows[rows.length - 1];
    const last = Math.max(weekStart(lastRow.week), untilSeconds === undefined ? -Infinity : weekStart(untilSeconds));
    const out = [];
    let i = 0;
    for (let w = weekStart(first.week); w <= last; w += WEEK_SECONDS) {
        const bucket = { week: w, additions: 0, deletions: 0 };
        while (i < rows.length && rows[i].week < w + WEEK_SECONDS) {
            bucket.additions += rows[i].additions;
            bucket.deletions += rows[i].deletions;
            i++;
        }
        out.push(bucket);
    }
    return out;
}
/** Running total per week: net lines (additions minus deletions) or cumulative additions. */
export function cumulative(rows, type) {
    let total = 0;
    return rows.map((r) => {
        total += type === 'net' ? r.additions - r.deletions : r.additions;
        return { t: r.week * 1000, value: total };
    });
}
export function summarize(rows) {
    let additions = 0;
    let deletions = 0;
    for (const r of rows) {
        additions += r.additions;
        deletions += r.deletions;
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    return {
        firstWeek: first ? isoDate(new Date(first.week * 1000)) : '',
        lastWeek: last ? isoDate(new Date(last.week * 1000)) : '',
        weeks: rows.length,
        additions,
        deletions,
        net: additions - deletions,
    };
}
/** Chart title and subtitle for a measure and the labels being plotted. */
export function describeChart(type, labels, xAxis = 'date') {
    const measure = type === 'net' ? 'Lines of code' : 'Lines of code added';
    const when = xAxis === 'timeline' ? (labels.length === 1 ? 'since the first commit' : 'since each repository\'s first commit') : 'over time';
    const subtitle = type === 'net'
        ? `Net lines in the repository ${when} (weekly additions minus deletions, cumulative)`
        : `Cumulative lines added ${when} (weekly)`;
    if (labels.length === 1)
        return { title: `${labels[0]}: ${measure}`, subtitle };
    return { title: measure, subtitle };
}
export function parseSeriesType(value) {
    return (value ?? '').toLowerCase() === 'added' ? 'added' : 'net';
}
//# sourceMappingURL=series.js.map