import { openDatabase, resolveDatabasePath } from '../db/database.ts';

const resolvedPath = resolveDatabasePath();
const db = openDatabase(resolvedPath);
const migrations = db.prepare('SELECT name, applied_at FROM schema_migrations ORDER BY name').all();
console.log(JSON.stringify({ databasePath: resolvedPath, migrations }, null, 2));
db.close();
