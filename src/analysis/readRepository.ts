import type { DatabaseSync } from 'node:sqlite';
import { JevClassifier, type JevAnalysisResult, type BrandProfile, DEFAULT_BRAND_PROFILE } from './jevClassifier.ts';
import { enrichVideoInformation, type EnrichedVideoInfo } from './videoEnrichment.ts';

type Row = Record<string, string | number | null>;

export type TrendFilters = {
  layer?: 'surface' | 'format' | 'desire';
  platform?: string;
  sourceLane?: string;
  minimumConfidence?: number;
};

export type VideoFilters = {
  template?: string;
  category?: string;
  platform?: string;
  q?: string;
};

function parseJson(raw: string | number | null | undefined): unknown {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export type GenreInfo = {
  key: string;
  label: string;
};

const GENRE_RULES: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: 'entertainment', label: '🎭 エンタメ・あるある', patterns: [/あるある|笑|コント|やってみた|ドッキリ|検証|アニメ|ゲーム|vtuber|hikakin|masuo|マスオ|ヒカキン|企画|リアクション/iu] },
  { key: 'cooking', label: '🍳 料理・グルメ', patterns: [/料理|レシピ|ご飯|飯|うまい|美味しい|スイーツ|カフェ|グルメ|夜食|弁当|自炊|居酒屋|時短飯|ズボラ飯/iu] },
  { key: 'beauty', label: '💄 美容・コスメ', patterns: [/美容|コスメ|メイク|スキンケア|垢抜け|プチプラ|ヘア|髪型|香水|ネイル|ファッション|コーデ|ビフォー|アフター/iu] },
  { key: 'how_to_learning', label: '📚 ノウハウ・解説', patterns: [/how[ -]?to|解説|コツ|手順|方法|仕事|就活|転職|副業|英語|勉強|資格|ai|マーケ|自己投資|ノウハウ|裏技|失敗|損/iu] },
  { key: 'lifestyle', label: '🌿 暮らし・Vlog', patterns: [/ルーティン|暮らし|同棲|購入品|一人暮らし|vlog|部屋|インテリア|日常|モーニング/iu] },
  { key: 'gadget_review', label: '📦 ガジェット・便利グッズ', patterns: [/ガジェット|便利グッズ|レビュー|amazon|百均|ダイソー|セリア|無印|ヨドバシ|家電|買ってよかった|アイテム/iu] },
];

export function detectGenre(text: string): GenreInfo {
  for (const rule of GENRE_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return { key: rule.key, label: rule.label };
    }
  }
  return { key: 'general', label: '💡 トレンド・カルチャー' };
}

const TEMPLATE_NAMES: Record<string, string> = {
  'aruaru': '🎭 【日常あるある型】共感とシェアで伸ばす学生あるある構成',
  'shortcut_hack': '⚡ 【裏技・神時短型】作業効率を劇的改善するツール・操作構成',
  'failure_first': '⚠️ 【失敗先出し型】「9割が損してる」損失回避フック構成',
  'how_to': '📚 【手順解説型】保存率特化のHow-to構成',
  'list': '🏆 【まとめ・BEST型】保存・見返しを促すリスト構成',
  'three_cuts': '⚡ 【3ステップ解決型】結論先出しで離脱を防ぐ構成',
  'routine': '🌿 【ルーティン型】世界観と日常感で引き込むVlog構成',
  'gourmet_recipe': '🍳 【悪魔の時短飯型】シズル感先行・手軽さで保存させる構成',
  'before_after': '💄 【劇的変身型】ビフォーアフター実演構成',
  'gadget_review': '📦 【生活激変ガジェット型】日常プチストレス解消構成',
  'reaction': '💥 【検証・リアクション型】好奇心刺激・オチ重視構成',
  'question_hook': '❓ 【疑問・問いかけ型】冒頭離脱を防ぐクイズ構成',
  'story': '📖 【ストーリー密着型】感情移入で完全視聴させる構成',
  'perspective_flip': '🔄 【視点反転・オチ型】予想を裏切るどんでん返し構成',
  'comment_driven': '💬 【コメント欄誘導型】議論・共感を巻き起こす参加型構成',
  'unclassified': '🎬 【一般構成型】標準的なショート動画構成',
};

