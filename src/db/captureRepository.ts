import { DEFAULT_BRAND_PROFILE, type BrandProfile } from '../analysis/jevClassifier.ts';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { normalizePostUrl } from '../domain/url.ts';
import { defaultSelectionMethod } from '../domain/validation.ts';
import type { YoutubeVideoMetadata } from '../connectors/youtube.ts';
import type { CaptureInput, NormalizedPostUrl, VisibleMetrics } from '../domain/types.ts';
import { AnalysisReadRepository, type TrendFilters, type VideoFilters } from '../analysis/readRepository.ts';
import { LocalAnalysisEngine } from '../analysis/engine.ts';

type PostRow = Record<string, string | number | null>;

export type CaptureResult = {
  captureId: string;
  postId: string;
  platform: string;
  deduplicated: boolean;
  metadataStatus: string;
  evidenceStatus: 'bias_audit_pending' | 'independent_confirmation_pending' | 'manual_review';
  saved: true;
  failureReason: string | null;
};

function prefixedId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

function rowToPost(row: PostRow): Record<string, unknown> {
  return {
    id: row.id,
    platform: row.platform,
    platformPostId: row.platform_post_id,
    canonicalUrl: row.canonical_url,
    creatorId: row.creator_id,
    publishedAt: row.published_at,
    caption: row.caption,
    durationMs: row.duration_ms,
    audioKey: row.audio_key,
    mediaType: row.media_type,
    firstSeenAt: row.first_seen_at,
    lastRefreshedAt: row.last_refreshed_at,
    accessTier: row.access_tier,
    metadataStatus: row.metadata_status,
    metadata: row.metadata_json === null ? null : JSON.parse(String(row.metadata_json)),
    linkStatus: row.link_status,
    lastLinkVerifiedAt: row.last_link_verified_at,
  };
}

function findPost(db: DatabaseSync, normalized: NormalizedPostUrl): PostRow | undefined {
  if (normalized.platformPostId !== null) {
    return db.prepare('SELECT * FROM posts WHERE platform = ? AND platform_post_id = ?')
      .get(normalized.platform, normalized.platformPostId) as PostRow | undefined;
  }
  return db.prepare('SELECT * FROM posts WHERE canonical_url = ?')
    .get(normalized.canonicalUrl) as PostRow | undefined;
}

