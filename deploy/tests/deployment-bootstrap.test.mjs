import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const runner=resolve('deploy/run-tests.mjs');
test('部署测试入口显式选择24.19.0且不依赖生产目录，错误版本在夹具前明确拒绝',()=>{
 const dir=mkdtempSync(join(tmpdir(),'qlgq-bootstrap-'));
 try{
  const wrong=join(dir,'node22');writeFileSync(wrong,'#!/bin/sh\necho v22.23.4\n');chmodSync(wrong,0o755);
  const bad=spawnSync(process.execPath,[runner,'--check'],{encoding:'utf8',env:{...process.env,QIULEGEQIU_TEST_NODE:wrong}});
  assert.equal(bad.status,1);assert.equal(bad.signal,null);assert.match(bad.stderr,/必须使用Node v24.19.0/);assert.match(bad.stderr,/QIULEGEQIU_TEST_NODE/);
  const good=spawnSync(process.execPath,[runner,'--check'],{encoding:'utf8',env:{...process.env,QIULEGEQIU_TEST_NODE:process.execPath}});
  assert.equal(good.status,0,good.stdout+good.stderr);assert.match(good.stdout,/v24.19.0/);
  const badNpm=spawnSync(process.execPath,[runner,'--check'],{encoding:'utf8',env:{...process.env,QIULEGEQIU_TEST_NODE:process.execPath,QIULEGEQIU_TEST_NPM_CLI:join(dir,'missing-npm.js')}});
  assert.equal(badNpm.status,1);assert.match(badNpm.stderr,/QIULEGEQIU_TEST_NPM_CLI/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