function humanReadableLabel(layer: string, rawLabel: string): string {
  const clean = rawLabel.replace(/^(surface|format|desire):/, '');
  if (layer === 'format') {
    if (TEMPLATE_NAMES[clean]) return TEMPLATE_NAMES[clean];
    if (TEMPLATE_NAMES[rawLabel]) return TEMPLATE_NAMES[rawLabel];
    return `🎬 【${clean}型】注目ショート構成`;
  }
  if (rawLabel.startsWith('#')) return `${rawLabel} 注目トレンド`;
  if (clean === 'unclassified') {
    return layer === 'surface' ? '注目キーワード' : '気軽な共感・追体験欲求';
  }
  return clean;
}

export class AnalysisReadRepository {
  private readonly db: DatabaseSync;
  private readonly jev = new JevClassifier();

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  listTrends(filters: TrendFilters = {}): Record<string, unknown>[] {
    const clauses = ['1 = 1'];
    const parameters: Array<string | number> = [];

    if (filters.layer !== undefined) {
      clauses.push('c.layer = ?');
      parameters.push(filters.layer);
    }

    if (filters.minimumConfidence !== undefined) {
      clauses.push('ts.confidence >= ?');
      parameters.push(filters.minimumConfidence);
    }
    if (filters.platform !== undefined) {
      clauses.push(`EXISTS (
        SELECT 1 FROM cluster_members fcm JOIN posts fp ON fp.id = fcm.post_id
        WHERE fcm.cluster_id = c.id AND fp.platform = ?
      )`);
      parameters.push(filters.platform);
    }
    if (filters.sourceLane !== undefined) {
      clauses.push(`EXISTS (
        SELECT 1 FROM cluster_members fcm JOIN capture_events fce ON fce.post_id = fcm.post_id
        WHERE fcm.cluster_id = c.id AND fce.source_lane = ?
      )`);
      parameters.push(filters.sourceLane);
    }

    const rows = this.db.prepare(`
      SELECT c.id, c.layer, c.parent_cluster_id, c.label, c.novelty_candidate,
             ts.universal_score, ts.team_interest_score, ts.evidence_count, ts.confidence,
             ts.velocity_score, ts.surprise_score, ts.diffusion_score, ts.cross_lane_score,
             ts.cross_platform_score, ts.engagement_score, ts.freshness_score,
             ta.status, ta.gate_passed, ta.independent_creator_count,
             ta.non_user_lane_count, ta.excluded_team_share_count,
             ba.bias_risk_score, ba.bias_label, ba.independent_confirmation_ratio,
             (SELECT cr.handle FROM cluster_members cm JOIN posts p ON p.id = cm.post_id LEFT JOIN creators cr ON cr.id = p.creator_id WHERE cm.cluster_id = c.id AND cr.handle IS NOT NULL LIMIT 1) AS representative_creator,
             (SELECT p.caption FROM cluster_members cm JOIN posts p ON p.id = cm.post_id WHERE cm.cluster_id = c.id AND p.caption IS NOT NULL AND p.caption <> '' LIMIT 1) AS sample_caption,
             (SELECT p.platform FROM cluster_members cm JOIN posts p ON p.id = cm.post_id WHERE cm.cluster_id = c.id LIMIT 1) AS sample_platform,
             (SELECT pma.usual_value_ratio FROM cluster_members cm JOIN post_metric_analysis pma ON pma.post_id = cm.post_id WHERE cm.cluster_id = c.id AND pma.usual_value_ratio IS NOT NULL LIMIT 1) AS sample_usual_ratio
      FROM clusters c
      JOIN analysis_owned_clusters aoc ON aoc.cluster_id = c.id
      JOIN trend_score_snapshots ts ON ts.cluster_id = c.id
      JOIN trend_assessments ta ON ta.cluster_id = c.id
      JOIN bias_audit_snapshots ba ON ba.cluster_id = c.id
      WHERE ${clauses.join(' AND ')}
      ORDER BY CASE ta.status WHEN 'market_trend' THEN 0 WHEN 'provisional' THEN 1
               WHEN 'team_interest' THEN 2 ELSE 3 END,
               ts.universal_score DESC, ts.team_interest_score DESC, c.id
    `).all(...parameters) as Row[];

    const mapped = rows.map((row) => {
      const sampleText = `${row.label} ${row.sample_caption ?? ''}`;
      const genre = detectGenre(sampleText);
      const ratio = typeof row.sample_usual_ratio === 'number' ? row.sample_usual_ratio : 1;
      const liftText = ratio > 1 ? `通常の${ratio.toFixed(1)}倍` : '急上昇中';
      const statusLabel = row.status === 'market_trend'
        ? '🔥 SNS全体で急上昇'
        : row.status === 'team_interest'
        ? '👀 チーム注目（要検証）'
        : '🌱 萌芽トレンド';

      return {
        id: row.id,
        layer: row.layer,
        parentClusterId: row.parent_cluster_id,
        label: row.label,
        displayLabel: humanReadableLabel(String(row.layer), String(row.label)),
        genre: genre.label,
        genreKey: genre.key,
        buzzLiftText: liftText,
        statusLabel,
        representativeCreator: row.representative_creator ? String(row.representative_creator) : null,
        sampleCaption: row.sample_caption ? String(row.sample_caption).slice(0, 120) : null,
        samplePlatform: row.sample_platform ? String(row.sample_platform) : null,
        noveltyCandidate: row.novelty_candidate === 1,
        status: row.status,
        gatePassed: row.gate_passed === 1,
        universalScore: row.universal_score,
        teamInterestScore: row.team_interest_score,
        evidenceCount: row.evidence_count,
        independentCreatorCount: row.independent_creator_count,
        nonUserLaneCount: row.non_user_lane_count,
        confidence: row.confidence,
        biasAudit: {
          riskScore: row.bias_risk_score,
          label: row.bias_label,
          independentConfirmationRatio: row.independent_confirmation_ratio,
          excludedTeamShares: row.excluded_team_share_count,
        },
        scoreComponents: {
          velocity: row.velocity_score,
          surprise: row.surprise_score,
          diffusion: row.diffusion_score,
          crossLane: row.cross_lane_score,
          crossPlatform: row.cross_platform_score,
          engagement: row.engagement_score,
          freshness: row.freshness_score,
        },
      };
    });

    // Group / deduplicate by displayLabel when layer is 'format' so there are ZERO duplicate templates in the ranking!
    if (filters.layer === 'format') {
      const seen = new Map<string, (typeof mapped)[0]>();
      for (const item of mapped) {
        const existing = seen.get(item.displayLabel);
        if (existing === undefined) {
          seen.set(item.displayLabel, { ...item });
        } else {
          existing.evidenceCount = (Number(existing.evidenceCount) || 1) + (Number(item.evidenceCount) || 1);
          existing.independentCreatorCount = Math.max(Number(existing.independentCreatorCount) || 1, Number(item.independentCreatorCount) || 1);
          if (item.status === 'market_trend') existing.status = 'market_trend';
          else if (item.status === 'provisional' && existing.status !== 'market_trend') existing.status = 'provisional';
        }
      }
      return [...seen.values()];
    }

    return mapped;
  }

