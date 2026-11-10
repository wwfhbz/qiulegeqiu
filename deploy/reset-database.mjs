/** Offline reset transaction. CLI is pinned to this game's DB; tests inject isolated temp paths. */
import {DatabaseSync} from 'node:sqlite';
import * as fs from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
export const DATABASE='/var/lib/qiulegeqiu/leaderboard.sqlite';
export const LEDGERS='/var/backups/qiulegeqiu-reset';
export const CONFIRM_RESET='RESET-QIULEGEQIU-ALL-DATA';
const suffixes=['','-wal','-shm','-journal'];
function digest(p){const hash=createHash('sha256'),fd=fs.openSync(p,'r'),buffer=Buffer.allocUnsafe(1024*1024);try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));return hash.digest('hex');}finally{fs.closeSync(fd);}}
function flush(path){const fd=fs.openSync(path,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function json(path,data){const temp=path+'.tmp-'+randomUUID();fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});flush(temp);fs.renameSync(temp,path);flush(dirname(path));}
function directory(path){if(fs.realpathSync(path)!==resolve(path)||!fs.lstatSync(path).isDirectory())throw Error('重置目录不能包含符号链接');}
function regular(path){const s=fs.lstatSync(path);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('数据库及快照必须为独立普通文件');return s;}
export function assertNoOpenFiles(database,proc='/proc'){
 const paths=suffixes.map(s=>database+s),inodes=new Set(paths.filter(p=>fs.existsSync(p)).map(p=>{const s=regular(p);return `${s.dev}:${s.ino}`;}));
 for(const pid of fs.readdirSync(proc)){if(!/^\d+$/.test(pid))continue;let descriptors;try{descriptors=fs.readdirSync(join(proc,pid,'fd'));}catch(error){if(error.code==='ENOENT'||error.code==='ESRCH')continue;throw Error('无法核实进程文件句柄，停止重置');}
  for(const fd of descriptors){try{const info=fs.statSync(join(proc,pid,'fd',fd));if(inodes.has(`${info.dev}:${info.ino}`))throw Error('数据库仍被进程打开，停止重置：PID '+pid);}catch(error){if(['ENOENT','ESRCH','EBADF'].includes(error.code))continue;throw error;}}
 }
}
export function assertStoppedServices(run=(name)=>spawnSync('systemctl',['is-active','--quiet',name])){
 for(const name of ['qiulegeqiu-api.service','qiulegeqiu-backup.service','qiulegeqiu-backup.timer']){const result=run(name);if(result.status===0)throw Error('重置/恢复前必须停止本游戏API及备份任务');if(![3,4].includes(result.status))throw Error('无法核实服务停用状态，禁止操作数据库');}
}
export class ResetStore{
 constructor({database=DATABASE,ledgerRoot=LEDGERS,id,commit,sha256,quiescent=assertNoOpenFiles}){
  if(!/^[A-Za-z0-9-]{8,80}$/.test(id)||!/^[a-f0-9]{40}$/.test(commit)||!/^[a-f0-9]{64}$/.test(sha256))throw Error('重置批次、审核提交或包哈希无效');
  this.database=resolve(database);this.root=resolve(ledgerRoot);this.id=id;this.commit=commit;this.sha256=sha256;this.quiescent=quiescent;this.ledger=join(this.root,id+'.json');
 }
 inspect(){
  directory(dirname(this.database));for(const s of suffixes)if(fs.lstatSync(this.database+s,{throwIfNoEntry:false}))regular(this.database+s);
  if(!fs.existsSync(this.root))return {phase:'new'};directory(this.root);
  for(const file of fs.readdirSync(this.root)){if(file.endsWith('.json')&&file!==this.id+'.json'){const pending=JSON.parse(fs.readFileSync(join(this.root,file)));if(pending.phase==='prepared')throw Error('存在其他未完成的重置事务，请先恢复');}}
  if(!fs.existsSync(this.ledger))return {phase:'new'};regular(this.ledger);const state=JSON.parse(fs.readFileSync(this.ledger));
  if(state.id!==this.id||state.commit!==this.commit||state.sha256!==this.sha256||state.database!==this.database)throw Error('重置批次已绑定其他审核版本，禁止重复清库');
  return state;
 }
 epoch(){const db=new DatabaseSync(this.database,{readOnly:true});try{return db.prepare('SELECT * FROM deployment_reset_epoch').get();}finally{db.close();}}
 assertEpoch(){const e=this.epoch();if(e?.reset_id!==this.id||e?.source_commit!==this.commit)throw Error('当前数据库不属于该成功重置批次，停止自动操作');}
 snapshot(destination,{verify=true}={}){
  fs.mkdirSync(destination,{mode:0o700});const files=[];
  for(const suffix of suffixes){const source=this.database+suffix;if(!fs.existsSync(source))continue;const before=regular(source),name=basename(source),target=join(destination,name);fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);fs.chmodSync(target,0o600);flush(target);const hash=digest(target);if(hash!==digest(source))throw Error('停服快照源文件发生变化');files.push({name,suffix,sha256:hash,uid:before.uid,gid:before.gid,mode:before.mode&0o777});}
  if(!files.some(f=>f.suffix==='')&&files.length)throw Error('只有WAL/日志但缺少主数据库，不能重置');
  json(join(destination,'manifest.json'),{database:this.database,files});this.verifySnapshot(destination,{integrity:verify});return files;
 }
 verifySnapshot(destination,{integrity=true}={}){
  directory(destination);const manifest=JSON.parse(fs.readFileSync(join(destination,'manifest.json')));if(manifest.database!==this.database||!Array.isArray(manifest.files))throw Error('快照目标路径不同');
  const seen=new Set();for(const f of manifest.files){if(!suffixes.includes(f.suffix)||seen.has(f.suffix)||f.name!==basename(this.database)+f.suffix)throw Error('快照路径或后缀无效');seen.add(f.suffix);regular(join(destination,f.name));if(digest(join(destination,f.name))!==f.sha256)throw Error('快照哈希校验失败');}
  if(manifest.files.length&&!seen.has(''))throw Error('快照主数据库缺失');
  if(integrity&&manifest.files.length){const check=join(dirname(destination),'.check-'+randomUUID());fs.mkdirSync(check,{mode:0o700});try{for(const f of manifest.files)fs.copyFileSync(join(destination,f.name),join(check,f.name));const db=new DatabaseSync(join(check,basename(this.database)));try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('快照SQLite完整性检查失败');}finally{db.close();}}finally{fs.rmSync(check,{recursive:true,force:true});}}
  return manifest;
 }
 prepare(record){
  record=resolve(record);directory(record);const state=this.inspect();if(state.phase==='complete'){this.assertEpoch();return state;}
  if(state.phase!=='new')throw Error('未完成或已回退批次必须人工检查，不能再次清库');
  this.quiescent(this.database);const files=this.snapshot(join(record,'database-original'));this.quiescent(this.database);
  fs.mkdirSync(this.root,{recursive:true,mode:0o700});directory(this.root);
  const receipt={phase:'prepared',id:this.id,commit:this.commit,sha256:this.sha256,database:this.database,record,hadDatabase:files.length>0};
  json(join(record,'database-reset-intent.json'),receipt);json(this.ledger,receipt);
  const temp=join(dirname(this.database),'.fresh-'+randomUUID()+'.sqlite'),owner=fs.statSync(dirname(this.database));
  try{const db=new DatabaseSync(temp);try{db.exec('CREATE TABLE deployment_reset_epoch(reset_id TEXT PRIMARY KEY,source_commit TEXT NOT NULL);');db.prepare('INSERT INTO deployment_reset_epoch VALUES(?,?)').run(this.id,this.commit);}finally{db.close();}fs.chmodSync(temp,0o600);if(process.getuid?.()===0)fs.chownSync(temp,owner.uid,owner.gid);flush(temp);
   for(const suffix of suffixes.slice(1))if(fs.existsSync(this.database+suffix))fs.unlinkSync(this.database+suffix);
   fs.renameSync(temp,this.database);flush(dirname(this.database));this.assertEpoch();return receipt;
  }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 }
 verifyPrepared(record){const s=this.inspect();if(s.phase!=='prepared'||resolve(record)!==s.record)throw Error('没有已验证的停服重置事务');this.verifySnapshot(join(s.record,'database-original'));this.assertEpoch();return s;}
 complete(record){const s=this.verifyPrepared(record),db=new DatabaseSync(this.database,{readOnly:true});try{if(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n<4)throw Error('新版数据库迁移未完成');}finally{db.close();}json(this.ledger,{...s,phase:'complete'});return {phase:'complete'};}
 restore(record){
  const s=this.inspect();if(s.record!==resolve(record)||!['prepared','complete','rolledback'].includes(s.phase))throw Error('重置回退记录不匹配');if(s.phase==='rolledback')return {phase:'rolledback'};if(s.phase==='complete')this.assertEpoch();
  const original=join(record,'database-original'),manifest=this.verifySnapshot(original);this.quiescent(this.database);
  // Retain anything written to the new board before failure; never discard it silently.
  if(!fs.existsSync(join(record,'database-failed-new')))this.snapshot(join(record,'database-failed-new'),{verify:false});
  else this.verifySnapshot(join(record,'database-failed-new'),{integrity:false});
  const stage=join(record,'.restore-'+randomUUID());fs.mkdirSync(stage,{mode:0o700});
  try{for(const f of manifest.files){const path=join(stage,f.name);fs.copyFileSync(join(original,f.name),path);fs.chmodSync(path,f.mode);if(process.getuid?.()===0)fs.chownSync(path,f.uid,f.gid);flush(path);}
   // Main DB and all sidecars are replaced only while API and backup writers are stopped.
   for(const suffix of suffixes)if(fs.existsSync(this.database+suffix)){regular(this.database+suffix);fs.unlinkSync(this.database+suffix);}
   for(const f of manifest.files)fs.copyFileSync(join(stage,f.name),this.database+f.suffix,fs.constants.COPYFILE_EXCL);
   for(const f of manifest.files){fs.chmodSync(this.database+f.suffix,f.mode);if(process.getuid?.()===0)fs.chownSync(this.database+f.suffix,f.uid,f.gid);flush(this.database+f.suffix);if(digest(this.database+f.suffix)!==f.sha256)throw Error('恢复后的数据库文件哈希不匹配，保持API停止');}flush(dirname(this.database));
   json(this.ledger,{...s,phase:'rolledback'});return {phase:'rolledback'};
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
 }
}
function productionRecord(record){const path=resolve(record);if(!path.startsWith('/var/backups/qiulegeqiu-install/')||fs.realpathSync(path)!==path||fs.statSync(path).uid!==0||(fs.statSync(path).mode&0o077))throw Error('重置事务目录不可信');return path;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.getuid?.()!==0)throw Error('生产重置助手必须由root调用');
  const [op,id,commit,sha256,record,confirmation]=process.argv.slice(2);const store=new ResetStore({id,commit,sha256});
  if(op==='inspect'){const s=store.inspect();if(s.phase==='complete')store.assertEpoch();else if(s.phase!=='new')throw Error('批次尚未完成或已回退，请先人工恢复');console.log(s.phase);}
  else{productionRecord(record);if(['prepare','restore'].includes(op))assertStoppedServices();if(op==='prepare'){if(confirmation!==CONFIRM_RESET)throw Error('缺少完整数据放弃确认');console.log(JSON.stringify(store.prepare(record)));}
   else if(op==='verify')console.log(JSON.stringify(store.verifyPrepared(record)));
   else if(op==='complete')console.log(JSON.stringify(store.complete(record)));
   else if(op==='restore')console.log(JSON.stringify(store.restore(record)));
   else throw Error('未知重置操作');}
 }catch(error){console.error('【全新数据库】'+error.message);process.exitCode=1;}
}
