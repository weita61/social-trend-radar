import { JevClassifier, type BrandProfile, DEFAULT_BRAND_PROFILE } from '../analysis/jevClassifier.ts';
import type { CaptureApi } from './handler.ts';
import type { TrendFilters, VideoFilters } from '../analysis/readRepository.ts';
import snapshotData from '../data/seedSnapshot.ts';

export class SnapshotCaptureApi implements CaptureApi {
  private readonly jev: JevClassifier;
  private brandProfile: BrandProfile;
  private readonly data: typeof snapshotData;

  constructor(customSnapshot?: typeof snapshotData) {
    this.data = customSnapshot ?? snapshotData;
    this.jev = new JevClassifier();
    this.brandProfile = (this.data.brandProfile as unknown as BrandProfile) ?? DEFAULT_BRAND_PROFILE;
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

    return {
      ...trend,
      actionableAdvice: blueprint,
      jevBlueprint: blueprint,
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
