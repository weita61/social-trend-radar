import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePostUrl, UrlValidationError } from '../src/domain/url.ts';

test('YouTube URL variants canonicalize to one post URL', () => {
  const urls = [
    'https://youtu.be/dQw4w9WgXcQ?t=4',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share',
    'http://m.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=test',
  ];

  for (const url of urls) {
    const result = normalizePostUrl(url);
    assert.equal(result.platform, 'youtube');
    assert.equal(result.platformPostId, 'dQw4w9WgXcQ');
    assert.equal(result.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(result.supported, true);
  }
});

test('Instagram and TikTok tracking parameters are removed', () => {
  assert.deepEqual(normalizePostUrl('https://instagram.com/reels/CODE_123/?igsh=abc#x'), {
    platform: 'instagram',
    platformPostId: 'CODE_123',
    canonicalUrl: 'https://www.instagram.com/reel/CODE_123/',
    mediaType: 'reel',
    supported: true,
    failureReason: null,
  });

  assert.deepEqual(normalizePostUrl('https://www.tiktok.com/@sample/video/7412345678901234567?is_from_webapp=1'), {
    platform: 'tiktok',
    platformPostId: '7412345678901234567',
    canonicalUrl: 'https://www.tiktok.com/@sample/video/7412345678901234567',
    mediaType: 'video',
    supported: true,
    failureReason: null,
  });
});

test('valid but unsupported URLs stay saveable for manual review', () => {
  const result = normalizePostUrl('https://example.com/something/?utm_source=x#fragment');
  assert.equal(result.platform, 'unknown');
  assert.equal(result.canonicalUrl, 'https://example.com/something');
  assert.equal(result.supported, false);
  assert.equal(result.failureReason, 'unsupported_platform');
});

test('credentials and non-http URLs are rejected', () => {
  assert.throws(() => normalizePostUrl('file:///etc/passwd'), UrlValidationError);
  assert.throws(() => normalizePostUrl('https://user:secret@example.com/video'), UrlValidationError);
});

