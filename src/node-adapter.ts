import type { IncomingMessage, ServerResponse } from 'node:http';

/** Builds a WHATWG `Request` from a Node `IncomingMessage` (GET/HEAD only; bodies are ignored). */
export function toRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return new Request(url, { method: req.method ?? 'GET', headers });
}

/** Writes a WHATWG `Response` to a Node `ServerResponse`. */
export async function sendResponse(res: ServerResponse, response: Response): Promise<void> {
  const body = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  if (!('content-length' in headers)) headers['content-length'] = String(body.byteLength);
  res.writeHead(response.status, headers);
  res.end(body);
}
