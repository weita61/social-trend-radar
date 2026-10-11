import { normalized } from './math.ts';
import type { AnalysisLayer, AnalysisPost, PostFeatures } from './types.ts';

type Rule = { label: string; patterns: RegExp[] };

const FORMAT_RULES: Rule[] = [
  { label: 'aruaru', patterns: [/あるある|コント|日常あるある|共感|やってる説/iu] },
  { label: 'shortcut_hack', patterns: [/ショートカット|プロンプト|スキャン|神ツール|神機能/iu] },
  { label: 'how_to', patterns: [/how[ -]?to/iu, /手順|方法|コツ|解説|チュートリアル|裏技/iu] },
  { label: 'before_after', patterns: [/before.{0,8}after/iu, /ビフォー|アフター|変化|比較|垢抜け/iu] },
  { label: 'list', patterns: [/\d+\s*(選|つ|個|本)/u, /まとめ|ランキング|ベスト/iu] },
  { label: 'story', patterns: [/ある日|実話|ストーリー|密着|一日/iu] },
  { label: 'reaction', patterns: [/反応|リアクション|やってみた|検証|ドッキリ/iu] },
  { label: 'question_hook', patterns: [/[?？]/u, /知ってる|なぜ|どうして/iu] },
  { label: 'failure_first', patterns: [/失敗|ミス|やらかし|後悔|ng|損/iu] },
  { label: 'routine', patterns: [/ルーティン|ナイトルーティン|モーニングルーティン|vlog|暮らし/iu] },
  { label: 'gourmet_recipe', patterns: [/レシピ|時短飯|ズボラ飯|フライパン|簡単ご飯|自炊/iu] },
  { label: 'gadget_review', patterns: [/買ってよかった|生活激変|神アイテム|便利グッズ|amazon|百均|文房具|文具/iu] },
];

const DESIRE_RULES: Rule[] = [
  { label: 'self_improvement', patterns: [/成長|上達|勉強|習慣|効率|スキル/iu] },
  { label: 'belonging', patterns: [/仲間|共感|友達|家族|一緒|コミュニティ|あるある/iu] },
  { label: 'recognition', patterns: [/評価|承認|モテ|注目|人気|バズ/iu] },
  { label: 'security', patterns: [/安心|安全|失敗しない|損しない|守る|ng/iu] },
  { label: 'curiosity', patterns: [/意外|秘密|未知|真実|なぜ|初めて|知ってる/iu] },
  { label: 'convenience', patterns: [/時短|簡単|楽|すぐ|無料|コスパ/iu] },
  { label: 'escape', patterns: [/癒|リラックス|非日常|旅|静か|無音/iu] },
];

function tokenize(text: string): string[] {
  const normalizedText = text.normalize('NFKC').toLowerCase();
  const wordTokens = normalizedText.match(/[\p{L}\p{N}_#@]{2,}/gu) ?? [];
  const japanese = normalizedText.replace(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '');
  const bigrams: string[] = [];
  for (let index = 0; index < japanese.length - 1; index += 1) bigrams.push(japanese.slice(index, index + 2));
  return [...wordTokens, ...bigrams];
}

function stableHash(token: string): number {
  let hash = 2166136261;
  for (const character of token) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hashEmbedding(tokens: readonly string[], dimensions: number, namespace: string): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokens) {
    const hash = stableHash(`${namespace}:${token}`);
    const index = hash % dimensions;
    const direction = ((hash >>> 8) & 1) === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + direction;
  }
  return normalized(vector);
}

function ruleLabels(text: string, rules: readonly Rule[], fallback: string): string[] {
  const labels = rules.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map((rule) => rule.label);
  return labels.length === 0 ? [fallback] : labels;
}

function layerVector(layer: AnalysisLayer, textTokens: string[], labels: string[], dimensions: number): number[] {
  return hashEmbedding([...textTokens, ...labels.flatMap((label) => [label, label, label])], dimensions, layer);
}

export function extractPostFeatures(post: AnalysisPost, dimensions: number): PostFeatures {
  const text = [post.caption ?? '', post.audioKey ?? '', ...post.notes].join(' ').normalize('NFKC');
  const tokens = tokenize(text);
  const surfaceLabels = [...new Set([
    ...tokens.filter((token) => token.startsWith('#')).slice(0, 8),
    ...(post.audioKey === null ? [] : [`audio:${post.audioKey}`]),
    ...post.reasons.map((reason) => `reason:${reason}`),
  ])];
  const safeSurfaceLabels = surfaceLabels.length === 0 ? ['surface:unclassified'] : surfaceLabels;
  const formatLabels = ruleLabels(`${text} ${post.reasons.join(' ')}`, FORMAT_RULES, 'format:unclassified');
  const desireLabels = ruleLabels(text, DESIRE_RULES, 'desire:unclassified');

  return {
    surface: { labels: safeSurfaceLabels, vector: layerVector('surface', tokens, safeSurfaceLabels, dimensions) },
    format: { labels: formatLabels, vector: layerVector('format', tokens, formatLabels, dimensions) },
    desire: { labels: desireLabels, vector: layerVector('desire', tokens, desireLabels, dimensions) },
  };
}