  getTrend(id: string): Record<string, unknown> | null {
    const cluster = this.db.prepare('SELECT layer, label FROM clusters WHERE id = ?').get(id) as Row | undefined;
    if (cluster === undefined) return null;
    const summary = this.listTrends({ layer: cluster.layer as 'surface' | 'format' | 'desire' }).find((trend) => trend.id === id);
    if (summary === undefined) return null;

    const audit = this.db.prepare(`
      SELECT user_submitted_share, submitter_hhi, independent_confirmation_ratio,
             non_user_lane_count, independent_creator_count, bias_risk_score,
             bias_label, score_cap, explanation_json
      FROM bias_audit_snapshots WHERE cluster_id = ? ORDER BY observed_at DESC LIMIT 1
    `).get(id) as Row | undefined;
    const assessment = this.db.prepare(`
      SELECT status, gate_passed, independently_confirmed_post_count, growing_post_count,
             excluded_team_share_count, explanation_json
      FROM trend_assessments WHERE cluster_id = ?
    `).get(id) as Row | undefined;
    const features = this.db.prepare(`
      SELECT cf.surface_features_json, cf.format_features_json, cf.desire_features_json
      FROM cluster_members cm JOIN content_features cf ON cf.post_id = cm.post_id
      WHERE cm.cluster_id = ?
    `).all(id) as Row[];
    const evidence = this.db.prepare(`
      SELECT tep.role, tep.why_included, tep.rank_order,
             p.id, p.platform, p.canonical_url, p.creator_id, p.published_at,
             p.caption, p.duration_ms, p.media_type,
             cr.handle AS creator_handle, cr.profile_url AS creator_profile_url,
             p.link_status, p.last_link_verified_at,
             pma.usual_value_ratio, pma.robust_lift_score, pma.velocity_per_hour,
             ms.observed_at, ms.view_count, ms.like_count, ms.comment_count,
             ce.source_lane, ms.data_source
      FROM trend_evidence_posts tep
      JOIN posts p ON p.id = tep.post_id
      LEFT JOIN creators cr ON cr.id = p.creator_id
      LEFT JOIN post_metric_analysis pma ON pma.post_id = p.id
      LEFT JOIN metric_snapshots ms ON ms.id = pma.metric_snapshot_id
      LEFT JOIN capture_events ce ON ce.id = (
        SELECT ce2.id FROM capture_events ce2 WHERE ce2.post_id = p.id ORDER BY ce2.captured_at LIMIT 1
      )
      WHERE tep.cluster_id IN (
        SELECT id FROM clusters WHERE layer = ? AND label = ?
      )
      ORDER BY tep.rank_order, ms.view_count DESC
    `).all(cluster.layer, cluster.label) as Row[];
    const fitScores = this.db.prepare(`
      SELECT fp.id, fp.name, fs.reproducibility_score, fs.brand_fit_score,
             fs.audience_fit_score, fs.computed_at
      FROM fit_scores fs JOIN fit_profiles fp ON fp.id = fs.fit_profile_id
      WHERE fs.cluster_id = ? ORDER BY fp.name
    `).all(id) as Row[];

    const rawLabel = String(cluster?.label ?? '');
    const layer = String(cluster?.layer ?? '');
    const genre = detectGenre(`${rawLabel} ${summary.sampleCaption ?? ''}`);

    // Active brand context
    const profileRow = this.db.prepare('SELECT config_json FROM fit_profiles WHERE id = ?').get('active_brand_profile') as { config_json: string } | undefined;
    let activeBrand: BrandProfile = DEFAULT_BRAND_PROFILE;
    if (profileRow?.config_json) {
      try {
        activeBrand = JSON.parse(profileRow.config_json);
      } catch {}
    }

    // Generate actionable blueprint via JevClassifier (local or AI)
    const jevResult: JevAnalysisResult = this.jev.generateMarketingBlueprintSync({
      caption: String(summary.sampleCaption ?? ''),
      genre: genre.label,
      label: rawLabel,
      brandProfile: activeBrand,
    });

    return {
      ...summary,
      displayLabel: humanReadableLabel(layer, rawLabel),
      genre: genre.label,
      genreKey: genre.key,
      actionableAdvice: {
        recommendedHook: jevResult.hookIdea,
        recommendedStructure: jevResult.scriptOutline,
        targetPsychology: jevResult.viewerPsychology,
        recommendedDuration: jevResult.recommendedDuration,
        hitReason: jevResult.hitReason,
        adaptationTheme: jevResult.adaptationTheme,
        filmingTips: jevResult.filmingTips,
        source: jevResult.source,
      },
      jevBlueprint: jevResult,
      hierarchy: { layer: cluster?.layer, label: cluster?.label },
      threeLayerFeatures: {
        surface: features.map((row) => parseJson(row.surface_features_json)),
        format: features.map((row) => parseJson(row.format_features_json)),
        desire: features.map((row) => parseJson(row.desire_features_json)),
      },
      biasAudit: audit === undefined ? null : {
        userSubmittedShare: audit.user_submitted_share,
        submitterHhi: audit.submitter_hhi,
        independentConfirmationRatio: audit.independent_confirmation_ratio,
        nonUserLaneCount: audit.non_user_lane_count,
        independentCreatorCount: audit.independent_creator_count,
        riskScore: audit.bias_risk_score,
        label: audit.bias_label,
        scoreCap: audit.score_cap,
        explanation: parseJson(audit.explanation_json),
        excludedTeamShares: assessment?.excluded_team_share_count,
      },
      assessment: assessment === undefined ? null : {
        status: assessment.status,
        gatePassed: assessment.gate_passed === 1,
        independentlyConfirmedPostCount: assessment.independently_confirmed_post_count,
        growingPostCount: assessment.growing_post_count,
        explanation: parseJson(assessment.explanation_json),
      },
      evidencePosts: (() => {
        const seenPosts = new Set<string>();
        const uniqueEvidence: Row[] = [];
        for (const row of evidence) {
          if (row.id !== null && !seenPosts.has(String(row.id))) {
            seenPosts.add(String(row.id));
            uniqueEvidence.push(row);
          }
        }
        return uniqueEvidence.map((row) => {
          const postText = `${row.caption ?? ''} ${row.creator_handle ?? ''}`;
          const postGenre = detectGenre(postText);
          const enriched = enrichVideoInformation({
            caption: row.caption ? String(row.caption) : null,
            creatorHandle: row.creator_handle ? String(row.creator_handle) : null,
            platform: row.platform ? String(row.platform) : null,
            url: row.canonical_url ? String(row.canonical_url) : null,
            rawLabel,
          });
          return {
            role: row.role,
            whyIncluded: row.why_included,
            postId: row.id,
            platform: row.platform,
            genre: postGenre.label,
            genreKey: postGenre.key,
            canonicalUrl: row.canonical_url,
            creatorId: row.creator_id,
            creatorHandle: row.creator_handle ? String(row.creator_handle) : 'クリエイター',
            creatorProfileUrl: row.creator_profile_url ? String(row.creator_profile_url) : null,
            caption: row.caption ? String(row.caption) : null,
            title: enriched.title,
            hook: enriched.hook,
            conceptSummary: enriched.conceptSummary,
            studentAppeal: enriched.studentAppeal,
            templateKey: enriched.templateKey,
            templateLabel: enriched.templateLabel,
            studentCategory: enriched.studentCategory,
            studentCategoryLabel: enriched.studentCategoryLabel,
            actionableArrangement: enriched.actionableArrangement,
            timelineOutline: enriched.timelineOutline,
            selfHook: enriched.selfHook,
            selfScriptOutline: enriched.selfScriptOutline,
            filmingTips: enriched.filmingTips,
            hitReason: enriched.hitReason,
            durationSeconds: typeof row.duration_ms === 'number' ? Math.round(row.duration_ms / 1000) : null,
            publishedAt: row.published_at,
            linkStatus: row.link_status,
            lastVerifiedAt: row.last_link_verified_at,
            sourceLane: row.source_lane,
            dataSource: row.data_source,
            observedAt: row.observed_at,
            viewCount: row.view_count,
            likeCount: row.like_count,
            commentCount: row.comment_count,
            usualValueRatio: row.usual_value_ratio,
            robustLiftScore: row.robust_lift_score,
            velocityPerHour: row.velocity_per_hour,
          };
        });
    })(),
    fitScores: fitScores.map((row) => ({
        profileId: row.id,
        profileName: row.name,
        reproducibilityScore: row.reproducibility_score,
        brandFitScore: row.brand_fit_score,
        audienceFitScore: row.audience_fit_score,
        computedAt: row.computed_at,
      })),
    };
  }

