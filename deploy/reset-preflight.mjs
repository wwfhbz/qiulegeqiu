// Node22-compatible, read-only. Never opens SQLite or changes service state.
import * as fs from 'node:fs';import {join,resolve} from 'node:path';import {parseEnv} from 'node:util';import {spawnSync} from 'node:child_process';
const database='/var/lib/qiulegeqiu/leaderboard.sqlite',root='/var/backups/qiulegeqiu-reset';
const [id,commit,sha256]=process.argv.slice(2);
if(id==='--check-pending'){
 if(fs.existsSync(root)){if(fs.realpathSync(root)!==root||fs.statSync(root).uid!==0||(fs.statSync(root).mode&0o077))throw Error('重置账本权限不安全');for(const file of fs.readdirSync(root)){if(file.endsWith('.json')&&JSON.parse(fs.readFileSync(join(root,file))).phase==='prepared')throw Error('存在未完成重置，必须先执行配套回退，不得普通发布');}}
 console.log('没有待恢复的重置事务');process.exit(0);
}

if(!/^[A-Za-z0-9-]{8,80}$/.test(id)||!/^[a-f0-9]{40}$/.test(commit)||!/^[a-f0-9]{64}$/.test(sha256))throw Error('重置批次及审核锚点无效');
if(process.getuid?.()!==0)throw Error('需要root读取实际API配置');
const envPath='/etc/qiulegeqiu-api.env',exists=fs.existsSync(envPath);
if(exists){const env=parseEnv(fs.readFileSync(envPath,'utf8'));if(env.DB_PATH!==database||env.PORT!=='8091')throw Error('实际DB_PATH或端口不符，禁止重置');}
else if(fs.existsSync(database))throw Error('已有数据库却无已核实的环境配置，停止重置');
const cat=spawnSync('systemctl',['cat','qiulegeqiu-api.service'],{encoding:'utf8'});
if(cat.status===0){
 if(!exists)throw Error('已有服务但环境配置缺失');
 const show=p=>{const r=spawnSync('systemctl',['show','qiulegeqiu-api.service','-p',p,'--value'],{encoding:'utf8'});if(r.status!==0)throw Error('不能读取实际API服务配置');return r.stdout.trim();};
 if(show('User')!=='qiulegeqiu'||show('WorkingDirectory')!=='/opt/qiulegeqiu-api/current/server'||show('EnvironmentFiles')!=='/etc/qiulegeqiu-api.env (ignore_errors=no)'||show('Environment')||show('DropInPaths'))throw Error('实际systemd环境/目录存在未知覆盖，停止重置');
 const pid=Number(show('MainPID'));if(pid>0){const live=Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`,'utf8').split('\0').filter(Boolean).map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)];}));
  const open=fs.readdirSync(`/proc/${pid}/fd`).flatMap(fd=>{try{return [fs.readlinkSync(`/proc/${pid}/fd/${fd}`)];}catch{return [];}});if(!open.includes(database)||open.some(path=>/\.(?:sqlite|db)(?:-wal|-shm|-journal)?$/.test(path)&&!['','-wal','-shm','-journal'].some(s=>path===database+s)))throw Error('进程实际打开的SQLite文件与授权路径不符');
  if(live.DB_PATH!==database||live.PORT!=='8091'||fs.realpathSync(`/proc/${pid}/cwd`)!==fs.realpathSync('/opt/qiulegeqiu-api/current/server'))throw Error('运行进程实际数据库/目录不符，禁止清理');
 }
}
for(const suffix of ['','-wal','-shm','-journal']){const p=database+suffix,s=fs.lstatSync(p,{throwIfNoEntry:false});if(s&&(!s.isFile()||s.isSymbolicLink()||s.nlink!==1))throw Error('数据库路径包含链接或特殊文件');}
let state={phase:'new'};
if(fs.existsSync(root)){
 const s=fs.lstatSync(root);if(fs.realpathSync(root)!==root||!s.isDirectory()||s.uid!==0||(s.mode&0o077))throw Error('重置账本目录权限不安全');
 for(const name of fs.readdirSync(root)){if(name.endsWith('.json')&&name!==id+'.json'&&JSON.parse(fs.readFileSync(join(root,name))).phase==='prepared')throw Error('存在其他未完成重置事务，先人工恢复');}
 const file=join(root,id+'.json');if(fs.existsSync(file)){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==0||(stat.mode&0o077))throw Error('重置账本文件不可信');state=JSON.parse(fs.readFileSync(file));if(state.id!==id||state.commit!==commit||state.sha256!==sha256||state.database!==database)throw Error('该批次已绑定其他版本，不会再次清库');if(state.phase!=='complete')throw Error('存在未完成或已回退批次，请先人工检查：'+state.record);}
}
console.log(state.phase);
console.error((exists?'【全新数据库】实际配置已核实：':'【全新数据库】首次安装无旧配置与旧库，限定目标：')+database+'；批次状态 '+state.phase+'（尚未停服或打开数据库）');
