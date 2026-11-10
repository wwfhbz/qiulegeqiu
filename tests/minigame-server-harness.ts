// Test-only provider, bound to random loopback port and in-memory DB. Never part of build/deploy.
import {createApp} from '../server/src/app';
let clock=Date.now();
const {app}=await createApp({now:()=>clock,dbPath:':memory:',secure:true,origin:'https://ball.gmgnclaw.com',rateLimit:false,wechat:{appId:'wx0000000000000000',exchange:async code=>({openid:code})}});
app.post('/api/__test/advance',async()=>{clock+=20000;return {ok:true};});
await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();if(!address||typeof address==='string')throw Error('Missing harness listener');console.log('HARNESS_PORT='+address.port);
process.on('SIGTERM',()=>{void app.close().then(()=>process.exit(0));});
