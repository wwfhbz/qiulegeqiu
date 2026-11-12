import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {RULES_VERSION} from '../shared/Challenge.ts';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const out='work/tap-start';mkdirSync(out,{recursive:true});const results=[];
try{for(const [width,height] of [[1366,768],[390,844],[320,568]]){
 const mobile=width<600,page=await browser.newPage({viewport:{width,height},hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.hintPaints=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){if(text==='点击任意位置开始游戏')window.hintPaints.push({alpha:this.globalAlpha,x,y,time:performance.now()});return fill.call(this,text,x,y,...args);};});
 await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({json:path==='/api/health'?{ok:true,rulesVersion:RULES_VERSION,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1']}:path==='/api/challenges'?{id:'local-fixture',rulesVersion:RULES_VERSION,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1']}:path==='/api/me'?{csrfToken:'local-fixture',player:null,best:null,board:'global',rankingRulesVersion:RULES_VERSION}:path==='/api/leaderboard'?{items:[],nextOffset:null,board:'global',rankingRulesVersion:RULES_VERSION}:{items:[],nextOffset:null}});});
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.hintPaints.length>0);
 assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');const first=await page.evaluate(()=>window.hintPaints[0]);assert.equal(first.x,400);assert.equal(first.y,492);assert(Math.abs(first.alpha-.7)<.01);
 await page.screenshot({path:`${out}/ready-${width}.png`});
 await page.locator('#mute').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');await page.locator('.trophy').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');
 await page.evaluate(()=>document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,isPrimary:true,button:0,clientX:100,bubbles:true})));assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');await page.locator('[data-online-close]').click();
 const rect=await page.locator('#arena-canvas').boundingBox();
 const tap=async ratio=>{const x=rect.x+rect.width*ratio,y=rect.y+rect.height*492/1120;await (mobile?page.touchscreen.tap(x,y):page.mouse.click(x,y));};
 for(const ratio of [.5,.15,.85]){await page.locator('#reset').click();await tap(ratio);await tap(ratio);assert.equal(await page.evaluate(()=>window.ballCore.state),'running');assert.equal(await page.evaluate(()=>window.ballCore.journal.events.filter(e=>e.type==='launch').length),1);}
 await page.waitForTimeout(350);const count=await page.evaluate(()=>window.hintPaints.length);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.hintPaints.length),count);
 await page.screenshot({path:`${out}/running-${width}.png`});await page.locator('#pause').click();await tap(.15);assert.equal(await page.evaluate(()=>window.ballCore.state),'paused');await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'running');
 await page.locator('#reset').click();await page.waitForFunction(()=>window.hintPaints.at(-1).time>performance.now()-100);assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');
 // Keyboard-only users retain an explicit, normally invisible launch target.
 await page.locator('#start').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.ballCore.state),'running');
 let release;const reached=new Promise(resolve=>{page.route('**/api/challenges/*/submit',route=>{release=()=>route.fulfill({status:422,json:{message:'本地提交失败夹具'}});resolve();});});
 await page.evaluate(()=>{const g=window.ballCore;for(let n=0;n<5;n++){g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);}});
 await page.locator('#nickname').fill('本地交互测试');await page.locator('#submit-score').click();await reached;
 await page.locator('[data-online-close]').click();await page.locator('#reset').click();await tap(.15);assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');
 await release();await page.waitForFunction(()=>!document.querySelector('#submit-score').disabled);await tap(.15);assert.equal(await page.evaluate(()=>window.ballCore.state),'running');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);results.push({width,height,input:mobile?'触屏':'鼠标',centerLeftRight:true,singleLaunch:true,controlsBlocked:true,pausedBlocked:true,hintCentered:true,hintFades:true,resetHint:true,keyboardAccessible:true,submissionBusyBlocked:true,errors});await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
