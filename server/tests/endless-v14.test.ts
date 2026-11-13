import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {ENDLESS_V4,ENDLESS_V5,type EndlessVariant} from '../../src/endless/EndlessRules';
import {ENDLESS_RULES_VERSION,ENDLESS_V4_RULES_VERSION,RULES_VERSION,type ChallengeEvent} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
import {createApp} from '../src/app';

/** Real field/drop/pickup callbacks in fixed-tick order; no fake scores or production requests. */
function trace(seed:number,v:EndlessVariant,ticks=9000){
 const g=new Game();g.setMode('endless');g.physics.endless!.variant=v;g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();const p=g.physics,f=p.endless!;
 for(let t=1;t<=ticks;t++){p.onStep?.(C.step);f.tick();if(t%6===0){const cells=Array.from(f.alive.keys()).filter(i=>f.alive[i]);if(cells.length)f.hit(cells[t*7919%cells.length]);}const target=p.powers.items.filter(d=>d.alive).sort((a,b)=>b.y-a.y)[0];p.powers.update(C.step,target?.x??400,p.paddleWidth,(kind,id)=>p.collect(kind,id));}
 for(let n=0;n<10&&g.state!=='gameOver';n++){for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}expect(g.state).toBe('gameOver');return g;
}
it.each([1,7,31])('种子%s：新旧版本真实多球/掉落/拾取日志分别回放并完全确定，不能互冒版本',seed=>{
 for(const v of [ENDLESS_V4,ENDLESS_V5]){const a=trace(seed,v),b=trace(seed,v),r=verifyTrace(a.journal.events,1e9,seed,a.rulesVersion);expect(a.journal.events).toEqual(b.journal.events);expect(r.summary).toEqual(a.journal.summary(a.score.total,a.reachedLevel,false));expect(r.suspicious).toEqual([]);expect(a.journal.events.filter(e=>e.type==='power').length).toBeGreaterThan(5);expect(()=>verifyTrace(a.journal.events,1e9,seed,v===ENDLESS_V4?ENDLESS_RULES_VERSION:ENDLESS_V4_RULES_VERSION)).toThrow();}
});
it('未知版本、重复砖、伪造拾取ID、反序tick仍拒绝；超额击碎预算仍隔离',()=>{
 const g=trace(7,ENDLESS_V5),e=g.journal.events;expect(()=>verifyTrace(e,1e9,7,'endless-unknown')).toThrow('不支持');
 const i=e.findIndex(e=>e.type==='power');expect(i).toBeGreaterThan(0);expect(()=>verifyTrace(e.map((x,n)=>n===i?{...x,dropId:49999}:x) as ChallengeEvent[],1e9,7,g.rulesVersion)).toThrow('无对应');
 const h=e.findIndex(e=>e.type==='hit');expect(()=>verifyTrace([...e.slice(0,h+1),e[h],...e.slice(h+1)],1e9,7,g.rulesVersion)).toThrow('方块不存在');expect(()=>verifyTrace(e.map((x,n)=>n===h?{...x,tick:-1}:x),1e9,7,g.rulesVersion)).toThrow('顺序');
 const probe=new Game();probe.setMode('endless');probe.journal.seed=7;probe.physics.setSeed(7);probe.physics.reset();const f=probe.physics.endless!,hits=Array.from(f.alive.keys()).filter(i=>f.alive[i]).slice(0,13).map(i=>({type:'hit' as const,tick:1,level:1,index:f.worldId(i)}));
 const burst:ChallengeEvent[]=[{type:'launch',tick:0,level:1},...hits];for(let n=0;n<3;n++){const tick=360+n;burst.push({type:'ballLost',tick,level:1},{type:'lost',tick,level:1});if(n<2)burst.push({type:'launch',tick,level:1});else burst.push({type:'finish',tick,level:1});}expect(verifyTrace(burst,1e9,7,ENDLESS_RULES_VERSION).suspicious).toContain('单步击碎数量异常');
});
it('V1.4压线1200tick扣命、重新发射清5行/补偿奖励，与客户端回放一致；暂停不计时间',()=>{
 const g=new Game();g.setMode('endless');g.journal.seed=31;g.physics.setSeed(31);g.physics.reset();g.start();const p=g.physics,f=p.endless!,park=()=>{for(const b of p.balls)Object.assign(b,{x:400,y:900,vx:0,vy:-1,outsideArena:true});};let guard=0;
 while(!f.blocked&&guard++<100000){park();g.update(C.step);}expect(f.blocked).toBe(true);const since=f.sinceDescent;g.pause();g.update(1000);expect(f.sinceDescent).toBe(since);expect(f.pressure).toBe(0);g.start();
 for(let n=0;n<1199;n++){park();g.update(C.step);}expect(g.lives).toBe(3);park();g.update(C.step);expect(g.lives).toBe(2);expect(g.pendingRelief).toBe(true);const before=f.destroyedTotal;g.start();expect(f.blocked).toBe(false);expect(g.journal.events.some(e=>e.type==='bonus')).toBe(true);expect(f.destroyedTotal-before).toBeLessThanOrEqual(15);
 for(let n=0;n<10&&g.state!=='gameOver';n++){for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 expect(verifyTrace(g.journal.events,1e9,31,g.rulesVersion).summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));
});
it('API：新旧版同账号分别最佳分、TOP100、分页、排名；旧榜/会话/历史行不变，幂等与分数验证不变',async()=>{
 let now=Date.now();const s=await createApp({dbPath:':memory:',origin:'https://test.local',secure:true,rateLimit:false,now:()=>now});try{
 const account=async(name:string)=>{const me=await s.app.inject({url:'/api/me?board=global'}),headers={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};expect((await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:name,regionCode:'ISO:CN'}})).statusCode).toBe(201);return headers;};
 const a=await account('新版规则测试甲'),b=await account('新版规则测试乙');
 const submit=async(headers:typeof a,v:EndlessVariant,ticks=9000)=>{const g=trace(7,v,ticks),summary=g.journal.summary(g.score.total,g.reachedLevel,false),created=await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:g.rulesVersion,seed:7}});expect(created.statusCode,created.body).toBe(201);const id=created.json().id;now+=summary.durationMs+5000;
  for(let o=0;o<g.journal.events.length;o+=256){const r=await s.app.inject({method:'POST',url:`/api/challenges/${id}/events`,headers,payload:{sequence:o/256,events:g.journal.events.slice(o,o+256)}});expect(r.statusCode,r.body).toBe(200);}
  const payload={idempotencyKey:randomUUID(),summary},url=`/api/challenges/${id}/submit`;expect((await s.app.inject({method:'POST',url,headers,payload:{...payload,summary:{...summary,score:summary.score+1}}})).statusCode).toBe(422);const r=await s.app.inject({method:'POST',url,headers,payload});expect(r.statusCode,r.body).toBe(200);expect(r.json().verificationStatus).toBe('verified');expect((await s.app.inject({method:'POST',url,headers,payload})).json().id).toBe(r.json().id);return r.json().id;};
 const old=await submit(a,ENDLESS_V4),saved=s.db.prepare('SELECT * FROM scores WHERE id=?').get(old),oldBest=(await s.app.inject({url:'/api/me/best?board=endless',headers:a})).json().best;
 const fresh=await submit(a,ENDLESS_V5),second=await submit(b,ENDLESS_V5,7000);expect(oldBest.id).toBe(old);expect(s.db.prepare('SELECT * FROM scores WHERE id=?').get(old)).toEqual(saved);
 expect((await s.app.inject({url:'/api/leaderboard?board=endless'})).json().items.map((r:{id:string})=>r.id)).toEqual([old]);expect((await s.app.inject({url:'/api/me/best?board=endless',headers:a})).json().best).toEqual(oldBest);
 const url='/api/leaderboard?board=endless&rulesVersion='+ENDLESS_RULES_VERSION,page=(await s.app.inject({url:url+'&limit=1'})).json(),next=(await s.app.inject({url:url+'&offset=1&limit=1'})).json();expect(page).toMatchObject({rankingRulesVersion:ENDLESS_RULES_VERSION,nextOffset:1});expect(page.items.map((x:{id:string})=>x.id)).toEqual([fresh]);expect(next.items[0]).toMatchObject({id:second,rank:2});expect(next.nextOffset).toBeNull();
 const me=(await s.app.inject({url:'/api/me/best?board=endless&rulesVersion='+ENDLESS_RULES_VERSION,headers:a})).json();expect(me.best).toMatchObject({id:fresh,rank:1});expect(me.rankingRulesVersion).toBe(ENDLESS_RULES_VERSION);
 await submit(a,ENDLESS_V5,4000);expect((await s.app.inject({url:'/api/me/best?board=endless&rulesVersion='+ENDLESS_RULES_VERSION,headers:a})).json().best.id).toBe(fresh);
 expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toEqual([]);expect((await s.app.inject({url:'/api/leaderboard?board=endless&rulesVersion='+RULES_VERSION})).statusCode).toBe(400);expect((await s.app.inject({method:'POST',url:'/api/challenges',headers:a,payload:{rulesVersion:'endless-unknown',seed:7}})).statusCode).toBe(400);
 expect(s.db.prepare('SELECT count(*) AS n FROM players').get()!.n).toBe(2);expect(s.db.prepare('SELECT count(*) AS n FROM scores').get()!.n).toBe(4);
 }finally{await s.app.close();}
},15000);
it('V1.4完整排名：TOP100分页截断但个人第105名可读，并列顺序稳定；旧版高分不混入',async()=>{
 const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false});try{
 const session=(await s.app.inject({url:'/api/me'})).cookies[0];const sid=s.db.prepare('SELECT id FROM sessions').get()!.id;
 // Ranking-only fixtures live exclusively in this in-memory test DB; never submitted to the real API.
 const add=(pid:string,id:string,rules:string,score:number,level:number,time:number,achieved:number)=>{
  s.db.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at,seed) VALUES(?,?,?,?,?,?)').run('c'+id,String(sid),rules,0,999999,7);
  s.db.prepare("INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,pid,'c'+id,'key'+id,'test',score,level,10,time,0,achieved,achieved,'verified','');
 };
 const expected:{id:string;level:number;time:number;achieved:number}[]=[];
 for(let i=0;i<105;i++){const pid='p'+i,id='s'+String(i).padStart(3,'0');s.db.prepare("INSERT INTO players VALUES(?,?,?,?,?,?,?,?)").run(pid,'测试'+i,'测试'+i,'ISO:CN','country',0,0,'active');const level=1+i%3,time=4000+i%4,achieved=i%5;add(pid,id,ENDLESS_RULES_VERSION,1000,level,time,achieved);expected.push({id,level,time,achieved});}
 expected.sort((a,b)=>b.level-a.level||a.time-b.time||a.achieved-b.achieved||a.id.localeCompare(b.id));add('p0','old-huge',ENDLESS_V4_RULES_VERSION,999999,99,3000,0);
 const ids:string[]=[];for(let offset=0;offset<100;offset+=20){const r=(await s.app.inject({url:'/api/leaderboard?board=endless&rulesVersion='+ENDLESS_RULES_VERSION+'&offset='+offset})).json();ids.push(...r.items.map((x:{id:string})=>x.id));expect(r.items.map((x:{rank:number})=>x.rank)).toEqual(Array.from({length:20},(_,n)=>offset+n+1));if(offset===80)expect(r.nextOffset).toBeNull();}
 expect(ids).toEqual(expected.slice(0,100).map(r=>r.id));const last=expected[104];const pid=s.db.prepare('SELECT player_id FROM scores WHERE id=?').get(last.id)!.player_id;s.db.prepare('UPDATE sessions SET player_id=?').run(pid);
 const result=(await s.app.inject({url:'/api/me/best?board=endless&rulesVersion='+ENDLESS_RULES_VERSION,headers:{cookie:'__Secure-qlgq='+session.value}})).json();expect(result.best).toMatchObject({id:last.id,rank:105});expect((await s.app.inject({url:'/api/leaderboard?board=endless'})).json().items[0].id).toBe('old-huge');
 }finally{await s.app.close();}
});
it('真实物理接触：拾取火焰/穿透后产生的范围击碎、闪电连击和新掉落仍能回放',()=>{
 const seed=7,g=new Game();g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();const p=g.physics,f=p.endless!;let burned=false,slashed=false;
 for(let t=1;t<=6000;t++){
  if(g.state==='ready')g.start();expect(g.state).toBe('running');
  const drop=p.powers.items.filter(d=>d.alive).sort((a,b)=>b.y-a.y)[0];p.setTarget(drop?.x??400);p.paddleX=p.targetX;
  for(const b of p.balls)Object.assign(b,{x:400,y:920,vx:440,vy:0,outsideArena:true});
  if((p.fireRemaining>0||p.pierceRemaining>0)&&t%30===0){const i=Array.from(f.alive.keys()).find(i=>f.alive[i]&&i%f.cols===22);if(i!==undefined)Object.assign(p.balls[0],{x:f.left+22*f.step+f.size/2,y:f.top+Math.floor(i/f.cols)*f.step+f.size+2,vx:0,vy:-440,outsideArena:false});}
  const seq=p.effects.eventSeq;g.update(C.step);if(p.effects.events.some(e=>e.seq>seq&&e.kind==='burn'))burned=true;if(p.effects.events.some(e=>e.seq>seq&&e.kind==='slash'))slashed=true;
  if(t%6===0){const cells=Array.from(f.alive.keys()).filter(i=>f.alive[i]);if(cells.length)f.hit(cells[t*7919%cells.length]);}
 }
 expect(burned).toBe(true);expect(slashed).toBe(true);expect(g.journal.events.some(e=>e.type==='power'&&e.kind==='lightning')).toBe(true);
 for(let n=0;n<10&&g.state!=='gameOver';n++){for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 const result=verifyTrace(g.journal.events,1e9,seed,g.rulesVersion);expect(result.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(result.suspicious).toEqual([]);
});
