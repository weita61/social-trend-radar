import { createInterface } from 'node:readline/promises';
import { loadCrawlerConfig } from '../automation/config.ts';
import { crawlerPlatforms, type CrawlerPlatform } from '../automation/types.ts';
import { PlaywrightReadOnlyBrowserFactory } from '../automation/playwrightBrowser.ts';

const platform = process.argv[2];
if (!(crawlerPlatforms as readonly string[]).includes(platform ?? '')) {
  console.error('Usage: pnpm crawler:login <instagram|tiktok>');
  process.exit(2);
}

const selectedPlatform = platform as CrawlerPlatform;
const config = loadCrawlerConfig({ ...process.env, CRAWLER_HEADLESS: 'false' });
const session = await new PlaywrightReadOnlyBrowserFactory({
  profileRoot: config.browserProfileRoot,
  headless: false,
  chromeExecutablePath: config.chromeExecutablePath,
}).open(selectedPlatform);
const loginUrl = selectedPlatform === 'instagram'
  ? 'https://www.instagram.com/accounts/login/'
  : 'https://www.tiktok.com/login';

await session.navigate(loginUrl);

const terminal = createInterface({ input: process.stdin, output: process.stderr });
try {
  await terminal.question(`${selectedPlatform}専用調査アカウントへ手動ログインし、完了後にこのターミナルでEnterを押してください。`);
} finally {
  terminal.close();
  await session.close();
}
console.error(`${selectedPlatform}の専用ブラウザーセッションを保存しました。`);
