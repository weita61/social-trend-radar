import { join } from 'node:path';
import type { CrawlerTarget } from './types.ts';

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error('Boolean environment values must be true or false');
}

function urls(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback).split(',').map((item) => item.trim()).filter((item) => item !== '');
}

export type CrawlerConfig = {
  enabled: boolean;
  headless: boolean;
  intervalMinutes: number;
  browserProfileRoot: string;
  chromeExecutablePath: string | null;
  killSwitchPath: string;
  targets: CrawlerTarget[];
};

export function loadCrawlerConfig(environment: NodeJS.ProcessEnv = process.env): CrawlerConfig {
  const home = environment.HOME;
  if (home === undefined || home === '') throw new Error('HOME is required for crawler profiles');
  const defaultProfileRoot = join(home, 'Library', 'Application Support', 'SocialTrendRadar', 'browser-profiles');
  const defaultKillSwitchPath = join(home, 'Library', 'Application Support', 'SocialTrendRadar', 'crawler.stop');
  const maxScrolls = positiveInteger(environment.CRAWLER_SCROLLS_PER_RUN, 6, 'CRAWLER_SCROLLS_PER_RUN');
  const waitMs = positiveInteger(environment.CRAWLER_WAIT_MS, 4_000, 'CRAWLER_WAIT_MS');
  const instagramUrls = urls(environment.INSTAGRAM_CRAWL_URLS, 'https://www.instagram.com/reels/');
  const tiktokUrls = urls(environment.TIKTOK_CRAWL_URLS, 'https://www.tiktok.com/foryou');
  const targets: CrawlerTarget[] = [
    ...instagramUrls.map((url, index): CrawlerTarget => ({
      id: `instagram-fyp-${index + 1}`,
      platform: 'instagram',
      url,
      sourceLane: 'broad',
      discoverySurface: 'fyp',
      maxScrolls,
      waitMs,
    })),
    ...tiktokUrls.map((url, index): CrawlerTarget => ({
      id: `tiktok-fyp-${index + 1}`,
      platform: 'tiktok',
      url,
      sourceLane: 'broad',
      discoverySurface: 'fyp',
      maxScrolls,
      waitMs,
    })),
  ];

  return {
    enabled: booleanValue(environment.CRAWLER_ENABLED, false),
    headless: booleanValue(environment.CRAWLER_HEADLESS, false),
    intervalMinutes: positiveInteger(environment.CRAWLER_INTERVAL_MINUTES, 30, 'CRAWLER_INTERVAL_MINUTES'),
    browserProfileRoot: environment.CRAWLER_PROFILE_ROOT?.trim() || defaultProfileRoot,
    chromeExecutablePath: environment.CRAWLER_CHROME_EXECUTABLE?.trim() || null,
    killSwitchPath: environment.CRAWLER_KILL_SWITCH_PATH?.trim() || defaultKillSwitchPath,
    targets,
  };
}
