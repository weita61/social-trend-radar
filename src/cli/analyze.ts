import { ResilientAnalysisRunner } from '../analysis/resilientRunner.ts';
import { openDatabase } from '../db/database.ts';

const db = openDatabase();
try {
  const runner = new ResilientAnalysisRunner(db);
  const result = runner.run();
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'failed') {
    process.exit(1);
  }
} finally {
  db.close();
}
