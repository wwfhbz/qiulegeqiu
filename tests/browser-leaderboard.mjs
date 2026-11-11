import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const base=process.env.BASE_URL||'http://127.0.0.1:4173',errors=[],results=[],out=process.env.LEADERBOARD_OUT||'docs';mkdirSync(`${out}/screenshots`,{recursive:true});
try{
 for(const [width,height] of [[1366,768],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<600,deviceScaleFactor:width<600?3:1});page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForTimeout(200);assert(await page.locator('.ranking-dialog').isHidden());
  await page.locator('#start').click();await page.waitForFunction(()=>window.ballCore.physics.blocks.removed>0);
  for(let i=0;i<5;i++){
   if(i)await page.locator('#start').click();
   await page.evaluate(()=>{Object.assign(window.ballCore.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});});await page.waitForTimeout(700);
   await page.evaluate(()=>{Object.assign(window.ballCore.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});});
   await page.waitForFunction(()=>['ready','gameOver'].includes(window.ballCore.state));
  }
  assert(await page.locator('.ranking-dialog').isVisible());assert((await page.locator('#challenge-stats').textContent()).includes('到达第1关'));const nickname='街机'+width+Date.now().toString(36).slice(-6);await page.locator('#nickname').fill(nickname);await page.locator('#region-details summary').click();
  for(const [label,value] of [['国家/地区','ISO:CN'],['省级','CN:340000'],['地级/直属县级','CN:341200'],['县级','CN:341222']]){const select=page.locator(`select[aria-label="${label}"]`);await page.waitForFunction(({label,value})=>!!document.querySelector(`select[aria-label="${label}"] option[value="${value}"]`),{label,value});await select.locator(`option[value="${value}"]`).click();}
  await page.locator('select[aria-label="国家/地区"] option[value="ISO:CN"]').click();assert.equal(await page.locator('#region-label').textContent(),'地区：中国');
  for(const [label,value] of [['省级','CN:340000'],['地级/直属县级','CN:341200'],['县级','CN:341222']]){await page.waitForFunction(({label,value})=>!!document.querySelector(`select[aria-label="${label}"] option[value="${value}"]`),{label,value});await page.locator(`select[aria-label="${label}"] option[value="${value}"]`).click();}
  assert((await page.locator('#region-label').textContent()).includes('太和'));await page.locator('#region-details summary').click();await page.locator('#submit-score').click();
  await page.waitForFunction(()=>document.querySelector('#online-message').textContent.includes('成绩已登记'));const message=await page.locator('#online-message').textContent();assert(!message.includes('异常'),message);await page.waitForFunction(name=>document.querySelector('#ranking-rows').textContent.includes('太和·'+name),nickname);
  const me=await page.evaluate(()=>fetch('/api/me?board=global').then(r=>r.json()));assert.equal(me.player.nickname,nickname);assert.equal(me.player.region_code,'CN:341222');assert(me.best.score>0);assert.equal(me.best.rank>=1,true);assert.equal(await page.locator('#ranking-rows [data-ranking-card]').count()<=20,true);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.ranking-dialog').scrollWidth>document.querySelector('.ranking-dialog').clientWidth);assert(!overflow);
  await page.screenshot({path:`${out}/screenshots/leaderboard-${width>600?'desktop':'mobile'}.png`});await page.locator('[data-online-close]').click();await page.reload();await page.getByRole('button',{name:'全球排行榜'}).click();await page.waitForFunction(()=>document.querySelector('#my-best').textContent.includes('我的排名'));const back=await page.evaluate(()=>fetch('/api/me?board=global').then(r=>r.json()));assert.equal(back.player.id,me.player.id);assert.equal(back.best.score,me.best.score);
  await page.locator('[data-online-close]').click();await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.ballCore.state),'running');results.push({viewport:[width,height],nickname,score:me.best.score,rank:me.best.rank,region:me.player.region_code,registered:true,reloadKeepsIdentity:true,pagination:true,overflow:false});await page.close();
 }
 const offline=await browser.newPage({viewport:{width:390,height:844}});offline.on('pageerror',e=>errors.push(e.message));await offline.route('**/api/**',r=>r.abort());await offline.goto(base);await offline.locator('#start').click();await offline.waitForFunction(()=>window.ballCore.physics.blocks.removed>0);await offline.locator('#pause').click();await offline.locator('#start').click();
 for(let i=0;i<5;i++){if(i)await offline.locator('#start').click();await offline.evaluate(()=>{const g=window.ballCore;for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);});}
 await offline.waitForFunction(()=>document.querySelector('.ranking-dialog').open);await offline.locator('#skip-score').click();assert.equal(await offline.evaluate(()=>window.ballCore.state),'running');assert.equal(await offline.evaluate(()=>window.ballCore.lives),5);assert.deepEqual(errors,[]);
 writeFileSync(`${out}/leaderboard-browser-results.json`,JSON.stringify({base,results,offlineSkipAndRetry:true,errors,note:'真实RAF消块及球死亡后向本地SQLite API提交，未mock排行榜；地区为用户自选标签。'},null,2)+'\n');console.log(JSON.stringify({players:results.length,offline:true,errors}));
}finally{await browser.close();}
