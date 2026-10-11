import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AutomationAuditRepository } from '../src/automation/auditRepository.ts';
import { AutomationCaptureClient } from '../src/automation/captureClient.ts';
import { loadCrawlerConfig } from '../src/automation/config.ts';
import { extractObservedPosts, parseVisibleMetrics } from '../src/automation/extract.ts';
import {
  assertAllowedAutomationAction,
  AutomationStopError,
  detectStopReason,
  ForbiddenAutomationActionError,
} from '../src/automation/policy.ts';
import { ReadOnlyCrawler } from '../src/automation/runner.ts';
import type {
  AutomationAuditSink,
  AutomationOperation,
  AutomationRunCounts,
  CrawlerTarget,
  ReadOnlyBrowserSession,
} from '../src/automation/types.ts';
import { openDatabase } from '../src/db/database.ts';

const target: CrawlerTarget = {
  id: 'instagram-fyp-test',
  platform: 'instagram',
  url: 'https://www.instagram.com/reels/',
  sourceLane: 'broad',
  discoverySurface: 'fyp',
  maxScrolls: 1,
  waitMs: 1,
};

test('visible metric parser understands western and Japanese count suffixes', () => {
  const metrics = parseVisibleMetrics('1.2万 いいね Views: 3.4M コメント 56', new Date('2026-10-10T00:00:00Z'));
  assert.equal(metrics?.viewCount, 3_400_000);
  assert.equal(metrics?.likeCount, 12_000);
  assert.equal(metrics?.commentCount, 56);
  assert.equal(metrics?.dataSource, 'visible');
});

test('extractor keeps supported platform posts, canonicalizes, and deduplicates', () => {
  const posts = extractObservedPosts('instagram', [
    { href: 'https://www.instagram.com/reels/ABC123/?igsh=x', text: 'いいね 1.2万' },
    { href: 'https://www.instagram.com/reel/ABC123/', text: 'duplicate' },
    { href: 'https://www.tiktok.com/@sample/video/7412345678901234567', text: 'wrong platform' },
    { href: 'javascript:void(0)', text: 'invalid' },
  ], new Date('2026-10-10T00:00:00Z'));
  assert.deepEqual(posts, [{
    url: 'https://www.instagram.com/reel/ABC123/',
    visibleMetrics: {
      observedAt: '2026-10-10T00:00:00.000Z',
      viewCount: null,
      likeCount: 12_000,
      commentCount: null,
      shareCount: null,
      saveCount: null,
      dataSource: 'visible',
      confidence: 0.65,
    },
  }]);
});

test('policy rejects every non-read-only action and detects login or challenge pages', () => {
  assert.doesNotThrow(() => assertAllowedAutomationAction('scroll'));
  assert.throws(() => assertAllowedAutomationAction('click'), ForbiddenAutomationActionError);
  assert.throws(() => assertAllowedAutomationAction('fill'), ForbiddenAutomationActionError);
  assert.equal(detectStopReason('instagram', 'https://instagram.com/accounts/login/', ''), 'login_required');
  assert.equal(detectStopReason('tiktok', 'https://tiktok.com/foryou', 'Verify you are human'), 'challenge_detected');
});

test('crawler stays disabled by default and keeps profiles outside the synced project', () => {
  const config = loadCrawlerConfig({
    HOME: '/Users/tester',
    CRAWLER_PROFILE_ROOT: '',
    CRAWLER_KILL_SWITCH_PATH: '',
  });
  assert.equal(config.enabled, false);
  assert.equal(config.browserProfileRoot, '/Users/tester/Library/Application Support/SocialTrendRadar/browser-profiles');
  assert.equal(config.killSwitchPath, '/Users/tester/Library/Application Support/SocialTrendRadar/crawler.stop');
  assert.equal(config.targets.length, 2);
});

test('empty TikTok URLs keep TikTok paused while Instagram runs at the configured pace', () => {
  const config = loadCrawlerConfig({
    HOME: '/Users/tester',
    CRAWLER_ENABLED: 'true',
    CRAWLER_HEADLESS: 'true',
    CRAWLER_INTERVAL_MINUTES: '1',
    CRAWLER_SCROLLS_PER_RUN: '20',
    CRAWLER_WAIT_MS: '1000',
    INSTAGRAM_CRAWL_URLS: 'https://www.instagram.com/reels/',
    TIKTOK_CRAWL_URLS: '',
  });
  assert.equal(config.enabled, true);
  assert.equal(config.headless, true);
  assert.equal(config.intervalMinutes, 1);
  assert.deepEqual(config.targets.map(({ platform, maxScrolls, waitMs }) => ({
    platform,
    maxScrolls,
    waitMs,
  })), [{ platform: 'instagram', maxScrolls: 20, waitMs: 1_000 }]);
});

