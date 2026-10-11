import type { CaptureInput } from '../domain/types.ts';
import type { CaptureResult } from '../db/captureRepository.ts';
import { InputValidationError, validateCaptureInput } from '../domain/validation.ts';
import { UrlValidationError } from '../domain/url.ts';
import type { TrendFilters, VideoFilters } from '../analysis/readRepository.ts';

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export interface CaptureApi {
  capture(input: CaptureInput): CaptureResult | Promise<CaptureResult>;
  getPost(id: string): Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  listTrends?(filters: TrendFilters): Record<string, unknown>[] | Promise<Record<string, unknown>[]>;
  listVideos?(filters?: VideoFilters): Record<string, unknown>[] | Promise<Record<string, unknown>[]>;
  getTrend?(id: string): Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  generateJevBlueprintForTrend?(id: string, brandProfile?: Record<string, unknown>): Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  getOverview?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  getCoverage?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  getAutomation?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  getPipeline?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  runAnalysis?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  getBrandProfile?(): Record<string, unknown> | Promise<Record<string, unknown>>;
  updateBrandProfile?(profile: Record<string, unknown>): Record<string, unknown> | Promise<Record<string, unknown>>;
  updateSnapshot?(snapshot: Record<string, unknown>): void | Promise<void>;
}

export function createApiHandler(repository: CaptureApi): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const rawPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    const pathname = rawPath.replace(/\/index(?:\.ts)?$/, '') || '/';

    if (request.method === 'POST' && pathname === '/api/sync/snapshot') {
      const authHeader = request.headers.get('authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const expectedSecret = process.env.SYNC_SECRET;
      if (!expectedSecret || token !== expectedSecret) {
        return json({ error: 'unauthorized', message: 'Invalid or missing SYNC_SECRET' }, 401);
      }
      try {
        const payload = (await request.json()) as Record<string, unknown>;
        if (repository.updateSnapshot) {
          await repository.updateSnapshot(payload);
        }
        return json({ ok: true, message: 'Snapshot synced successfully', exportedAt: payload.exportedAt });
      } catch (err) {
        return json({ error: 'invalid_payload', message: String(err) }, 400);
      }
    }

    if (request.method === 'POST' && pathname === '/api/captures') {
      try {
        const raw = await request.json();
        const input = validateCaptureInput(raw);
        return json(await repository.capture(input), 201);
      } catch (error) {
        if (error instanceof InputValidationError || error instanceof UrlValidationError) {
          return json({ error: error.code, message: error.message, field: error instanceof InputValidationError ? error.field : undefined }, 400);
        }
        if (error instanceof SyntaxError) return json({ error: 'invalid_json', message: 'Request body must be valid JSON' }, 400);
        throw error;
      }
    }

    const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (request.method === 'GET' && postMatch?.[1] !== undefined) {
      const post = await repository.getPost(decodeURIComponent(postMatch[1]));
      return post === null
        ? json({ error: 'not_found', message: 'Post not found' }, 404)
        : json(post);
    }

    if (request.method === 'GET' && pathname === '/api/trends' && repository.listTrends !== undefined) {
      const layer = url.searchParams.get('layer');
      if (layer !== null && !['surface', 'format', 'desire'].includes(layer)) {
        return json({ error: 'invalid_filter', message: 'layer must be surface, format, or desire' }, 400);
      }
      const minimumConfidenceRaw = url.searchParams.get('minimumConfidence');
      const minimumConfidence = minimumConfidenceRaw === null ? undefined : Number(minimumConfidenceRaw);
      if (minimumConfidence !== undefined && (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1)) {
        return json({ error: 'invalid_filter', message: 'minimumConfidence must be between 0 and 1' }, 400);
      }
      const filters: TrendFilters = {};
      if (layer !== null) filters.layer = layer as 'surface' | 'format' | 'desire';
      const platform = url.searchParams.get('platform');
      if (platform !== null) filters.platform = platform;
      const sourceLane = url.searchParams.get('sourceLane');
      if (sourceLane !== null) filters.sourceLane = sourceLane;
      if (minimumConfidence !== undefined) filters.minimumConfidence = minimumConfidence;
      return json(await repository.listTrends(filters));
    }

    if (request.method === 'GET' && pathname === '/api/videos' && repository.listVideos !== undefined) {
      const template = url.searchParams.get('template') ?? undefined;
      const category = url.searchParams.get('category') ?? undefined;
      const platform = url.searchParams.get('platform') ?? undefined;
      const q = url.searchParams.get('q') ?? undefined;
      return json(await repository.listVideos({ template, category, platform, q }));
    }

    const trendMatch = pathname.match(/^\/api\/trends\/([^/]+)$/);
    if (request.method === 'GET' && trendMatch?.[1] !== undefined && repository.getTrend !== undefined) {
      const trend = await repository.getTrend(decodeURIComponent(trendMatch[1]));
      return trend === null
        ? json({ error: 'not_found', message: 'Trend not found' }, 404)
        : json(trend);
    }

    const jevMatch = pathname.match(/^\/api\/trends\/([^/]+)\/jev-blueprint$/);
    if (request.method === 'POST' && jevMatch?.[1] !== undefined && repository.generateJevBlueprintForTrend !== undefined) {
      const rawBody = await request.json().catch(() => ({}));
      const brandProfile = (rawBody && typeof rawBody === 'object' && 'brandProfile' in rawBody) ? rawBody.brandProfile : undefined;
      const blueprint = await repository.generateJevBlueprintForTrend(decodeURIComponent(jevMatch[1]), brandProfile as any);
      return blueprint === null
        ? json({ error: 'not_found', message: 'Trend not found' }, 404)
        : json(blueprint);
    }

    if (request.method === 'GET' && pathname === '/api/overview' && repository.getOverview !== undefined) {
      return json(await repository.getOverview());
    }

    if (request.method === 'GET' && pathname === '/api/coverage' && repository.getCoverage !== undefined) {
      return json(await repository.getCoverage());
    }

    if (request.method === 'GET' && pathname === '/api/automation' && repository.getAutomation !== undefined) {
      return json(await repository.getAutomation());
    }

    if (request.method === 'GET' && pathname === '/api/pipeline' && repository.getPipeline !== undefined) {
      return json(await repository.getPipeline());
    }

    if (request.method === 'POST' && pathname === '/api/analyze' && repository.runAnalysis !== undefined) {
      return json(await repository.runAnalysis());
    }

    if (request.method === 'GET' && pathname === '/api/profile' && repository.getBrandProfile !== undefined) {
      return json(await repository.getBrandProfile());
    }

    if (request.method === 'POST' && pathname === '/api/profile' && repository.updateBrandProfile !== undefined) {
      try {
        const body = await request.json() as Record<string, unknown>;
        return json(await repository.updateBrandProfile(body));
      } catch {
        return json({ error: 'invalid_json' }, 400);
      }
    }

    if (request.method === 'GET' && (pathname === '/health' || pathname === '/api/health' || pathname === '/api')) {
      return json({ ok: true, service: 'social-trend-radar-capture-api' });
    }

    return json({ error: 'not_found', message: 'Route not found' }, 404);
  };
}
