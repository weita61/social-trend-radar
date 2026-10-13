import { runAutomatedPipeline } from '../automation/pipeline.ts';

async function main(): Promise<void> {
  console.log('=== Social Trend Radar 全自動パイプライン起動 ===');
  const result = await runAutomatedPipeline();
  console.log('実行結果:', JSON.stringify(result, null, 2));
}

await main();
