import { CaptureClient } from './captureClient.ts';
import { startDiscordBot } from './discord.ts';
import { startSlackBot } from './slack.ts';

const captureClient = new CaptureClient(process.env.CAPTURE_API_URL ?? 'http://127.0.0.1:8787');
const submitterHashSecret = process.env.SUBMITTER_HASH_SECRET?.trim();
if (submitterHashSecret === undefined || submitterHashSecret === '') {
  throw new Error('SUBMITTER_HASH_SECRET is required');
}

const discordToken = process.env.DISCORD_BOT_TOKEN?.trim();
const slackBotToken = process.env.SLACK_BOT_TOKEN?.trim();
const slackAppToken = process.env.SLACK_APP_TOKEN?.trim();
const processes: Array<Promise<unknown>> = [];

if (discordToken !== undefined && discordToken !== '') {
  processes.push(startDiscordBot({ token: discordToken, submitterHashSecret, captureClient }));
}
if (slackBotToken !== undefined && slackBotToken !== '' && slackAppToken !== undefined && slackAppToken !== '') {
  processes.push(startSlackBot({
    botToken: slackBotToken,
    appToken: slackAppToken,
    submitterHashSecret,
    captureClient,
  }));
}
if (processes.length === 0) throw new Error('Set DISCORD_BOT_TOKEN or both SLACK_BOT_TOKEN and SLACK_APP_TOKEN');

await Promise.all(processes);
console.log('Configured Social Trend Radar bots are connected');

