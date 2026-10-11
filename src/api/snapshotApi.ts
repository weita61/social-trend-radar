import { JevClassifier, type BrandProfile, DEFAULT_BRAND_PROFILE } from '../analysis/jevClassifier.ts';
import type { CaptureApi } from './handler.ts';
import type { TrendFilters, VideoFilters } from '../analysis/readRepository.ts';
import snapshotData from '../data/seedSnapshot.ts';

export class SnapshotCaptureApi implements CaptureApi {
  private readonly jev: JevClassifier;
  private brandProfile: BrandProfile;
  private data: typeof snapshotData;

  constructor(customSnapshot?: typeof snapshotData) {
    this.data = customSnapshot ?? snapshotData;
    this.jev = new JevClassifier();
    this.brandProfile = (this.data.brandProfile as unknown as BrandProfile) ?? DEFAULT_BRAND_PROFILE;
  }

  updateSnapshot(newSnapshot: Record<string, unknown>): void {
    this.data = newSnapshot as unknown as typeof snapshotData;
    if (this.data.brandProfile) {
      this.brandProfile = (this.data.brandProfile as unknown as BrandProfile);
    }
  }

  getOverview(): Record<string, unknown> {
    return this.data.overview as Record<string, unknown>;
  }

  listTrends(filters: TrendFilters = {}): Record<string, unknown>[] {
    let trends = (this.data.trends ?? []) as unknown as Record<string, unknown>[];
    if (filters.layer) {
      trends = trends.filter((t) => t.layer === filters.layer);
    }
    if (filters.platform) {
      trends = trends.filter((t) => t.samplePlatform === filters.platform);
    }
    if (filters.minimumConfidence !== undefined) {
      trends = trends.filter((t) => Number(t.confidence ?? 0) >= filters.minimumConfidence!);
    }
    return trends;
  }

