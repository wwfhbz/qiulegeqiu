import { readFileSync } from 'node:fs';
import { resource, transaction, type Db } from './db.js';
export interface Region { code: string; parent: string | null; level: string; name: string; prefix: string; country: string; priority: number }
export const regionData = JSON.parse(readFileSync(resource('data/regions.json'), 'utf8')) as { metadata: Record<string, unknown>; common: string[]; aliases: Record<string,string>; regions: Region[] };
export function seedRegions(db: Db) { transaction(db, () => { const insert = db.prepare('INSERT INTO regions VALUES(?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET parent=excluded.parent,level=excluded.level,name=excluded.name,prefix=excluded.prefix,country=excluded.country,priority=excluded.priority'); for (const r of regionData.regions) insert.run(r.code,r.parent,r.level,r.name,r.prefix,r.country,r.priority); }); }
export function region(db: Db, code: string) { const alias=regionData.aliases[code.replace(/^ISO:/,'')]; if(alias)code=`CN:${alias}`; return db.prepare('SELECT * FROM regions WHERE code=?').get(code) as unknown as Region | undefined; }
export function regionView(db: Db, r: Region) { const path: string[] = []; let p = r.parent; while (p) { const parent = region(db,p); if (!parent) break; path.unshift(parent.name); p=parent.parent; } return {...r,path:path.join(' / '),hasChildren:!!db.prepare('SELECT 1 FROM regions WHERE parent=? LIMIT 1').get(r.code)}; }
export function searchRegions(db: Db, parent: string | undefined, q: string, offset: number) {
  const alias=regionData.aliases[q.toUpperCase()];
  const term = `%${q.replace(/[\\%_]/g,'\\$&')}%`;
  const clause = parent ? 'parent=?' : '(level=\'country\' OR code IN (\'CN:710000\',\'CN:810000\',\'CN:820000\'))';
  const codeTerm=alias?`%CN:${alias}%`:term;
  const args = parent ? [parent,term,codeTerm] : [term,codeTerm];
  const rows = db.prepare(`SELECT * FROM regions WHERE ${clause} AND (name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\') ORDER BY priority,code LIMIT 51 OFFSET ?`).all(...args,offset) as unknown as Region[];
  return { items: rows.slice(0,50).map(r=>regionView(db,r)), nextOffset: rows.length>50?offset+50:null, version:regionData.metadata.version };
}
if(process.argv.includes('--check')) { const codes=new Set(regionData.regions.map(r=>r.code)); if(codes.size!==regionData.regions.length||regionData.regions.some(r=>r.parent&&!codes.has(r.parent)))throw Error('区划缺失或重复'); console.log(regionData.metadata); }
