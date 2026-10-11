import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiHandler } from '../src/api/handler.ts';
import { SnapshotCaptureApi } from '../src/api/snapshotApi.ts';

const snapshotApi = new SnapshotCaptureApi();
const handler = createApiHandler(snapshotApi);

function resolveRequestUrl(req: IncomingMessage): URL {
  const host = req.headers.host ?? 'localhost';
  let path = req.url ?? '/';

  // If internal reverse proxy or rewrite replaced req.url with a script path, recover original
  if (path === '/api/index.ts' || path === '/index.ts' || path.startsWith('/api/[...path]') || path.startsWith('/api/index.ts?') || path.startsWith('/index.ts?')) {
    const forwarded = (req.headers['x-forwarded-uri'] as string | undefined)
      ?? (req.headers['x-original-url'] as string | undefined);
    if (forwarded) {
      path = forwarded;
    }
  }

  return new URL(path, `https://${host}`);
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = resolveRequestUrl(req);
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
  try {
    const request = await toRequest(req);
    const response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Vercel API error:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_error', message: String(err) }));
  }
}