  listVideos(filters: VideoFilters = {}): Record<string, unknown>[] {
    let list = (this.data.videos ?? []) as unknown as Record<string, unknown>[];
    if (filters.template && filters.template !== 'all') {
      list = list.filter((v) => v.templateKey === filters.template || v.template === filters.template);
    }
    if (filters.category && filters.category !== 'all') {
      list = list.filter((v) => v.category === filters.category || v.studentCategory === filters.category);
    }
    if (filters.platform && filters.platform !== 'all') {
      list = list.filter((v) => v.platform === filters.platform);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter((v) =>
        String(v.title ?? '').toLowerCase().includes(q)
        || String(v.hook ?? '').toLowerCase().includes(q)
        || String(v.caption ?? '').toLowerCase().includes(q)
        || String(v.creatorHandle ?? '').toLowerCase().includes(q)
        || String(v.templateName ?? '').toLowerCase().includes(q)
        || String(v.templateLabel ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  getTrend(id: string): Record<string, unknown> | null {
    const trend = ((this.data.trends ?? []) as unknown as Record<string, unknown>[]).find((t) => t.id === id);
    if (!trend) return null;

    const blueprint = this.jev.generateMarketingBlueprintSync({
      caption: String(trend.sampleCaption ?? ''),
      genre: String(trend.genre ?? 'エンタメ'),
      label: String(trend.label ?? ''),
      brandProfile: this.brandProfile,
    });

    const evidencePosts = (trend.evidencePosts as Array<Record<string, unknown>> | undefined)
      ?? ((this.data.videos ?? []) as unknown as Array<Record<string, unknown>>).filter((v) =>
        v.formatClusterId === id || v.templateKey === trend.label
      );

    return {
      ...trend,
      evidencePosts,
      actionableAdvice: (trend.actionableAdvice as Record<string, unknown> | undefined) ?? blueprint,
      jevBlueprint: (trend.jevBlueprint as Record<string, unknown> | undefined) ?? blueprint,
    };
  }

  async generateJevBlueprintForTrend(id: string, brandProfile?: BrandProfile): Promise<Record<string, unknown> | null> {
    const trend = ((this.data.trends ?? []) as unknown as Record<string, unknown>[]).find((t) => t.id === id);
    if (!trend) return null;

    const profileToUse = brandProfile ?? this.brandProfile;
    const blueprint = await this.jev.generateMarketingBlueprint({
      caption: String(trend.sampleCaption ?? ''),
      creator: String(trend.representativeCreator ?? ''),
      platform: String(trend.samplePlatform ?? 'youtube'),
      genre: String(trend.genre ?? 'エンタメ'),
      brandProfile: profileToUse,
    });
    return blueprint as unknown as Record<string, unknown>;
  }

  getCoverage(): Record<string, unknown> {
    return this.data.coverage as Record<string, unknown>;
  }

  getAutomation(): Record<string, unknown> {
    return this.data.automation as Record<string, unknown>;
  }

  getPipeline(hours?: number | string): Record<string, unknown> {
    const raw = (this.data.pipeline ?? {}) as Record<string, unknown>;
    const numHours = (hours !== undefined && hours !== 'all' && Number(hours) > 0) ? Number(hours) : null;
    if (numHours === null) {
      return {
        ...raw,
        filter: { hours: 'all', label: '全期間 (All Time)', cutoffTime: null },
      };
    }
    const cutoffTime = new Date(Date.now() - numHours * 3600 * 1000).getTime();
    const recentCaptures = ((raw.recentCaptures ?? []) as Array<Record<string, unknown>>).filter((c) => {
      if (!c.capturedAt) return true;
      return new Date(String(c.capturedAt)).getTime() >= cutoffTime;
    });
    const recentAuditEvents = ((raw.recentAuditEvents ?? []) as Array<Record<string, unknown>>).filter((a) => {
      if (!a.occurredAt) return true;
      return new Date(String(a.occurredAt)).getTime() >= cutoffTime;
    });

    const allStages = (raw.stages ?? []) as Array<Record<string, unknown>>;
    const filteredStages = allStages.map((st) => {
      if (st.id === 'stage_ingestion') {
        const count = recentCaptures.length > 0
          ? recentCaptures.length
          : Math.max(1, Math.round((Number(st.totalCount ?? 25) * Math.min(24, numHours)) / 24));
        return {
          ...st,
          totalCount: count,
          metrics: {
            ...(st.metrics as Record<string, unknown>),
            totalAuditEvents: recentAuditEvents.length > 0 ? recentAuditEvents.length : Math.max(1, Math.round(84 * Math.min(24, numHours) / 24)),
          },
        };
      }
      if (st.id === 'stage_normalization') {
        const count = Math.max(1, Math.round((Number(st.totalCount ?? 30) * Math.min(24, numHours)) / 24));
        return { ...st, totalCount: count };
      }
      if (st.id === 'stage_analysis') {
        const count = Math.max(1, Math.round((Number(st.totalCount ?? 43) * Math.min(24, numHours)) / 24));
        return { ...st, totalCount: count };
      }
      if (st.id === 'stage_snapshot') {
        const count = Math.max(1, Math.round((Number(st.totalCount ?? 30) * Math.min(24, numHours)) / 24));
        return { ...st, totalCount: count };
      }
      return st;
    });

    return {
      ...raw,
      filter: {
        hours: numHours,
        label: `直近 ${numHours} 時間`,
        cutoffTime: new Date(cutoffTime).toISOString(),
      },
      stages: filteredStages,
      recentCaptures,
      recentAuditEvents,
    };
  }

  getBrandProfile(): Record<string, unknown> {
    return { profile: this.brandProfile };
  }

  updateBrandProfile(profile: Record<string, unknown>): Record<string, unknown> {
    this.brandProfile = {
      name: String(profile.name ?? this.brandProfile.name),
      targetAudience: String(profile.targetAudience ?? this.brandProfile.targetAudience),
      missionGoal: String(profile.missionGoal ?? this.brandProfile.missionGoal),
      valueProposition: String(profile.valueProposition ?? this.brandProfile.valueProposition),
      toneAndManner: String(profile.toneAndManner ?? this.brandProfile.toneAndManner),
    };
    return { success: true, profile: this.brandProfile };
  }

  getPost(id: string): Record<string, unknown> | null {
    const video = ((this.data.videos ?? []) as unknown as Record<string, unknown>[]).find((v) => v.id === id);
    return video ?? null;
  }

  capture(): never {
    throw new Error('Capture write operations are only permitted on the local MacBook crawler');
  }

  runAnalysis(): Record<string, unknown> {
    return { status: 'snapshot_ready', message: 'Read models up to date from snapshot' };
  }
}
