import { readFileSync, existsSync } from 'node:fs';
import { exportSnapshot } from '../../scripts/exportSnapshot.ts';

async function syncSnapshot(): Promise<void> {
  const apiUrl = process.env.VERCEL_SYNC_URL || 'https://social-trend-radar-6aqh.vercel.app/api/sync/snapshot';
  const syncSecret = process.env.SYNC_SECRET;

  // 1. Ensure snapshot is up to date
  exportSnapshot();

  const snapshotPath = './src/data/seedSnapshot.json';
  if (!existsSync(snapshotPath)) {
    console.error('[Sync] Error: seedSnapshot.json does not exist');
    process.exit(1);
  }

  const raw = readFileSync(snapshotPath, 'utf-8');
  const data = JSON.parse(raw);

  if (!syncSecret) {
    console.warn('[Sync] Warning: SYNC_SECRET not found in environment.');
    console.log('[Sync] Local snapshot generated. Set SYNC_SECRET in .env and Vercel Environment Variables to enable direct HTTP sync.');
    return;
  }

  console.log(`[Sync] Pushing latest snapshot (${data.videos?.length || 0} videos, ${data.trends?.length || 0} trends) to ${apiUrl}...`);

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${syncSecret}`,
      },
      body: raw,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Sync] HTTP Error ${res.status}: ${errText}`);
      process.exit(1);
    }

    const json = await res.json();
    console.log('[Sync] Success:', json);
  } catch (err) {
    console.error('[Sync] Network error:', err);
    process.exit(1);
  }
}

syncSnapshot();
