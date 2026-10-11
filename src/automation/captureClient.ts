import type {
  AutomationCaptureResult,
  AutomationCaptureSink,
  CrawlerTarget,
  ObservedPost,
} from './types.ts';

export class AutomationCaptureClient implements AutomationCaptureSink {
  private readonly baseUrl: URL;
  private readonly request: typeof fetch;

  constructor(baseUrl: string, request: typeof fetch = fetch) {
    this.baseUrl = new URL(baseUrl);
    this.request = request;
  }

  async save(target: CrawlerTarget, post: ObservedPost, runId: string): Promise<AutomationCaptureResult> {
    const response = await this.request(new URL('/api/captures', this.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: post.url,
        captureChannel: 'api',
        sourceLane: target.sourceLane,
        selectionMethod: 'auto_observed',
        discoverySurface: target.discoverySurface,
        collectorContext: JSON.stringify({ runId, targetId: target.id, platform: target.platform }),
        visibleMetrics: post.visibleMetrics,
      }),
    });
    const payload = await response.json() as AutomationCaptureResult & { message?: string };
    if (!response.ok) throw new Error(payload.message ?? `Capture API returned HTTP ${response.status}`);
    return payload;
  }
}
