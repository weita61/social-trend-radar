import { readFileSync, existsSync } from 'node:fs';
import { openDatabase } from '../db/database.ts';
import { CaptureRepository } from '../db/captureRepository.ts';
import { CaptureService } from '../services/captureService.ts';
import { YoutubeAdapter } from '../connectors/youtube.ts';
import { QuotaGuard } from '../connectors/quotaGuard.ts';
import { LocalAnalysisEngine } from '../analysis/engine.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('使用法: pnpm import:urls <URL1> <URL2> ... または pnpm import:urls <urls.txt>');
    process.exit(1);
  }

  const rawUrls: string[] = [];
  for (const arg of args) {
    if (existsSync(arg)) {
      const content = readFileSync(arg, 'utf-8');
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) rawUrls.push(trimmed);
      });
    } else if (arg.startsWith('http://') || arg.startsWith('https://')) {
      rawUrls.push(arg.trim());
    }
  }

  if (rawUrls.length === 0) {
    console.error('インポート対象のURLが見つかりませんでした。');
    process.exit(1);
  }

  console.log(`--- ${rawUrls.length} 件のショート動画URLのインポートを開始します ---`);

  const db = openDatabase();
  const quotaGuard = new QuotaGuard(db);
  const youtubeApiKey = process.env.YOUTUBE_API_KEY?.trim();
  const youtube = youtubeApiKey ? new YoutubeAdapter({ apiKey: youtubeApiKey, quotaGuard }) : null;
  const repository = new CaptureRepository(db);
  const service = new CaptureService(repository, youtube);

  let successCount = 0;
  let deduplicatedCount = 0;

  for (let i = 0; i < rawUrls.length; i += 1) {
    const url = rawUrls[i];
    try {
      const result = await service.capture({
        url,
        captureChannel: 'manual',
        sourceLane: 'broad',
        discoverySurface: 'fyp',
        selectionMethod: 'manual_research',
        reason: 'format',
        note: 'バズ動画手動インポート',
      });
      if (result.deduplicated) {
        deduplicatedCount += 1;
        console.log(`[${i + 1}/${rawUrls.length}] 重複スキップ: ${url}`);
      } else {
        successCount += 1;
        console.log(`[${i + 1}/${rawUrls.length}] 登録完了: ${url} (ID: ${result.postId})`);
      }
    } catch (err) {
      console.error(`[${i + 1}/${rawUrls.length}] 失敗: ${url}`, err);
    }
  }

  console.log(`\nインポート結果: 新規 ${successCount} 件, 重複 ${deduplicatedCount} 件`);
  console.log('--- ローカル分析エンジンを再実行してランキングを更新中... ---');

  const engine = new LocalAnalysisEngine(db);
  const summary = engine.run();
  console.log('✓ 分析完了:', JSON.stringify(summary, null, 2));

  db.close();
}

await main();
