import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { CaptureClient } from './captureClient.ts';
import { pseudonymizeSubmitter } from './identity.ts';
import { parseCaptureMessage } from './message.ts';

export async function startDiscordBot(options: {
  token: string;
  submitterHashSecret: string;
  captureClient: CaptureClient;
}): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.guildId === null) return;
    const parsed = parseCaptureMessage(message.content);
    if (parsed.urls.length === 0) return;

    const pseudonym = pseudonymizeSubmitter('discord', message.author.id, options.submitterHashSecret);
    try {
      const captures = await Promise.all(parsed.urls.map((url) => options.captureClient.save({
        url,
        channel: 'bot',
        submitterPseudonym: pseudonym,
        note: parsed.note,
      })));
      const deduplicated = captures.filter((capture) => capture.deduplicated).length;
      const suffix = deduplicated === 0 ? '' : `（うち既存${deduplicated}件に発見経路を追加）`;
      await message.reply(`保存しました：${captures.length}件${suffix}。独立確認待ちです。`);
    } catch (error) {
      console.error('Discord capture failed', error);
      await message.reply('保存に失敗しました。URLは取得できているため、MacのCapture API状態を確認してください。');
    }
  });

  await client.login(options.token);
  return client;
}
