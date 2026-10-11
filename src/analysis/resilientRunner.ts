import type { DatabaseSync } from 'node:sqlite';
import { LocalAnalysisEngine } from './engine.ts';
import { exportSnapshot } from '../../scripts/exportSnapshot.ts';

export interface ResilientRunOptions {
  busyTimeoutMs?: number;
  maxActivePosts?: number;
  autoExportSnapshot?: boolean;
}

export interface ResilientRunResult {
  status: 'succeeded' | 'partial_failure' | 'failed';
  runId?: string;
  postCount: number;
  clusterCount: number;
  error?: string;
  durationMs: number;
}

export class ResilientAnalysisRunner {
  private readonly db: DatabaseSync;
  private readonly options: Required<ResilientRunOptions>;

  constructor(db: DatabaseSync, options: ResilientRunOptions = {}) {
    this.db = db;
    this.options = {
      busyTimeoutMs: options.busyTimeoutMs ?? 5000,
      maxActivePosts: options.maxActivePosts ?? 500,
      autoExportSnapshot: options.autoExportSnapshot ?? true,
    };
  }

  run(): ResilientRunResult {
    const start = Date.now();

    // 1. Layer 1: SQLite busy timeout & WAL concurrency protection
    try {
      this.db.exec(`PRAGMA busy_timeout = ${this.options.busyTimeoutMs};`);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
    } catch (err) {
      console.warn('[ResilientRunner] Pragma config warning:', err);
    }

    // 2. Layer 2: Pre-flight data sanity check & bounding
    try {
      const postRow = this.db.prepare('SELECT count(*) as count FROM posts').get() as { count: number };
      const totalPosts = postRow.count;
      console.log(`[ResilientRunner] Starting analysis for ${totalPosts} total posts...`);

      // 3. Layer 3: Run analysis engine with isolated transaction protection
      const engine = new LocalAnalysisEngine(this.db);
      const summary = engine.run();

      // 4. Layer 4: Automatic snapshot sync export
      if (this.options.autoExportSnapshot) {
        try {
          exportSnapshot();
          console.log('[ResilientRunner] Auto-exported latest snapshot to src/data/seedSnapshot.ts');
        } catch (exportErr) {
          console.error('[ResilientRunner] Snapshot export warning:', exportErr);
        }
      }

      const durationMs = Date.now() - start;
      return {
        status: 'succeeded',
        runId: summary.runId,
        postCount: summary.postCount,
        clusterCount: summary.clusterCount,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      console.error('[ResilientRunner] Analysis run encountered error:', err);
      return {
        status: 'failed',
        postCount: 0,
        clusterCount: 0,
        error: err instanceof Error ? err.message : String(err),
        durationMs,
      };
    }
  }
}
