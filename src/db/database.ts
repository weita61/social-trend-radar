import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrateDatabase } from './migrate.ts';

export function resolveDatabasePath(explicitPath?: string): string {
  if (explicitPath !== undefined && explicitPath !== '') return explicitPath;
  if (process.env.DATABASE_PATH !== undefined && process.env.DATABASE_PATH !== '') {
    return process.env.DATABASE_PATH;
  }
  const appSupportPath = resolve(
    process.env.HOME ?? '',
    'Library/Application Support/SocialTrendRadar/data/social-trend-radar.sqlite',
  );
  if (existsSync(appSupportPath)) {
    return appSupportPath;
  }
  return './data/social-trend-radar.sqlite';
}

export function openDatabase(path = resolveDatabasePath()): DatabaseSync {
  const databasePath = path === ':memory:' ? path : resolve(path);
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (databasePath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  migrateDatabase(db);
  return db;
}
