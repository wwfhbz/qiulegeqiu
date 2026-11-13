import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {RULES_VERSION,PREVIOUS_RULES_VERSION} from '../shared/Challenge.ts';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const schemaFailure=process.env.EVENT_SCHEMA_FAIL==='1',out=schemaFailure?'work/submission-schema':'work/power-submission';mkdirSync(out,{recursive:true});const results=[];
try{for(const [width,height] of [[1366,768],[390,844]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<600}),keys=[],errors=[],batches=[];let rejectEvents=true;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;
  let body={};let status=200;
  if(path==='/api/me')body={board:'global',rankingRulesVersion:RULES_VERSION,csrfToken:'local-fixture',player:{id:'local-fixture',nickname:'本地测试玩家',region_code:'ISO:CN',prefix:'中国',display_name:'中国·本地测试玩家'},best:null,historicalBests:[{rules_version:PREVIOUS_RULES_VERSION,score:314115,reached_level:5}]};
  else if(path==='/api/health')body={ok:true,rulesVersion:RULES_VERSION,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1']};
  else if(path==='/api/challenges')body={id:'local-run',rulesVersion:RULES_VERSION,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1']};
  else if(schemaFailure&&path.endsWith('/events')){batches.push(route.request().postDataJSON());if(rejectEvents){status=400;body={code:'VALIDATION_ERROR',message:'提交内容格式不正确（events[0].dropId：不支持的字段）'};}}
  else if(path.endsWith('/submit')){keys.push(route.request().postDataJSON().idempotencyKey);status=!schemaFailure&&keys.length===1?422:200;body=status===422?{message:'无对应可拾取道具'}:{verificationStatus:'verified'};}
  else if(path==='/api/leaderboard')body={board:'global',rankingRulesVersion:RULES_VERSION,items:[],nextOffset:null};
  return route.fulfill({status,json:body});
 });
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>{const g=window.ballCore;for(let n=0;n<5;n++){g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);}});
 await page.waitForFunction(()=>document.querySelector('.ranking-dialog').open);
 await page.waitForFunction(()=>document.querySelector('#historical-best').textContent.includes('旧版十二关记录：314115 分'));assert((await page.locator('#my-best').textContent()).includes('未上榜'));

 await page.locator('#view-board').click();await page.waitForFunction(()=>document.querySelector('#challenge-entry').hidden);await page.locator('#return-score').click();await page.waitForFunction(()=>!document.querySelector('#challenge-entry').hidden);
 const snapshot=await page.evaluate(()=>JSON.stringify(window.ballCore.journal.events));await page.locator('#submit-score').click();
 await page.waitForFunction(schema=>document.querySelector('#online-message').textContent.includes(schema?'events[0].dropId':'无对应可拾取道具')&&!document.querySelector('#submit-score').disabled,schemaFailure);if(schemaFailure)assert(!(await page.locator('#online-message').textContent()).includes('本轮挑战已失效'));
 assert((await page.locator('#online-message').textContent()).includes('可重试提交'));assert.equal(await page.evaluate(()=>JSON.stringify(window.ballCore.journal.events)),snapshot);
 await page.screenshot({path:`${out}/failure-${width}.png`});rejectEvents=false;await page.locator('#submit-score').click();
 await page.waitForFunction(()=>document.querySelector('#online-message').textContent.includes('成绩已登记')&&!document.querySelector('#submit-score').disabled);
 if(schemaFailure){assert.equal(keys.length,1);const repeated=batches.filter(b=>b.sequence===0);assert(repeated.length>=2);assert.deepEqual(repeated[0],repeated.at(-1));}else{assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);}assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/retry-${width}.png`});results.push({width,height,errorShown:true,buttonRestored:true,journalRetained:true,sameIdempotencyKey:true,retrySucceeded:true,errors});await page.close();
}writeFileSync(`${out}/results.json`,JSON.stringify({note:'本地UI故障注入；未向生产服务器提交成绩',results},null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
