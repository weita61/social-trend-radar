import { createQueueHandler, type CaptureQueueStore, type QueueEnqueueResult } from '../../../src/api/queueHandler.ts';

type D1ResultRow = { id: string };

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

type WorkerEnvironment = {
  CAPTURE_DB: D1Database;
};

class D1CaptureQueueStore implements CaptureQueueStore {
  constructor(privateDb: D1Database) {
    this.db = privateDb;
  }

  private readonly db: D1Database;

  async enqueue(idempotencyKey: string, payloadJson: string, receivedAt: string): Promise<QueueEnqueueResult> {
    const existing = await this.db.prepare('SELECT id FROM capture_inbox WHERE idempotency_key = ?')
      .bind(idempotencyKey)
      .first<D1ResultRow>();
    if (existing !== null) return { queueId: existing.id, deduplicated: true };

    const queueId = `queue_${crypto.randomUUID().replaceAll('-', '')}`;
    try {
      await this.db.prepare(`
        INSERT INTO capture_inbox (id, idempotency_key, payload_json, received_at)
        VALUES (?, ?, ?, ?)
      `).bind(queueId, idempotencyKey, payloadJson, receivedAt).run();
      return { queueId, deduplicated: false };
    } catch (error) {
      const raced = await this.db.prepare('SELECT id FROM capture_inbox WHERE idempotency_key = ?')
        .bind(idempotencyKey)
        .first<D1ResultRow>();
      if (raced !== null) return { queueId: raced.id, deduplicated: true };
      throw error;
    }
  }
}

export default {
  fetch(request: Request, environment: WorkerEnvironment): Promise<Response> {
    return createQueueHandler(new D1CaptureQueueStore(environment.CAPTURE_DB))(request);
  },
};

