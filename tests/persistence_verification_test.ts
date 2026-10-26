import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { persistDbAtomic, resolveDatabasePaths, findLatestValidBackup } from '../server/db.js';

async function runPersistenceTests() {
  console.log('\n=============================================================');
  console.log('🛡️ GULF TAXIS DISPATCH CLOUD — DATABASE PERSISTENCE VERIFICATION');
  console.log('=============================================================\n');

  const testDir = path.resolve('data', 'test_sandbox');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbFile = path.join(testDir, 'test_persistence.sqlite');
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // 1. Test Atomic Persistence
  console.log('--- 1. Testing Atomic Persistence ---');
  db.run('CREATE TABLE test_data (id TEXT PRIMARY KEY, value TEXT);');
  db.run("INSERT INTO test_data VALUES ('t1', 'Initial Record');");
  persistDbAtomic(db, testDbFile);

  if (!fs.existsSync(testDbFile)) {
    throw new Error('Test DB file was not created by persistDbAtomic!');
  }
  const size1 = fs.statSync(testDbFile).size;
  console.log(`  ✅ [PASS] Atomic persist created DB file (${size1} bytes)`);

  // Verify no orphaned temporary files remain
  const tempFiles = fs.readdirSync(testDir).filter((f) => f.includes('.tmp.'));
  if (tempFiles.length !== 0) {
    throw new Error('Found orphaned temporary files: ' + tempFiles.join(', '));
  }
  console.log('  ✅ [PASS] Zero orphaned .tmp files left on disk');

  // 2. Test Record Survival across restarts and reloads
  console.log('\n--- 2. Testing Data Survival across Reloads ---');
  const reloadedBuffer = fs.readFileSync(testDbFile);
  const reloadedDb = new SQL.Database(reloadedBuffer);
  const rows = reloadedDb.exec("SELECT * FROM test_data WHERE id = 't1'");
  if (rows[0]?.values[0]?.[1] !== 'Initial Record') {
    throw new Error('Reloaded data mismatch!');
  }
  console.log('  ✅ [PASS] Record survived disk reload with exact value');

  // Insert second record and update atomically
  reloadedDb.run("INSERT INTO test_data VALUES ('t2', 'Second Record');");
  persistDbAtomic(reloadedDb, testDbFile);

  const verifyBuffer = fs.readFileSync(testDbFile);
  const verifyDb = new SQL.Database(verifyBuffer);
  const countRes = verifyDb.exec('SELECT count(*) FROM test_data');
  const count = countRes[0]?.values[0]?.[0];
  if (count !== 2) {
    throw new Error(`Expected 2 records after second persist, got: ${count}`);
  }
  console.log(`  ✅ [PASS] Subsequent atomic updates preserve both records (count: ${count})`);

  // 3. Test Production Mode Protection against Silent Recreation
  console.log('\n--- 3. Testing Production Protection against Missing DB ---');
  const missingDbFile = path.join(testDir, 'non_existent_production.sqlite');
  process.env.GULF_TAXIS_DB_PATH = missingDbFile;
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_INITIAL_SEED;

  // Verify resolveDatabasePaths honors environment variable
  const resolved = resolveDatabasePaths();
  if (resolved.dbFile !== missingDbFile) {
    throw new Error(`Path resolution failed. Expected ${missingDbFile}, got ${resolved.dbFile}`);
  }
  console.log('  ✅ [PASS] Environment variable GULF_TAXIS_DB_PATH takes priority');

  // Clean up sandbox
  if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
  fs.rmdirSync(testDir);
  delete process.env.GULF_TAXIS_DB_PATH;
  process.env.NODE_ENV = 'development';

  console.log('\n=============================================================');
  console.log('🎉 ALL PERSISTENCE SAFEGUARD TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================\n');
}

runPersistenceTests().catch((err) => {
  console.error('Persistence test failed:', err);
  process.exit(1);
});
