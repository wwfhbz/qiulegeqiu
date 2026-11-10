import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function dataPath(path: string) { return resolve(dirname(fileURLToPath(import.meta.url)), '../../..', 'server', path); }
// Both tsx source and build/server/src have different depths; resolve from process.cwd instead.
export function resource(path: string) { return resolve(process.env.APP_ROOT || process.cwd(), path); }
export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path); db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(readFileSync(resource('migrations/001-initial.sql'), 'utf8'));
  db.prepare('INSERT OR IGNORE INTO schema_migrations VALUES(1,?)').run(Date.now()); return db;
}
export type Db = DatabaseSync;
export function transaction<T>(db: Db, run: () => T): T { db.exec('BEGIN IMMEDIATE'); try { const result = run(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
export function json<T>(value: unknown): T { return JSON.parse(String(value)) as T; }
