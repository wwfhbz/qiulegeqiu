import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {RULES_VERSION,LEGACY_RULES_VERSION} from '../shared/Challenge.ts';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const reports=[];mkdirSync('work/v12',{recursive:true});
try{
 for(const [width,height] of [[1366,768],[390,844],[320,568]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<600}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.ballCore?.physics.blocks.total===600);
  const snapshot=()=>page.evaluate(()=>{const g=window.ballCore,p=g.physics;return {level:g.levels.current.number,total:p.blocks.total,remaining:p.blocks.remaining,speed:p.launchSpeed,width:p.paddleWidth,exit:p.wall.visibleExitWidth,lives:g.lives,balls:p.balls.length,hud:document.querySelector('#level').textContent,hearts:document.querySelectorAll('#hearts span:not(.lost)').length};});
  const first=await snapshot();assert.equal(first.total,600);assert.equal(first.hud,'01/12');assert.equal(first.speed,374);assert.equal(first.exit,200);assert.equal(first.width,145.6);await page.screenshot({path:`work/v12/first-${width}.png`});
  await page.locator('#start').click();await page.waitForFunction(()=>window.ballCore.physics.blocks.removed>0);
  await page.evaluate(()=>{const g=window.ballCore;for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);});assert.equal((await snapshot()).lives,4);
  const clear=()=>page.evaluate(()=>{const g=window.ballCore;g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);});
  await clear();const second=await snapshot();assert.equal(second.level,2);assert.equal(second.total,1200);assert.equal(second.lives,4);assert.equal(second.balls,1);assert.equal(second.exit,160);assert.equal(await page.evaluate(()=>window.ballCore.state),'ready');await page.screenshot({path:`work/v12/second-${width}.png`});
  await clear();const third=await snapshot();assert.equal(third.level,3);assert.equal(third.total,4203);assert.equal(third.width,112);assert.equal(third.speed,440);assert.equal(third.lives,4);assert.equal(third.balls,1);await page.screenshot({path:`work/v12/third-${width}.png`});
  await page.locator('.trophy').click();assert.equal(await page.locator('#season').count(),0);assert.equal(await page.locator('#refresh-board').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);reports.push({viewport:[width,height],first,second,third,errors});await page.close();
 }
 // An old backend must not silently put incomparable legacy records into the unified ranking.
 const page=await browser.newPage();await page.route('**/api/leaderboard**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{rank:1,display_name:'旧规则不应混排',score:999,reached_level:10}],nextOffset:null})}));await page.goto('http://127.0.0.1:4173');await page.locator('.trophy').click();await page.waitForFunction(()=>document.querySelector('#online-message').textContent.includes('后端需要更新'));assert.equal(await page.locator('#ranking-rows [data-ranking-card]').count(),0);assert.equal(await page.locator('#season').count(),0);await page.close();
 writeFileSync('work/v12/browser-results.json',JSON.stringify({reports,oldBackendFailsClosed:true},null,2));console.log(JSON.stringify({viewports:reports.length,autoAdvance:true,oldBackendFailsClosed:true}));
}finally{await browser.close();}
