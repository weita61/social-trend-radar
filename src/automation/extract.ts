import { normalizePostUrl } from '../domain/url.ts';
import type { VisibleMetrics } from '../domain/types.ts';
import type { CrawlerPlatform, ObservedPost, VisibleCard } from './types.ts';

const COUNT_UNIT_MULTIPLIERS: Readonly<Record<string, number>> = {
  '': 1,
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
  万: 10_000,
  億: 100_000_000,
};

function parseCountToken(raw: string): number | null {
  const match = raw.trim().toLowerCase().replaceAll(',', '').match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmb万億]?)$/u);
  if (match?.[1] === undefined || match[2] === undefined) return null;
  const numeric = Number.parseFloat(match[1]);
  const multiplier = COUNT_UNIT_MULTIPLIERS[match[2]];
  if (!Number.isFinite(numeric) || multiplier === undefined) return null;
  const count = Math.round(numeric * multiplier);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function labeledCount(text: string, labels: readonly string[]): number | null {
  const token = '([0-9][0-9,.]*(?:\\.[0-9]+)?\\s*[KMBkmb万億]?)';
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const after = text.match(new RegExp(`${escaped}\\s*[:：]?\\s*${token}`, 'iu'))?.[1];
    const before = text.match(new RegExp(`${token}\\s*${escaped}`, 'iu'))?.[1];
    const parsed = parseCountToken(after ?? before ?? '');
    if (parsed !== null) return parsed;
  }
  return null;
}

export function parseVisibleMetrics(text: string, observedAt = new Date()): VisibleMetrics | null {
  const viewCount = labeledCount(text, ['views', 'view', '再生回数', '再生']);
  const likeCount = labeledCount(text, ['likes', 'like', 'いいね']);
  const commentCount = labeledCount(text, ['comments', 'comment', 'コメント']);
  const shareCount = labeledCount(text, ['shares', 'share', 'シェア']);
  const saveCount = labeledCount(text, ['saves', 'save', '保存']);
  if ([viewCount, likeCount, commentCount, shareCount, saveCount].every((value) => value === null)) {
    return null;
  }
  return {
    observedAt: observedAt.toISOString(),
    viewCount,
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    dataSource: 'visible',
    confidence: 0.65,
  };
}

export function extractObservedPosts(
  platform: CrawlerPlatform,
  cards: readonly VisibleCard[],
  observedAt = new Date(),
): ObservedPost[] {
  const unique = new Map<string, ObservedPost>();
  for (const card of cards) {
    let normalized;
    try {
      normalized = normalizePostUrl(card.href);
    } catch {
      continue;
    }
    if (!normalized.supported || normalized.platform !== platform || normalized.platformPostId === null) continue;
    if (!unique.has(normalized.canonicalUrl)) {
      unique.set(normalized.canonicalUrl, {
        url: normalized.canonicalUrl,
        visibleMetrics: parseVisibleMetrics(card.text, observedAt),
      });
    }
  }
  return [...unique.values()];
}
