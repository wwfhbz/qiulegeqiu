// Test-only: real API + controlled WeChat exchange, temporary DB, random loopback port. Not shipped.
import {resolve} from 'node:path';import {tmpdir} from 'node:os';
import {createApp} from '../server/src/app';import {Game} from '../src/Game';import {C} from '../src/GameConfig';
const path=resolve(process.env.FRESH_FIXTURE_DB||'');if(!path.startsWith(resolve(tmpdir())+'/qiulegeqiu-fresh-'))throw Error('测试仅允许独立临时数据库');
let clock=Date.now();const {app}=await createApp({dbPath:path,secure:true,origin:'https://test.local',now:()=>clock,rateLimit:false,wechat:{appId:'wx0000000000000000',exchange:async code=>({openid:code.split(':')[0]})}});
app.get('/fixture/advance',async()=>{clock+=20000;return {ok:true};});
app.get('/fixture/trace',async()=>{const g=new Game();for(let r=0;r<5;r++){g.start();if(r===0)g.physics.blocks.hit(g.physics.blocks.alive.findIndex(Boolean));Object.assign(g.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});for(let n=0;n<20;n++)g.update(.1);Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}return {events:g.journal.events,seed:g.journal.seed,summary:g.journal.summary(g.score.total,1,false)};});
await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw Error('No local port');console.log('FRESH_PORT='+address.port);
process.on('SIGTERM',()=>{void app.close().then(()=>process.exit(0));});
