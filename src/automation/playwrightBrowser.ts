import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import type {
  CrawlerPlatform,
  ReadOnlyBrowserFactory,
  ReadOnlyBrowserSession,
  VisibleCard,
} from './types.ts';

class PlaywrightReadOnlySession implements ReadOnlyBrowserSession {
  private readonly context: BrowserContext;
  private readonly page: Page;

  constructor(
    context: BrowserContext,
    page: Page,
  ) {
    this.context = context;
    this.page = page;
  }

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  }

  async readVisibleCards(): Promise<VisibleCard[]> {
    return this.page.locator('a[href]').evaluateAll((anchors) => anchors.flatMap((element) => {
      if (!(element instanceof HTMLAnchorElement)) return [];
      const bounds = element.getBoundingClientRect();
      const visible = bounds.width > 0
        && bounds.height > 0
        && bounds.bottom >= 0
        && bounds.top <= window.innerHeight;
      if (!visible) return [];

      let container: Element | null = element.closest('article');
      if (container === null) {
        container = element;
        for (let depth = 0; depth < 4 && container.parentElement !== null; depth += 1) {
          container = container.parentElement;
        }
      }
      return [{
        href: element.href,
        text: (container.textContent ?? element.textContent ?? '').trim().slice(0, 1_000),
      }];
    }));
  }

  async readPageState(): Promise<{ url: string; visibleText: string }> {
    return {
      url: this.page.url(),
      visibleText: (await this.page.locator('body').innerText({ timeout: 10_000 })).slice(0, 8_000),
    };
  }

  async scroll(distance: number): Promise<void> {
    await this.page.mouse.wheel(0, distance);
  }

  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}

export class PlaywrightReadOnlyBrowserFactory implements ReadOnlyBrowserFactory {
  private readonly options: {
    profileRoot: string;
    headless: boolean;
    chromeExecutablePath: string | null;
  };

  constructor(options: {
    profileRoot: string;
    headless: boolean;
    chromeExecutablePath: string | null;
  }) {
    this.options = options;
  }

  async open(platform: CrawlerPlatform): Promise<ReadOnlyBrowserSession> {
    const profileDirectory = join(this.options.profileRoot, platform);
    mkdirSync(profileDirectory, { recursive: true, mode: 0o700 });
    const browserLocation = this.options.chromeExecutablePath === null
      ? { channel: 'chrome' as const }
      : { executablePath: this.options.chromeExecutablePath };
    const context = await chromium.launchPersistentContext(profileDirectory, {
      headless: this.options.headless,
      ...browserLocation,
      acceptDownloads: false,
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
      viewport: null,
    });
    const page = context.pages()[0] ?? await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('download', (download) => { void download.cancel(); });
    return new PlaywrightReadOnlySession(context, page);
  }
}
