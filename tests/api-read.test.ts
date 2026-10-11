import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from '../src/db/database.ts';
import { CaptureRepository } from '../src/db/captureRepository.ts';
import { CaptureService } from '../src/services/captureService.ts';
import { createApiHandler } from '../src/api/handler.ts';
import { LocalAnalysisEngine } from '../src/analysis/engine.ts';

test('read repository and API provide overview, coverage, and automation data', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());

  // Insert sample post & capture event
  const repo = new CaptureRepository(db);
  const service = new CaptureService(repo, null);
  const handler = createApiHandler(service);

  const captureRes = await repo.capture({
    url: 'https://www.youtube.com/shorts/testshort123',
    captureChannel: 'bot',
    sourceLane: 'personalized',
    discoverySurface: 'fyp',
    reason: 'hook',
    note: '冒頭のフックが効いている',
  });
  assert.equal(captureRes.saved, true);

  // Run analysis to produce cluster & assessment
  new LocalAnalysisEngine(db).run(new Date('2026-10-10T12:00:00Z'));

  // Test /api/overview
  const overviewRes = await handler(new Request('http://localhost/api/overview'));
  assert.equal(overviewRes.status, 200);
  const overviewData = await overviewRes.json();
  assert.equal(overviewData.totalPosts, 1);
  assert.equal(overviewData.totalClusters, 3);
  assert.ok(overviewData.teamInterestCount >= 1);

  // Test /api/coverage
  const coverageRes = await handler(new Request('http://localhost/api/coverage'));
  assert.equal(coverageRes.status, 200);
  const coverageData = await coverageRes.json();
  assert.equal(coverageData.totalCaptures, 1);
  assert.equal(coverageData.totalPosts, 1);
  assert.ok(Array.isArray(coverageData.laneDistribution));
  assert.ok(Array.isArray(coverageData.platformDistribution));
  assert.ok(coverageData.laneWarnings.length > 0); // 3 lanes have 0 count

  // Test /api/automation
  const autoRes = await handler(new Request('http://localhost/api/automation'));
  assert.equal(autoRes.status, 200);
  const autoData = await autoRes.json();
  assert.equal(autoData.safetyAudit.executedWriteCount, 0);
  assert.equal(autoData.safetyAudit.verifiedSafe, true);
  assert.ok(autoData.macStatus.online);
});
