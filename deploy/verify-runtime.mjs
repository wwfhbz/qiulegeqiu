import {verifyLeaderboardHealth,verifyLeaderboardPage} from './leaderboard-contract.mjs';
// Run as the production service user, with cwd exactly the new release/server.
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

export async function verifyRuntime(server,{start=false}={}) {
 if(process.version!=='v24.19.0')throw Error('必须使用生产Node v24.19.0');
 server=realpathSync(server);
 if(realpathSync(process.cwd())!==server)throw Error('必须从实际release/server运行目录验收');
 const pkg=JSON.parse(readFileSync(join(server,'package.json'),'utf8'));
 const lock=JSON.parse(readFileSync(join(server,'package-lock.json'),'utf8'));
 if(JSON.stringify(Object.entries(pkg.dependencies||{}).sort())!==JSON.stringify(Object.entries(lock.packages?.['']?.dependencies||{}).sort()))throw Error('package.json与锁文件的生产依赖不一致');
 const localModules=join(server,'node_modules')+sep;
 const require=createRequire(join(server,'build/index.js'));
 for(const dep of Object.keys(pkg.dependencies||{})) {
  const target=realpathSync(require.resolve(dep));
  if(!target.startsWith(localModules))throw Error(`运行时依赖不在本release/server/node_modules：${dep}`);
  const installed=JSON.parse(readFileSync(join(server,'node_modules',dep,'package.json'),'utf8'));
  if(installed.version!==lock.packages?.['node_modules/'+dep]?.version)throw Error(`安装版本与锁文件不符：${dep}`);
  const loaded=await import(pathToFileURL(target).href);
  if(dep==='better-sqlite3'){
   const db=new loaded.default(':memory:');try{if(db.prepare('SELECT 1 AS n').get().n!==1)throw Error('原生模块执行失败');}finally{db.close();}
  }
 }
 // Current application uses built-in node:sqlite, not better-sqlite3. Actually execute it.
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');
 try{if(db.prepare('SELECT 1 AS n').get().n!==1)throw Error('SQLite原生运行时异常');}finally{db.close();}
 if(start)await smokeStart(server);
 console.log(JSON.stringify({event:'release_runtime_verified',node:process.version,moduleAbi:process.versions.modules,dependencies:Object.keys(pkg.dependencies),sqlite:pkg.dependencies?.['better-sqlite3']?'better-sqlite3 + node:sqlite':'node:sqlite',started:start}));
}
async function smokeStart(server){
 // Actual production entrypoint, same UID/cwd/runtime, isolated in-memory DB and ephemeral loopback
 // port. No production migrations, player rows, 8091/8080 sockets or current symlink are touched.
 const child=spawn(process.execPath,['build/index.js'],{cwd:server,env:{PATH:process.env.PATH,NODE_ENV:'production',PUBLIC_ORIGIN:'https://ball.gmgnclaw.com',DB_PATH:':memory:',APP_ROOT:server,PORT:'0'},stdio:['ignore','pipe','pipe']});
 let address,buffer='',diagnostic='',exit;
 const closed=new Promise(resolve=>child.once('close',(code,signal)=>{exit={code,signal};resolve();}));
 child.on('error',error=>{diagnostic=error.message;});
 child.stderr.on('data',data=>{diagnostic=(diagnostic+data.toString()).slice(-2048);});
 child.stdout.on('data',data=>{buffer+=data;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{const msg=JSON.parse(line).msg;const match=typeof msg==='string'&&msg.match(/^Server listening at (http:\/\/127\.0\.0\.1:\d+)$/);if(match)address=match[1];}catch{ /* Ignore non-JSON diagnostics, never print secrets. */ }}if(buffer.length>8192)buffer=buffer.slice(-8192);});
 let healthy=false;
 try{
  const deadline=Date.now()+15000;
  while(!address&&!exit&&Date.now()<deadline)await delay(50);
  if(!address||exit)throw Error(`候选API未能启动：${diagnostic||'退出或启动超时'}`);
  const port=Number(new URL(address).port);if(port===8080||port===8091)throw Error('预检不能占用正式或其他游戏端口');
  const response=await fetch(address+'/api/health',{signal:AbortSignal.timeout(3000)}),body=await response.json();
  if(!response.ok||!body.ok||body.database!=='ready')throw Error('候选API健康检查失败');
  verifyLeaderboardHealth(body);
  const boardResponse=await fetch(address+'/api/leaderboard?board=global&limit=20',{signal:AbortSignal.timeout(3000)});if(!boardResponse.ok)throw Error('候选API统一榜单不可用');verifyLeaderboardPage(await boardResponse.json(),body.rulesVersion);
  healthy=true;
 }finally{
  if(!exit)child.kill('SIGTERM');
  await Promise.race([closed,delay(3000,undefined,{ref:false})]);
  if(!exit){child.kill('SIGKILL');await closed;}
 }
 if(healthy&&exit?.code!==0)throw Error('候选API无法正常退出');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{await verifyRuntime(resolve(process.argv[2]),{start:process.argv[3]==='--start'});}
 catch(error){console.error('候选版本运行时验收失败：'+String(error));process.exitCode=1;}
}
