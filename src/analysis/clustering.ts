import { cosineDistance, meanVectors } from './math.ts';
import type { AnalysisLayer, ClusterCandidate, PostFeatures } from './types.ts';

type WorkingCluster = ClusterCandidate & { labels: string[] };

function labelFor(labels: readonly string[], layer: AnalysisLayer): string {
  const frequencies = new Map<string, number>();
  for (const label of labels) frequencies.set(label, (frequencies.get(label) ?? 0) + 1);
  const winner = [...frequencies.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0];
  return winner ?? `${layer}:unclassified`;
}

export function clusterLayer(
  layer: AnalysisLayer,
  featuresByPost: ReadonlyMap<string, PostFeatures>,
  maximumDistance: number,
): ClusterCandidate[] {
  const clusters: WorkingCluster[] = [...featuresByPost.entries()].map(([postId, features]) => ({
    layer,
    label: labelFor(features[layer].labels, layer),
    labels: features[layer].labels,
    memberPostIds: [postId],
    centroid: features[layer].vector,
  }));

  while (clusters.length > 1) {
    let best: { left: number; right: number; distance: number } | null = null;
    for (let left = 0; left < clusters.length; left += 1) {
      for (let right = left + 1; right < clusters.length; right += 1) {
        const leftCluster = clusters[left];
        const rightCluster = clusters[right];
        if (leftCluster === undefined || rightCluster === undefined) continue;
        const distance = cosineDistance(leftCluster.centroid, rightCluster.centroid);
        if (best === null || distance < best.distance) best = { left, right, distance };
      }
    }
    if (best === null || best.distance > maximumDistance) break;
    const leftCluster = clusters[best.left];
    const rightCluster = clusters[best.right];
    if (leftCluster === undefined || rightCluster === undefined) break;
    const labels = [...leftCluster.labels, ...rightCluster.labels];
    const merged: WorkingCluster = {
      layer,
      label: labelFor(labels, layer),
      labels,
      memberPostIds: [...leftCluster.memberPostIds, ...rightCluster.memberPostIds].sort(),
      centroid: meanVectors([leftCluster.centroid, rightCluster.centroid]),
    };
    clusters.splice(best.right, 1);
    clusters.splice(best.left, 1, merged);
  }

  return clusters
    .map((cluster) => ({
      layer: cluster.layer,
      label: cluster.label,
      memberPostIds: cluster.memberPostIds,
      centroid: cluster.centroid,
    }))
    .sort((left, right) => right.memberPostIds.length - left.memberPostIds.length || left.label.localeCompare(right.label));
}
