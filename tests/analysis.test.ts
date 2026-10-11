import assert from 'node:assert/strict';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { LocalAnalysisEngine } from '../src/analysis/engine.ts';
import { extractPostFeatures } from '../src/analysis/features.ts';
import { analyzeMetrics } from '../src/analysis/metrics.ts';
import { scoreCluster } from '../src/analysis/scoring.ts';
import { AnalysisReadRepository } from '../src/analysis/readRepository.ts';
import { openDatabase } from '../src/db/database.ts';

test('metric analysis excludes manual input and computes robust local comparisons', () => {
  const metrics = analyzeMetrics([
    { id: 'm1', postId: 'p1', creatorId: 'c1', platform: 'instagram', observedAt: '2026-10-01T00:00:00Z', viewCount: 100, likeCount: 10, commentCount: 1, shareCount: 0, saveCount: 0 },
    { id: 'm2', postId: 'p1', creatorId: 'c1', platform: 'instagram', observedAt: '2026-10-01T01:00:00Z', viewCount: 300, likeCount: 30, commentCount: 3, shareCount: 2, saveCount: 5 },
    { id: 'm3', postId: 'p2', creatorId: 'c2', platform: 'instagram', observedAt: '2026-10-01T01:00:00Z', viewCount: 100, likeCount: 4, commentCount: 1, shareCount: 0, saveCount: 0 },
  ]);
  const first = metrics.find((metric) => metric.postId === 'p1');
  assert.equal(first?.baselineScope, 'platform');
  assert.equal(first?.usualValueRatio, 3);
  assert.equal(first?.velocityPerHour, 200);
  assert.ok((first?.robustLiftScore ?? 0) > 50);
});

test('three-layer feature extraction is local, deterministic, and explainable', () => {
  const post = {
    id: 'p1', platform: 'instagram', creatorId: null, caption: '失敗を先に見せる簡単How-to #勉強',
    audioKey: null, publishedAt: null, firstSeenAt: '2026-10-01T00:00:00Z',
    notes: ['時短のコツ'], reasons: ['hook'], discoverySurfaces: ['fyp'],
  };
  const first = extractPostFeatures(post, 64);
  const second = extractPostFeatures(post, 64);
  assert.deepEqual(first, second);
  assert.ok(first.format.labels.includes('how_to'));
  assert.ok(first.format.labels.includes('failure_first'));
  assert.ok(first.desire.labels.includes('self_improvement'));
  assert.equal(first.surface.vector.length, 64);
});

test('bias audit keeps team interest separate from market diffusion', () => {
  const score = scoreCluster({
    memberPostIds: ['p1'], independentCreatorIds: [], platforms: ['instagram'], nonUserLanes: [],
    independentlyConfirmedPostIds: [], humanCaptureCount: 8, submitterCounts: [8], metricPostCount: 0,
    growingPostCount: 0, averageRobustLift: 0, averageVelocityPerHour: 0, averageEngagementRate: 0,
    newestObservedAt: '2026-10-10T00:00:00Z',
  }, {
    userSubmittedShare: 0.35, submitterHhi: 0.25, independentConfirmationGap: 0.25, nonUserLaneGap: 0.15,
  }, { independentCreators: 3, nonUserLanes: 2, independentConfirmations: 1, growingPosts: 1 }, new Date('2026-10-10T00:00:00Z'));
  assert.equal(score.status, 'team_interest');
  assert.equal(score.biasLabel, 'high');
  assert.ok(score.teamInterestScore > score.universalScore);
  assert.ok(score.universalScore <= 39);
});

function seedMarketCluster(db: DatabaseSync): void {
  const creator = db.prepare(`INSERT INTO creators (id, platform, platform_creator_id, handle, profile_url, first_seen_at) VALUES (?, 'youtube', ?, ?, ?, ?)`);
  const post = db.prepare(`
    INSERT INTO posts (id, platform, platform_post_id, canonical_url, creator_id, published_at, caption,
      media_type, first_seen_at, access_tier, metadata_status, link_status)
    VALUES (?, 'youtube', ?, ?, ?, ?, ?, 'short', ?, 'official_api', 'complete', 'active')
  `);
  const event = db.prepare(`
    INSERT INTO capture_events (id, post_id, raw_url, captured_at, capture_channel, source_lane,
      selection_method, discovery_surface, note, processing_status)
    VALUES (?, ?, ?, ?, 'api', ?, 'official_feed', 'chart', ?, 'saved')
  `);
  const metric = db.prepare(`
    INSERT INTO metric_snapshots (id, post_id, observed_at, view_count, like_count, comment_count,
      data_source, confidence, score_eligible) VALUES (?, ?, ?, ?, ?, ?, 'official_api', 1, 1)
  `);
  for (let index = 1; index <= 3; index += 1) {
    const creatorId = `creator_${index}`;
    const postId = `post_${index}`;
    const videoId = `video00000${index}`;
    creator.run(creatorId, `channel_${index}`, `creator${index}`, `https://youtube.com/channel/${index}`, '2026-10-01T00:00:00Z');
    post.run(postId, videoId, `https://www.youtube.com/watch?v=${videoId}`, creatorId,
      `2026-10-0${index}T00:00:00Z`, '失敗を先に見せる簡単How-to。勉強のコツ', `2026-10-0${index}T00:00:00Z`);
    const lane = index === 1 ? 'external' : 'broad';
    event.run(`cap_${index}`, postId, `https://youtu.be/${videoId}`, `2026-10-0${index}T01:00:00Z`, lane, '共通の失敗先出し構造');
    metric.run(`metric_${index}_a`, postId, `2026-10-0${index}T01:00:00Z`, 100 * index, 10, 2);
    metric.run(`metric_${index}_b`, postId, `2026-10-0${index}T02:00:00Z`, 300 * index, 30, 5);
  }
}

test('analysis engine persists clusters, audits, scores, evidence, and read models', (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  seedMarketCluster(db);
  const summary = new LocalAnalysisEngine(db).run(new Date('2026-10-10T00:00:00Z'));
  assert.equal(summary.postCount, 3);
  assert.ok(summary.clusterCount >= 3);
  assert.ok(summary.marketTrendCount >= 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM content_features').get()?.count, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM post_metric_analysis').get()?.count, 3);
  assert.ok(Number(db.prepare('SELECT COUNT(*) AS count FROM trend_evidence_posts').get()?.count) > 0);

  const repository = new AnalysisReadRepository(db);
  const formatTrend = repository.listTrends({ layer: 'format' })[0];
  assert.notEqual(formatTrend, undefined);
  const detail = repository.getTrend(String(formatTrend?.id));
  assert.notEqual(detail, null);
  assert.ok(Array.isArray(detail?.evidencePosts));
  assert.ok(Array.isArray(detail?.fitScores));

  const rerun = new LocalAnalysisEngine(db).run(new Date('2026-10-10T01:00:00Z'));
  assert.equal(rerun.clusterCount, summary.clusterCount);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM analysis_owned_clusters').get()?.count, summary.clusterCount);
});
