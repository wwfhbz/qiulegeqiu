import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const source='/var/lib/qiulegeqiu/leaderboard.sqlite',directory='/var/backups/qiulegeqiu';
process.umask(0o077);mkdirSync(directory,{recursive:true,mode:0o700});
const db=new DatabaseSync(source,{readOnly:true});
const destination=`${directory}/${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.sqlite`;
await backup(db,destination);db.close();chmodSync(destination,0o600);
const check=new DatabaseSync(destination,{readOnly:true});if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('备份完整性失败');check.close();console.log(destination);
