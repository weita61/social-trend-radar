import type { NormalizedPostUrl } from './types.ts';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);

export class UrlValidationError extends Error {
  readonly code = 'invalid_url';
}

function normalizeFallback(parsed: URL): string {
  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.port = '';
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  return parsed.toString();
}

function youtubePost(parsed: URL): NormalizedPostUrl {
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = segments[0] ?? null;
  } else if (segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') {
    id = segments[1] ?? null;
  } else if (parsed.pathname === '/watch') {
    id = parsed.searchParams.get('v');
  }

  if (id !== null && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return {
      platform: 'youtube',
      platformPostId: id,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      mediaType: segments[0] === 'shorts' ? 'short' : 'video',
      supported: true,
      failureReason: null,
    };
  }

  return {
    platform: 'youtube',
    platformPostId: null,
    canonicalUrl: normalizeFallback(parsed),
    mediaType: 'unknown',
    supported: false,
    failureReason: 'unsupported_youtube_post_url',
  };
}

function instagramPost(parsed: URL): NormalizedPostUrl {
  const segments = parsed.pathname.split('/').filter(Boolean);
  const type = segments[0];
  const id = segments[1];

  if ((type === 'reel' || type === 'reels' || type === 'p') && id !== undefined && /^[A-Za-z0-9_-]+$/.test(id)) {
    return {
      platform: 'instagram',
      platformPostId: id,
      canonicalUrl: `https://www.instagram.com/${type === 'p' ? 'p' : 'reel'}/${id}/`,
      mediaType: type === 'p' ? 'unknown' : 'reel',
      supported: true,
      failureReason: null,
    };
  }

  return {
    platform: 'instagram',
    platformPostId: null,
    canonicalUrl: normalizeFallback(parsed),
    mediaType: 'unknown',
    supported: false,
    failureReason: 'unsupported_instagram_post_url',
  };
}

function tiktokPost(parsed: URL): NormalizedPostUrl {
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);
  const videoIndex = segments.indexOf('video');
  let id = videoIndex >= 0 ? segments[videoIndex + 1] : undefined;

  if (segments[0] === 'v' && segments[1]?.endsWith('.html')) {
    id = segments[1].slice(0, -'.html'.length);
  }

  if (id !== undefined && /^\d+$/.test(id)) {
    const handle = segments.find((segment) => segment.startsWith('@'));
    const creatorPath = handle === undefined ? '' : `/${handle}`;
    return {
      platform: 'tiktok',
      platformPostId: id,
      canonicalUrl: `https://www.tiktok.com${creatorPath}/video/${id}`,
      mediaType: 'video',
      supported: true,
      failureReason: null,
    };
  }

  const isShortLink = host === 'vm.tiktok.com' || host === 'vt.tiktok.com';
  return {
    platform: 'tiktok',
    platformPostId: null,
    canonicalUrl: normalizeFallback(parsed),
    mediaType: 'unknown',
    supported: false,
    failureReason: isShortLink ? 'tiktok_short_link_requires_resolution' : 'unsupported_tiktok_post_url',
  };
}

export function normalizePostUrl(rawUrl: string): NormalizedPostUrl {
  if (rawUrl.length === 0 || rawUrl.length > 2_048) {
    throw new UrlValidationError('URL must contain between 1 and 2048 characters');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UrlValidationError('URL must be absolute');
  }

  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.username !== '' || parsed.password !== '') {
    throw new UrlValidationError('Only credential-free HTTP(S) URLs are accepted');
  }

  const host = parsed.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) return youtubePost(parsed);
  if (INSTAGRAM_HOSTS.has(host)) return instagramPost(parsed);
  if (TIKTOK_HOSTS.has(host)) return tiktokPost(parsed);

  return {
    platform: 'unknown',
    platformPostId: null,
    canonicalUrl: normalizeFallback(parsed),
    mediaType: 'unknown',
    supported: false,
    failureReason: 'unsupported_platform',
  };
}

