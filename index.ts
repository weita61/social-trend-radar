import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiHandler } from './src/api/handler.ts';
import { SnapshotCaptureApi } from './src/api/snapshotApi.ts';
import { INDEX_HTML, STYLE_CSS, APP_JS } from './src/webAssets.ts';

const snapshotApi = new SnapshotCaptureApi();
const apiHandler = createApiHandler(snapshotApi);

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost';
  const rawPath = (req.headers['x-matched-path'] as string | undefined)
    ?? (req.headers['x-forwarded-uri'] as string | undefined)
    ?? req.url
    ?? '/';
  const url = new URL(rawPath, `https://${host}`);
  const method = req.method ?? 'GET';

  if (method === 'GET' || method === 'HEAD') {
    return new Request(url, {
      method,
      headers: req.headers as HeadersInit,
    });
  }

  let body: Buffer | undefined;
  const anyReq = req as unknown as { body?: unknown };
  if (anyReq.body !== undefined) {
    body = Buffer.isBuffer(anyReq.body)
      ? anyReq.body
      : typeof anyReq.body === 'string'
      ? Buffer.from(anyReq.body)
      : Buffer.from(JSON.stringify(anyReq.body));
  } else if (Symbol.asyncIterator in req) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  const init: RequestInit = {
    method,
    headers: req.headers as HeadersInit,
  };
  if (body !== undefined) {
    init.body = new Uint8Array(body);
  }
  return new Request(url, init);
}

export default async function (req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? 'localhost';
  const rawPath = (req.headers['x-matched-path'] as string | undefined)
    ?? (req.headers['x-forwarded-uri'] as string | undefined)
    ?? req.url
    ?? '/';
  const url = new URL(rawPath, `https://${host}`);
  const pathname = url.pathname;

  // 1. Static web assets served with in-memory caching
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (pathname === '/' || pathname === '/index.html') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('cache-control', 'public, max-age=0, must-revalidate');
      res.end(INDEX_HTML);
      return;
    }
    if (pathname === '/style.css') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/css; charset=utf-8');
      res.setHeader('cache-control', 'public, max-age=3600');
      res.end(STYLE_CSS);
      return;
    }
    if (pathname === '/app.js') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/javascript; charset=utf-8');
      res.setHeader('cache-control', 'public, max-age=3600');
      res.end(APP_JS);
      return;
    }
  }

  // 2. API endpoints and health checks
  try {
    const request = await toRequest(req);
    const response = await apiHandler(request);
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Vercel server error:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_error', message: String(err) }));
  }
}
