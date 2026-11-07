import type { IncomingMessage, ServerResponse } from 'node:http';
/** Builds a WHATWG `Request` from a Node `IncomingMessage` (GET/HEAD only; bodies are ignored). */
export declare function toRequest(req: IncomingMessage): Request;
/** Writes a WHATWG `Response` to a Node `ServerResponse`. */
export declare function sendResponse(res: ServerResponse, response: Response): Promise<void>;
