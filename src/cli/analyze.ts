import { LocalAnalysisEngine } from '../analysis/engine.ts';
import { openDatabase } from '../db/database.ts';

const db = openDatabase();
try {
  const summary = new LocalAnalysisEngine(db).run();
  console.log(JSON.stringify(summary, null, 2));
} finally {
  db.close();
}
