import { createApp } from './app.js';
const {app}=await createApp();
const port=Number(process.env.PORT||8091);
if(port===8080)throw new Error('禁止使用其他游戏的8080端口');
await app.listen({host:'127.0.0.1',port});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
