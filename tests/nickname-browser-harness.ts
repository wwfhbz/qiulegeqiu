// Local-only integration harness, not bundled or deployed. No production data or credentials.
import {createApp} from '../server/src/app';
let time=Date.now();const {app}=await createApp({dbPath:':memory:',secure:false,origin:process.env.FRONT_ORIGIN!,rateLimit:false,now:()=>time});
// Fixed-tick play is advanced quickly by the browser fixture; reserve sufficient server challenge time.
app.addHook('onResponse',async(req)=>{if(req.method==='POST'&&req.url==='/api/challenges')time+=60000;});
await app.listen({host:'127.0.0.1',port:0});const a=app.server.address();if(!a||typeof a==='string')throw Error('No local port');console.log('NICKNAME_PORT='+a.port);process.on('SIGTERM',()=>{void app.close().then(()=>process.exit(0));});
