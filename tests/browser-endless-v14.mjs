// Local Chromium integration only. Never sends scores or requests to production.
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ENDLESS_RULES_VERSION} from '../shared/Challenge.ts';
const out='work/endless-v14/browser';mkdirSync(out,{recursive:true});
const vite=await createServer({server:{host:'127.0.0.1',port:0}});await vite.listen();let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const reports=[];
 for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]){const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'本地测试API离线'})}));
  await page.goto('http://127.0.0.1:'+vite.httpServer.address().port);await page.locator('[data-pick="endless"]:visible').first().click();
  const result=await page.evaluate(()=>{const g=window.ballCore;g.start();g.physics.collect('wide');const p=g.physics,before={mode:g.mode,rules:g.rulesVersion,lives:g.lives,wide:p.wideRemaining,width:p.paddleWidth};g.pause();g.update(100);return {...before,afterWide:p.wideRemaining,state:g.state,rows:p.endless.descents,overflow:document.documentElement.scrollWidth>innerWidth};});assert.equal(result.rules,ENDLESS_RULES_VERSION);assert.equal(result.mode,'endless');assert.equal(result.lives,3);assert.equal(result.wide,8);assert.equal(result.afterWide,8);assert.equal(result.overflow,false);assert.equal(result.state,'paused');assert.deepEqual(errors,[]);await page.screenshot({path:out+'/'+name+'.png'});reports.push({name,...result,errors});await page.close();
 }writeFileSync(out+'/report.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
}finally{await browser?.close();await vite.close();}
