import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export class QuotaExceededError extends Error {
  readonly code = 'quota_limit_reached';
}

export type QuotaReservation = {
  runId: string;
  connector: string;
  usageDate: string;
  unitsUsed: number;
  limit: number;
};

export class QuotaGuard {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  reserve(connector: string, operation: string, units: number, limit: number, now = new Date()): QuotaReservation {
    if (!Number.isSafeInteger(units) || units <= 0) throw new RangeError('Quota units must be a positive integer');
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError('Quota limit must be a positive integer');

    const usageDate = now.toISOString().slice(0, 10);
    const timestamp = now.toISOString();
    const runId = `run_${randomUUID().replaceAll('-', '')}`;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare(`
        SELECT units_used FROM api_quota_daily WHERE connector = ? AND usage_date = ?
      `).get(connector, usageDate);
      const current = row === undefined ? 0 : Number(row.units_used);
      const next = current + units;

      if (next > limit) {
        this.db.prepare(`
          INSERT INTO connector_runs (
            id, connector, operation, started_at, completed_at, status, quota_units, error_code
          ) VALUES (?, ?, ?, ?, ?, 'quota_stopped', 0, 'quota_limit_reached')
        `).run(runId, connector, operation, timestamp, timestamp);
        this.db.exec('COMMIT');
        throw new QuotaExceededError(`${connector} daily quota guard stopped the request at ${current}/${limit} units`);
      }

      this.db.prepare(`
        INSERT INTO api_quota_daily (connector, usage_date, units_used, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (connector, usage_date)
        DO UPDATE SET units_used = excluded.units_used, updated_at = excluded.updated_at
      `).run(connector, usageDate, next, timestamp);
      this.db.prepare(`
        INSERT INTO connector_runs (id, connector, operation, started_at, status, quota_units)
        VALUES (?, ?, ?, ?, 'started', ?)
      `).run(runId, connector, operation, timestamp, units);
      this.db.exec('COMMIT');
      return { runId, connector, usageDate, unitsUsed: next, limit };
    } catch (error) {
      if (error instanceof QuotaExceededError) throw error;
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  complete(runId: string, now = new Date()): void {
    this.db.prepare(`
      UPDATE connector_runs SET status = 'succeeded', completed_at = ? WHERE id = ? AND status = 'started'
    `).run(now.toISOString(), runId);
  }

  fail(runId: string, errorCode: string, now = new Date()): void {
    this.db.prepare(`
      UPDATE connector_runs
      SET status = 'failed', completed_at = ?, error_code = ?
      WHERE id = ? AND status = 'started'
    `).run(now.toISOString(), errorCode.slice(0, 128), runId);
  }
}

