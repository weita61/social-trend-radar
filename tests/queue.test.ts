import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createQueueHandler, SqliteCaptureQueueStore } from '../src/api/queueHandler.ts';

const queueMigration = readFileSync(
  new URL('../apps/worker-api/migrations/0001_capture_queue.sql', import.meta.url),
  'utf8',
);

test('D1-compatible inbox queues and deduplicates idempotent captures', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(queueMigration);
  const handler = createQueueHandler(new SqliteCaptureQueueStore(db));
  const body = JSON.stringify({
    url: 'https://www.tiktok.com/@sample/video/7412345678901234567',
    captureChannel: 'extension',
    sourceLane: 'broad',
    discoverySurface: 'search',
  });
  const request = () => new Request('https://worker.test/api/captures', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'capture-from-device-1' },
    body,
  });

  const first = await handler(request());
  assert.equal(first.status, 202);
  const firstBody = await first.json() as Record<string, unknown>;
  assert.equal(firstBody.deduplicated, false);

  const second = await handler(request());
  assert.equal(second.status, 200);
  const secondBody = await second.json() as Record<string, unknown>;
  assert.equal(secondBody.deduplicated, true);
  assert.equal(secondBody.queueId, firstBody.queueId);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM capture_inbox').get()?.count, 1);
});

test('queue requires a client event id so identical human shares remain distinct', async (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(queueMigration);
  const handler = createQueueHandler(new SqliteCaptureQueueStore(db));
  const response = await handler(new Request('https://worker.test/api/captures', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://www.instagram.com/reel/ABC123/',
      captureChannel: 'bot',
      sourceLane: 'personalized',
      discoverySurface: 'shared',
    }),
  }));
  assert.equal(response.status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM capture_inbox').get()?.count, 0);
});
