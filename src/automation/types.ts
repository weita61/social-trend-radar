import type { DiscoverySurface, SourceLane, VisibleMetrics } from '../domain/types.ts';

export const crawlerPlatforms = ['instagram', 'tiktok'] as const;
export type CrawlerPlatform = (typeof crawlerPlatforms)[number];

export type CrawlerTarget = {
  id: string;
  platform: CrawlerPlatform;
  url: string;
  sourceLane: Exclude<SourceLane, 'personalized'>;
  discoverySurface: Exclude<DiscoverySurface, 'shared'>;
  maxScrolls: number;
  waitMs: number;
};

export type VisibleCard = {
  href: string;
  text: string;
};

export type ObservedPost = {
  url: string;
  visibleMetrics: VisibleMetrics | null;
};

export interface ReadOnlyBrowserSession {
  navigate(url: string): Promise<void>;
  readVisibleCards(): Promise<VisibleCard[]>;
  readPageState(): Promise<{ url: string; visibleText: string }>;
  scroll(distance: number): Promise<void>;
  wait(milliseconds: number): Promise<void>;
  close(): Promise<void>;
}

export interface ReadOnlyBrowserFactory {
  open(platform: CrawlerPlatform): Promise<ReadOnlyBrowserSession>;
}

export type AutomationCaptureResult = {
  deduplicated: boolean;
};

export interface AutomationCaptureSink {
  save(target: CrawlerTarget, post: ObservedPost, runId: string): Promise<AutomationCaptureResult>;
}

export type AutomationRunCounts = {
  observedCount: number;
  savedCount: number;
  duplicateCount: number;
  blockedWriteAttemptCount: number;
};

export interface AutomationAuditSink {
  startRun(target: CrawlerTarget, startedAt?: Date): string;
  recordOperation(
    runId: string,
    operation: AutomationOperation,
    options?: { targetUrl?: string; attemptedWrite?: boolean; details?: Record<string, unknown> },
  ): void;
  finishRun(
    runId: string,
    status: 'succeeded' | 'stopped' | 'failed',
    counts: AutomationRunCounts,
    errorCode?: string,
  ): void;
}

export const automationOperations = [
  'navigate',
  'read_visible',
  'scroll',
  'wait',
  'capture',
  'stop',
  'blocked_write',
] as const;
export type AutomationOperation = (typeof automationOperations)[number];
