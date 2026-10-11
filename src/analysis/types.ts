export type AnalysisLayer = 'surface' | 'format' | 'desire';

export type AnalysisPost = {
  id: string;
  platform: string;
  creatorId: string | null;
  caption: string | null;
  audioKey: string | null;
  publishedAt: string | null;
  firstSeenAt: string;
  notes: string[];
  reasons: string[];
  discoverySurfaces: string[];
};

export type LayerFeatures = {
  labels: string[];
  vector: number[];
};

export type PostFeatures = Record<AnalysisLayer, LayerFeatures>;

export type ClusterCandidate = {
  layer: AnalysisLayer;
  label: string;
  memberPostIds: string[];
  centroid: number[];
};

export type MetricAnalysis = {
  postId: string;
  metricSnapshotId: string | null;
  baselineScope: 'creator' | 'platform' | 'none';
  baselineValue: number | null;
  usualValueRatio: number | null;
  robustLiftScore: number;
  velocityPerHour: number | null;
  engagementRate: number | null;
};

export type BiasWeights = {
  userSubmittedShare: number;
  submitterHhi: number;
  independentConfirmationGap: number;
  nonUserLaneGap: number;
};

export type TrendGate = {
  independentCreators: number;
  nonUserLanes: number;
  independentConfirmations: number;
  growingPosts: number;
};

export type AnalysisConfig = {
  embeddingDimensions: number;
  clusterDistance: Record<AnalysisLayer, number>;
  biasWeights: BiasWeights;
  trendGate: TrendGate;
};

export type AnalysisSummary = {
  runId: string;
  postCount: number;
  clusterCount: number;
  marketTrendCount: number;
  provisionalCount: number;
  teamInterestCount: number;
  insufficientEvidenceCount: number;
};
