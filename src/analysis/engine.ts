import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { clusterLayer } from './clustering.ts';
import { extractPostFeatures } from './features.ts';
import { analyzeMetrics, type MetricSnapshotInput } from './metrics.ts';
import { clamp } from './math.ts';
import { scoreCluster, type ClusterEvidence } from './scoring.ts';
import type {
  AnalysisConfig,
  AnalysisLayer,
  AnalysisPost,
  AnalysisSummary,
  ClusterCandidate,
  MetricAnalysis,
  PostFeatures,
} from './types.ts';

type DbRow = Record<string, string | number | null>;
type StoredCluster = ClusterCandidate & { id: string; parentClusterId: string | null };

const DEFAULT_CONFIG: AnalysisConfig = {
  embeddingDimensions: 64,
  clusterDistance: { surface: 0.58, format: 0.56, desire: 0.48 },
  biasWeights: {
    userSubmittedShare: 0.35,
    submitterHhi: 0.25,
    independentConfirmationGap: 0.25,
    nonUserLaneGap: 0.15,
  },
  trendGate: { independentCreators: 2, nonUserLanes: 1, independentConfirmations: 1, growingPosts: 1 },
};

function runId(): string {
  return `analysis_${randomUUID().replaceAll('-', '')}`;
}

function clusterId(candidate: ClusterCandidate): string {
  const digest = createHash('sha256')
    .update(`${candidate.layer}\0${candidate.memberPostIds.join('\0')}`)
    .digest('hex')
    .slice(0, 24);
  return `cluster_${digest}`;
}

