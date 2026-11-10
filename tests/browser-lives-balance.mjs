import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[],results=[];mkdirSync('docs/screenshots',{recursive:true});
try {
 for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:320,height:568}]){
  const page=await browser.newPage({viewport,hasTouch:viewport.width<600,deviceScaleFactor:viewport.width<600?3:1});page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForTimeout(100);
  const initial=await page.evaluate(()=>{const g=window.ballCore,hearts=document.querySelector('#hearts');return {lives:g.lives,hearts:hearts.children.length,lit:hearts.querySelectorAll(':not(.lost)').length,hud:Number(document.querySelector('#lives').textContent),fits:hearts.getBoundingClientRect().right<=document.querySelector('#score').getBoundingClientRect().left,overflow:document.documentElement.scrollWidth>innerWidth};});assert.deepEqual(initial,{lives:5,hearts:5,lit:5,hud:5,fits:true,overflow:false});
  await page.locator('#start').click();
  const immediate=await page.evaluate(()=>{const g=window.ballCore;for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);return {lives:g.lives,hud:Number(document.querySelector('#lives').textContent),hearts:document.querySelectorAll('#hearts span:not(.lost)').length,label:document.querySelector('#start').textContent};});assert.deepEqual(immediate,{lives:4,hud:4,hearts:4,label:'▶ 继续挑战'});
  await page.locator('#start').click();await page.locator('#pause').click();await page.locator('#start').click();assert.equal(await page.locator('#lives').textContent(),'4');
  // Real destruction, then the real central next-level action; no reset of lives.
  await page.evaluate(()=>{const g=window.ballCore;for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);});await page.locator('#start').click();
  const continuation=await page.evaluate(()=>{const g=window.ballCore,p=g.physics;let n=2000;for(let i=0;i<p.blocks.alive.length&&n;i++)if(p.blocks.alive[i]){p.blocks.hit(i);n--;}
   const before={level:g.levels.current.number,removed:p.blocks.removed,score:g.score.total,grid:Array.from(p.blocks.alive)};
   p.collect('wide');p.powers.spawn(400,1000,'triple');for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);
   return {before,after:{level:g.levels.current.number,removed:p.blocks.removed,score:g.score.total,grid:Array.from(p.blocks.alive)},lives:g.lives,hud:Number(document.querySelector('#lives').textContent),hearts:document.querySelectorAll('#hearts span:not(.lost)').length,balls:p.balls.length,wide:p.wideRemaining,drops:p.powers.items.some(p=>p.alive),label:document.querySelector('#start').textContent};});
  assert.deepEqual(continuation.before,continuation.after);assert.equal(continuation.lives,3);assert.equal(continuation.hud,3);assert.equal(continuation.hearts,3);assert.equal(continuation.balls,1);assert.equal(continuation.wide,0);assert.equal(continuation.drops,false);assert.equal(continuation.label,'▶ 继续挑战');
  if(viewport.width!==320)await page.screenshot({path:`docs/screenshots/v061-${viewport.width>600?'desktop':'mobile'}.png`});
  await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.ballCore.levels.current.number),2);assert(await page.locator('#central-layer').isHidden());
  for(let i=0;i<3;i++){if(i)await page.locator('#start').click();await page.evaluate(()=>{const g=window.ballCore;for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);});}
  assert.equal(await page.evaluate(()=>window.ballCore.state),'gameOver');assert.equal(await page.locator('#lives').textContent(),'0');await page.evaluate(()=>window.ballCore.start());assert.equal(await page.evaluate(()=>window.ballCore.state),'gameOver');await page.locator('#start').click();assert.equal(await page.locator('#lives').textContent(),'5');assert.equal(await page.evaluate(()=>window.ballCore.levels.current.number),1);await page.locator('#reset').click();assert.equal(await page.locator('#score').textContent(),'0');
  const {grid,...progress}=continuation.before;results.push({viewport,initial,immediate,continuation:{...progress,lives:3,preserved:true},gameOverAndRetry:true});await page.close();
 }
 assert.deepEqual(errors,[]);writeFileSync('docs/lives-balance-browser-results.json',JSON.stringify({base,results,errors,fifthLevel:'使用单元测试专用5关配置验证，正式main只有3关，未虚构第5关浏览器结果'},null,2)+'\n');console.log(JSON.stringify({viewports:results.length,immediateHUD:true,continuedLevel:2,errors}));
} finally {await browser.close();}
