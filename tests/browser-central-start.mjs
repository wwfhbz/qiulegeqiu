import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:4173',out='work/regression-central';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[];
async function geometry(page){
 // Read both rectangles in one browser task: ResizeObserver may run between two locator calls.
 const snapshot=await page.waitForFunction(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};const canvas=rect('canvas'),button=rect('#start'),bottom=rect('.bottom-controls');return bottom.y>=canvas.y+canvas.height&&document.documentElement.scrollWidth<=innerWidth&&button.width>=44&&Math.abs(button.x+button.width/2-canvas.x-canvas.width/2)<1.5&&Math.abs(button.y+button.height/2-canvas.y-canvas.height*492/1120)<1.5?{canvas,button,bottom}:false;});
 const {canvas,button,bottom}=await snapshot.jsonValue();
 assert(button.width>=44&&button.height>=44);
 assert(Math.abs(button.x+button.width/2-(canvas.x+canvas.width*.5))<1.5);
 assert(Math.abs(button.y+button.height/2-(canvas.y+canvas.height*492/1120))<1.5);
 assert.equal(await page.locator('.bottom-controls button').count(),2);
 assert.equal(await page.locator('.bottom-controls #start').count(),0);
 assert.equal(await page.locator('#next').count(),0);
 assert(bottom.y>=canvas.y+canvas.height);
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 return {width:button.width,height:button.height};
}
async function clear(page){
 await page.evaluate(()=>{const g=window.ballCore;for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);for(const b of g.physics.balls)b.alive=false;g.update(1/120);});
 await page.waitForFunction(()=>['levelComplete','victory'].includes(window.ballCore.state));
 if(await page.locator('.ranking-dialog[open]').count())await page.locator('[data-online-close]').click();
 await page.waitForFunction(()=>document.querySelector('#start').textContent===(window.ballCore.state==='levelComplete'?'下一关':'重新挑战'));
}
async function lose(page){
 await page.evaluate(()=>{for(const b of window.ballCore.physics.balls)Object.assign(b,{x:400,y:1130,vx:0,vy:440,outsideArena:true});});
 await page.waitForFunction(()=>['ready','gameOver'].includes(window.ballCore.state));
 if(await page.locator('.ranking-dialog[open]').count())await page.locator('[data-online-close]').click();
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1300}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
 assert.equal(await page.locator('#start').textContent(),'▶ 开始游戏');const desktopButton=await geometry(page);
 await page.screenshot({path:`${out}/v05-desktop.png`,fullPage:true});
 await page.locator('#start').click();
 assert.equal(await page.evaluate(()=>window.ballCore.state),'running');assert(await page.locator('#central-layer').isHidden());assert(await page.locator('#start').isHidden());
 assert(await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height*492/1120)===c;}));
 await page.evaluate(()=>{const g=window.ballCore,start=g.start.bind(g);window.resumeCalls=0;g.start=()=>{window.resumeCalls++;start();};});
 await page.locator('#pause').click();assert.equal(await page.locator('#start').textContent(),'▶ 继续游戏');await geometry(page);
 const before=await page.evaluate(()=>JSON.stringify([window.ballCore.physics.balls,window.ballCore.score.total,window.ballCore.score.remaining,window.ballCore.physics.wideRemaining]));await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>JSON.stringify([window.ballCore.physics.balls,window.ballCore.score.total,window.ballCore.score.remaining,window.ballCore.physics.wideRemaining])),before);
 await page.locator('#start').click();assert(await page.locator('#central-layer').isHidden());await page.locator('#pause').click();await page.locator('#pause').click();assert.equal(await page.evaluate(()=>window.resumeCalls),2);assert.equal(await page.evaluate(()=>window.ballCore.physics.balls.length),1);
 await lose(page);assert.equal(await page.locator('#lives').textContent(),'4');assert.equal(await page.locator('#start').textContent(),'▶ 继续挑战');await page.locator('#start').click();await page.evaluate(()=>document.querySelector('#start').click());assert.equal(await page.evaluate(()=>window.ballCore.physics.balls.length),1);assert.equal(await page.locator('#lives').textContent(),'4');
 for(let i=0;i<4;i++){await lose(page);if(i<3)await page.locator('#start').click();}assert.equal(await page.evaluate(()=>window.ballCore.state),'gameOver');assert.equal(await page.locator('#start').textContent(),'重新挑战');await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'running');assert.equal(await page.locator('#lives').textContent(),'5');assert.equal(await page.locator('#score').textContent(),'0');assert.equal(await page.evaluate(()=>window.ballCore.physics.balls.length),1);
 await page.locator('#reset').click();assert.equal(await page.locator('#start').textContent(),'▶ 开始游戏');await page.locator('#start').click();
 const speeds=[440];for(let i=0;i<3;i++){
   await clear(page);
   if(i<2){assert.equal(await page.locator('#start').textContent(),'下一关');const total=await page.evaluate(()=>window.ballCore.score.total);await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'running');assert.equal(await page.evaluate(()=>window.ballCore.levels.current.number),i+2);assert.equal(await page.evaluate(()=>window.ballCore.score.total),total);speeds.push(await page.evaluate(()=>Math.hypot(window.ballCore.physics.balls[0].vx,window.ballCore.physics.balls[0].vy)));}
 }
 assert.equal(await page.evaluate(()=>window.ballCore.state),'victory');assert.equal(await page.locator('#start').textContent(),'重新挑战');assert(await page.locator('#settlement').isVisible());assert.equal(await page.locator('#result-score').textContent(),'388005');await page.screenshot({path:`${out}/v05-victory.png`,fullPage:true});await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'running');assert.equal(await page.locator('#lives').textContent(),'5');assert.equal(await page.locator('#score').textContent(),'0');
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:3});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(base);const touchButton=await geometry(mobile);await mobile.locator('#start').tap();assert(await mobile.locator('#central-layer').isHidden());
 const box=await mobile.locator('canvas').boundingBox(),cdp=await mobile.context().newCDPSession(mobile),y=box.y+box.height*492/1120;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.5,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.7,y}]});await mobile.waitForTimeout(180);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await mobile.evaluate(()=>window.ballCore.physics.targetX)>400);
 await mobile.locator('#pause').click();assert.equal(await mobile.locator('#start').textContent(),'▶ 继续游戏');await mobile.screenshot({path:`${out}/v05-mobile.png`,fullPage:true});await mobile.locator('#start').tap();assert.equal(await mobile.evaluate(()=>window.ballCore.state),'running');await mobile.locator('#pause').click();await mobile.locator('#pause').click();assert.equal(await mobile.evaluate(()=>window.ballCore.state),'running');
 await mobile.locator('#reset').click();await mobile.setViewportSize({width:320,height:720});await geometry(mobile);await mobile.locator('#start').tap();const ticksBefore=await mobile.evaluate(()=>window.ballCore.physics.ticks);for(const width of [390,320,390,320]){await mobile.setViewportSize({width,height:720});await mobile.waitForTimeout(60);}await mobile.evaluate(()=>document.querySelector('canvas').style.display='none');await mobile.waitForTimeout(80);assert(await mobile.evaluate(()=>document.querySelector('canvas').width)>0);await mobile.evaluate(()=>document.querySelector('canvas').style.display='');await mobile.waitForTimeout(80);const ticksAfter=await mobile.evaluate(()=>window.ballCore.physics.ticks);assert(ticksAfter>ticksBefore);assert.deepEqual(errors,[]);
 const report={base,firstStart:true,lifeLostContinue:true,centralAndBottomUseSameStart:true,repeatedActivationDoesNotDuplicateBalls:true,nextLevelAutoLaunch:true,gameOverRetry:true,finalVictoryAndRetry:true,bottomButtonCount:2,canvasReceivesFormerButtonPointWhenRunning:true,touchDragThroughFormerButton:true,resizeKeepsAnimationRunning:true,zeroSizeCanvasRecovery:true,desktopButton,touchButton,mobileWidths:[390,320],dpr:3,speeds,unchangedLives:5,unchangedLevels:3,errors};writeFileSync('work/regression-central/browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
