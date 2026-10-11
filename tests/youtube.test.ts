import assert from 'node:assert/strict';
import test from 'node:test';
import { QuotaExceededError, QuotaGuard } from '../src/connectors/quotaGuard.ts';
import { isoDurationToMilliseconds, YoutubeAdapter } from '../src/connectors/youtube.ts';
import { CaptureRepository } from '../src/db/captureRepository.ts';
import { openDatabase } from '../src/db/database.ts';
import { CaptureService } from '../src/services/captureService.ts';

test('ISO 8601 YouTube durations convert to milliseconds', () => {
  assert.equal(isoDurationToMilliseconds('PT59S'), 59_000);
  assert.equal(isoDurationToMilliseconds('PT1H2M3.5S'), 3_723_500);
  assert.equal(isoDurationToMilliseconds('invalid'), null);
});

test('YouTube adapter uses official metadata and records quota', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const adapter = new YoutubeAdapter({
    apiKey: 'test-key',
    quotaGuard: new QuotaGuard(db),
    request: async () => Response.json({
      items: [{
        id: 'dQw4w9WgXcQ',
        snippet: {
          publishedAt: '2026-10-01T00:00:00Z',
          channelId: 'channel-1',
          title: 'A title',
          description: 'A description',
          channelTitle: 'Creator',
          tags: ['sample'],
        },
        contentDetails: { duration: 'PT42S' },
        statistics: { viewCount: '1234', likeCount: '56', commentCount: '7' },
      }],
    }),
  });

  const result = await adapter.fetchVideo('dQw4w9WgXcQ');
  assert.equal(result.durationMs, 42_000);
  assert.equal(result.metrics.viewCount, 1234);
  assert.equal(result.creator.platformCreatorId, 'channel-1');
  assert.equal(db.prepare("SELECT units_used FROM api_quota_daily WHERE connector = 'youtube'").get()?.units_used, 1);
  assert.equal(db.prepare("SELECT status FROM connector_runs WHERE connector = 'youtube'").get()?.status, 'succeeded');
});

test('quota guard stops before crossing the configured free limit', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const guard = new QuotaGuard(db);
  guard.reserve('youtube', 'videos.list', 1, 1, new Date('2026-10-09T00:00:00Z'));
  assert.throws(
    () => guard.reserve('youtube', 'videos.list', 1, 1, new Date('2026-10-09T01:00:00Z')),
    QuotaExceededError,
  );
  assert.equal(db.prepare("SELECT units_used FROM api_quota_daily WHERE connector = 'youtube'").get()?.units_used, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM connector_runs WHERE status = 'quota_stopped'").get()?.count, 1);
});

test('capture service enriches a YouTube post without losing the capture event', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const repository = new CaptureRepository(db);
  const adapter = new YoutubeAdapter({
    apiKey: 'test-key',
    quotaGuard: new QuotaGuard(db),
    request: async () => Response.json({
      items: [{
        snippet: {
          publishedAt: '2026-10-01T00:00:00Z',
          channelId: 'channel-1',
          title: 'A title',
          description: 'A description',
          channelTitle: 'Creator',
        },
        contentDetails: { duration: 'PT42S' },
        statistics: { viewCount: '1234' },
      }],
    }),
  });
  const service = new CaptureService(repository, adapter);
  const capture = await service.capture({
    url: 'https://youtu.be/dQw4w9WgXcQ',
    captureChannel: 'api',
    sourceLane: 'external',
    selectionMethod: 'official_feed',
    discoverySurface: 'chart',
  });

  assert.equal(capture.metadataStatus, 'complete');
  const detail = repository.getPost(capture.postId) as {
    post: { accessTier: string, caption: string },
    captureEvents: unknown[],
    metricSnapshots: Array<{ dataSource: string, scoreEligible: boolean }>,
  };
  assert.equal(detail.post.accessTier, 'official_api');
  assert.equal(detail.post.caption, 'A description');
  assert.equal(detail.captureEvents.length, 1);
  assert.equal(detail.metricSnapshots[0]?.dataSource, 'official_api');
  assert.equal(detail.metricSnapshots[0]?.scoreEligible, true);
});

