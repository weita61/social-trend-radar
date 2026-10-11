import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiHandler } from '../src/api/handler.ts';
import { CaptureRepository } from '../src/db/captureRepository.ts';
import { openDatabase } from '../src/db/database.ts';

function setup() {
  const db = openDatabase(':memory:');
  const handler = createApiHandler(new CaptureRepository(db));
  return { db, handler };
}

function postCapture(handler: (request: Request) => Promise<Response>, body: Record<string, unknown>): Promise<Response> {
  return handler(new Request('http://local.test/api/captures', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

const baseCapture = {
  captureChannel: 'bot',
  sourceLane: 'personalized',
  discoverySurface: 'shared',
  submitterPseudonym: 'member_anon_1',
};

test('POST deduplicates posts but preserves every capture event', async (t) => {
  const { db, handler } = setup();
  t.after(() => db.close());

  const firstResponse = await postCapture(handler, {
    ...baseCapture,
    url: 'https://youtu.be/dQw4w9WgXcQ?t=4',
    note: 'first discovery',
  });
  assert.equal(firstResponse.status, 201);
  const first = await firstResponse.json() as Record<string, unknown>;
  assert.equal(first.deduplicated, false);
  assert.equal(first.evidenceStatus, 'bias_audit_pending');

  const secondResponse = await postCapture(handler, {
    ...baseCapture,
    url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share',
    submitterPseudonym: 'member_anon_2',
  });
  const second = await secondResponse.json() as Record<string, unknown>;
  assert.equal(second.deduplicated, true);
  assert.equal(second.postId, first.postId);

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM posts').get()?.count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM capture_events').get()?.count, 2);

  const getResponse = await handler(new Request(`http://local.test/api/posts/${String(first.postId)}`));
  assert.equal(getResponse.status, 200);
  const detail = await getResponse.json() as { post: { canonicalUrl: string }, captureEvents: unknown[] };
  assert.equal(detail.post.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(detail.captureEvents.length, 2);
});

test('unsupported platform is saved with its failure reason', async (t) => {
  const { db, handler } = setup();
  t.after(() => db.close());

  const response = await postCapture(handler, {
    ...baseCapture,
    url: 'https://example.com/video/123?utm_source=chat',
  });
  assert.equal(response.status, 201);
  const capture = await response.json() as Record<string, unknown>;
  assert.equal(capture.platform, 'unknown');
  assert.equal(capture.metadataStatus, 'failed');
  assert.equal(capture.evidenceStatus, 'manual_review');
  assert.equal(capture.failureReason, 'unsupported_platform');

  const event = db.prepare('SELECT processing_status, failure_reason FROM capture_events').get();
  assert.equal(event?.processing_status, 'manual_review');
  assert.equal(event?.failure_reason, 'unsupported_platform');
});

test('lane and discovery surface are required', async (t) => {
  const { db, handler } = setup();
  t.after(() => db.close());

  const response = await postCapture(handler, {
    url: 'https://www.instagram.com/reel/ABC123/',
    captureChannel: 'extension',
    sourceLane: 'personalized',
  });
  assert.equal(response.status, 400);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.field, 'discoverySurface');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM posts').get()?.count, 0);
});

test('manual metrics are retained but explicitly excluded from scoring', async (t) => {
  const { db, handler } = setup();
  t.after(() => db.close());

  const response = await postCapture(handler, {
    ...baseCapture,
    url: 'https://www.instagram.com/reel/ABC123/',
    visibleMetrics: {
      viewCount: 1000,
      dataSource: 'manual',
      confidence: 0.4,
    },
  });
  const capture = await response.json() as Record<string, unknown>;
  const getResponse = await handler(new Request(`http://local.test/api/posts/${String(capture.postId)}`));
  const detail = await getResponse.json() as { metricSnapshots: Array<{ viewCount: number, scoreEligible: boolean }> };
  assert.equal(detail.metricSnapshots[0]?.viewCount, 1000);
  assert.equal(detail.metricSnapshots[0]?.scoreEligible, false);
});

test('GET returns 404 for an unknown post', async (t) => {
  const { db, handler } = setup();
  t.after(() => db.close());
  const response = await handler(new Request('http://local.test/api/posts/post_missing'));
  assert.equal(response.status, 404);
});

test('health endpoint reports the capture API is ready', async (t) => {
  const { db, handler } = setup();
  t.after(() => db.close());
  const response = await handler(new Request('http://local.test/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'social-trend-radar-capture-api',
  });
});

