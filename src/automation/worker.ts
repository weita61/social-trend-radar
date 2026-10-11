import { AutomationAuditRepository } from './auditRepository.ts';
import { AutomationCaptureClient } from './captureClient.ts';
import { loadCrawlerConfig } from './config.ts';
import { AutomationStopError } from './policy.ts';
import { PlaywrightReadOnlyBrowserFactory } from './playwrightBrowser.ts';
import { ReadOnlyCrawler } from './runner.ts';
import { openDatabase } from '../db/database.ts';

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  console.error(`[${new Date().toISOString()}] ${level}: ${message}`);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runCrawlerWorker(): Promise<void> {
  const config = loadCrawlerConfig();
  if (!config.enabled) {
    log('INFO', 'Crawler is disabled. Set CRAWLER_ENABLED=true after manual login.');
    return;
  }

  const db = openDatabase();
  const crawler = new ReadOnlyCrawler({
    browserFactory: new PlaywrightReadOnlyBrowserFactory({
      profileRoot: config.browserProfileRoot,
      headless: config.headless,
      chromeExecutablePath: config.chromeExecutablePath,
    }),
    captureSink: new AutomationCaptureClient(process.env.CAPTURE_API_URL ?? 'http://127.0.0.1:8787'),
    auditSink: new AutomationAuditRepository(db),
    killSwitchPath: config.killSwitchPath,
  });
  let stopping = false;
  let safetyPaused = false;
  const stop = (): void => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    while (!stopping) {
      if (!safetyPaused) {
        for (const target of config.targets) {
          if (stopping) break;
          try {
            const counts = await crawler.run(target);
            log('INFO', `${target.id}: observed=${counts.observedCount} saved=${counts.savedCount} duplicates=${counts.duplicateCount}`);
          } catch (error) {
            if (error instanceof AutomationStopError) {
              safetyPaused = true;
              log('WARN', `${target.id}: safety pause (${error.code}). Manual confirmation is required.`);
              break;
            }
            log('ERROR', `${target.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }
      }
      const waitUntil = Date.now() + (safetyPaused ? 60_000 : config.intervalMinutes * 60_000);
      while (!stopping && Date.now() < waitUntil) await sleep(Math.min(1_000, waitUntil - Date.now()));
    }
  } finally {
    db.close();
  }
}
