import { existsSync } from 'node:fs';
import { extractObservedPosts } from './extract.ts';
import {
  assertAllowedAutomationAction,
  AutomationStopError,
  detectStopReason,
} from './policy.ts';
import type {
  AutomationAuditSink,
  AutomationCaptureSink,
  AutomationRunCounts,
  CrawlerTarget,
  ReadOnlyBrowserFactory,
} from './types.ts';

export type ReadOnlyCrawlerOptions = {
  browserFactory: ReadOnlyBrowserFactory;
  captureSink: AutomationCaptureSink;
  auditSink: AutomationAuditSink;
  killSwitchPath: string;
  scrollDistance?: number;
};

export class ReadOnlyCrawler {
  private readonly scrollDistance: number;
  private readonly options: ReadOnlyCrawlerOptions;

  constructor(options: ReadOnlyCrawlerOptions) {
    this.options = options;
    this.scrollDistance = options.scrollDistance ?? 900;
  }

  private assertKillSwitchOff(): void {
    if (existsSync(this.options.killSwitchPath)) throw new AutomationStopError('kill_switch_enabled');
  }

  async run(target: CrawlerTarget): Promise<AutomationRunCounts> {
    const counts: AutomationRunCounts = {
      observedCount: 0,
      savedCount: 0,
      duplicateCount: 0,
      blockedWriteAttemptCount: 0,
    };
    const runId = this.options.auditSink.startRun(target);
    const seen = new Set<string>();
    let session;

    try {
      this.assertKillSwitchOff();
      session = await this.options.browserFactory.open(target.platform);
      assertAllowedAutomationAction('navigate');
      this.options.auditSink.recordOperation(runId, 'navigate', { targetUrl: target.url });
      await session.navigate(target.url);

      for (let index = 0; index <= target.maxScrolls; index += 1) {
        this.assertKillSwitchOff();
        assertAllowedAutomationAction('wait');
        this.options.auditSink.recordOperation(runId, 'wait', { details: { milliseconds: target.waitMs } });
        await session.wait(target.waitMs);

        assertAllowedAutomationAction('read_visible');
        const pageState = await session.readPageState();
        const stopReason = detectStopReason(target.platform, pageState.url, pageState.visibleText);
        if (stopReason !== null) throw new AutomationStopError(stopReason);

        const cards = await session.readVisibleCards();
        this.options.auditSink.recordOperation(runId, 'read_visible', { details: { cardCount: cards.length } });
        const posts = extractObservedPosts(target.platform, cards);
        counts.observedCount += posts.length;

        for (const post of posts) {
          if (seen.has(post.url)) continue;
          seen.add(post.url);
          assertAllowedAutomationAction('capture');
          const result = await this.options.captureSink.save(target, post, runId);
          counts.savedCount += 1;
          if (result.deduplicated) counts.duplicateCount += 1;
          this.options.auditSink.recordOperation(runId, 'capture', { targetUrl: post.url });
        }

        if (index === target.maxScrolls) break;
        assertAllowedAutomationAction('scroll');
        this.options.auditSink.recordOperation(runId, 'scroll', { details: { distance: this.scrollDistance } });
        await session.scroll(this.scrollDistance);
      }

      this.options.auditSink.finishRun(runId, 'succeeded', counts);
      return counts;
    } catch (error) {
      const stopped = error instanceof AutomationStopError;
      const errorCode = error instanceof AutomationStopError
        ? error.code
        : error instanceof Error
          ? error.name
          : 'unknown_error';
      this.options.auditSink.recordOperation(runId, 'stop', { details: { errorCode } });
      this.options.auditSink.finishRun(runId, stopped ? 'stopped' : 'failed', counts, errorCode);
      throw error;
    } finally {
      await session?.close();
    }
  }
}