function insertMetric(db: DatabaseSync, postId: string, metrics: VisibleMetrics, fallbackObservedAt: string): void {
  db.prepare(`
    INSERT INTO metric_snapshots (
      id, post_id, observed_at, view_count, like_count, comment_count,
      share_count, save_count, follower_count, data_source, confidence, score_eligible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    prefixedId('metric'), postId, metrics.observedAt ?? fallbackObservedAt,
    metrics.viewCount ?? null, metrics.likeCount ?? null, metrics.commentCount ?? null,
    metrics.shareCount ?? null, metrics.saveCount ?? null, metrics.followerCount ?? null,
    metrics.dataSource, metrics.confidence, metrics.dataSource === 'manual' ? 0 : 1,
  );
}

export class CaptureRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  capture(input: CaptureInput, now = new Date()): CaptureResult {
    const normalized = normalizePostUrl(input.url);
    const capturedAt = now.toISOString();
    const captureId = prefixedId('cap');
    const selectionMethod = input.selectionMethod ?? defaultSelectionMethod(input.captureChannel);
    let existing: PostRow | undefined;
    let postId: string;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      existing = findPost(this.db, normalized);
      postId = existing === undefined ? prefixedId('post') : String(existing.id);

      if (existing === undefined) {
        this.db.prepare(`
          INSERT INTO posts (
            id, platform, platform_post_id, canonical_url, media_type, first_seen_at,
            access_tier, metadata_status, metadata_json, link_status
          ) VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, 'active')
        `).run(
          postId,
          normalized.platform,
          normalized.platformPostId,
          normalized.canonicalUrl,
          normalized.mediaType,
          capturedAt,
          normalized.supported ? 'partial' : 'failed',
          JSON.stringify({ captureOnly: true }),
        );
      }

      this.db.prepare(`
        INSERT INTO capture_events (
          id, post_id, raw_url, captured_at, capture_channel, source_lane,
          selection_method, submitter_pseudonym, discovery_surface, reason, note,
          collector_context, processing_status, failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        captureId,
        postId,
        input.url,
        capturedAt,
        input.captureChannel,
        input.sourceLane,
        selectionMethod,
        input.submitterPseudonym ?? null,
        input.discoverySurface,
        input.reason ?? null,
        input.note ?? null,
        input.collectorContext ?? null,
        normalized.supported ? 'saved' : 'manual_review',
        normalized.failureReason,
      );

      if (input.visibleMetrics !== undefined && input.visibleMetrics !== null) {
        insertMetric(this.db, postId, input.visibleMetrics, capturedAt);
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    const metadataStatus = existing === undefined
      ? (normalized.supported ? 'partial' : 'failed')
      : String(existing.metadata_status);
    const evidenceStatus = !normalized.supported
      ? 'manual_review'
      : selectionMethod === 'user_shared'
        ? 'bias_audit_pending'
        : 'independent_confirmation_pending';

    return {
      captureId,
      postId,
      platform: normalized.platform,
      deduplicated: existing !== undefined,
      metadataStatus,
      evidenceStatus,
      saved: true,
      failureReason: normalized.failureReason,
    };
  }

  getPost(id: string): Record<string, unknown> | null {
    const post = this.db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
    if (post === undefined) return null;

    const captureEvents = this.db.prepare(`
      SELECT id, captured_at, capture_channel, source_lane, selection_method,
             submitter_pseudonym, discovery_surface, reason, note, collector_context,
             processing_status, failure_reason
      FROM capture_events WHERE post_id = ? ORDER BY captured_at ASC, id ASC
    `).all(id).map((row) => ({
      id: row.id,
      capturedAt: row.captured_at,
      captureChannel: row.capture_channel,
      sourceLane: row.source_lane,
      selectionMethod: row.selection_method,
      submitterPseudonym: row.submitter_pseudonym,
      discoverySurface: row.discovery_surface,
      reason: row.reason,
      note: row.note,
      collectorContext: row.collector_context,
      processingStatus: row.processing_status,
      failureReason: row.failure_reason,
    }));

    const metricSnapshots = this.db.prepare(`
      SELECT id, observed_at, view_count, like_count, comment_count, share_count,
             save_count, follower_count, data_source, confidence, score_eligible
      FROM metric_snapshots WHERE post_id = ? ORDER BY observed_at ASC, id ASC
    `).all(id).map((row) => ({
      id: row.id,
      observedAt: row.observed_at,
      viewCount: row.view_count,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      shareCount: row.share_count,
      saveCount: row.save_count,
      followerCount: row.follower_count,
      dataSource: row.data_source,
      confidence: row.confidence,
      scoreEligible: row.score_eligible === 1,
    }));

    const features = this.db.prepare('SELECT * FROM content_features WHERE post_id = ?').get(id);
    const clusters = this.db.prepare(`
      SELECT c.id, c.layer, c.parent_cluster_id, c.label, c.novelty_candidate,
             cm.distance, cm.added_at
      FROM cluster_members cm JOIN clusters c ON c.id = cm.cluster_id
      WHERE cm.post_id = ? ORDER BY c.layer, c.label
    `).all(id);

    return {
      post: rowToPost(post),
      captureEvents,
      metricSnapshots,
      contentFeatures: features ?? null,
      clusters,
    };
  }

  listTrends(filters: TrendFilters = {}): Record<string, unknown>[] {
    return new AnalysisReadRepository(this.db).listTrends(filters);
  }

  listVideos(filters: VideoFilters = {}): Record<string, unknown>[] {
    return new AnalysisReadRepository(this.db).listVideos(filters);
  }

  getTrend(id: string): Record<string, unknown> | null {
    return new AnalysisReadRepository(this.db).getTrend(id);
  }

  async generateJevBlueprintForTrend(id: string): Promise<Record<string, unknown> | null> {
    return new AnalysisReadRepository(this.db).generateJevBlueprintForTrend(id);
  }

  getOverview(): Record<string, unknown> {
    return new AnalysisReadRepository(this.db).getOverview();
  }

  getCoverage(): Record<string, unknown> {
    return new AnalysisReadRepository(this.db).getCoverage();
  }

  getAutomation(): Record<string, unknown> {
    return new AnalysisReadRepository(this.db).getAutomation();
  }

  runAnalysis(): Record<string, unknown> {
    return new LocalAnalysisEngine(this.db).run();
  }

  enrichYoutubePost(postId: string, metadata: YoutubeVideoMetadata, observedAt = new Date()): void {
    const timestamp = observedAt.toISOString();
    let creatorId: string | null = null;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (metadata.creator.platformCreatorId !== null) {
        const existingCreator = this.db.prepare(`
          SELECT id FROM creators WHERE platform = 'youtube' AND platform_creator_id = ?
        `).get(metadata.creator.platformCreatorId);
        creatorId = existingCreator === undefined ? prefixedId('creator') : String(existingCreator.id);
        if (existingCreator === undefined) {
          this.db.prepare(`
            INSERT INTO creators (
              id, platform, platform_creator_id, handle, profile_url, first_seen_at
            ) VALUES (?, 'youtube', ?, ?, ?, ?)
          `).run(
            creatorId,
            metadata.creator.platformCreatorId,
            metadata.creator.handle,
            metadata.creator.profileUrl,
            timestamp,
          );
        }
      }

      const update = this.db.prepare(`
        UPDATE posts
        SET creator_id = ?, published_at = ?, caption = ?, duration_ms = ?,
            last_refreshed_at = ?, access_tier = 'official_api', metadata_status = 'complete',
            metadata_json = ?
        WHERE id = ? AND platform = 'youtube'
      `).run(
        creatorId,
        metadata.publishedAt,
        metadata.caption,
        metadata.durationMs,
        timestamp,
        JSON.stringify(metadata.rawMetadata),
        postId,
      );
      if (update.changes !== 1) throw new Error('YouTube post not found for enrichment');

      insertMetric(this.db, postId, {
        observedAt: timestamp,
        ...metadata.metrics,
        dataSource: 'official_api',
        confidence: 1,
      }, timestamp);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  recordMetadataFailure(postId: string, captureId: string, failureReason: string): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(`
        UPDATE posts SET metadata_status = 'failed' WHERE id = ?
      `).run(postId);
      this.db.prepare(`
        UPDATE capture_events
        SET processing_status = 'metadata_failed', failure_reason = ?
        WHERE id = ? AND post_id = ?
      `).run(failureReason.slice(0, 256), captureId, postId);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  getBrandProfile(): Record<string, unknown> {
    const row = this.db.prepare('SELECT id, name, config_json FROM fit_profiles WHERE id = ?').get('active_brand_profile') as { id: string; name: string; config_json: string } | undefined;
    if (row && row.config_json) {
      try {
        return JSON.parse(row.config_json) as Record<string, unknown>;
      } catch {
        // fallback
      }
    }
    return DEFAULT_BRAND_PROFILE as unknown as Record<string, unknown>;
  }

  updateBrandProfile(profile: BrandProfile): Record<string, unknown> {
    const nowIso = new Date().toISOString();
    const configJson = JSON.stringify(profile);
    this.db.prepare(`
      INSERT INTO fit_profiles (id, name, config_json, created_at)
      VALUES ('active_brand_profile', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        config_json = excluded.config_json
    `).run(profile.name, configJson, nowIso);
    return profile as unknown as Record<string, unknown>;
  }

}
