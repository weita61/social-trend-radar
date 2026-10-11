import type { DatabaseSync } from 'node:sqlite';
import { InputValidationError, validateCaptureInput } from '../domain/validation.ts';
import { normalizePostUrl, UrlValidationError } from '../domain/url.ts';

export type QueueEnqueueResult = { queueId: string; deduplicated: boolean };

export interface CaptureQueueStore {
  enqueue(idempotencyKey: string, payloadJson: string, receivedAt: string): QueueEnqueueResult | Promise<QueueEnqueueResult>;
}

export class SqliteCaptureQueueStore implements CaptureQueueStore {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  enqueue(idempotencyKey: string, payloadJson: string, receivedAt: string): QueueEnqueueResult {
    const existing = this.db.prepare('SELECT id FROM capture_inbox WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing !== undefined) return { queueId: String(existing.id), deduplicated: true };

    const queueId = `queue_${crypto.randomUUID().replaceAll('-', '')}`;
    try {
      this.db.prepare(`
        INSERT INTO capture_inbox (id, idempotency_key, payload_json, received_at)
        VALUES (?, ?, ?, ?)
      `).run(queueId, idempotencyKey, payloadJson, receivedAt);
      return { queueId, deduplicated: false };
    } catch (error) {
      const raced = this.db.prepare('SELECT id FROM capture_inbox WHERE idempotency_key = ?').get(idempotencyKey);
      if (raced !== undefined) return { queueId: String(raced.id), deduplicated: true };
      throw error;
    }
  }
}

export function createQueueHandler(store: CaptureQueueStore): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/captures') {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    try {
      const raw = await request.json();
      const input = validateCaptureInput(raw);
      normalizePostUrl(input.url);
      const payloadJson = JSON.stringify(input);
      const suppliedKey = request.headers.get('idempotency-key')?.trim();
      if (suppliedKey === undefined || suppliedKey === '') {
        return Response.json({ error: 'missing_idempotency_key', message: 'Idempotency-Key header is required' }, { status: 400 });
      }
      const idempotencyKey = suppliedKey.slice(0, 200);
      const result = await store.enqueue(idempotencyKey, payloadJson, new Date().toISOString());
      return Response.json({ ...result, queued: true }, { status: result.deduplicated ? 200 : 202 });
    } catch (error) {
      if (error instanceof InputValidationError || error instanceof UrlValidationError) {
        return Response.json({
          error: error.code,
          message: error.message,
          field: error instanceof InputValidationError ? error.field : undefined,
        }, { status: 400 });
      }
      if (error instanceof SyntaxError) return Response.json({ error: 'invalid_json' }, { status: 400 });
      throw error;
    }
  };
}
