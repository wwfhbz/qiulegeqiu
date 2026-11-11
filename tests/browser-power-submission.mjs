import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {RULES_VERSION} from '../shared/Challenge.ts';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const out='work/power-submission';mkdirSync(out,{recursive:true});const results=[];
try{for(const [width,height] of [[1366,768],[390,844]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<600}),keys=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;
  let body={};let status=200;
  if(path==='/api/me')body={board:'global',rankingRulesVersion:RULES_VERSION,csrfToken:'local-fixture',player:{id:'local-fixture',nickname:'本地测试玩家',region_code:'ISO:CN',prefix:'中国',display_name:'中国·本地测试玩家'},best:null};
  else if(path==='/api/health')body={ok:true,rulesVersion:RULES_VERSION};
  else if(path==='/api/challenges')body={id:'local-run',rulesVersion:RULES_VERSION};
  else if(path.endsWith('/submit')){keys.push(route.request().postDataJSON().idempotencyKey);status=keys.length===1?422:200;body=status===422?{message:'无对应可拾取道具'}:{verificationStatus:'verified'};}
  else if(path==='/api/leaderboard')body={board:'global',rankingRulesVersion:RULES_VERSION,items:[],nextOffset:null};
  return route.fulfill({status,json:body});
 });
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>{const g=window.ballCore;for(let n=0;n<5;n++){g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);}});
 await page.waitForFunction(()=>document.querySelector('.ranking-dialog').open);
 const snapshot=await page.evaluate(()=>JSON.stringify(window.ballCore.journal.events));await page.locator('#submit-score').click();
 await page.waitForFunction(()=>document.querySelector('#online-message').textContent.includes('无对应可拾取道具')&&!document.querySelector('#submit-score').disabled);
 assert((await page.locator('#online-message').textContent()).includes('可重试提交'));assert.equal(await page.evaluate(()=>JSON.stringify(window.ballCore.journal.events)),snapshot);
 await page.screenshot({path:`${out}/failure-${width}.png`});await page.locator('#submit-score').click();
 await page.waitForFunction(()=>document.querySelector('#online-message').textContent.includes('成绩已登记')&&!document.querySelector('#submit-score').disabled);
 assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/retry-${width}.png`});results.push({width,height,errorShown:true,buttonRestored:true,journalRetained:true,sameIdempotencyKey:true,retrySucceeded:true,errors});await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify({note:'本地UI故障注入；未向生产服务器提交成绩',results},null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
