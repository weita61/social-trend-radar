import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';

export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

export function migrateDatabase(db: DatabaseSync, migrationsDirectory = DEFAULT_MIGRATIONS_DIR): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => String(row.name)),
  );
  const files = readdirSync(migrationsDirectory)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(new URL(file, `file://${migrationsDirectory}/`), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
      db.exec('COMMIT');
      newlyApplied.push(file);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return newlyApplied;
}

