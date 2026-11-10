import { chromium } from '@playwright/test';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('dist/index.html','utf8');
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m=>m[1]);
assert(assets.some(x=>x.endsWith('.js'))&&assets.some(x=>x.endsWith('.css')),'缺少生产 JS/CSS');
for(const asset of assets)assert(existsSync(`dist${asset}`),'引用资源不存在');
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const asset of assets){const res=await page.request.get(base+asset);assert.equal(res.status(),200);assert(res.headers()['content-type'].includes(asset.endsWith('.js')?'javascript':'css'));}
 await page.goto(base);assert.equal(await page.title(),'球了个球');assert.equal(await page.locator('#total').textContent(),'4203');
 const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.2);await page.waitForTimeout(250);assert(await page.evaluate(()=>window.ballCore.physics.paddleX)>400);
 await page.locator('#start').click();await page.waitForFunction(()=>Number(document.querySelector('#removed').textContent)>0);
 await page.getByRole('button',{name:'暂停',exact:true}).click();const snapshot=await page.evaluate(()=>JSON.stringify(window.ballCore.physics.balls));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>JSON.stringify(window.ballCore.physics.balls)),snapshot);
 await page.getByRole('button',{name:'继续',exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.locator('#status').textContent(),'突破进行中');
 // Simulate the final ball crossing the existing exit, and verify relaunch.
 await page.evaluate(()=>{const p=window.ballCore.physics;p.balls.length=1;Object.assign(p.balls[0],{x:400,y:1130,vx:0,vy:440});});
 await page.waitForFunction(()=>window.ballCore.state==='ready');await page.locator('#start').click();await page.waitForTimeout(100);assert.equal(await page.locator('#status').textContent(),'突破进行中');
 await page.getByRole('button',{name:'重新开始'}).click();assert.equal(await page.locator('#removed').textContent(),'0');assert.equal(await page.locator('#balls').textContent(),'1');
 assert.deepEqual(errors,[]);mkdirSync('work',{recursive:true});const report={base,assets,total:4203,mouse:true,normalBlockDestruction:true,pauseAndResume:true,escapeAndRelaunch:true,restart:true,errors};writeFileSync('work/release-smoke-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
