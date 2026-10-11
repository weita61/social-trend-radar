import assert from 'node:assert/strict';
import test from 'node:test';
import { CaptureClient } from '../apps/bot/src/captureClient.ts';
import { pseudonymizeSubmitter } from '../apps/bot/src/identity.ts';
import { parseCaptureMessage } from '../apps/bot/src/message.ts';

test('bot message extracts unique links and keeps optional note', () => {
  const parsed = parseCaptureMessage(
    '冒頭が良い https://www.instagram.com/reel/ABC123/?igsh=x https://youtu.be/dQw4w9WgXcQ。',
  );
  assert.deepEqual(parsed.urls, [
    'https://www.instagram.com/reel/ABC123/?igsh=x',
    'https://youtu.be/dQw4w9WgXcQ',
  ]);
  assert.equal(parsed.note, '冒頭が良い');
});

test('submitter pseudonyms are stable per provider and do not expose raw IDs', () => {
  const secret = 'a-long-local-test-secret';
  const first = pseudonymizeSubmitter('discord', 'user-123', secret);
  const second = pseudonymizeSubmitter('discord', 'user-123', secret);
  const slack = pseudonymizeSubmitter('slack', 'user-123', secret);
  assert.equal(first, second);
  assert.notEqual(first, slack);
  assert.equal(first.includes('user-123'), false);
});

test('capture client sends a human share without raw provider identity', async () => {
  let received: Record<string, unknown> | undefined;
  const request = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    received = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      captureId: 'cap_1', postId: 'post_1', platform: 'youtube', deduplicated: false, saved: true,
    }, { status: 201 });
  };
  const client = new CaptureClient('http://127.0.0.1:8787', request as typeof fetch);
  await client.save({
    url: 'https://youtu.be/dQw4w9WgXcQ',
    channel: 'bot',
    submitterPseudonym: 'hashed-user',
    note: null,
  });

  assert.equal(received?.captureChannel, 'bot');
  assert.equal(received?.selectionMethod, 'user_shared');
  assert.equal(received?.submitterPseudonym, 'hashed-user');
  assert.equal(JSON.stringify(received).includes('user-123'), false);
});
