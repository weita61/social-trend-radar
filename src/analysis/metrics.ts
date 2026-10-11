import { clamp, mad, median } from './math.ts';
import type { MetricAnalysis } from './types.ts';

export type MetricSnapshotInput = {
  id: string;
  postId: string;
  creatorId: string | null;
  platform: string;
  observedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  saveCount: number | null;
};

function latestByPost(rows: readonly MetricSnapshotInput[]): Map<string, MetricSnapshotInput> {
  const latest = new Map<string, MetricSnapshotInput>();
  for (const row of rows) {
    const current = latest.get(row.postId);
    if (current === undefined || row.observedAt > current.observedAt) latest.set(row.postId, row);
  }
  return latest;
}

function viewsByScope(
  latest: ReadonlyMap<string, MetricSnapshotInput>,
  target: MetricSnapshotInput,
  scope: 'creator' | 'platform',
): number[] {
  return [...latest.values()]
    .filter((row) => row.postId !== target.postId && row.viewCount !== null)
    .filter((row) => scope === 'creator' ? target.creatorId !== null && row.creatorId === target.creatorId : row.platform === target.platform)
    .map((row) => row.viewCount as number);
}

function velocityForPost(rows: readonly MetricSnapshotInput[]): number | null {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first?.viewCount === null || first?.viewCount === undefined || last?.viewCount === null || last?.viewCount === undefined) return null;
  const elapsedHours = (Date.parse(last.observedAt) - Date.parse(first.observedAt)) / 3_600_000;
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return null;
  return Math.max(0, last.viewCount - first.viewCount) / elapsedHours;
}

export function analyzeMetrics(rows: readonly MetricSnapshotInput[]): MetricAnalysis[] {
  const latest = latestByPost(rows);
  const byPost = new Map<string, MetricSnapshotInput[]>();
  for (const row of rows) byPost.set(row.postId, [...(byPost.get(row.postId) ?? []), row]);

  const platformLogViews = new Map<string, number[]>();
  for (const row of latest.values()) {
    if (row.viewCount === null) continue;
    platformLogViews.set(row.platform, [...(platformLogViews.get(row.platform) ?? []), Math.log1p(row.viewCount)]);
  }

  return [...latest.values()].map((row): MetricAnalysis => {
    const creatorValues = viewsByScope(latest, row, 'creator');
    const platformValues = viewsByScope(latest, row, 'platform');
    const baselineScope = creatorValues.length >= 3 ? 'creator' : platformValues.length > 0 ? 'platform' : 'none';
    const baselineValues = baselineScope === 'creator' ? creatorValues : baselineScope === 'platform' ? platformValues : [];
    const baselineValue = median(baselineValues);
    const usualValueRatio = row.viewCount === null || baselineValue === null || baselineValue <= 0
      ? null
      : row.viewCount / baselineValue;
    const logs = platformLogViews.get(row.platform) ?? [];
    const logCenter = median(logs);
    const logMad = mad(logs, logCenter);
    const robustZ = row.viewCount === null || logCenter === null
      ? 0
      : (Math.log1p(row.viewCount) - logCenter) / Math.max(0.15, (logMad ?? 0) * 1.4826);
    const engagementTotal = [row.likeCount, row.commentCount, row.shareCount, row.saveCount]
      .reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return {
      postId: row.postId,
      metricSnapshotId: row.id,
      baselineScope,
      baselineValue,
      usualValueRatio,
      robustLiftScore: clamp(50 + robustZ * 12),
      velocityPerHour: velocityForPost(byPost.get(row.postId) ?? []),
      engagementRate: row.viewCount === null || row.viewCount <= 0 ? null : engagementTotal / row.viewCount,
    };
  });
}
