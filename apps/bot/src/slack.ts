import { App } from '@slack/bolt';
import type { CaptureClient } from './captureClient.ts';
import { pseudonymizeSubmitter } from './identity.ts';
import { parseCaptureMessage } from './message.ts';

export async function startSlackBot(options: {
  botToken: string;
  appToken: string;
  submitterHashSecret: string;
  captureClient: CaptureClient;
}): Promise<App> {
  const app = new App({
    token: options.botToken,
    appToken: options.appToken,
    socketMode: true,
  });

  app.message(async ({ message, say }) => {
    const event = message as unknown as Record<string, unknown>;
    const channelType = event.channel_type;
    if (event.subtype !== undefined || (channelType !== 'channel' && channelType !== 'group')) return;
    if (typeof event.text !== 'string' || typeof event.user !== 'string') return;
    const parsed = parseCaptureMessage(event.text);
    if (parsed.urls.length === 0) return;

    const pseudonym = pseudonymizeSubmitter('slack', event.user, options.submitterHashSecret);
    try {
      const captures = await Promise.all(parsed.urls.map((url) => options.captureClient.save({
        url,
        channel: 'bot',
        submitterPseudonym: pseudonym,
        note: parsed.note,
      })));
      const deduplicated = captures.filter((capture) => capture.deduplicated).length;
      const suffix = deduplicated === 0 ? '' : `（うち既存${deduplicated}件に発見経路を追加）`;
      await say(`保存しました：${captures.length}件${suffix}。独立確認待ちです。`);
    } catch (error) {
      console.error('Slack capture failed', error);
      await say('保存に失敗しました。MacのCapture API状態を確認してください。');
    }
  });

  await app.start();
  return app;
}
