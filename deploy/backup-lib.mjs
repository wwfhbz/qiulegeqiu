import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, realpath, lstat, chmod, rename, unlink, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
const ownBackup=/^qiulegeqiu-\d{4}-\d{2}-\d{2}T[0-9.-]+Z-[0-9a-f-]{36}\.sqlite$/;
async function directoryPath(path) { await mkdir(path,{recursive:true,mode:0o700});if(await realpath(path)!==resolve(path)||(await lstat(path)).isSymbolicLink())throw Error('备份目录不能包含符号链接'); }
export async function createBackup({source,directory,now=Date.now(),retainDays=7}) {
  if(!Number.isInteger(retainDays)||retainDays<7)throw Error('至少保留7天备份');
  source=resolve(source);directory=resolve(directory);
  if((await lstat(source)).isSymbolicLink()||await realpath(source)!==source)throw Error('数据库不能使用符号链接');
  await directoryPath(directory);
  const name=`qiulegeqiu-${new Date(now).toISOString().replaceAll(':','-')}-${randomUUID()}.sqlite`;
  const destination=join(directory,name),partial=destination+'.partial';let db;
  try {
    db=new DatabaseSync(source,{readOnly:true});await backup(db,partial);db.close();db=undefined;
    await chmod(partial,0o600);const check=new DatabaseSync(partial,{readOnly:true});
    let counts;
    try {if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||check.prepare('PRAGMA foreign_key_check').all().length)throw Error('备份完整性检查失败');counts={players:Number(check.prepare('SELECT COUNT(*) AS n FROM players').get().n),scores:Number(check.prepare('SELECT COUNT(*) AS n FROM scores').get().n)};}finally{check.close();}
    await rename(partial,destination);
    const removed=[];for(const file of await readdir(directory)){if(!ownBackup.test(file)||file===name)continue;const path=join(directory,file),info=await lstat(path);if(info.isFile()&&!info.isSymbolicLink()&&info.mtimeMs<now-retainDays*86400000){await unlink(path);removed.push(file);}}
    return {file:destination,counts,removed,retainedDays:retainDays};
  } catch(error) {if(db)db.close();await unlink(partial).catch(()=>{});throw error;}
}
