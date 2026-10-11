import { clamp } from './math.ts';
import type { BiasWeights, TrendGate } from './types.ts';

export type ClusterEvidence = {
  memberPostIds: string[];
  independentCreatorIds: string[];
  platforms: string[];
  nonUserLanes: string[];
  independentlyConfirmedPostIds: string[];
  humanCaptureCount: number;
  submitterCounts: number[];
  metricPostCount: number;
  growingPostCount: number;
  averageRobustLift: number;
  averageVelocityPerHour: number;
  averageEngagementRate: number;
  newestObservedAt: string | null;
};

export type ClusterScores = {
  biasRiskScore: number;
  biasLabel: 'low' | 'medium' | 'high';
  userSubmittedShare: number;
  submitterHhi: number;
  independentConfirmationRatio: number;
  nonUserLaneCount: number;
  independentCreatorCount: number;
  scoreCap: number | null;
  gatePassed: boolean;
  status: 'market_trend' | 'provisional' | 'team_interest' | 'insufficient_evidence';
  velocityScore: number;
  surpriseScore: number;
  diffusionScore: number;
  crossLaneScore: number;
  crossPlatformScore: number;
  engagementScore: number;
  freshnessScore: number;
  universalScore: number;
  teamInterestScore: number;
  confidence: number;
};

function hhi(counts: readonly number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  return counts.reduce((sum, count) => sum + (count / total) ** 2, 0);
}

export function scoreCluster(
  evidence: ClusterEvidence,
  weights: BiasWeights,
  gate: TrendGate,
  now: Date,
): ClusterScores {
  const totalEvidenceEvents = evidence.humanCaptureCount + evidence.independentlyConfirmedPostIds.length;
  const userSubmittedShare = totalEvidenceEvents === 0 ? 0 : evidence.humanCaptureCount / totalEvidenceEvents;
  const submitterHhi = hhi(evidence.submitterCounts);
  const independentConfirmationRatio = evidence.memberPostIds.length === 0
    ? 0
    : evidence.independentlyConfirmedPostIds.length / evidence.memberPostIds.length;
  const laneCoverage = clamp(evidence.nonUserLanes.length / 4, 0, 1);
  const biasRiskScore = clamp(100 * (
    weights.userSubmittedShare * userSubmittedShare
    + weights.submitterHhi * submitterHhi
    + weights.independentConfirmationGap * (1 - independentConfirmationRatio)
    + weights.nonUserLaneGap * (1 - laneCoverage)
  ));
  const biasLabel = biasRiskScore >= 70 ? 'high' : biasRiskScore >= 40 ? 'medium' : 'low';
  const gatePassed = evidence.independentCreatorIds.length >= gate.independentCreators
    && evidence.nonUserLanes.length >= gate.nonUserLanes
    && evidence.independentlyConfirmedPostIds.length >= gate.independentConfirmations
    && evidence.growingPostCount >= gate.growingPosts;
  const status = biasLabel === 'high'
    ? 'team_interest'
    : gatePassed && biasLabel === 'low'
      ? 'market_trend'
      : gatePassed
        ? 'provisional'
        : evidence.humanCaptureCount > 0
          ? 'team_interest'
          : 'insufficient_evidence';

  const velocityScore = clamp(Math.log1p(Math.max(0, evidence.averageVelocityPerHour)) * 10);
  const surpriseScore = clamp(evidence.averageRobustLift);
  const diffusionScore = clamp(evidence.independentCreatorIds.length / 10 * 100);
  const crossLaneScore = clamp(evidence.nonUserLanes.length / 4 * 100);
  const crossPlatformScore = clamp(evidence.platforms.length / 3 * 100);
  const engagementScore = clamp(evidence.averageEngagementRate * 500);
  const ageHours = evidence.newestObservedAt === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, (now.getTime() - Date.parse(evidence.newestObservedAt)) / 3_600_000);
  const freshnessScore = Number.isFinite(ageHours) ? clamp(100 * Math.exp(-ageHours / (24 * 14))) : 0;
  const rawUniversal = 0.2 * velocityScore + 0.2 * surpriseScore + 0.2 * diffusionScore
    + 0.15 * crossLaneScore + 0.1 * crossPlatformScore + 0.05 * engagementScore + 0.1 * freshnessScore;
  const scoreCap = biasLabel === 'high' ? 39 : biasLabel === 'medium' ? 69 : null;
  const universalScore = Math.min(rawUniversal, scoreCap ?? 100);
  const uniqueSubmitters = evidence.submitterCounts.length;
  const teamInterestScore = clamp(
    Math.log1p(evidence.humanCaptureCount) * 18 + Math.log1p(uniqueSubmitters) * 14,
  );
  const metricCoverage = evidence.memberPostIds.length === 0 ? 0 : evidence.metricPostCount / evidence.memberPostIds.length;
  const confidence = clamp(
    25 * Math.min(1, evidence.memberPostIds.length / 5)
    + 25 * independentConfirmationRatio
    + 20 * Math.min(1, evidence.nonUserLanes.length / 2)
    + 20 * metricCoverage
    + 10 * Math.min(1, evidence.independentCreatorIds.length / 3),
    0,
    100,
  ) / 100;

  return {
    biasRiskScore,
    biasLabel,
    userSubmittedShare,
    submitterHhi,
    independentConfirmationRatio,
    nonUserLaneCount: evidence.nonUserLanes.length,
    independentCreatorCount: evidence.independentCreatorIds.length,
    scoreCap,
    gatePassed,
    status,
    velocityScore,
    surpriseScore,
    diffusionScore,
    crossLaneScore,
    crossPlatformScore,
    engagementScore,
    freshnessScore,
    universalScore,
    teamInterestScore,
    confidence,
  };
}
