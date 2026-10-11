import {
  captureChannels,
  captureReasons,
  discoverySurfaces,
  selectionMethods,
  sourceLanes,
  type CaptureChannel,
  type CaptureInput,
  type SelectionMethod,
  type VisibleMetrics,
} from './types.ts';

export class InputValidationError extends Error {
  readonly code = 'invalid_input';
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new InputValidationError(`${field} must be one of: ${allowed.join(', ')}`, field);
  }
  return value as T;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new InputValidationError(`${field} must be a string no longer than ${maxLength} characters`, field);
  }
  return value;
}

function optionalCount(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new InputValidationError(`${field} must be a non-negative safe integer`, field);
  }
  return value as number;
}

function validateMetrics(value: unknown): VisibleMetrics | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value)) throw new InputValidationError('visibleMetrics must be an object', 'visibleMetrics');

  const dataSource = requiredEnum(value.dataSource, 'visibleMetrics.dataSource', ['visible', 'official_api', 'manual'] as const);
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    throw new InputValidationError('visibleMetrics.confidence must be between 0 and 1', 'visibleMetrics.confidence');
  }

  const observedAt = optionalString(value.observedAt, 'visibleMetrics.observedAt', 64);
  if (observedAt !== undefined && observedAt !== null && Number.isNaN(Date.parse(observedAt))) {
    throw new InputValidationError('visibleMetrics.observedAt must be an ISO date', 'visibleMetrics.observedAt');
  }

  const viewCount = optionalCount(value.viewCount, 'visibleMetrics.viewCount');
  const likeCount = optionalCount(value.likeCount, 'visibleMetrics.likeCount');
  const commentCount = optionalCount(value.commentCount, 'visibleMetrics.commentCount');
  const shareCount = optionalCount(value.shareCount, 'visibleMetrics.shareCount');
  const saveCount = optionalCount(value.saveCount, 'visibleMetrics.saveCount');
  const followerCount = optionalCount(value.followerCount, 'visibleMetrics.followerCount');

  return {
    ...(observedAt === undefined || observedAt === null ? {} : { observedAt }),
    ...(viewCount === undefined ? {} : { viewCount }),
    ...(likeCount === undefined ? {} : { likeCount }),
    ...(commentCount === undefined ? {} : { commentCount }),
    ...(shareCount === undefined ? {} : { shareCount }),
    ...(saveCount === undefined ? {} : { saveCount }),
    ...(followerCount === undefined ? {} : { followerCount }),
    dataSource,
    confidence: value.confidence,
  };
}

export function defaultSelectionMethod(channel: CaptureChannel): SelectionMethod {
  if (channel === 'bot' || channel === 'extension') return 'user_shared';
  if (channel === 'api') return 'official_feed';
  return 'manual_research';
}

export function validateCaptureInput(value: unknown): CaptureInput {
  if (!isRecord(value)) throw new InputValidationError('Request body must be a JSON object');
  if (typeof value.url !== 'string') throw new InputValidationError('url is required', 'url');

  const captureChannel = requiredEnum(value.captureChannel, 'captureChannel', captureChannels);
  const sourceLane = requiredEnum(value.sourceLane, 'sourceLane', sourceLanes);
  const discoverySurface = requiredEnum(value.discoverySurface, 'discoverySurface', discoverySurfaces);
  const selectionMethod = value.selectionMethod === undefined
    ? defaultSelectionMethod(captureChannel)
    : requiredEnum(value.selectionMethod, 'selectionMethod', selectionMethods);
  const reason = value.reason === undefined || value.reason === null
    ? value.reason as null | undefined
    : requiredEnum(value.reason, 'reason', captureReasons);
  const submitterPseudonym = optionalString(value.submitterPseudonym, 'submitterPseudonym', 128);
  const note = optionalString(value.note, 'note', 4_000);
  const collectorContext = optionalString(value.collectorContext, 'collectorContext', 256);
  const visibleMetrics = validateMetrics(value.visibleMetrics);

  return {
    url: value.url,
    captureChannel,
    sourceLane,
    selectionMethod,
    discoverySurface,
    ...(reason === undefined ? {} : { reason }),
    ...(submitterPseudonym === undefined ? {} : { submitterPseudonym }),
    ...(note === undefined ? {} : { note }),
    ...(collectorContext === undefined ? {} : { collectorContext }),
    ...(visibleMetrics === undefined ? {} : { visibleMetrics }),
  };
}
