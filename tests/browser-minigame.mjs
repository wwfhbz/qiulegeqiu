// wx compatibility harness in real Chromium. NOT an official WeChat DevTools or device test.
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
// Use a TS-enabled isolated backend process for inject calls, never production endpoints.
const child=spawn(process.execPath,['--import','./server/node_modules/tsx/dist/loader.mjs','tests/minigame-server-harness.ts'],{stdio:['ignore','pipe','inherit'],env:{...process.env,APP_ROOT:resolve('server')}});
// The child uses HTTP on a randomly assigned loopback port and an isolated in-memory SQLite DB.
const endpoint=await new Promise((r,j)=>{const onData=data=>{const match=data.toString().match(/HARNESS_PORT=(\d+)/);if(match){child.stdout.off('data',onData);r(Number(match[1]));}};child.stdout.on('data',onData);child.once('exit',()=>j(Error('Backend harness exited')));});
const game=readFileSync('minigame/dist/game.js','utf8');
const server=createServer((req,res)=>{if(req.url==='/game.js'){res.setHeader('content-type','text/javascript');res.end(game);}else{res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#050c18}canvas{position:absolute;left:0;top:0}</style>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});}catch(error){server.close();child.kill('SIGTERM');throw error;}
mkdirSync('work/minigame',{recursive:true});const reports=[];
try{
 for(const [name,width,height,dpr] of [['phone',375,812,3],['small-phone',320,568,2],['tablet',768,1024,2]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://ball.gmgnclaw.com/api/**',async route=>{const request=route.request();if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type,authorization,x-csrf-token'}});return;}const path=new URL(request.url()).pathname+new URL(request.url()).search;
   const headers=request.headers();delete headers.origin;delete headers.host;const r=await fetch(`http://127.0.0.1:${endpoint}${path}`,{method:request.method(),headers,body:request.postData()||undefined});await route.fulfill({status:r.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await r.text()});});
  await page.goto(`http://127.0.0.1:${port}`);
  await page.evaluate(()=>{
   const doc=document;let canvases=0;window.module={exports:{}};window.__touch={};window.__life={};window.__shares=[];
   window.wx={createCanvas(){const c=doc.createElement('canvas');if(canvases++===0){c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';doc.body.append(c);}return c;},getWindowInfo:()=>({windowWidth:innerWidth,windowHeight:innerHeight,pixelRatio:devicePixelRatio,safeArea:{top:44,bottom:innerHeight-34,left:0,right:innerWidth}}),getMenuButtonBoundingClientRect:()=>({bottom:80,left:innerWidth-90}),
    onTouchStart:f=>__touch.down=f,onTouchMove:f=>__touch.move=f,onTouchEnd:f=>__touch.up=f,onTouchCancel:f=>__touch.cancel=f,onHide:f=>__life.hide=f,onShow:f=>__life.show=f,onWindowResize:()=>{},
    login:o=>o.success({code:'browser-harness:'+Math.random()}),request:o=>fetch(o.url,{method:o.method,headers:o.header,body:o.method==='POST'?JSON.stringify(o.data):undefined}).then(async r=>o.success({statusCode:r.status,data:await r.json()})).catch(()=>o.fail()),
    getStorageSync:k=>JSON.parse(localStorage.getItem(k)||'null'),setStorageSync:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),removeStorageSync:k=>localStorage.removeItem(k),
    showModal:o=>o.success?.({confirm:true,content:'兼容测试'+innerWidth}),showToast:()=>{},showActionSheet:()=>{},showShareMenu:()=>{},onShareAppMessage:f=>window.__share=f,shareAppMessage:o=>__shares.push(o),requirePrivacyAuthorize:o=>o.success()};
   // A browser document exists only inside the wx mock; game code must not access it.
   const script=doc.createElement('script');script.src='/game.js';doc.body.append(script);
  });
  await page.waitForFunction(()=>window.module?.exports.app?.game.state==='ready');
  await page.waitForTimeout(150);await page.screenshot({path:`work/minigame/${name}-ready.png`});
  const result=await page.evaluate(async()=>{
   const app=module.exports.app,g=app.game;const click=(x,y)=>{const t={identifier:1,clientX:x,clientY:y};__touch.down({touches:[t],changedTouches:[t]});__touch.up({touches:[],changedTouches:[t]});};
   // Use the same central hit target and wx touch callbacks as a real host.
   const v=app.view;click(innerWidth/2,v.arena.y+492*v.scale);
   const deadline=Date.now()+5000;while(g.state!=='running'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));
   if(g.state!=='running')throw Error('Central touch did not start');
   const paddle=g.physics.paddleX,t={identifier:2,clientX:innerWidth*.5,clientY:v.arena.y+v.arena.height-10};__touch.down({touches:[t],changedTouches:[t]});t.clientX=innerWidth-30;__touch.move({touches:[t],changedTouches:[t]});__touch.up({touches:[],changedTouches:[t]});
   await new Promise(r=>setTimeout(r,80));const moved=g.physics.paddleX>paddle;
   __life.hide();const tick=g.journal.tick;await new Promise(r=>setTimeout(r,70));if(g.journal.tick!==tick||g.state!=='paused')throw Error('Background physics did not pause');__life.show();if(g.state!=='paused')throw Error('Foreground auto-launched');
   g.start();const hitDeadline=Date.now()+4000;while(g.physics.blocks.removed===0&&Date.now()<hitDeadline)await new Promise(r=>setTimeout(r,20));const playedBricks=g.physics.blocks.removed;if(!playedBricks)throw Error('No actual brick collision in wx host');if(g.state==='ready')g.start();g.physics.triple();const balls=g.physics.balls.length;
   // Do not fabricate production scores. This is an isolated harness; test real loss events.
   g.reset();g.start();for(let round=0;round<5;round++){if(g.state==='ready')g.start();Object.assign(g.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});for(let n=0;n<20;n++)g.update(.1);Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);}
   app.sync.lastPump=Date.now();app.sync.observe();await app.sync.run.id;await app.api.request('/__test/advance',{});await app.submit();const me=await app.api.me(),board=await app.api.request('/leaderboard?limit=5');
   app.online=false;app.frame(performance.now());return {moved,balls,playedBricks,state:g.state,lives:g.lives,best:me.best,boardCount:board.items.length,width:app.canvas.width,share:__share()};
  });
  assert.equal(result.moved,true);assert(result.playedBricks>0);assert.equal(result.balls,3);assert.equal(result.lives,0);assert(result.best);assert(result.boardCount>=1);assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:`work/minigame/${name}-result.png`});const stress=await page.evaluate(()=>new Promise(resolve=>{const app=module.exports.app;app.online=false;app.panel.close();app.game.stress();let frames=0,start=performance.now(),last=start;const deltas=[];function sample(now){deltas.push(now-last);last=now;if(++frames<90)requestAnimationFrame(sample);else{app.game.pause();resolve({frames,elapsedMs:now-start,averageFps:frames*1000/(now-start),maxFrameMs:Math.max(...deltas),ballsAtEnd:app.game.physics.balls.length});}}requestAnimationFrame(sample);}));reports.push({name,width,height,...result,stress,errors});await page.close();
 }
 writeFileSync('work/minigame/browser-results.json',JSON.stringify({harness:'Chromium wx API compatibility mock; not official DevTools',reports},null,2));console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));child.kill('SIGTERM');}
