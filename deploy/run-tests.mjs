// Bootstrap is intentionally Node22-compatible. Never discovers or changes a production runtime.
import {existsSync,realpathSync,readdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
try{
 const node=realpathSync(process.env.QIULEGEQIU_TEST_NODE||process.execPath);
 const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const version=spawnSync(node,['--version'],{encoding:'utf8',env});
 if(version.error||version.status!==0||version.stdout.trim()!=='v24.19.0')throw Error('部署测试必须使用Node v24.19.0。请显式设置QIULEGEQIU_TEST_NODE和QIULEGEQIU_TEST_NPM_CLI；不会自动使用/opt生产运行时或绕过版本检查。');
 const npmCandidate=process.env.QIULEGEQIU_TEST_NPM_CLI||join(dirname(node),'../lib/node_modules/npm/bin/npm-cli.js');
 if(!existsSync(npmCandidate))throw Error('找不到配套npm-cli.js，请显式设置QIULEGEQIU_TEST_NPM_CLI（支持Ubuntu独立安装与官方tar布局）');
 const npm=realpathSync(npmCandidate);
 Object.assign(env,{PATH:dirname(node)+':'+(process.env.PATH||'/usr/bin:/bin'),QIULEGEQIU_TEST_NODE:node,QIULEGEQIU_TEST_NPM_CLI:npm});
 console.log(`部署测试运行时：${node}（v24.19.0）；npm CLI：${npm}`);
 if(process.argv.includes('--check'))process.exit(0);
 function run(args){const r=spawnSync(node,args,{cwd:root,env,stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);}
 // Tests consume real build artifacts; do not rely on a stale or absent server/build directory.
 run([npm,'run','build','--prefix','server']);
 const tests=readdirSync(join(root,'deploy/tests')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>join(root,'deploy/tests',n));
 run(['--test',...tests]);
}catch(error){console.error(String(error));process.exitCode=1;}