  async generateJevBlueprintForTrend(id: string, brandProfile?: BrandProfile): Promise<JevAnalysisResult | null> {
    const trend = this.getTrend(id);
    if (!trend) return null;
    const activeProfile = brandProfile ?? this.getBrandProfile() as unknown as BrandProfile;
    return this.jev.generateMarketingBlueprint({
      caption: String(trend.sampleCaption ?? ''),
      creator: String(trend.representativeCreator ?? ''),
      platform: String(trend.samplePlatform ?? 'youtube'),
      genre: String(trend.genre ?? 'エンタメ'),
      brandProfile: activeProfile,
    });
  }

  getBrandProfile(): Record<string, unknown> {
    const row = this.db.prepare('SELECT id, name, config_json FROM fit_profiles WHERE id = ?').get('active_brand_profile') as { id: string; name: string; config_json: string } | undefined;
    if (row?.config_json) {
      try {
        return JSON.parse(row.config_json) as Record<string, unknown>;
      } catch {}
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

  getOverview(): Record<string, unknown> {
    const trends = this.listTrends();
    const totalClusters = trends.length;
    let marketTrendCount = 0;
    let provisionalCount = 0;
    let teamInterestCount = 0;
    let insufficientEvidenceCount = 0;
    let confidenceSum = 0;

    for (const t of trends) {
      if (t.status === 'market_trend') marketTrendCount += 1;
      else if (t.status === 'provisional') provisionalCount += 1;
      else if (t.status === 'team_interest') teamInterestCount += 1;
      else insufficientEvidenceCount += 1;
      confidenceSum += typeof t.confidence === 'number' ? t.confidence : 0;
    }

    const postRow = this.db.prepare('SELECT COUNT(*) AS total FROM posts').get() as Row | undefined;
    const totalPosts = Number(postRow?.total ?? 0);

    const captured24hRow = this.db.prepare(`
      SELECT COUNT(*) AS total FROM capture_events
      WHERE captured_at >= datetime('now', '-24 hours')
    `).get() as Row | undefined;
    const captured24h = Number(captured24hRow?.total ?? 0);

    const creatorsRow = this.db.prepare('SELECT COUNT(*) AS total FROM creators').get() as Row | undefined;
    const totalCreators = Number(creatorsRow?.total ?? 0);

    const lastRunRow = this.db.prepare(`
      SELECT id, started_at, completed_at, status, post_count, cluster_count
      FROM analysis_runs ORDER BY started_at DESC LIMIT 1
    `).get() as Row | undefined;

    return {
      totalClusters,
      marketTrendCount,
      provisionalCount,
      teamInterestCount,
      insufficientEvidenceCount,
      totalPosts,
      captured24h,
      totalCreators,
      averageConfidence: totalClusters > 0 ? Math.round((confidenceSum / totalClusters) * 100) / 100 : 0,
      lastAnalysis: lastRunRow ? {
        id: lastRunRow.id,
        startedAt: lastRunRow.started_at,
        completedAt: lastRunRow.completed_at,
        status: lastRunRow.status,
        postCount: lastRunRow.post_count,
        clusterCount: lastRunRow.cluster_count,
      } : null,
    };
  }

  getCoverage(): Record<string, unknown> {
    const totalCapturesRow = this.db.prepare('SELECT COUNT(*) AS total FROM capture_events').get() as Row | undefined;
    const totalCaptures = Number(totalCapturesRow?.total ?? 0);

    const laneRows = this.db.prepare(`
      SELECT source_lane, COUNT(*) AS count
      FROM capture_events GROUP BY source_lane ORDER BY count DESC
    `).all() as Row[];

    const laneLabels: Record<string, string> = {
      personalized: 'Personalized',
      fixed_panel: 'Fixed Panel',
      broad: 'Broad Discovery',
      external: 'External Baseline',
    };

    const laneDistribution = ['personalized', 'fixed_panel', 'broad', 'external'].map((laneKey) => {
      const found = laneRows.find((r) => r.source_lane === laneKey);
      const count = Number(found?.count ?? 0);
      return {
        lane: laneKey,
        label: laneLabels[laneKey] ?? laneKey,
        count,
        ratio: totalCaptures > 0 ? Math.round((count / totalCaptures) * 1000) / 10 : 0,
      };
    });

    const platformRows = this.db.prepare(`
      SELECT platform, COUNT(*) AS count
      FROM posts GROUP BY platform ORDER BY count DESC
    `).all() as Row[];

    const totalPostsRow = this.db.prepare('SELECT COUNT(*) AS total FROM posts').get() as Row | undefined;
    const totalPosts = Number(totalPostsRow?.total ?? 0);

    const platformLabels: Record<string, string> = {
      youtube: 'YouTube Shorts',
      instagram: 'Instagram Reels',
      tiktok: 'TikTok',
    };

    const platformDistribution = ['youtube', 'instagram', 'tiktok'].map((platKey) => {
      const found = platformRows.find((r) => r.platform === platKey);
      const count = Number(found?.count ?? 0);
      return {
        platform: platKey,
        label: platformLabels[platKey] ?? platKey,
        count,
        ratio: totalPosts > 0 ? Math.round((count / totalPosts) * 1000) / 10 : 0,
      };
    });

    const creatorCountRows = this.db.prepare(`
      SELECT c.handle, p.platform, COUNT(p.id) AS post_count
      FROM posts p
      LEFT JOIN creators c ON c.id = p.creator_id
      GROUP BY p.creator_id, p.platform
      ORDER BY post_count DESC
      LIMIT 10
    `).all() as Row[];

    const totalCreatorsRow = this.db.prepare('SELECT COUNT(*) AS total FROM creators').get() as Row | undefined;
    const totalCreators = Number(totalCreatorsRow?.total ?? 0);

    const top10PostCount = creatorCountRows.reduce((sum, r) => sum + Number(r.post_count ?? 0), 0);
    const top10Ratio = totalPosts > 0 ? Math.round((top10PostCount / totalPosts) * 1000) / 10 : 0;

    const dailyRows = this.db.prepare(`
      SELECT SUBSTR(captured_at, 1, 10) AS day, COUNT(*) AS count
      FROM capture_events
      GROUP BY day
      ORDER BY day DESC
      LIMIT 7
    `).all() as Row[];

    const laneWarnings: string[] = [];
    for (const lane of laneDistribution) {
      if (lane.count === 0) {
        laneWarnings.push(`${lane.label} レーンの観測データが0件です。観測の偏りに注意してください。`);
      }
    }

    return {
      totalCaptures,
      totalPosts,
      laneDistribution,
      platformDistribution,
      creatorConcentration: {
        totalCreators,
        top10PostCount,
        top10Ratio,
        topCreators: creatorCountRows.map((r) => ({
          handle: r.handle ? String(r.handle) : null,
          platform: String(r.platform),
          postCount: Number(r.post_count ?? 0),
        })),
      },
      dailyActivity: dailyRows.reverse().map((r) => ({
        date: String(r.day),
        count: Number(r.count ?? 0),
      })),
      laneWarnings,
    };
  }

  getAutomation(): Record<string, unknown> {
    const executedWritesRow = this.db.prepare(`
      SELECT COALESCE(SUM(executed_write_count), 0) AS executed_writes,
             COALESCE(SUM(blocked_write_attempt_count), 0) AS blocked_writes
      FROM automation_runs
    `).get() as Row | undefined;

    const auditCountRow = this.db.prepare('SELECT COUNT(*) AS total FROM automation_audit_events').get() as Row | undefined;

    const recentAuditEvents = this.db.prepare(`
      SELECT id, run_id, occurred_at, operation, target_url, attempted_write, executed_write
      FROM automation_audit_events
      ORDER BY occurred_at DESC
      LIMIT 10
    `).all() as Row[];

    const latestIgRun = this.db.prepare(`
      SELECT id, started_at, completed_at, status, observed_count, saved_count, duplicate_count, error_code
      FROM automation_runs WHERE platform = 'instagram' ORDER BY started_at DESC LIMIT 1
    `).get() as Row | undefined;

    const latestTiktokRun = this.db.prepare(`
      SELECT id, started_at, completed_at, status, observed_count, saved_count, duplicate_count, error_code
      FROM automation_runs WHERE platform = 'tiktok' ORDER BY started_at DESC LIMIT 1
    `).get() as Row | undefined;

    const todayStr = new Date().toISOString().slice(0, 10);
    const quotaRow = this.db.prepare(`
      SELECT units_used FROM api_quota_daily WHERE connector = 'youtube' AND usage_date = ?
    `).get(todayStr) as Row | undefined;
    const youtubeUnitsUsed = Number(quotaRow?.units_used ?? 0);

    const latestYoutubeRun = this.db.prepare(`
      SELECT started_at, status, quota_units, error_code
      FROM connector_runs WHERE connector = 'youtube' ORDER BY started_at DESC LIMIT 1
    `).get() as Row | undefined;

    const latestSlackRun = this.db.prepare(`
      SELECT started_at, status, error_code
      FROM connector_runs WHERE connector = 'slack' ORDER BY started_at DESC LIMIT 1
    `).get() as Row | undefined;

    const recentRuns = this.db.prepare(`
      SELECT id, platform, target_url, source_lane, started_at, status, observed_count, saved_count, duplicate_count, error_code
      FROM automation_runs ORDER BY started_at DESC LIMIT 10
    `).all() as Row[];

    return {
      macStatus: {
        online: true,
        lastActiveAt: new Date().toISOString(),
      },
      safetyAudit: {
        executedWriteCount: Number(executedWritesRow?.executed_writes ?? 0),
        blockedWriteAttemptCount: Number(executedWritesRow?.blocked_writes ?? 0),
        totalAuditEvents: Number(auditCountRow?.total ?? 0),
        verifiedSafe: Number(executedWritesRow?.executed_writes ?? 0) === 0,
        recentAuditEvents: recentAuditEvents.map((r) => ({
          id: r.id,
          runId: r.run_id,
          occurredAt: r.occurred_at,
          operation: r.operation,
          targetUrl: r.target_url,
          attemptedWrite: r.attempted_write === 1,
          executedWrite: r.executed_write ?? 0,
        })),
      },
      crawlers: {
        instagram: latestIgRun ? {
          id: latestIgRun.id,
          status: latestIgRun.status,
          startedAt: latestIgRun.started_at,
          completedAt: latestIgRun.completed_at,
          observedCount: latestIgRun.observed_count,
          savedCount: latestIgRun.saved_count,
          duplicateCount: latestIgRun.duplicate_count,
          errorCode: latestIgRun.error_code,
        } : null,
        tiktok: latestTiktokRun ? {
          id: latestTiktokRun.id,
          status: latestTiktokRun.status,
          startedAt: latestTiktokRun.started_at,
          completedAt: latestTiktokRun.completed_at,
          observedCount: latestTiktokRun.observed_count,
          savedCount: latestTiktokRun.saved_count,
          duplicateCount: latestTiktokRun.duplicate_count,
          errorCode: latestTiktokRun.error_code,
        } : null,
      },
      connectors: {
        youtube: {
          status: latestYoutubeRun ? String(latestYoutubeRun.status) : 'configured',
          dailyUnitsUsed: youtubeUnitsUsed,
          dailyQuotaLimit: 8000,
          quotaRatio: Math.round((youtubeUnitsUsed / 8000) * 1000) / 10,
          lastRunAt: latestYoutubeRun ? String(latestYoutubeRun.started_at) : null,
        },
        slack: {
          status: latestSlackRun ? String(latestSlackRun.status) : 'active',
          lastRunAt: latestSlackRun ? String(latestSlackRun.started_at) : null,
        },
      },
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        platform: r.platform,
        targetUrl: r.target_url,
        sourceLane: r.source_lane,
        status: r.status,
        startedAt: r.started_at,
        observedCount: r.observed_count,
        savedCount: r.saved_count,
        duplicateCount: r.duplicate_count,
        errorCode: r.error_code,
      })),
    };
  }

  listVideos(filters: VideoFilters = {}): Record<string, unknown>[] {
    const rows = this.db.prepare(`
      SELECT p.id, p.platform, p.canonical_url, p.creator_id, p.published_at,
             p.caption, p.duration_ms, p.media_type,
             cr.handle AS creator_handle, cr.profile_url AS creator_profile_url,
             pma.usual_value_ratio, pma.robust_lift_score, pma.velocity_per_hour,
             ms.view_count, ms.like_count, ms.comment_count,
             (SELECT c.id FROM cluster_members cm JOIN clusters c ON c.id = cm.cluster_id WHERE cm.post_id = p.id AND c.layer = 'format' LIMIT 1) AS format_cluster_id,
             (SELECT c.label FROM cluster_members cm JOIN clusters c ON c.id = cm.cluster_id WHERE cm.post_id = p.id AND c.layer = 'format' LIMIT 1) AS format_label
      FROM posts p
      LEFT JOIN creators cr ON cr.id = p.creator_id
      LEFT JOIN post_metric_analysis pma ON pma.post_id = p.id
      LEFT JOIN metric_snapshots ms ON ms.id = pma.metric_snapshot_id
      ORDER BY COALESCE(ms.view_count, 0) DESC, p.first_seen_at DESC
    `).all() as Row[];

    const videos = rows.map((row) => {
      const enriched = enrichVideoInformation({
        caption: row.caption ? String(row.caption) : null,
        creatorHandle: row.creator_handle ? String(row.creator_handle) : null,
        platform: row.platform ? String(row.platform) : null,
        url: row.canonical_url ? String(row.canonical_url) : null,
        rawLabel: row.format_label ? String(row.format_label) : null,
      });

      return {
        id: row.id,
        platform: row.platform,
        canonicalUrl: row.canonical_url,
        creatorHandle: row.creator_handle ? String(row.creator_handle) : 'クリエイター',
        creatorProfileUrl: row.creator_profile_url ? String(row.creator_profile_url) : null,
        caption: row.caption ? String(row.caption) : null,
        title: enriched.title,
        hook: enriched.hook,
        conceptSummary: enriched.conceptSummary,
        studentAppeal: enriched.studentAppeal,
        templateKey: enriched.templateKey,
        templateLabel: enriched.templateLabel,
        studentCategory: enriched.studentCategory,
        studentCategoryLabel: enriched.studentCategoryLabel,
        actionableArrangement: enriched.actionableArrangement,
        timelineOutline: enriched.timelineOutline,
        selfHook: enriched.selfHook,
        selfScriptOutline: enriched.selfScriptOutline,
        filmingTips: enriched.filmingTips,
        hitReason: enriched.hitReason,
        formatClusterId: row.format_cluster_id ?? null,
        durationSeconds: typeof row.duration_ms === 'number' ? Math.round(row.duration_ms / 1000) : null,
        viewCount: row.view_count ?? null,
        likeCount: row.like_count ?? null,
        commentCount: row.comment_count ?? null,
        usualValueRatio: row.usual_value_ratio ?? null,
        publishedAt: row.published_at ?? null,
      };
    });

    return videos.filter((v) => {
      if (filters.template && v.templateKey !== filters.template) return false;
      if (filters.category && v.studentCategory !== filters.category) return false;
      if (filters.platform && v.platform !== filters.platform) return false;
      if (filters.q) {
        const query = filters.q.toLowerCase();
        const searchTarget = `${v.title} ${v.hook} ${v.conceptSummary} ${v.studentAppeal} ${v.caption ?? ''} ${v.creatorHandle}`.toLowerCase();
        if (!searchTarget.includes(query)) return false;
      }
      return true;
    });
  }
}
