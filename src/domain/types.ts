export const platforms = ['youtube', 'instagram', 'tiktok', 'unknown'] as const;
export type Platform = (typeof platforms)[number];

export const captureChannels = ['bot', 'extension', 'api', 'manual'] as const;
export type CaptureChannel = (typeof captureChannels)[number];

export const sourceLanes = ['personalized', 'fixed_panel', 'broad', 'external'] as const;
export type SourceLane = (typeof sourceLanes)[number];

export const selectionMethods = ['user_shared', 'auto_observed', 'official_feed', 'manual_research'] as const;
export type SelectionMethod = (typeof selectionMethods)[number];

export const discoverySurfaces = ['fyp', 'search', 'profile', 'hashtag', 'chart', 'shared', 'other'] as const;
export type DiscoverySurface = (typeof discoverySurfaces)[number];

export const captureReasons = ['hook', 'format', 'audio', 'edit', 'topic', 'comments', 'other'] as const;
export type CaptureReason = (typeof captureReasons)[number];

export type VisibleMetrics = {
  observedAt?: string;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  saveCount?: number | null;
  followerCount?: number | null;
  dataSource: 'visible' | 'official_api' | 'manual';
  confidence: number;
};

export type CaptureInput = {
  url: string;
  captureChannel: CaptureChannel;
  sourceLane: SourceLane;
  selectionMethod?: SelectionMethod;
  submitterPseudonym?: string | null;
  discoverySurface: DiscoverySurface;
  reason?: CaptureReason | null;
  note?: string | null;
  collectorContext?: string | null;
  visibleMetrics?: VisibleMetrics | null;
};

export type NormalizedPostUrl = {
  platform: Platform;
  platformPostId: string | null;
  canonicalUrl: string;
  mediaType: 'short' | 'reel' | 'video' | 'unknown';
  supported: boolean;
  failureReason: string | null;
};