test('automation capture client marks observations as auto-observed', async () => {
  const requestBodies: Array<Record<string, unknown>> = [];
  const client = new AutomationCaptureClient('http://127.0.0.1:8787', async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json({ deduplicated: false }, { status: 201 });
  });
  await client.save(target, {
    url: 'https://www.instagram.com/reel/ABC123/',
    visibleMetrics: null,
  }, 'run_test');
  const requestBody = requestBodies[0];
  assert.ok(requestBody !== undefined);
  assert.equal(requestBody?.selectionMethod, 'auto_observed');
  assert.equal(requestBody?.sourceLane, 'broad');
  assert.equal(requestBody?.captureChannel, 'api');
});

class FakeSession implements ReadOnlyBrowserSession {
  closed = false;
  reads = 0;

  async navigate(): Promise<void> {}
  async readVisibleCards(): Promise<Array<{ href: string; text: string }>> {
    this.reads += 1;
    return [{ href: 'https://www.instagram.com/reel/ABC123/', text: 'likes 10' }];
  }
  async readPageState(): Promise<{ url: string; visibleText: string }> {
    return { url: target.url, visibleText: 'Reels' };
  }
  async scroll(): Promise<void> {}
  async wait(): Promise<void> {}
  async close(): Promise<void> { this.closed = true; }
}

class MemoryAudit implements AutomationAuditSink {
  readonly operations: AutomationOperation[] = [];
  finished: { status: string; counts: AutomationRunCounts; errorCode?: string } | null = null;
  startRun(): string { return 'run_test'; }
  recordOperation(_runId: string, operation: AutomationOperation): void { this.operations.push(operation); }
  finishRun(
    _runId: string,
    status: 'succeeded' | 'stopped' | 'failed',
    counts: AutomationRunCounts,
    errorCode?: string,
  ): void {
    this.finished = { status, counts, ...(errorCode === undefined ? {} : { errorCode }) };
  }
}

test('crawler only uses read-only actions and saves each URL once per run', async () => {
  const session = new FakeSession();
  const audit = new MemoryAudit();
  const saved: string[] = [];
  const crawler = new ReadOnlyCrawler({
    browserFactory: { open: async () => session },
    captureSink: {
      save: async (_target, post) => {
        saved.push(post.url);
        return { deduplicated: false };
      },
    },
    auditSink: audit,
    killSwitchPath: join(tmpdir(), 'nonexistent-social-trend-radar-kill-switch'),
  });

  const counts = await crawler.run(target);
  assert.equal(session.reads, 2);
  assert.deepEqual(saved, ['https://www.instagram.com/reel/ABC123/']);
  assert.equal(counts.savedCount, 1);
  assert.equal(audit.operations.includes('blocked_write'), false);
  assert.equal(session.closed, true);
  assert.equal(audit.finished?.status, 'succeeded');
});

test('crawler stops before extraction when login is required', async () => {
  const session = new FakeSession();
  session.readPageState = async () => ({
    url: 'https://www.instagram.com/accounts/login/',
    visibleText: 'Log in',
  });
  const audit = new MemoryAudit();
  const crawler = new ReadOnlyCrawler({
    browserFactory: { open: async () => session },
    captureSink: { save: async () => ({ deduplicated: false }) },
    auditSink: audit,
    killSwitchPath: join(tmpdir(), 'nonexistent-social-trend-radar-kill-switch'),
  });

  await assert.rejects(() => crawler.run(target), (error: unknown) => (
    error instanceof AutomationStopError && error.code === 'login_required'
  ));
  assert.equal(session.reads, 0);
  assert.equal(audit.finished?.status, 'stopped');
  assert.equal(session.closed, true);
});

test('automation audit schema guarantees executed write operations stay zero', () => {
  const directory = mkdtempSync(join(tmpdir(), 'radar-automation-'));
  try {
    const db = openDatabase(join(directory, 'test.sqlite'));
    const repository = new AutomationAuditRepository(db);
    const runId = repository.startRun(target, new Date('2026-10-10T00:00:00Z'));
    repository.recordOperation(runId, 'navigate', { targetUrl: target.url });
    repository.recordOperation(runId, 'blocked_write', { attemptedWrite: true, details: { action: 'click' } });
    repository.finishRun(runId, 'stopped', {
      observedCount: 0,
      savedCount: 0,
      duplicateCount: 0,
      blockedWriteAttemptCount: 1,
    }, 'forbidden_automation_action');

    const row = db.prepare(`
      SELECT SUM(attempted_write) AS attempted, SUM(executed_write) AS executed
      FROM automation_audit_events WHERE run_id = ?
    `).get(runId);
    assert.equal(row?.attempted, 1);
    assert.equal(row?.executed, 0);
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
