import type { BrandProfile } from '../analysis/jevClassifier.ts';
import { YoutubeApiError, type YoutubeAdapter } from '../connectors/youtube.ts';
import type { CaptureRepository, CaptureResult } from '../db/captureRepository.ts';
import { normalizePostUrl } from '../domain/url.ts';
import type { CaptureInput } from '../domain/types.ts';
import type { TrendFilters, VideoFilters } from '../analysis/readRepository.ts';

export class CaptureService {
  private readonly repository: CaptureRepository;
  private readonly youtube: YoutubeAdapter | null;

  constructor(repository: CaptureRepository, youtube: YoutubeAdapter | null = null) {
    this.repository = repository;
    this.youtube = youtube;
  }

  async capture(input: CaptureInput): Promise<CaptureResult> {
    const result = this.repository.capture(input);
    const normalized = normalizePostUrl(input.url);
    if (
      this.youtube === null
      || normalized.platform !== 'youtube'
      || normalized.platformPostId === null
      || !normalized.supported
    ) {
      return result;
    }

    try {
      const metadata = await this.youtube.fetchVideo(normalized.platformPostId);
      this.repository.enrichYoutubePost(result.postId, metadata);
      return { ...result, metadataStatus: 'complete' };
    } catch (error) {
      const failureReason = error instanceof YoutubeApiError ? error.code : 'youtube_metadata_fetch_failed';
      this.repository.recordMetadataFailure(result.postId, result.captureId, failureReason);
      return { ...result, metadataStatus: 'failed', failureReason };
    }
  }

  getPost(id: string): Record<string, unknown> | null {
    return this.repository.getPost(id);
  }

  listTrends(filters: TrendFilters = {}): Record<string, unknown>[] {
    return this.repository.listTrends(filters);
  }

  listVideos(filters: VideoFilters = {}): Record<string, unknown>[] {
    return this.repository.listVideos(filters);
  }

  getTrend(id: string): Record<string, unknown> | null {
    return this.repository.getTrend(id);
  }

  async generateJevBlueprintForTrend(id: string): Promise<Record<string, unknown> | null> {
    return this.repository.generateJevBlueprintForTrend(id);
  }

  getOverview(): Record<string, unknown> {
    return this.repository.getOverview();
  }

  getCoverage(): Record<string, unknown> {
    return this.repository.getCoverage();
  }

  getAutomation(): Record<string, unknown> {
    return this.repository.getAutomation();
  }

  getPipeline(): Record<string, unknown> {
    return this.repository.getPipeline();
  }

  runAnalysis(): Record<string, unknown> {
    return this.repository.runAnalysis();
  }
  getBrandProfile(): Record<string, unknown> {
    return this.repository.getBrandProfile();
  }

  updateBrandProfile(profile: BrandProfile): Record<string, unknown> {
    return this.repository.updateBrandProfile(profile);
  }
}
