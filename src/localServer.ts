import { createServer, type IncomingMessage } from 'node:http';
import { createApiHandler } from './api/handler.ts';
import { serveStatic } from './api/static.ts';
import { CaptureRepository } from './db/captureRepository.ts';
import { openDatabase } from './db/database.ts';
import { QuotaGuard } from './connectors/quotaGuard.ts';
import { YoutubeAdapter } from './connectors/youtube.ts';
import { CaptureService } from './services/captureService.ts';

async function toRequest(request: IncomingMessage): Promise<Request> {
  const host = request.headers.host ?? '127.0.0.1';
  const url = new URL(request.url ?? '/', `http://${host}`);
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = chunks.length === 0 ? undefined : Buffer.concat(chunks);
  return new Request(url, {
    method: request.method ?? 'GET',
    headers: request.headers as HeadersInit,
    ...(body === undefined ? {} : { body }),
  });
}

const db = openDatabase();
const youtubeApiKey = process.env.YOUTUBE_API_KEY?.trim();
const youtube = youtubeApiKey === undefined || youtubeApiKey === ''
  ? null
  : new YoutubeAdapter({
      apiKey: youtubeApiKey,
      quotaGuard: new QuotaGuard(db),
      dailyQuotaLimit: Number.parseInt(process.env.YOUTUBE_DAILY_QUOTA_LIMIT ?? '8000', 10),
    });
const handler = createApiHandler(new CaptureService(new CaptureRepository(db), youtube));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '8787', 10);

const server = createServer(async (incoming, outgoing) => {
  try {
    const request = await toRequest(incoming);
    const url = new URL(request.url);

    if (request.method === 'GET' && !url.pathname.startsWith('/api/') && url.pathname !== '/health') {
      const staticResponse = serveStatic(url.pathname);
      if (staticResponse !== null) {
        outgoing.statusCode = staticResponse.status;
        staticResponse.headers.forEach((value, name) => outgoing.setHeader(name, value));
        outgoing.end(Buffer.from(await staticResponse.arrayBuffer()));
        return;
      }
    }

    const response = await handler(request);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.statusCode = 500;
    outgoing.setHeader('content-type', 'application/json');
    outgoing.end(JSON.stringify({ error: 'internal_error' }));
  }
});

server.listen(port, host, () => {
  console.log(`Social Trend Radar Capture & Web API listening on http://${host}:${port}`);
});

let autoTimer: NodeJS.Timeout | null = null;
const autoPipelineIntervalMin = Number.parseInt(process.env.AUTO_PIPELINE_INTERVAL_MIN ?? '30', 10);
if (process.env.AUTO_PIPELINE_DISABLED !== 'true') {
  setTimeout(async () => {
    try {
      const { runAutomatedPipeline } = await import('./automation/pipeline.ts');
      await runAutomatedPipeline(db);
    } catch (e) {
      console.warn('[AutoPipeline] Initial run notice:', e);
    }
  }, 3_000);

  autoTimer = setInterval(async () => {
    try {
      const { runAutomatedPipeline } = await import('./automation/pipeline.ts');
      await runAutomatedPipeline(db);
    } catch (e) {
      console.warn('[AutoPipeline] Periodic run notice:', e);
    }
  }, autoPipelineIntervalMin * 60_000);
}

function shutdown(): void {
  if (autoTimer) clearInterval(autoTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
