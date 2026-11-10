import test,{after} from 'node:test';
import {createRuntimeFixture} from './runtime-fixture.mjs';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,cpSync,copyFileSync,readFileSync,writeFileSync,statSync,chmodSync,renameSync,rmSync,existsSync,readdirSync,symlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const runtime=createRuntimeFixture();after(()=>runtime.cleanup());
const root=process.cwd(),installer=resolve('deploy/install-production-deps.sh'),verifier=resolve('deploy/verify-runtime.mjs');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'qlgq-runtime-')),server=join(dir,'server');mkdirSync(server);
 for(const name of ['package.json','package-lock.json'])copyFileSync(join(root,'server',name),join(server,name));
 for(const name of ['build','data','migrations'])cpSync(join(root,'server',name),join(server,name),{recursive:true});
 return {dir,server};
}
function verify(server,start=false){return spawnSync(runtime.node,[verifier,server,...(start?['--start']:[])],{cwd:server,encoding:'utf8',env:{PATH:process.env.PATH},timeout:25000});}
test('真实npm ci在077下复现51个包仍不可供其他UID读取；缺fastify阻止切换，修复安装后实际入口可启动',()=>{
 const f=fixture();try{
  const npm=runtime.npm;
  const oldEnv={...process.env,HOME:f.dir};for(const key of Object.keys(oldEnv))if(/^npm_config_/i.test(key)||['NODE_OPTIONS','NODE_PATH'].includes(key))delete oldEnv[key];
  const old=execFileSync('bash',['-c','umask 077; exec "$1" "$2" ci --prefix "$PWD" --global=false --workspaces=false --omit=dev --ignore-scripts --no-audit --no-fund --cache "$HOME/.cache"','sh',runtime.node,npm],{cwd:f.server,encoding:'utf8',env:oldEnv});
  assert.match(old,/added \d+ packages/);
  assert.equal(statSync(join(f.server,'node_modules')).mode&0o777,0o700);
  assert.equal(statSync(join(f.server,'node_modules/fastify')).mode&0o777,0o700);
  // Non-root process with no traversal access sees the same missing-package failure.
  chmodSync(join(f.server,'node_modules/fastify'),0);
  try{const denied=process.getuid()===0?spawnSync('setpriv',['--bounding-set=-dac_override,-dac_read_search',runtime.node,verifier,f.server],{cwd:f.server,encoding:'utf8',env:{PATH:process.env.PATH},timeout:25000}):verify(f.server);assert.equal(denied.error,undefined,denied.error?.message);assert.notEqual(denied.status,0);assert.match(denied.stderr,/fastify|EACCES|MODULE_NOT_FOUND/);}finally{chmodSync(join(f.server,'node_modules/fastify'),0o700);}
  renameSync(join(f.server,'node_modules/fastify'),join(f.server,'node_modules/fastify-missing'));
  const missing=verify(f.server);assert.notEqual(missing.status,0);assert.match(missing.stderr,/fastify/);
  // Explicit prefix + clean environment defeats inherited global/prefix redirection.
  execFileSync('bash',[installer,runtime.node,f.server],{cwd:'/',encoding:'utf8',env:{...process.env,npm_config_global:'true',npm_config_prefix:join(f.dir,'wrong-prefix')},timeout:60000});
  assert(!existsSync(join(f.dir,'wrong-prefix')));
  function permissions(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const p=join(dir,item.name),m=statSync(p).mode;if(item.isSymbolicLink())continue;if(item.isDirectory()){assert.equal(m&0o777,0o755,p);permissions(p);}else assert.equal(m&0o044,0o044,p);}}
  permissions(join(f.server,'node_modules'));
  assert(!existsSync(join(f.server,'node_modules/typescript')));
  const good=verify(f.server,true);assert.equal(good.status,0,good.stdout+good.stderr);assert.match(good.stdout,/"started":true/);assert.match(good.stdout,/"sqlite":"node:sqlite"/);
  const entry=join(f.server,'build/index.js'),originalEntry=readFileSync(entry);
  writeFileSync(entry,'throw new Error("fixture actual entry startup failure")');
  const brokenStart=verify(f.server,true);assert.notEqual(brokenStart.status,0);assert.match(brokenStart.stderr,/fixture actual entry startup failure/);writeFileSync(entry,originalEntry);
  // Missing local package must not be satisfied from ancestor/global node_modules.
  mkdirSync(join(f.dir,'node_modules'));renameSync(join(f.server,'node_modules/fastify'),join(f.dir,'node_modules/fastify'));
  const ancestor=verify(f.server);assert.notEqual(ancestor.status,0);assert.match(ancestor.stderr,/本release/);
  renameSync(join(f.dir,'node_modules/fastify'),join(f.server,'node_modules/fastify'));
  // Native-module rejection is real loading, not a string search. Current app needs no addon.
  const pkg=JSON.parse(readFileSync(join(f.server,'package.json'))),lock=JSON.parse(readFileSync(join(f.server,'package-lock.json')));
  pkg.dependencies['better-sqlite3']='0.0.0-test';lock.packages[''].dependencies['better-sqlite3']='0.0.0-test';lock.packages['node_modules/better-sqlite3']={version:'0.0.0-test'};
  writeFileSync(join(f.server,'package.json'),JSON.stringify(pkg));writeFileSync(join(f.server,'package-lock.json'),JSON.stringify(lock));
  const addon=join(f.server,'node_modules/better-sqlite3');mkdirSync(addon);writeFileSync(join(addon,'package.json'),'{"main":"index.cjs","version":"0.0.0-test"}');writeFileSync(join(addon,'index.cjs'),'throw new Error("ERR_DLOPEN_FAILED: fixture ABI mismatch")');
  const native=verify(f.server);assert.notEqual(native.status,0);assert.match(native.stderr,/ERR_DLOPEN_FAILED/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
function rollbackFixture(){
 const dir=mkdtempSync(join(tmpdir(),'qlgq-rollback-')),record=join(dir,'record'),base=join(dir,'api'),web=join(dir,'web'),bin=join(dir,'bin');
 for(const d of [record,base,web,bin])mkdirSync(d);
 const log=join(dir,'commands');writeFileSync(log,'');
 writeFileSync(join(bin,'systemctl'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\ncase "$1" in is-active|is-enabled) exit 1;;esac\n');chmodSync(join(bin,'systemctl'),0o755);
 const dbpath=join(dir,'leaderboard.sqlite'),db=new DatabaseSync(dbpath);db.exec('CREATE TABLE players(id TEXT);INSERT INTO players VALUES("real-fixture-player")'.replaceAll('"',"'"));db.close();
 const dbBefore=readFileSync(dbpath),inode=statSync(dbpath).ino;
 for(const unit of ['qiulegeqiu-api.service','qiulegeqiu-backup.timer']){writeFileSync(join(record,unit+'.enabled'),'not-found');writeFileSync(join(record,unit+'.active'),'inactive');}
 return {dir,record,base,web,bin,log,dbpath,dbBefore,inode};
}
function rollback(f,previous=''){
 return spawnSync('bash',['-c','set -Eeuo pipefail; source "$1"; rollback_install_resources "$2" "$3" "$4" "$5"','sh',resolve('deploy/first-install-rollback-lib.sh'),f.record,f.base,f.web,previous],{encoding:'utf8',env:{...process.env,PATH:f.bin+':'+process.env.PATH,COMMAND_LOG:f.log}});
}
test('首次安装在服务尚未创建时失败：不stop/disable不存在的服务，不触碰数据库',()=>{
 const f=rollbackFixture();try{const r=rollback(f);assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(f.log,'utf8'),'');assert.deepEqual(readFileSync(f.dbpath),f.dbBefore);assert.equal(statSync(f.dbpath).ino,f.inode);}finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('首次安装切换后失败：移除本次指针和新增文件、恢复网页，旧数据库原样保留',()=>{
 const f=rollbackFixture();try{
  const release=join(f.base,'release');mkdirSync(release);symlinkSync(release,join(f.base,'current'));
  const newConfig=join(f.dir,'new.env');writeFileSync(newConfig,'safe fixture');writeFileSync(join(f.record,'changed-files'),newConfig+'\n');writeFileSync(join(f.record,'publish-attempted'),'');writeFileSync(join(f.record,'index.html'),'original html');writeFileSync(join(f.web,'index.html'),'new html');
  const r=rollback(f);assert.equal(r.status,0,r.stderr);assert(!existsSync(join(f.base,'current')));assert(!existsSync(newConfig));assert.equal(readFileSync(join(f.web,'index.html'),'utf8'),'original html');assert.deepEqual(readFileSync(f.dbpath),f.dbBefore);assert.equal(statSync(f.dbpath).ino,f.inode);
  assert.doesNotMatch(readFileSync(f.log,'utf8'),/disable|stop|game|8080/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
test('发布顺序与隔离：服务用户候选启动先于current切换，生产数据库不参与预检',()=>{
 const publish=readFileSync('deploy/publish.sh','utf8'),check=readFileSync(verifier,'utf8'),rollback=readFileSync('deploy/first-install-rollback-lib.sh','utf8');
 assert(publish.indexOf('install-production-deps.sh')<publish.indexOf('verify-runtime.mjs'));
 assert(publish.indexOf('verify-runtime.mjs')<publish.indexOf('mv -Tf "$base/current.new-$$"'));
 assert.match(publish,/runuser -u qiulegeqiu -- env -i/);assert.match(check,/DB_PATH:':memory:'/);assert.match(check,/PORT:'0'/);
 assert.doesNotMatch(rollback,/8080|game\.gmgnclaw|sqlite|\/var\/lib/);
});

test('安装新unit后失败：只移除本次新增unit，不disable原本不存在的服务',()=>{
 const f=rollbackFixture();try{
  const unit=join(f.dir,'qiulegeqiu-api.service');writeFileSync(unit,'new unit');writeFileSync(join(f.record,'changed-files'),unit+'\n');
  const r=rollback(f);assert.equal(r.status,0,r.stderr);assert(!existsSync(unit));assert.equal(readFileSync(f.log,'utf8'),'daemon-reload\n');assert.deepEqual(readFileSync(f.dbpath),f.dbBefore);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});

test('完整publish缺包回归：假成功安装不能切换版本；旧库在线备份且原数据不变',()=>{
 const f=fixture();try{
  const base=join(f.dir,'api'),site=join(f.dir,'site'),data=join(f.dir,'data'),backups=join(f.dir,'backups'),etc=join(f.dir,'etc'),bin=join(f.dir,'bin'),source=join(f.dir,'source'),log=join(f.dir,'commands');
  for(const d of [base,site,data,backups,etc,bin,source])mkdirSync(d);
  const dbpath=join(data,'leaderboard.sqlite'),db=new DatabaseSync(dbpath);db.exec("CREATE TABLE players(id TEXT PRIMARY KEY);CREATE TABLE scores(id TEXT PRIMARY KEY);INSERT INTO players VALUES('existing');INSERT INTO scores VALUES('best')");db.close();
  const original=readFileSync(dbpath),inode=statSync(dbpath).ino;
  const previous=join(base,'releases/previous');mkdirSync(join(previous,'server/build'),{recursive:true});writeFileSync(join(previous,'server/build/index.js'),'old');writeFileSync(join(previous,'RULES_VERSION'),'test-rules');symlinkSync(previous,join(base,'current'));
  mkdirSync(join(base,'node/bin'),{recursive:true});copyFileSync(runtime.node,join(base,'node/bin/node'));chmodSync(join(base,'node/bin/node'),0o755);
  writeFileSync(join(site,'index.html'),'old html');writeFileSync(join(etc,'qiulegeqiu-api.service'),'owned unit');
  const envfile=join(etc,'qiulegeqiu-api.env');writeFileSync(envfile,`NODE_ENV=production\nPORT=8091\nPUBLIC_ORIGIN=https://ball.gmgnclaw.com\nDB_PATH=${dbpath}\n`);
  cpSync(f.server,join(source,'server'),{recursive:true});cpSync(join(root,'deploy'),join(source,'deploy'),{recursive:true});
  mkdirSync(join(source,'dist/assets'),{recursive:true});writeFileSync(join(source,'dist/index.html'),'new html');writeFileSync(join(source,'dist/assets/game.js'),'game');writeFileSync(join(source,'VERSION'),'0.8.0');writeFileSync(join(source,'RULES_VERSION'),'test-rules');
  const replacements=[['/opt/qiulegeqiu-api',base],['/var/www/qiulegeqiu',site],['/var/lib/qiulegeqiu',data],['/var/backups/qiulegeqiu',backups],['/etc/qiulegeqiu-api.env',envfile],['/etc/systemd/system/qiulegeqiu-api.service',join(etc,'qiulegeqiu-api.service')],['/run/lock/qiulegeqiu-rollout.lock',join(f.dir,'rollout.lock')]];
  let script=readFileSync(join(root,'deploy/publish.sh'),'utf8').replace('[[ $EUID = 0 ]]','true # unprivileged fixture only');
  for(const [from,to] of replacements)script=script.replaceAll(from,to);
  const publisher=join(f.dir,'publish-fixture.sh');writeFileSync(publisher,script);
  for(const name of ['backup.mjs','check-production-env.mjs']){
   const path=join(source,'deploy',name);let text=readFileSync(path,'utf8');for(const [from,to] of replacements)text=text.replaceAll(from,to);writeFileSync(path,text);
  }
  // Fault injection: mimic npm exit 0/"added packages" but provide no runtime packages.
  writeFileSync(join(source,'deploy/install-production-deps.sh'),'#!/bin/bash\necho "added 51 packages (fault fixture: missing dependency tree)"\n');
  function executable(name,body){const p=join(bin,name);writeFileSync(p,'#!/bin/sh\n'+body);chmodSync(p,0o755);}
  executable('node','echo "错误：意外调用系统Node22夹具" >&2\nexit 97\n');
  executable('id',`if [ "$1" = -u ] && [ "$2" = qiulegeqiu ];then echo ${process.getuid()};else exec /usr/bin/id "$@";fi\n`);
  executable('runuser','shift 3\nexec "$@"\n');
  executable('systemctl','printf "%s\\n" "$*" >> "$COMMAND_LOG"\nexit 0\n');
  writeFileSync(log,'');
  const launch=()=>spawnSync('bash',[publisher,'--apply',source],{encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,COMMAND_LOG:log,QIULEGEQIU_LOCK_HELD:''},timeout:30000});
  const runtimeNode=join(base,'node/bin/node'),savedNode=runtimeNode+'.verified24';renameSync(runtimeNode,savedNode);
  writeFileSync(runtimeNode,'#!/bin/sh\necho v22.23.4\n');chmodSync(runtimeNode,0o755);
  try{const wrong=launch();assert.equal(wrong.error,undefined);assert.equal(wrong.status,1);assert.match(wrong.stderr,/运行时必须为生产Node v24.19.0/);assert.doesNotMatch(wrong.stdout,/added 51 packages/);assert.deepEqual(readFileSync(dbpath),original);}finally{rmSync(runtimeNode);renameSync(savedNode,runtimeNode);}
  const r=launch();
  assert.equal(r.error,undefined,r.error?.message);assert.equal(r.signal,null);assert.equal(r.status,1,r.stdout+r.stderr);assert.match(r.stdout,/added 51 packages/);assert.match(r.stderr,/候选版本运行时验收失败/);assert.match(r.stderr,/fastify/);assert.equal(readFileSync(join(site,'index.html'),'utf8'),'old html');
  assert.equal(execFileSync('readlink',['-f',join(base,'current')],{encoding:'utf8'}).trim(),previous);
  assert.equal(readFileSync(log,'utf8'),'');assert.deepEqual(readFileSync(dbpath),original);assert.equal(statSync(dbpath).ino,inode);
  assert(readdirSync(backups).some(n=>n.endsWith('.sqlite')));
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});


test('回退只恢复变更清单中的配置，未修改配置及其他游戏文件保持原样',()=>{
 const f=rollbackFixture();try{
  const changed=join(f.dir,'api.env'),untouched=join(f.dir,'unchanged.env'),otherGame=join(f.dir,'game.gmgnclaw.com.conf');
  writeFileSync(changed,'new config');writeFileSync(untouched,'independent edit');writeFileSync(otherGame,'other game 8080 untouched');
  const snapshot=join(f.record,'files',f.dir);mkdirSync(snapshot,{recursive:true});writeFileSync(join(snapshot,'api.env'),'old config');writeFileSync(join(snapshot,'unchanged.env'),'stale config');
  writeFileSync(join(f.record,'changed-files'),changed+'\n');
  const r=rollback(f);assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(changed,'utf8'),'old config');assert.equal(readFileSync(untouched,'utf8'),'independent edit');assert.equal(readFileSync(otherGame,'utf8'),'other game 8080 untouched');assert.equal(readFileSync(f.log,'utf8'),'');assert.deepEqual(readFileSync(f.dbpath),f.dbBefore);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
