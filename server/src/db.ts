import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Start in the server directory, or explicitly set APP_ROOT to that directory.
export function resource(path: string) { return resolve(process.env.APP_ROOT || process.cwd(), path); }
export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path); db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(readFileSync(resource('migrations/001-initial.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations VALUES(1,?)').run(Date.now());
  if(!db.prepare('SELECT 1 FROM schema_migrations WHERE version=2').get())transaction(db,()=>{db.exec(readFileSync(resource('migrations/002-challenge-seed.sql'),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(2,?)').run(Date.now());});
  if(!db.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get())transaction(db,()=>{db.exec(readFileSync(resource('migrations/003-wechat.sql'),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(3,?)').run(Date.now());});
  return db;
}
export type Db = DatabaseSync;
export function transaction<T>(db: Db, run: () => T): T { db.exec('BEGIN IMMEDIATE'); try { const result = run(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
export function json<T>(value: unknown): T { return JSON.parse(String(value)) as T; }

/** Empty-only schema reversal. Normal application rollback keeps additive tables and all data. */
export function rollbackWechatEmpty(db:Db){
 try{db.exec(readFileSync(resource('migrations/003-wechat.down.sql'),'utf8'));}
 catch(error){try{db.exec('ROLLBACK');}catch{/* SQL may have already ended the transaction. */}throw error;}
}
