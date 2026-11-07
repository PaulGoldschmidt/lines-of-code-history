import { type Theme, type ChartStyle, type XAxis } from './chart.js';
import { RepoLoader } from './loader.js';
import type { SeriesType } from './types.js';
export interface HandlerOptions {
    loader?: RepoLoader;
    /** `Cache-Control` max-age for successful charts and data. Default 6 hours. */
    maxAgeSeconds?: number;
    now?: () => Date;
}
export type FetchHandler = (request: Request) => Promise<Response>;
interface Params {
    repos: string[];
    invalid: string[];
    type: SeriesType;
    theme: Theme;
    style: ChartStyle;
    xAxis: XAxis;
    width: number;
    height: number;
}
export declare function parseParams(url: URL): Params;
/** Creates a fetch-style request handler serving the web UI, the SVG endpoint and the JSON API. */
export declare function createHandler(options?: HandlerOptions): FetchHandler;
export {};
