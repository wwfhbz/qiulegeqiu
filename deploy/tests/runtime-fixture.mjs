import {mkdtempSync,mkdirSync,copyFileSync,cpSync,chmodSync,realpathSync,existsSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

export function createRuntimeFixture(){
 const selected=realpathSync(process.env.QIULEGEQIU_TEST_NODE||process.execPath);
 const cleanEnv={...process.env};delete cleanEnv.NODE_OPTIONS;delete cleanEnv.NODE_PATH;
 const check=spawnSync(selected,['--version'],{encoding:'utf8',env:cleanEnv});
 if(check.error||check.status!==0||check.stdout.trim()!=='v24.19.0')throw Error('夹具要求显式选择真实Node v24.19.0；请运行npm run test:deploy并设置QIULEGEQIU_TEST_NODE');
 const npmCli=realpathSync(process.env.QIULEGEQIU_TEST_NPM_CLI||resolve(dirname(selected),'../lib/node_modules/npm/bin/npm-cli.js'));
 const dir=mkdtempSync(join(tmpdir(),'qlgq-controlled-runtime-'));
 try{
  const bin=join(dir,'bin'),npmRoot=join(dir,'lib/node_modules/npm');mkdirSync(bin,{recursive:true});mkdirSync(dirname(npmRoot),{recursive:true});
  copyFileSync(selected,join(bin,'node'));chmodSync(join(bin,'node'),0o755);
  // npm-cli's parent is bin; copy the actual npm package, including its dependency tree.
  cpSync(resolve(dirname(npmCli),'..'),npmRoot,{recursive:true,dereference:true});
  const node=join(bin,'node'),npm=join(npmRoot,'bin/npm-cli.js');
  if(!existsSync(npm))throw Error('所选npm CLI不属于完整npm包');
  const version=spawnSync(node,['--version'],{encoding:'utf8',env:cleanEnv});
  if(version.status!==0||version.stdout.trim()!=='v24.19.0')throw Error('临时夹具Node版本验证失败');
  return {dir,node,npm,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
 }catch(error){rmSync(dir,{recursive:true,force:true});throw error;}
}
