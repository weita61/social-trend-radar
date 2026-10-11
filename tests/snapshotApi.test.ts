import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotCaptureApi } from '../src/api/snapshotApi.ts';
import { createApiHandler } from '../src/api/handler.ts';

test('SnapshotCaptureApi serves overview, trends, videos, and custom blueprints', async () => {
  const api = new SnapshotCaptureApi();

  // Overview
  const overview = api.getOverview() as { totalPosts: number; totalClusters: number };
  assert.equal(typeof overview.totalPosts, 'number');
  assert.ok(overview.totalPosts > 0);

  // Trends
  const trends = api.listTrends({ layer: 'format' });
  assert.ok(Array.isArray(trends));
  assert.ok(trends.length > 0);

  // Videos
  const videos = api.listVideos();
  assert.ok(Array.isArray(videos));
  assert.ok(videos.length > 0);

  // Filter videos by query
  const filtered = api.listVideos({ q: '神' });
  assert.ok(Array.isArray(filtered));

  // Get specific trend with blueprint
  const firstTrendId = String(trends[0].id);
  const trend = api.getTrend(firstTrendId);
  assert.ok(trend !== null);
  assert.ok(trend.actionableAdvice !== undefined);

  // Brand profile update & blueprint regeneration
  const updated = api.updateBrandProfile({
    name: 'テスト学生団体',
    targetAudience: '大学1年生',
    missionGoal: '新歓イベント動員',
    valueProposition: '圧倒的な自己成長環境',
    toneAndManner: '親しみやすい先輩トーン',
  });
  assert.equal(updated.success, true);

  const customBp = await api.generateJevBlueprintForTrend(firstTrendId, {
    name: 'テスト学生団体',
    targetAudience: '大学1年生',
    missionGoal: '新歓イベント動員',
    valueProposition: '圧倒的な自己成長環境',
    toneAndManner: '親しみやすい先輩トーン',
  });
  assert.ok(customBp !== null);
  assert.ok(typeof customBp.hookIdea === 'string');

  // Verify full handler integration via HTTP requests
  const handler = createApiHandler(api);

  const resOverview = await handler(new Request('http://localhost/api/overview'));
  assert.equal(resOverview.status, 200);
  const jsonOverview = await resOverview.json();
  assert.equal(jsonOverview.totalPosts, overview.totalPosts);

  const resTrends = await handler(new Request('http://localhost/api/trends?layer=format'));
  assert.equal(resTrends.status, 200);
  const jsonTrends = await resTrends.json();
  assert.equal(jsonTrends.length, trends.length);

  const resVideos = await handler(new Request('http://localhost/api/videos'));
  assert.equal(resVideos.status, 200);
  const jsonVideos = await resVideos.json();
  assert.equal(jsonVideos.length, videos.length);
});
