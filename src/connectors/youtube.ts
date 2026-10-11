import type { QuotaGuard } from './quotaGuard.ts';

type YoutubeApiResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      publishedAt?: string;
      channelId?: string;
      title?: string;
      description?: string;
      channelTitle?: string;
      categoryId?: string;
      tags?: string[];
      defaultLanguage?: string;
      defaultAudioLanguage?: string;
    };
    contentDetails?: { duration?: string };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
  error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> };
};

export type YoutubeVideoMetadata = {
  creator: {
    platformCreatorId: string | null;
    handle: string | null;
    profileUrl: string | null;
  };
  publishedAt: string | null;
  caption: string | null;
  durationMs: number | null;
  metrics: {
    viewCount: number | null;
    likeCount: number | null;
    commentCount: number | null;
  };
  rawMetadata: Record<string, unknown>;
};

export class YoutubeApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function safeCount(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isoDurationToMilliseconds(duration: string | undefined): number | null {
  if (duration === undefined) return null;
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (match === null) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return Math.round((hours * 3_600 + minutes * 60 + seconds) * 1_000);
}

export class YoutubeAdapter {
  private readonly apiKey: string;
  private readonly quotaGuard: QuotaGuard;
  private readonly dailyQuotaLimit: number;
  private readonly request: typeof fetch;

  constructor(options: {
    apiKey: string;
    quotaGuard: QuotaGuard;
    dailyQuotaLimit?: number;
    request?: typeof fetch;
  }) {
    this.apiKey = options.apiKey;
    this.quotaGuard = options.quotaGuard;
    this.dailyQuotaLimit = options.dailyQuotaLimit ?? 8_000;
    this.request = options.request ?? fetch;
  }

  async fetchVideo(postId: string): Promise<YoutubeVideoMetadata> {
    if (!/^[A-Za-z0-9_-]{11}$/.test(postId)) throw new YoutubeApiError('invalid_video_id', 'Invalid YouTube video ID');
    const reservation = this.quotaGuard.reserve('youtube', 'videos.list', 1, this.dailyQuotaLimit);
    const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos');
    endpoint.searchParams.set('part', 'snippet,contentDetails,statistics');
    endpoint.searchParams.set('id', postId);
    endpoint.searchParams.set('key', this.apiKey);

    try {
      const response = await this.request(endpoint, { headers: { accept: 'application/json' } });
      const payload = await response.json() as YoutubeApiResponse;
      if (!response.ok) {
        const reason = payload.error?.errors?.[0]?.reason ?? `http_${response.status}`;
        throw new YoutubeApiError(reason, payload.error?.message ?? 'YouTube API request failed');
      }
      const video = payload.items?.[0];
      if (video === undefined) throw new YoutubeApiError('video_not_found', 'YouTube video was not found or is unavailable');

      this.quotaGuard.complete(reservation.runId);
      const channelId = video.snippet?.channelId ?? null;
      return {
        creator: {
          platformCreatorId: channelId,
          handle: video.snippet?.channelTitle ?? null,
          profileUrl: channelId === null ? null : `https://www.youtube.com/channel/${channelId}`,
        },
        publishedAt: video.snippet?.publishedAt ?? null,
        caption: video.snippet?.description ?? null,
        durationMs: isoDurationToMilliseconds(video.contentDetails?.duration),
        metrics: {
          viewCount: safeCount(video.statistics?.viewCount),
          likeCount: safeCount(video.statistics?.likeCount),
          commentCount: safeCount(video.statistics?.commentCount),
        },
        rawMetadata: {
          title: video.snippet?.title ?? null,
          categoryId: video.snippet?.categoryId ?? null,
          tags: video.snippet?.tags ?? [],
          defaultLanguage: video.snippet?.defaultLanguage ?? null,
          defaultAudioLanguage: video.snippet?.defaultAudioLanguage ?? null,
        },
      };
    } catch (error) {
      this.quotaGuard.fail(
        reservation.runId,
        error instanceof YoutubeApiError ? error.code : 'network_or_parse_error',
      );
      throw error;
    }
  }
}
