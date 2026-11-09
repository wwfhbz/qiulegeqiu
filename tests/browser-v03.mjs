import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('docs/screenshots',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1440,height:1250}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.BASE_URL||'http://127.0.0.1:4173');
const layout=async()=>{const boxes=await Promise.all(['#start','#pause','#reset','header','canvas'].map(s=>page.locator(s).boundingBox()));assert(boxes[0].x<boxes[1].x&&boxes[1].x<boxes[2].x);assert(Math.abs(boxes[0].y-boxes[2].y)<1);assert(boxes[0].y+boxes[0].height<=boxes[3].y);assert(boxes[3].y<boxes[4].y);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));};await layout();
const box=await page.locator('canvas').boundingBox();
await page.mouse.move(box.x+box.width*.1,box.y+box.height*.9);await page.waitForTimeout(400);const left=await page.evaluate(()=>({x:window.ballCore.physics.paddleX,y:898}));
await page.mouse.move(box.x+box.width*.9,box.y+box.height*.9);await page.waitForTimeout(600);const right=await page.evaluate(()=>({x:window.ballCore.physics.paddleX,y:898}));assert(right.x>left.x);assert.equal(left.y,right.y);
await page.getByRole('button',{name:'重新开始'}).click();
await page.getByRole('button',{name:'开始游戏'}).click();
await page.evaluate(()=>{const g=window.ballCore,p=g.physics;p.reset();Object.assign(p.balls[0],{x:400,y:830,vx:0,vy:440,outsideArena:false});const evidence={outside:false,bounced:false,reentered:false,maxY:830};window.v03Evidence=evidence;const update=p.update.bind(p);p.update=dt=>{update(dt);const b=p.balls[0];if(!b)return;evidence.maxY=Math.max(evidence.maxY,b.y);if(b.outsideArena)evidence.outside=true;if(evidence.outside&&b.vy<0)evidence.bounced=true;if(evidence.bounced&&!b.outsideArena)evidence.reentered=true;};});
await page.waitForFunction(()=>window.v03Evidence.reentered);const trajectory=await page.evaluate(()=>window.v03Evidence);assert(trajectory.maxY>880);
await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'继续',exact:true}).click();await page.getByRole('button',{name:'重新开始'}).click();await page.waitForTimeout(100);
await page.screenshot({path:'docs/screenshots/v03-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await layout();
const mobileBox=await page.locator('canvas').boundingBox();const cdp=await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mobileBox.x+mobileBox.width*.5,y:mobileBox.y+mobileBox.height*.9}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mobileBox.x+mobileBox.width*.8,y:mobileBox.y+mobileBox.height*.9}]});await page.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await page.evaluate(()=>window.ballCore.physics.paddleX)>400);
await page.screenshot({path:'docs/screenshots/v03-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
const result={gap:40,paddleY:898,left,right,trajectory,desktopTopButtons:true,mobileTopButtons:true,touch:true,errors};writeFileSync('docs/v03-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
