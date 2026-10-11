export function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const current = sorted[middle];
  if (current === undefined) return null;
  if (sorted.length % 2 === 1) return current;
  const previous = sorted[middle - 1];
  return previous === undefined ? current : (previous + current) / 2;
}

export function mad(values: readonly number[], center = median(values)): number | null {
  if (center === null) return null;
  return median(values.map((value) => Math.abs(value - center)));
}

export function cosineDistance(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 1;
  return 1 - dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function normalized(vector: readonly number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude === 0 ? [...vector] : vector.map((value) => value / magnitude);
}

export function meanVectors(vectors: readonly number[][]): number[] {
  if (vectors.length === 0) return [];
  const length = Math.max(...vectors.map((vector) => vector.length));
  const mean = Array.from({ length }, () => 0);
  for (const vector of vectors) {
    for (let index = 0; index < length; index += 1) mean[index] = (mean[index] ?? 0) + (vector[index] ?? 0);
  }
  return normalized(mean.map((value) => value / vectors.length));
}
