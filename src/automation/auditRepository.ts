import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AutomationAuditSink,
  AutomationOperation,
  AutomationRunCounts,
  CrawlerTarget,
} from './types.ts';

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export class AutomationAuditRepository implements AutomationAuditSink {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  startRun(target: CrawlerTarget, startedAt = new Date()): string {
    const runId = id('autorun');
    this.db.prepare(`
      INSERT INTO automation_runs (
        id, platform, target_url, source_lane, discovery_surface, started_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'started')
    `).run(
      runId,
      target.platform,
      target.url,
      target.sourceLane,
      target.discoverySurface,
      startedAt.toISOString(),
    );
    return runId;
  }

  recordOperation(
    runId: string,
    operation: AutomationOperation,
    options: { targetUrl?: string; attemptedWrite?: boolean; details?: Record<string, unknown> } = {},
  ): void {
    this.db.prepare(`
      INSERT INTO automation_audit_events (
        id, run_id, occurred_at, operation, target_url,
        attempted_write, executed_write, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id('audit'),
      runId,
      new Date().toISOString(),
      operation,
      options.targetUrl ?? null,
      options.attemptedWrite === true ? 1 : 0,
      options.details === undefined ? null : JSON.stringify(options.details),
    );
  }

  finishRun(
    runId: string,
    status: 'succeeded' | 'stopped' | 'failed',
    counts: AutomationRunCounts,
    errorCode?: string,
  ): void {
    const update = this.db.prepare(`
      UPDATE automation_runs
      SET completed_at = ?, status = ?, observed_count = ?, saved_count = ?,
          duplicate_count = ?, blocked_write_attempt_count = ?, error_code = ?
      WHERE id = ? AND status = 'started'
    `).run(
      new Date().toISOString(),
      status,
      counts.observedCount,
      counts.savedCount,
      counts.duplicateCount,
      counts.blockedWriteAttemptCount,
      errorCode ?? null,
      runId,
    );
    if (update.changes !== 1) throw new Error(`Automation run is not active: ${runId}`);
  }
}
