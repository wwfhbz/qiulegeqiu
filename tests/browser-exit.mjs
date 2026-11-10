import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:4173',out='docs/screenshots';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1450}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForTimeout(100);
 const pixels=await page.evaluate(()=>{
  const c=document.querySelector('canvas'),ctx=c.getContext('2d'),ratio=c.width/800;
  const lit=(x,y)=>{const xx=Math.round(x*ratio),yy=Math.round(y*ratio);const data=ctx.getImageData(xx-2,yy-2,5,5).data;for(let i=0;i<data.length;i+=4)if(data[i]>45&&data[i+1]>60&&data[i+2]>85)return true;return false;};
  return {leftNewWall:lit(320,492+Math.sqrt(360**2-80**2)),rightNewWall:lit(480,492+Math.sqrt(360**2-80**2)),centerOpen:!lit(400,852),leftEndpoint:lit(347,492+Math.sqrt(360**2-53**2)),rightEndpoint:lit(453,492+Math.sqrt(360**2-53**2))};
 });assert(Object.values(pixels).every(Boolean));
 await page.screenshot({path:`${out}/exit-after-desktop.png`,fullPage:true});await page.locator('#start').click();assert(await page.locator('#central-layer').isHidden());
 await page.evaluate(()=>{const g=window.ballCore,p=g.physics;Object.assign(p.balls[0],{x:480,y:810,vx:0,vy:760,outsideArena:false});window.exitEvidence={wallReflected:false,outside:false,bounced:false,returned:false,maxY:830,mode:'wall'};const update=p.update.bind(p);p.update=dt=>{update(dt);const b=p.balls[0],e=window.exitEvidence;if(!b)return;if(e.mode==='wall'){if(b.vy<0&&!b.outsideArena)e.wallReflected=true;}else{e.maxY=Math.max(e.maxY,b.y);if(b.outsideArena)e.outside=true;if(e.outside&&b.vy<0)e.bounced=true;if(e.bounced&&!b.outsideArena)e.returned=true;}};});
 await page.waitForFunction(()=>window.exitEvidence.wallReflected);
 await page.evaluate(()=>{const p=window.ballCore.physics;p.paddleX=p.targetX=400;Object.assign(p.balls[0],{x:400,y:830,vx:0,vy:760,outsideArena:false});window.exitEvidence.mode='gate';});
 await page.waitForFunction(()=>window.exitEvidence.returned);const flight=await page.evaluate(()=>window.exitEvidence);assert(flight.maxY>1000);
 await page.locator('#reset').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.equal(await page.locator('.bottom-controls button').count(),2);assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.screenshot({path:`${out}/exit-after-mobile.png`,fullPage:true});
 await page.locator('#start').click();await page.locator('#pause').click();await page.locator('#start').click();assert(await page.locator('#central-layer').isHidden());assert.deepEqual(errors,[]);
 const report={oldHalfWidth:106,newHalfWidth:53,oldNominalWidth:212,newNominalWidth:106,nominalRatio:.5,newVisibleWidth:104.6,visibleToOldNominalRatio:104.6/212,ballCenterClearanceAtEndpointChord:95.6,arena:{x:400,y:492,radius:360},paddleTop:1012,paddleGap:160,pixels,flight,centralButton:true,bottomButtons:2,errors};writeFileSync('docs/exit-browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
