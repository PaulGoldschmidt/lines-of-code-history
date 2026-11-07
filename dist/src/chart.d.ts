import type { Point } from './types.js';
export type Theme = 'light' | 'dark' | 'auto';
type Mode = 'light' | 'dark';
/** `clean` is the default look; `sketch` is hand-drawn in the spirit of xkcd and star-history. */
export type ChartStyle = 'clean' | 'sketch';
/** `date` plots calendar time; `timeline` aligns every series at its first commit. */
export type XAxis = 'date' | 'timeline';
export interface ChartSeries {
    label: string;
    points: Point[];
    /**
     * Palette slot, default the series' position. Set it to the position a repository was
     * requested in, so a repository keeps its colour when an earlier one failed to load.
     */
    colorIndex?: number;
}
export interface ChartOptions {
    width?: number;
    height?: number;
    /** `auto` follows the viewer's `prefers-color-scheme`. */
    theme?: Theme;
    style?: ChartStyle;
    xAxis?: XAxis;
    title?: string;
    subtitle?: string;
    /** Small text, bottom right. */
    footer?: string;
    /** Small text, bottom left (e.g. repositories that could not be loaded). */
    note?: string;
    /** Accessible description for the SVG `<title>`. */
    description?: string;
    now?: Date;
}
/** Categorical palette, fixed order, stepped separately for light and dark surfaces. */
export declare const SERIES_COLORS: Record<Mode, readonly string[]>;
export declare const MAX_SERIES: number;
export declare const DEFAULT_WIDTH = 800;
export declare const DEFAULT_HEIGHT = 480;
export declare const MIN_WIDTH = 320;
export declare const MAX_WIDTH = 2400;
export declare const MIN_HEIGHT = 200;
export declare const MAX_HEIGHT = 1600;
export declare function clamp(n: number, lo: number, hi: number): number;
export declare function parseTheme(value: string | null | undefined): Theme;
export declare function parseStyle(value: string | null | undefined): ChartStyle;
export declare function parseXAxis(value: string | null | undefined): XAxis;
export declare function escapeXml(s: string): string;
/** 1234567 → "1,234,567" */
export declare function formatNumber(n: number): string;
/** 1234567 becomes "1.23M", 2500 becomes "2.5k", -300 becomes "-300" */
export declare function formatCompact(n: number): string;
/** Rough text width for layout; the renderer is a browser, so this only needs to be safe. */
export declare function textWidth(s: string, fontSize: number): number;
/** Exact width of sketch text, which is drawn from glyph outlines with known advances. */
export declare function sketchTextWidth(s: string, fontSize: number): number;
/** "Nice" axis ticks covering [min, max] with roughly `target` steps; `integer` keeps steps >= 1. */
export declare function niceTicks(min: number, max: number, target?: number, integer?: boolean): number[];
export interface TimeTick {
    t: number;
    label: string;
}
/** Calendar-aligned x-axis ticks: the finest interval whose labels fit in `availableWidth` pixels. */
export declare function timeTicks(t0: number, t1: number, availableWidth: number, fontSize?: number): TimeTick[];
/** Ticks for an elapsed-time axis starting at 0: the finest of weeks, months or years whose labels fit. */
export declare function elapsedTicks(span: number, availableWidth: number, fontSize?: number): TimeTick[];
/** Renders a multi-series line chart as a standalone SVG document. */
export declare function renderChart(seriesIn: ChartSeries[], opts?: ChartOptions): string;
/** Renders a chart-sized placeholder carrying a message (errors, "still computing", usage hints). */
export declare function renderMessage(title: string, message: string, opts?: ChartOptions): string;
export {};
