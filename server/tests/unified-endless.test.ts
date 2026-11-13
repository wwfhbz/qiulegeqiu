import {it,expect} from 'vitest';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../src/db';
import {endlessLeaderboard,endlessPersonalBest,globalLeaderboard} from '../src/leaderboard';
import {verifyTrace} from '../src/verifier';
import {ENDLESS_V4_RULES_VERSION,ENDLESS_RULES_VERSION,RULES_VERSION} from '../../shared/Challenge';
it('004→005安全增量迁移：一致性备份、旧分/身份/指针不变、重复打开幂等；跨版本最高分且未来无需榜单改动',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qq-unified-')),path=join(dir,'board.sqlite');let db:DatabaseSync|undefined;
 try{db=new DatabaseSync(path);for(const [n,file] of [[1,'001-initial.sql'],[2,'002-challenge-seed.sql'],[3,'003-wechat.sql'],[4,'004-seasons.sql']] as const){db.exec(readFileSync('migrations/'+file,'utf8'));db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(n,1);}
 db.exec("INSERT INTO regions VALUES('ISO:CN',NULL,'country','中国','中国','CN',0)");for(const p of ['a','b'])db.prepare('INSERT INTO players VALUES(?,?,?,?,?,?,?,?)').run(p,'玩家'+p,'玩家'+p,'ISO:CN','country',0,0,'active');db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run('session','a','test-hash','test-csrf',0,9999999999999);
 const add=(d:DatabaseSync,id:string,pid:string,rules:string,score:number,status='verified',mode?:string)=>{
  if(mode)d.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at,seed,mode) VALUES(?,?,?,?,?,?,?)').run('c'+id,'session',rules,0,9999999999999,7,mode);
  else d.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at,seed) VALUES(?,?,?,?,?,?)').run('c'+id,'session',rules,0,9999999999999,7);
  d.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,pid,'c'+id,'key'+id,'fixture',score,1,1,5000,0,0,0,status,'');
 };
 add(db,'oldA','a',ENDLESS_V4_RULES_VERSION,100);add(db,'newA','a',ENDLESS_RULES_VERSION,90);add(db,'oldB','b',ENDLESS_V4_RULES_VERSION,110);add(db,'newB','b',ENDLESS_RULES_VERSION,120);db.prepare('INSERT INTO season_player_bests VALUES(?,?,?)').run(ENDLESS_RULES_VERSION,'a','newA');
 const tables=['players','sessions','scores','challenges','season_player_bests'],snap=tables.map(t=>db!.prepare('SELECT * FROM '+t+' ORDER BY 1').all());await backup(db,join(dir,'before.sqlite'));const archive=new DatabaseSync(join(dir,'before.sqlite'));expect(archive.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');expect(archive.prepare('SELECT * FROM scores ORDER BY 1').all()).toEqual(snap[2]);archive.close();db.close();db=undefined;
 for(let n=0;n<2;n++){db=openDb(path);expect(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get()!.n).toBe(6);for(let i=0;i<tables.length;i++){const rows=db.prepare('SELECT * FROM '+tables[i]+' ORDER BY 1').all();expect(i===3?rows.map(({mode,...r})=>r):rows).toEqual(snap[i]);}expect(db.prepare("SELECT count(*) n FROM challenges WHERE mode='endless'").get()!.n).toBe(4);
  expect(endlessLeaderboard(db,0,20).map(r=>r.id)).toEqual(['newB','oldA']);expect(endlessPersonalBest(db,'a')).toMatchObject({id:'oldA',rank:2});expect(globalLeaderboard(db,0,20)).toEqual([]);db.close();db=undefined;}
 db=openDb(path);add(db,'future','a','endless-2.0.0-test',500,'verified','endless');add(db,'quarantined','b','endless-3.0.0-test',9999,'quarantined','endless');add(db,'campaign','b',RULES_VERSION,10000,'verified','campaign');
 expect(endlessLeaderboard(db,0,20).map(r=>r.id)).toEqual(['future','newB']);expect(endlessPersonalBest(db,'a')).toMatchObject({id:'future',rank:1});expect(()=>verifyTrace([],1e9,7,'endless-2.0.0-test')).toThrow('不支持');
 // Old binary omitting the new column is classified by the compatibility trigger, without a version allowlist.
 add(db,'oldWriter','b',ENDLESS_V4_RULES_VERSION,600);expect(db.prepare('SELECT mode FROM challenges WHERE id=?').get('coldWriter')!.mode).toBe('endless');expect(endlessLeaderboard(db,0,20)[0].id).toBe('oldWriter');
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
