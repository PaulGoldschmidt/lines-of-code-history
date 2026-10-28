import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendResponse, toRequest } from '../src/node-adapter.js';

test('toRequest rebuilds the URL from the Host header and keeps headers', () => {
  const req = { url: '/svg?repos=a/b&theme=dark', method: 'GET', headers: { host: 'loc-history.com', 'x-multi': ['1', '2'], 'x-skip': undefined } } as unknown as IncomingMessage;
  const r = toRequest(req);
  assert.equal(r.url, 'http://loc-history.com/svg?repos=a/b&theme=dark');
  assert.equal(r.method, 'GET');
  assert.equal(r.headers.get('x-multi'), '1, 2');
  assert.equal(r.headers.has('x-skip'), false);
  assert.equal(toRequest({ headers: {} } as unknown as IncomingMessage).url, 'http://localhost/');
});

test('sendResponse writes status, headers, content-length and the body', async () => {
  let written: { status: number; headers: Record<string, string> } | undefined;
  let body: Buffer | undefined;
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      written = { status, headers };
    },
    end(chunk: Buffer) {
      body = chunk;
    },
  } as unknown as ServerResponse;
  await sendResponse(res, new Response('<svg/>', { status: 201, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' } }));
  assert.equal(written?.status, 201);
  assert.equal(written?.headers['content-type'], 'image/svg+xml');
  assert.equal(written?.headers['cache-control'], 'no-store');
  assert.equal(written?.headers['content-length'], '6');
  assert.equal(body?.toString(), '<svg/>');
});
