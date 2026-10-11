import { writeFileSync, mkdirSync } from 'node:fs';
import { openDatabase } from '../src/db/database.ts';
import { AnalysisReadRepository } from '../src/analysis/readRepository.ts';

function exportSnapshot(): void {
  const db = openDatabase();
  const repo = new AnalysisReadRepository(db);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    overview: repo.getOverview(),
    trends: repo.listTrends({ layer: 'format' }),
    videos: repo.listVideos(),
    coverage: repo.getCoverage(),
    automation: repo.getAutomation(),
    brandProfile: repo.getBrandProfile(),
  };

  mkdirSync('./src/data', { recursive: true });
  writeFileSync('./src/data/seedSnapshot.json', JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`[Snapshot] Successfully exported ${snapshot.videos.length} videos and ${snapshot.trends.length} trend formats to src/data/seedSnapshot.json`);
}

exportSnapshot();
