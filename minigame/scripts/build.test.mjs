import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const script=resolve('minigame/scripts/build.mjs');
function rejected(config,pattern){const dir=mkdtempSync(join(tmpdir(),'qlgq-wx-build-'));try{mkdirSync(join(dir,'minigame'));writeFileSync(join(dir,'minigame/local.config.json'),JSON.stringify(config));const r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,pattern);assert(!existsSync(join(dir,'minigame/dist/game.js')));}finally{rmSync(dir,{recursive:true,force:true});}}
test('构建拒绝在客户端配置中放AppSecret',()=>rejected({appid:'touristappid',AppSecret:'forbidden-test-placeholder'},/禁止放AppSecret/));
test('正式构建拒绝HTTP API，即使是localhost',()=>rejected({apiBase:'http://127.0.0.1:8091/api'},/必须使用HTTPS/));
test('可导入小游戏包入口与配置齐备，无后端SQLite或换码Secret代码',()=>{const game=readFileSync('minigame/dist/game.js','utf8'),config=JSON.parse(readFileSync('minigame/dist/project.config.json'));assert.equal(config.compileType,'game');assert.equal(config.miniprogramRoot,'./');assert.equal(JSON.parse(readFileSync('minigame/dist/game.json')).deviceOrientation,'portrait');assert.doesNotMatch(game,/WECHAT_APP_SECRET|jscode2session|node:sqlite|node:crypto|nickname-rules\.json/);assert(game.length>10000);});
