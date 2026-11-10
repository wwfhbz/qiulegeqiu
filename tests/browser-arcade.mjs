import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const out='work/regression-arcade';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const errors=[];
async function layout(page){
 const selectors=['header','#level','.dashboard','canvas','.bottom-controls'];
 const boxes=await Promise.all(selectors.map(s=>page.locator(s).boundingBox()));
 assert(boxes[0].y<boxes[1].y&&boxes[1].y<boxes[2].y&&boxes[2].y<boxes[3].y);
 assert(boxes[4].y>=boxes[3].y+boxes[3].height);
 const buttons=await Promise.all(['#pause','#reset'].map(s=>page.locator(s).boundingBox()));
 const width=await page.evaluate(()=>innerWidth);
 assert(buttons.every(b=>b.width>=80&&b.height>=42&&b.x>=0&&b.x+b.width<=width));
 assert(buttons[0].x<buttons[1].x);
 assert(Math.abs(buttons[0].y-buttons[1].y)<1);
 assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
}
async function miss(page){
 if(await page.evaluate(()=>window.ballCore.state)==='ready')await page.locator('#start').click();
 await page.evaluate(()=>{for(const b of window.ballCore.physics.balls)Object.assign(b,{x:400,y:1130,vx:0,vy:440,outsideArena:true});});
 await page.waitForFunction(()=>['ready','gameOver'].includes(window.ballCore.state));
}
async function clear(page){
 if(await page.evaluate(()=>window.ballCore.state)==='ready')await page.locator('#start').click();
 // Exercise the real destruction events and same-frame clear/miss precedence.
 await page.evaluate(()=>{const g=window.ballCore;for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);for(const b of g.physics.balls)b.alive=false;g.update(1/120);});
 await page.waitForFunction(()=>['levelComplete','victory'].includes(window.ballCore.state));
 await page.waitForFunction(()=>document.querySelector('#start').textContent===(window.ballCore.state==='levelComplete'?'下一关':'重新挑战'));
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:1300}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await layout(page);assert(await page.locator('#stress').isHidden());
 assert.equal(await page.locator('#lives').textContent(),'3');assert.equal(await page.locator('#score').textContent(),'0');
 if(await page.evaluate(()=>window.ballCore.state)==='ready')await page.locator('#start').click();await page.waitForFunction(()=>Number(document.querySelector('#removed').textContent)>0);
 assert(Number(await page.locator('#score').textContent())>0);
 const audioState=await page.evaluate(()=>window.ballCore.audio.context?.state);assert.equal(audioState,'running');
 await page.evaluate(()=>{const p=window.ballCore.physics;p.powers.spawn(p.paddleX,1003,'wide');p.powers.spawn(p.paddleX,1003,'triple');});
 await page.waitForFunction(()=>window.ballCore.physics.balls.length>=3&&window.ballCore.physics.wideRemaining>0);
 await page.getByRole('button',{name:'暂停',exact:true}).click();
 const data=()=>page.evaluate(()=>JSON.stringify([window.ballCore.physics.balls,window.ballCore.score.total,window.ballCore.score.combo,window.ballCore.score.remaining,window.ballCore.physics.wideRemaining,window.ballCore.physics.powers.items]));const frozen=await data();await page.waitForTimeout(250);assert.equal(await data(),frozen);
 await page.screenshot({path:`${out}/v04-desktop.png`,fullPage:true});
 await page.getByRole('button',{name:'静音',exact:true}).click();assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>window.ballCore.audio.master.gain.value),0);
 await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.evaluate(()=>{const p=window.ballCore.physics;Object.assign(p.balls[0],{x:400,y:1130,vx:0,vy:440,outsideArena:true});});
 await page.waitForFunction(()=>window.ballCore.physics.balls.length===2);assert.equal(await page.locator('#lives').textContent(),'3');
 const progress=await page.evaluate(()=>({removed:window.ballCore.physics.blocks.removed,score:window.ballCore.score.total}));
 await page.evaluate(()=>{for(const b of window.ballCore.physics.balls)Object.assign(b,{x:400,y:1130,vx:0,vy:440,outsideArena:true});});
 await page.waitForFunction(()=>window.ballCore.state==='ready');assert.equal(await page.locator('#lives').textContent(),'2');
 const afterLoss=await page.evaluate(()=>({removed:window.ballCore.physics.blocks.removed,score:window.ballCore.score.total,wide:window.ballCore.physics.wideRemaining,drops:window.ballCore.physics.powers.items.some(x=>x.alive)}));assert(afterLoss.removed>=progress.removed&&afterLoss.score>=progress.score);assert.equal(afterLoss.wide,0);assert.equal(afterLoss.drops,false);
 await miss(page);await miss(page);assert.equal(await page.locator('#lives').textContent(),'0');assert.equal(await page.locator('#start').textContent(),'重新挑战');assert.equal(await page.locator('#next').count(),0);
 await page.evaluate(()=>window.ballCore.start());assert.equal(await page.evaluate(()=>window.ballCore.state),'gameOver');
 await page.locator('#settlement').screenshot({path:`${out}/v04-game-over.png`});
 await page.getByRole('button',{name:'重新开始'}).click();assert.equal(await page.locator('#score').textContent(),'0');assert.equal(await page.locator('#lives').textContent(),'3');
 await miss(page);assert.equal(await page.locator('#lives').textContent(),'2');
 await clear(page);assert.equal(await page.evaluate(()=>window.ballCore.lives),2);assert.equal(await page.evaluate(()=>window.ballCore.result.lifeBonus),1000);
 await page.locator('#settlement').screenshot({path:`${out}/v04-level-complete.png`});
 let total=await page.evaluate(()=>window.ballCore.score.total);
 await page.getByRole('button',{name:'下一关'}).click();assert.equal(await page.evaluate(()=>window.ballCore.levels.current.number),2);assert.equal(await page.locator('#lives').textContent(),'2');assert.equal(Number(await page.locator('#score').textContent()),total);assert.equal(await page.locator('#removed').textContent(),'0');
 const speeds=[440,await page.evaluate(()=>Math.hypot(window.ballCore.physics.balls[0].vx,window.ballCore.physics.balls[0].vy))];
 await clear(page);total=await page.evaluate(()=>window.ballCore.score.total);await page.getByRole('button',{name:'下一关'}).click();assert.equal(await page.evaluate(()=>window.ballCore.levels.current.number),3);assert.equal(await page.evaluate(()=>window.ballCore.score.total),total);
 speeds.push(await page.evaluate(()=>Math.hypot(window.ballCore.physics.balls[0].vx,window.ballCore.physics.balls[0].vy)));assert(speeds.every((value,i)=>Math.abs(value-[440,484,528][i])<1e-8));
 await clear(page);assert.equal(await page.evaluate(()=>window.ballCore.state),'victory');assert.equal(await page.locator('#next').count(),0);assert.equal(await page.locator('#start').textContent(),'重新挑战');
 await page.locator('#settlement').screenshot({path:`${out}/v04-victory.png`});
 const finalScore=await page.evaluate(()=>window.ballCore.score.total);assert.equal(finalScore,383505);
 await page.getByRole('button',{name:'重新开始'}).click();assert.equal(await page.locator('#lives').textContent(),'3');assert.equal(await page.locator('#score').textContent(),'0');
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:3});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(base);await layout(mobile);
 const box=await mobile.locator('canvas').boundingBox(),cdp=await mobile.context().newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.5,y:box.y+box.height*.9}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.8,y:box.y+box.height*.9}]});await mobile.waitForTimeout(300);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await mobile.evaluate(()=>window.ballCore.physics.paddleX)>400);
 await mobile.screenshot({path:`${out}/v04-mobile.png`,fullPage:true});await mobile.setViewportSize({width:320,height:720});await layout(mobile);
 await page.goto(base+'?debug=1');assert(await page.locator('#stress').isVisible());await page.getByRole('button',{name:'百球压力测试'}).click();assert.equal(await page.evaluate(()=>window.ballCore.physics.balls.length),100);
 assert.deepEqual(errors,[]);
 const report={base,initialLives:3,normalDestructionScores:true,singleLossInMultiballPreservesLife:true,allLostCostsOneLife:true,gameOverBlocksLaunch:true,restart:true,clearBeforeLoss:true,levelsPreserveLivesAndScore:true,speeds,finalScore,finalVictory:true,pauseFreezesScoreAndPower:true,audioState,touch:true,dpr:3,mobileWidths:[390,320],bottomButtons:true,debugHiddenByDefault:true,errors,settlementScenarios:'通过真实方块销毁事件注入快速通关场景，未手工玩完12609块'};
 writeFileSync('work/regression-arcade/browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
