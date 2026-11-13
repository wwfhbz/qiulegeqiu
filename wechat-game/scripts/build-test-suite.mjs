import {test} from 'node:test';import assert from 'node:assert/strict';import * as fs from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawnSync} from 'node:child_process';import vm from 'node:vm';
import {readBuildConfig,buildWechatGame,getOpenDataEntry,cli} from './build.mjs';
export function buildTests(client){
 function rejected(config,pattern){const dir=fs.mkdtempSync(join(tmpdir(),'qq-wechat-config-'));try{fs.writeFileSync(join(dir,'local.config.json'),JSON.stringify(config));assert.throws(()=>readBuildConfig(dir),pattern);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
 test('客户端配置拒绝AppSecret与含凭据的API地址',()=>{rejected({AppSecret:'forbidden-test-value'},/禁止放AppSecret/);rejected({apiBase:'https://user:password@example.test/api'},/不能包含凭据/);});
 test('提审构建不能使用游客AppID，不把开发占位当正式登录',()=>{const dir=fs.mkdtempSync(join(tmpdir(),'qq-wx-release-'));try{assert.throws(()=>readBuildConfig(dir,false,true),/真实小游戏AppID/);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
 test('正式包拒绝HTTP，检查配置不依赖当前工作目录',()=>{rejected({apiBase:'http://127.0.0.1:8091/api'},/必须使用HTTPS/);const dir=fs.mkdtempSync(join(tmpdir(),'qq-wx-cwd-'));try{const result=spawnSync(process.execPath,[resolve(client,'scripts/build.mjs'),'--check'],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
 test('可导入包配置完整，复用同一规则而不打包浏览器或服务端',()=>{const out=resolve(client,'dist'),bundle=fs.readFileSync(join(out,'game.js'),'utf8'),project=JSON.parse(fs.readFileSync(join(out,'project.config.json'))),info=JSON.parse(fs.readFileSync(join(out,'build-info.json')));assert(fs.statSync(join(out,'assets/ranking-scene.png')).size>1000);assert(info.inputs.includes('shared/VisualTheme.ts'));assert.equal(project.compileType,'game');assert.equal(project.projectname,'球球出击');assert.equal(project.miniprogramRoot,'./');assert.equal(JSON.parse(fs.readFileSync(join(out,'game.json'))).deviceOrientation,'portrait');assert.equal(info.rulesVersion,'1.8.0-arcade-5l-12lv-powerpts-v6');assert.equal(info.endlessRulesVersion,'endless-1.6.0-3l-sink-v7');assert(info.inputs.includes('src/Game.ts'));assert(info.inputs.includes('src/Physics.ts'));assert(!info.inputs.some(p=>p.includes('WebPlatform')||p.includes('server/')));assert.doesNotMatch(bundle,/WECHAT_APP_SECRET|jscode2session|node:sqlite|node:crypto|nickname-rules\.json|document\.cookie|\bwindow\s*\./);});
 test('开放数据域单独构建且无主域网络/身份依赖，可无DOM读取与绘制空好友榜',()=>{
  const out=resolve(client,'dist'),config=JSON.parse(fs.readFileSync(join(out,'game.json'))),bundle=fs.readFileSync(join(out,getOpenDataEntry(config)),'utf8');assert.equal(config.openDataContext,'open-data');assert.equal(getOpenDataEntry(config),'open-data/index.js');assert(!fs.existsSync(join(out,'open-data/game.js')));assert.doesNotMatch(bundle,/WECHAT_APP_SECRET|jscode2session|localStorage|document\.|\.request\(|openid.*postMessage/);let receive;const texts=[],context=new Proxy({fillText:s=>texts.push(s),measureText:s=>({width:String(s).length*8})},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}}),canvas={width:1,height:1,getContext:()=>context},writes=[];
  const wx={getSharedCanvas:()=>canvas,onMessage:f=>{receive=f;},getUserCloudStorage:o=>o.success({KVDataList:[]}),getFriendCloudStorage:o=>o.success({data:[]}),setUserCloudStorage:o=>{writes.push(o.KVDataList);o.success();}};
  vm.runInNewContext(bundle,{wx,console,Date,Math,Number,Map,Set,JSON,module:{exports:{}},exports:{}},{timeout:3000});receive({type:'show',mode:'campaign',width:300,height:400,ratio:2});assert.equal(canvas.width,600);assert(texts.includes('还没有同玩好友的有效记录'));assert.equal(writes.length,0);const before=texts.length;receive({type:'hide'});receive({type:'scroll',dy:-20});assert.equal(texts.length,before);
 });
 test('配置入口为目录/index.js，拒绝路径越界及旧文件名写法',()=>{
  assert.equal(getOpenDataEntry({openDataContext:'open-data'}),'open-data/index.js');
  for(const directory of [undefined,'','../open-data','/open-data','open-data/index.js','a/../../b','a\\b'])assert.throws(()=>getOpenDataEntry({openDataContext:directory}),/相对目录/);
 });
 test('正式/开发/正式重复重建始终保留可加载index.js，不沿用旧game.js',async()=>{
  const root=fs.mkdtempSync(join(tmpdir(),'qq-open-entry-'));
  try{
   // Public, deliberately synthetic AppID exercises packaging gates; it is NOT a real platform login.
   fs.writeFileSync(join(root,'local.config.json'),JSON.stringify({appid:'wx0123456789abcdef'}));
   for(const [attempt,development] of [false,true,false].entries()){
    let out;if(development)out=await buildWechatGame({configRoot:root,development});else{const argv=process.argv;try{process.argv=[argv[0],argv[1],'--release'];out=await cli(root);}finally{process.argv=argv;}}
    const config=JSON.parse(fs.readFileSync(join(out,'game.json'),'utf8')),entry=getOpenDataEntry(config),file=join(out,entry),info=JSON.parse(fs.readFileSync(join(out,'build-info.json'),'utf8'));
    assert.equal(entry,'open-data/index.js');assert.equal(info.openDataEntry,entry);assert(fs.statSync(file).size>0);assert(!fs.existsSync(join(out,'open-data/game.js')));let onMessage;
    vm.runInNewContext(fs.readFileSync(file,'utf8'),{wx:{getSharedCanvas:()=>({getContext:()=>({})}),onMessage:f=>{onMessage=f;}},console,module:{exports:{}},exports:{}},{timeout:3000});assert.equal(typeof onMessage,'function');
    // Simulate an earlier broken output. Atomic rebuild must replace it, not preserve or depend on it.
    if(attempt<2){fs.writeFileSync(join(out,'open-data/game.js'),'throw Error("stale");');fs.unlinkSync(file);}
   }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
 });
 test('无DOM的微信VM可启动，原生触屏/后台/恢复有效，不访问Cookie或localStorage',()=>{
  const callbacks={},frames=new Map(),store=new Map(),texts=[];let frameId=0;
  const context=new Proxy({fillText:s=>texts.push(s),measureText:s=>({width:[...s].length*8}),roundRect:undefined},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>{target[key]=value;return true;}});
  const wx={createCanvas:()=>({width:0,height:0,getContext:()=>context}),getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:3,safeArea:{top:47,bottom:810,left:0,right:390}}),getMenuButtonBoundingClientRect:()=>({bottom:84,left:300}),
   onTouchStart:f=>{callbacks.down=f;},onTouchMove:f=>{callbacks.move=f;},onTouchEnd:f=>{callbacks.up=f;},onTouchCancel:f=>{callbacks.cancel=f;},onHide:f=>{callbacks.hide=f;},onShow:f=>{callbacks.show=f;},onWindowResize:f=>{callbacks.resize=f;},
   getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v),removeStorageSync:k=>store.delete(k),login:o=>o.fail(),request:o=>o.fail(),showModal:o=>o.success?.({confirm:false}),showToast:()=>{},showActionSheet:()=>{},showShareMenu:()=>{},onShareAppMessage:()=>{},shareAppMessage:()=>{}};
  const sandbox={wx,module:{exports:{}},exports:{},console,Date,Math,Promise,requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)};
  for(const name of ['window','document','localStorage','sessionStorage','ResizeObserver','AudioContext','fetch'])Object.defineProperty(sandbox,name,{get(){throw Error('错误访问浏览器接口：'+name);}});
  vm.runInNewContext(fs.readFileSync(resolve(client,'dist/game.js'),'utf8'),sandbox,{timeout:3000});const app=sandbox.module.exports.app;assert.equal(app.game.levels.count,12);assert.equal(app.game.lives,5);assert.equal(app.game.physics.blocks.total,600);assert.equal(frames.size,1);
  const tick=now=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(now);};tick(100);assert(texts.includes('球球出击'));app.game.start();tick(120);callbacks.hide();assert.equal(app.game.state,'paused');assert.equal(frames.size,0);callbacks.show();assert.equal(app.game.state,'paused');assert.equal(frames.size,1);app.dispose();assert.equal(frames.size,0);
 });
}