function parseJson<T>(raw: string | number | null | undefined, fallback: T): T {
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stringArray(value: string | number | null | undefined): string[] {
  return typeof value === 'string' && value.length > 0 ? value.split('\u001f') : [];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function overlap(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right);
  return left.reduce((count, value) => count + (rightSet.has(value) ? 1 : 0), 0);
}

function chooseParent(candidate: ClusterCandidate, parents: readonly StoredCluster[]): string | null {
  return [...parents]
    .map((parent) => ({ id: parent.id, overlap: overlap(candidate.memberPostIds, parent.memberPostIds) }))
    .sort((left, right) => right.overlap - left.overlap || left.id.localeCompare(right.id))[0]?.id ?? null;
}

function loadConfig(db: DatabaseSync): AnalysisConfig {
  const settings = new Map(
    (db.prepare('SELECT key, value_json FROM analysis_settings').all() as DbRow[])
      .map((row) => [String(row.key), String(row.value_json)]),
  );
  const clustering = parseJson<Record<string, number>>(settings.get('clustering'), {});
  return {
    embeddingDimensions: clustering.embeddingDimensions ?? DEFAULT_CONFIG.embeddingDimensions,
    clusterDistance: {
      surface: clustering.surfaceDistance ?? DEFAULT_CONFIG.clusterDistance.surface,
      format: clustering.formatDistance ?? DEFAULT_CONFIG.clusterDistance.format,
      desire: clustering.desireDistance ?? DEFAULT_CONFIG.clusterDistance.desire,
    },
    biasWeights: parseJson(settings.get('bias_weights'), DEFAULT_CONFIG.biasWeights),
    trendGate: parseJson(settings.get('trend_gate'), DEFAULT_CONFIG.trendGate),
  };
}

function loadPosts(db: DatabaseSync): AnalysisPost[] {
  const rows = db.prepare(`
    SELECT p.id, p.platform, p.creator_id, p.caption, p.audio_key, p.published_at, p.first_seen_at,
           GROUP_CONCAT(DISTINCT ce.note) AS notes,
           GROUP_CONCAT(DISTINCT ce.reason) AS reasons,
           GROUP_CONCAT(DISTINCT ce.discovery_surface) AS discovery_surfaces
    FROM posts p
    LEFT JOIN capture_events ce ON ce.post_id = p.id
    WHERE p.platform != 'unknown'
    GROUP BY p.id
    ORDER BY p.first_seen_at, p.id
  `).all() as DbRow[];
  return rows.map((row) => ({
    id: String(row.id),
    platform: String(row.platform),
    creatorId: row.creator_id === null ? null : String(row.creator_id),
    caption: row.caption === null ? null : String(row.caption),
    audioKey: row.audio_key === null ? null : String(row.audio_key),
    publishedAt: row.published_at === null ? null : String(row.published_at),
    firstSeenAt: String(row.first_seen_at),
    notes: stringArray(row.notes).flatMap((value) => value.split(',')),
    reasons: stringArray(row.reasons).flatMap((value) => value.split(',')),
    discoverySurfaces: stringArray(row.discovery_surfaces).flatMap((value) => value.split(',')),
  }));
}

function loadMetrics(db: DatabaseSync): MetricSnapshotInput[] {
  return (db.prepare(`
    SELECT ms.id, ms.post_id, p.creator_id, p.platform, ms.observed_at, ms.view_count,
           ms.like_count, ms.comment_count, ms.share_count, ms.save_count
    FROM metric_snapshots ms JOIN posts p ON p.id = ms.post_id
    WHERE ms.score_eligible = 1
    ORDER BY ms.post_id, ms.observed_at, ms.id
  `).all() as DbRow[]).map((row) => ({
    id: String(row.id),
    postId: String(row.post_id),
    creatorId: row.creator_id === null ? null : String(row.creator_id),
    platform: String(row.platform),
    observedAt: String(row.observed_at),
    viewCount: row.view_count === null ? null : Number(row.view_count),
    likeCount: row.like_count === null ? null : Number(row.like_count),
    commentCount: row.comment_count === null ? null : Number(row.comment_count),
    shareCount: row.share_count === null ? null : Number(row.share_count),
    saveCount: row.save_count === null ? null : Number(row.save_count),
  }));
}

function buildClusters(
  features: ReadonlyMap<string, PostFeatures>,
  config: AnalysisConfig,
): StoredCluster[] {
  const byLayer = new Map<AnalysisLayer, StoredCluster[]>();
  for (const layer of ['desire', 'format', 'surface'] as const) {
    const candidates = clusterLayer(layer, features, config.clusterDistance[layer]);
    const parentLayer = layer === 'surface' ? 'format' : layer === 'format' ? 'desire' : null;
    const parents = parentLayer === null ? [] : byLayer.get(parentLayer) ?? [];
    byLayer.set(layer, candidates.map((candidate) => ({
      ...candidate,
      id: clusterId(candidate),
      parentClusterId: chooseParent(candidate, parents),
    })));
  }
  return [...(byLayer.get('desire') ?? []), ...(byLayer.get('format') ?? []), ...(byLayer.get('surface') ?? [])];
}

function evidenceForCluster(
  db: DatabaseSync,
  cluster: StoredCluster,
  posts: ReadonlyMap<string, AnalysisPost>,
  metrics: ReadonlyMap<string, MetricAnalysis>,
): ClusterEvidence {
  const placeholders = cluster.memberPostIds.map(() => '?').join(',');
  const eventRows = placeholders.length === 0 ? [] : db.prepare(`
    SELECT post_id, selection_method, source_lane, submitter_pseudonym, captured_at
    FROM capture_events WHERE post_id IN (${placeholders})
  `).all(...cluster.memberPostIds) as DbRow[];
  const humanRows = eventRows.filter((row) => row.selection_method === 'user_shared');
  const nonUserRows = eventRows.filter((row) => row.selection_method === 'auto_observed' || row.selection_method === 'official_feed');
  const submitters = new Map<string, number>();
  for (const row of humanRows) {
    const submitter = row.submitter_pseudonym === null ? 'unknown' : String(row.submitter_pseudonym);
    submitters.set(submitter, (submitters.get(submitter) ?? 0) + 1);
  }
  const metricRows = cluster.memberPostIds.map((id) => metrics.get(id)).filter((metric): metric is MetricAnalysis => metric !== undefined);
  const clusterPosts = cluster.memberPostIds.map((id) => posts.get(id)).filter((post): post is AnalysisPost => post !== undefined);
  return {
    memberPostIds: cluster.memberPostIds,
    independentCreatorIds: unique(clusterPosts.flatMap((post) => post.creatorId === null ? [] : [post.creatorId])),
    platforms: unique(clusterPosts.map((post) => post.platform)),
    nonUserLanes: unique(nonUserRows.map((row) => String(row.source_lane))),
    independentlyConfirmedPostIds: unique(nonUserRows.map((row) => String(row.post_id))),
    humanCaptureCount: humanRows.length,
    submitterCounts: [...submitters.values()],
    metricPostCount: metricRows.length,
    growingPostCount: metricRows.filter((metric) => (metric.velocityPerHour ?? 0) > 0).length,
    averageRobustLift: metricRows.length === 0 ? 0 : metricRows.reduce((sum, metric) => sum + metric.robustLiftScore, 0) / metricRows.length,
    averageVelocityPerHour: metricRows.length === 0 ? 0 : metricRows.reduce((sum, metric) => sum + (metric.velocityPerHour ?? 0), 0) / metricRows.length,
    averageEngagementRate: metricRows.length === 0 ? 0 : metricRows.reduce((sum, metric) => sum + (metric.engagementRate ?? 0), 0) / metricRows.length,
    newestObservedAt: eventRows.map((row) => String(row.captured_at)).sort().at(-1) ?? null,
  };
}

function saveEvidence(
  db: DatabaseSync,
  cluster: StoredCluster,
  posts: ReadonlyMap<string, AnalysisPost>,
  metrics: ReadonlyMap<string, MetricAnalysis>,
): void {
  const available = cluster.memberPostIds.map((id) => ({ post: posts.get(id), metric: metrics.get(id) }))
    .filter((entry): entry is { post: AnalysisPost; metric: MetricAnalysis | undefined } => entry.post !== undefined);
  const selected = new Set<string>();
  const roles: Array<{ role: string; postId: string; why: string }> = [];
  const add = (role: string, postId: string | undefined, why: string): void => {
    if (postId === undefined || selected.has(postId) || roles.length >= 6) return;
    selected.add(postId);
    roles.push({ role, postId, why });
  };
  add('earliest', [...available].sort((left, right) =>
    (left.post.publishedAt ?? left.post.firstSeenAt).localeCompare(right.post.publishedAt ?? right.post.firstSeenAt))[0]?.post.id,
  'クラスタ内で最も早く観測した投稿');
  add('fastest_rising', [...available].sort((left, right) =>
    (right.metric?.velocityPerHour ?? -1) - (left.metric?.velocityPerHour ?? -1))[0]?.post.id,
  '有効な時系列観測で上昇速度が最大');
  const firstPlatform = available.find((entry) => selected.has(entry.post.id))?.post.platform;
  add('cross_platform', available.find((entry) => entry.post.platform !== firstPlatform)?.post.id,
    '発生元と異なる媒体で確認');
  add('counterexample', [...available].sort((left, right) =>
    (left.metric?.robustLiftScore ?? 50) - (right.metric?.robustLiftScore ?? 50))
    .find((entry) => (entry.metric?.robustLiftScore ?? 50) < 50)?.post.id,
  '構造は近いが通常値からの上振れが弱い反例');
  for (const entry of [...available].sort((left, right) =>
    (right.metric?.robustLiftScore ?? 0) - (left.metric?.robustLiftScore ?? 0))) {
    add('representative', entry.post.id, 'クラスタの代表証拠');
  }
  const insert = db.prepare(`
    INSERT INTO trend_evidence_posts (cluster_id, post_id, role, why_included, rank_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  roles.forEach((entry, index) => insert.run(cluster.id, entry.postId, entry.role, entry.why, index));
}

function saveFitScores(db: DatabaseSync, cluster: StoredCluster, evidence: ClusterEvidence, computedAt: string): void {
  const profiles = db.prepare('SELECT id, config_json FROM fit_profiles').all() as DbRow[];
  for (const profile of profiles) {
    const config = parseJson<{ platforms?: string[]; preferredFormatTags?: string[]; preferredDesireTags?: string[]; brandSafetyExcludedTags?: string[] }>(profile.config_json, {});
    const reproducibility = clamp(30 + Math.min(50, cluster.memberPostIds.length * 10) + (cluster.label.includes('unclassified') ? 0 : 20));
    const excluded = config.brandSafetyExcludedTags?.includes(cluster.label) ?? false;
    const brandFit = excluded ? 0 : (config.preferredFormatTags?.includes(cluster.label) || config.preferredDesireTags?.includes(cluster.label)) ? 90 : 60;
    const targetPlatforms = config.platforms ?? [];
    const matchedPlatforms = evidence.platforms.filter((platform) => targetPlatforms.includes(platform)).length;
    const audienceFit = targetPlatforms.length === 0 ? 60 : clamp(matchedPlatforms / targetPlatforms.length * 100);
    db.prepare(`
      INSERT INTO fit_scores (cluster_id, fit_profile_id, reproducibility_score, brand_fit_score, audience_fit_score, computed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(cluster_id, fit_profile_id) DO UPDATE SET
        reproducibility_score = excluded.reproducibility_score,
        brand_fit_score = excluded.brand_fit_score,
        audience_fit_score = excluded.audience_fit_score,
        computed_at = excluded.computed_at
    `).run(cluster.id, String(profile.id), reproducibility, brandFit, audienceFit, computedAt);
  }
}

export class LocalAnalysisEngine {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  run(now = new Date()): AnalysisSummary {
    const id = runId();
    const startedAt = now.toISOString();
    this.db.prepare(`INSERT INTO analysis_runs (id, started_at, status) VALUES (?, ?, 'started')`).run(id, startedAt);
    try {
      const config = loadConfig(this.db);
      const posts = loadPosts(this.db);
      const postMap = new Map(posts.map((post) => [post.id, post]));
      const features = new Map(posts.map((post) => [post.id, extractPostFeatures(post, config.embeddingDimensions)]));
      const metricAnalyses = analyzeMetrics(loadMetrics(this.db));
      const metricMap = new Map(metricAnalyses.map((metric) => [metric.postId, metric]));
      const clusters = buildClusters(features, config);
      const counts = { market_trend: 0, provisional: 0, team_interest: 0, insufficient_evidence: 0 };

      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`DELETE FROM clusters WHERE id IN (SELECT cluster_id FROM analysis_owned_clusters)`);
        const saveFeature = this.db.prepare(`
          INSERT INTO content_features (
            post_id, surface_features_json, format_features_json, desire_features_json,
            embedding_ref, classifier, confidence
          ) VALUES (?, ?, ?, ?, ?, 'heuristic', ?)
          ON CONFLICT(post_id) DO UPDATE SET
            surface_features_json = excluded.surface_features_json,
            format_features_json = excluded.format_features_json,
            desire_features_json = excluded.desire_features_json,
            embedding_ref = excluded.embedding_ref,
            classifier = excluded.classifier,
            confidence = excluded.confidence
        `);
        for (const post of posts) {
          const feature = features.get(post.id);
          if (feature === undefined) continue;
          const classifiedLayers = (['surface', 'format', 'desire'] as const)
            .filter((layer) => !feature[layer].labels.some((label) => label.includes('unclassified'))).length;
          saveFeature.run(
            post.id,
            JSON.stringify(feature.surface),
            JSON.stringify(feature.format),
            JSON.stringify(feature.desire),
            `local-hash-v1:${config.embeddingDimensions}`,
            0.4 + classifiedLayers * 0.15,
          );
        }
        const saveMetric = this.db.prepare(`
          INSERT INTO post_metric_analysis (
            post_id, metric_snapshot_id, baseline_scope, baseline_value, usual_value_ratio,
            robust_lift_score, velocity_per_hour, engagement_rate, computed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(post_id) DO UPDATE SET
            metric_snapshot_id = excluded.metric_snapshot_id,
            baseline_scope = excluded.baseline_scope,
            baseline_value = excluded.baseline_value,
            usual_value_ratio = excluded.usual_value_ratio,
            robust_lift_score = excluded.robust_lift_score,
            velocity_per_hour = excluded.velocity_per_hour,
            engagement_rate = excluded.engagement_rate,
            computed_at = excluded.computed_at
        `);
        for (const metric of metricAnalyses) saveMetric.run(
          metric.postId, metric.metricSnapshotId, metric.baselineScope, metric.baselineValue,
          metric.usualValueRatio, metric.robustLiftScore, metric.velocityPerHour, metric.engagementRate, startedAt,
        );
        for (const cluster of clusters) {
          this.db.prepare(`
            INSERT INTO clusters (id, layer, parent_cluster_id, label, novelty_candidate, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(cluster.id, cluster.layer, cluster.parentClusterId, cluster.label, cluster.memberPostIds.length < 3 ? 1 : 0, startedAt);
          this.db.prepare('INSERT INTO analysis_owned_clusters (cluster_id) VALUES (?)').run(cluster.id);
          for (const postId of cluster.memberPostIds) {
            const distance = 1 - (features.get(postId)?.[cluster.layer].vector.reduce(
              (sum, value, index) => sum + value * (cluster.centroid[index] ?? 0), 0,
            ) ?? 0);
            this.db.prepare(`INSERT INTO cluster_members (cluster_id, post_id, distance, added_at) VALUES (?, ?, ?, ?)`)
              .run(cluster.id, postId, distance, startedAt);
          }
        }
        for (const cluster of clusters) {
          const evidence = evidenceForCluster(this.db, cluster, postMap, metricMap);
          const scores = scoreCluster(evidence, config.biasWeights, config.trendGate, now);
          counts[scores.status] += 1;
          const scoreId = `score_${randomUUID().replaceAll('-', '')}`;
          this.db.prepare(`
            INSERT INTO trend_score_snapshots (
              id, cluster_id, observed_at, velocity_score, surprise_score, diffusion_score,
              cross_lane_score, cross_platform_score, engagement_score, freshness_score,
              universal_score, team_interest_score, evidence_count, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            scoreId, cluster.id, startedAt, scores.velocityScore, scores.surpriseScore,
            scores.diffusionScore, scores.crossLaneScore, scores.crossPlatformScore,
            scores.engagementScore, scores.freshnessScore, scores.universalScore,
            scores.teamInterestScore, cluster.memberPostIds.length, scores.confidence,
          );
          this.db.prepare(`
            INSERT INTO bias_audit_snapshots (
              id, cluster_id, observed_at, user_submitted_share, submitter_hhi,
              independent_confirmation_ratio, non_user_lane_count, independent_creator_count,
              bias_risk_score, bias_label, score_cap, explanation_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `bias_${randomUUID().replaceAll('-', '')}`, cluster.id, startedAt,
            scores.userSubmittedShare, scores.submitterHhi, scores.independentConfirmationRatio,
            scores.nonUserLaneCount, scores.independentCreatorCount, scores.biasRiskScore,
            scores.biasLabel, scores.scoreCap, JSON.stringify({
              weights: config.biasWeights,
              excludedTeamShares: evidence.humanCaptureCount,
              independentlyConfirmedPosts: evidence.independentlyConfirmedPostIds.length,
            }),
          );
          this.db.prepare(`
            INSERT INTO trend_assessments (
              cluster_id, analysis_run_id, status, gate_passed, independent_creator_count,
              non_user_lane_count, independently_confirmed_post_count, growing_post_count,
              excluded_team_share_count, explanation_json, computed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cluster.id, id, scores.status, scores.gatePassed ? 1 : 0,
            scores.independentCreatorCount, scores.nonUserLaneCount,
            evidence.independentlyConfirmedPostIds.length, evidence.growingPostCount,
            evidence.humanCaptureCount, JSON.stringify({
              gate: config.trendGate,
              biasLabel: scores.biasLabel,
              reason: scores.status === 'market_trend'
                ? '独立確認と広域トレンドゲートを通過'
                : scores.status === 'team_interest'
                  ? 'チーム内の関心と市場伝播を分離'
                  : '認定に必要な独立証拠が不足',
            }), startedAt,
          );
          saveEvidence(this.db, cluster, postMap, metricMap);
          saveFitScores(this.db, cluster, evidence, startedAt);
        }
        this.db.prepare(`
          UPDATE analysis_runs SET completed_at = ?, status = 'succeeded', post_count = ?, cluster_count = ? WHERE id = ?
        `).run(startedAt, posts.length, clusters.length, id);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
      return {
        runId: id,
        postCount: posts.length,
        clusterCount: clusters.length,
        marketTrendCount: counts.market_trend,
        provisionalCount: counts.provisional,
        teamInterestCount: counts.team_interest,
        insufficientEvidenceCount: counts.insufficient_evidence,
      };
    } catch (error) {
      this.db.prepare(`UPDATE analysis_runs SET completed_at = ?, status = 'failed', error_code = ? WHERE id = ?`)
        .run(new Date().toISOString(), error instanceof Error ? error.name : 'unknown_error', id);
      throw error;
    }
  }
}
