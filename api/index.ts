import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiHandler } from '../src/api/handler.ts';
import { SnapshotCaptureApi } from '../src/api/snapshotApi.ts';

const snapshotApi = new SnapshotCaptureApi();
const handler = createApiHandler(snapshotApi);

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `https://${host}`);
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = chunks.length === 0 ? undefined : Buffer.concat(chunks);
  return new Request(url, {
    method: req.method ?? 'GET',
    headers: req.headers as HeadersInit,
    ...(body === undefined || req.method === 'GET' || req.method === 'HEAD' ? {} : { body }),
  });
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
