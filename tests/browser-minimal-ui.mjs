import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[],errors=[];mkdirSync('docs/screenshots',{recursive:true});
try{
for(const [width,height] of [[1366,768],[1920,1080],[1024,600],[390,844],[320,568]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<600,deviceScaleFactor:width<600?3:1});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.waitForTimeout(180);
 const layout=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {viewport:[innerWidth,innerHeight],hud:box('.hud'),canvas:box('canvas'),controls:box('.bottom-controls'),scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],items:document.querySelectorAll('.hud-item').length,level:document.querySelector('#level').textContent,expected:`01/${String(window.ballCore.levels.count).padStart(2,'0')}`};});
 assert.equal(layout.items,4);assert.equal(layout.level,layout.expected);assert(layout.hud.height>=48&&layout.hud.height<=64);assert(layout.controls.bottom<=height+1);assert(layout.scroll[0]<=width&&layout.scroll[1]<=height);assert(Math.abs(layout.canvas.width/layout.canvas.height-800/1120)<1e-4);assert(layout.hud.bottom<=layout.canvas.y+1);assert(layout.controls.y>=layout.canvas.bottom);assert.equal(await page.locator('.dashboard,.level-heading,.instructions,.progress').count(),0);
 if(width===1366||width===390)await page.screenshot({path:`docs/screenshots/ui-after-${width===390?'mobile':'desktop'}.png`});
 await page.locator('#start').click();assert(await page.locator('#central-layer').isHidden());await page.waitForFunction(()=>window.ballCore.physics.blocks.removed>0);await page.locator('#pause').click();assert.equal(await page.locator('#start').textContent(),'▶ 继续游戏');
 const sync=await page.evaluate(()=>{const g=window.ballCore;return {score:Number(document.querySelector('#score').textContent)===g.score.total,remaining:Number(document.querySelector('#remaining').textContent)===g.physics.blocks.remaining,hearts:document.querySelectorAll('#hearts span:not(.lost)').length===g.lives};});assert(sync.score&&sync.remaining&&sync.hearts);
 await page.evaluate(()=>{const p=window.ballCore.physics;p.triple();});await page.waitForFunction(()=>!document.querySelector('#ball-badge').hidden);assert.equal(await page.locator('.hud').evaluate(e=>e.offsetHeight),layout.hud.height);
 await page.locator('#start').click();assert(await page.locator('#central-layer').isHidden());await page.locator('#reset').click();assert.equal(await page.locator('#remaining').textContent(),'4203');
 const c=await page.locator('canvas').boundingBox();if(width<600){const session=await page.context().newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x+c.width*.5,y:c.y+c.height*.9}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+c.width*.8,y:c.y+c.height*.9}]});await page.waitForTimeout(300);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await page.evaluate(()=>window.ballCore.physics.paddleX)>400);}
 results.push({...layout,sync,startPauseResumeReset:true,touch:width<600});await page.close();
}
assert.deepEqual(errors,[]);writeFileSync('docs/minimal-ui-browser-results.json',JSON.stringify({results,errors},null,2)+'\n');console.log(JSON.stringify({viewports:results.length,errors}));
}finally{await browser.close();}
