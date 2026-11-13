import {expect,it,vi} from 'vitest';
import {AudioSystem} from '../src/Audio';
import {Effects} from '../src/Effects';
import {HapticTracker} from '../src/Haptics';
import {Game} from '../src/Game';
import {Renderer} from '../src/Renderer';
import {wxFixture} from './helpers/WxFixture';
import {context} from '../wechat-game/src/CanvasAdapter';

function fakeContext(state:string){
 const started:number[]=[],ctx={state,currentTime:0,destination:{},resume:vi.fn(async()=>{ctx.state='running';}),
  createGain:()=>({gain:{value:0,cancelScheduledValues(){}},connect:vi.fn()}),
  createDynamicsCompressor:()=>({threshold:{value:0},ratio:{value:0},connect:vi.fn()}),
  createBuffer:vi.fn(()=>({})),createBufferSource:()=>({buffer:null,connect:vi.fn(),start:(t:number)=>started.push(t)})};
 return {ctx,started};
}
it('移动端音频：任意手势都恢复挂起/中断的音频，首次手势播放一次静音缓冲解锁旧iOS',()=>{
 const {ctx,started}=fakeContext('suspended'),audio=new AudioSystem(()=>ctx as unknown as AudioContext);
 audio.unlock();expect(ctx.resume).toHaveBeenCalledTimes(1);expect(started).toEqual([0]);
 ctx.state='interrupted';audio.unlock();expect(ctx.resume).toHaveBeenCalledTimes(2);expect(started).toHaveLength(1);
 ctx.state='running';audio.unlock();expect(ctx.resume).toHaveBeenCalledTimes(2);
});
it('没有createBuffer或压缩器的宿主（微信夹具）仍可解锁，不抛错',()=>{
 const ctx={state:'suspended',destination:{},resume:vi.fn(async()=>{}),createGain:()=>({gain:{value:0},connect:()=>{}})};
 const audio=new AudioSystem(()=>ctx as unknown as AudioContext);expect(()=>audio.unlock()).not.toThrow();expect(ctx.resume).toHaveBeenCalled();
});
it('屏幕震动：连击只在每100连击时震动，5/10/20/25/50连击只弹提示',()=>{
 const game=new Game(),canvas=wxFixture().wx.createCanvas(),cached=wxFixture().wx.createCanvas();context(canvas);context(cached);
 const r=new Renderer(canvas,{cache:cached,viewport:()=>({width:390,height:546}),pixelRatio:()=>2});
 const fx=game.physics.effects,shook=()=>(r as unknown as {shakeUntil:number}).shakeUntil;
 r.draw(game.physics,false,0);let now=1000;
 for(const combo of [5,10,20,25,50,75]){fx.emit('combo',400,400,combo);r.draw(game.physics,false,now);expect(shook(),`combo ${combo}`).toBeLessThan(now);now+=1000;}
 for(const combo of [100,200]){fx.emit('combo',400,400,combo);r.draw(game.physics,false,now);expect(shook(),`combo ${combo}`).toBeGreaterThan(now);now+=1000;}
 r.dispose();game.dispose();
});
it('振动策略（网页/微信共用）：只在炸弹、清台、÷2、最后一球漏掉时触发，节流120毫秒，不随砖块和连击触发',()=>{
 const fx=new Effects(),h=new HapticTracker();expect(h.next(fx,false,0)).toBeUndefined();
 fx.emit('hit',0,0);fx.emit('combo',0,0,100);fx.emit('paddle',0,0);expect(h.next(fx,false,1000)).toBeUndefined();
 fx.emit('lost',0,0);expect(h.next(fx,false,2000)).toBeUndefined();
 fx.emit('lost',0,0);expect(h.next(fx,true,3000)).toBe('medium');
 fx.emit('power',0,0,0,'halve');expect(h.next(fx,false,3050)).toBeUndefined();
 fx.emit('bomb',0,0);expect(h.next(fx,false,4000)).toBe('heavy');
 fx.emit('clear',0,0);fx.emit('power',0,0,0,'halve');expect(h.next(fx,false,5000)).toBe('heavy');
});
it('100颗火焰/穿透球连续渲染不抛错、不改动游戏状态，特效池大小固定',()=>{
 const game=new Game();game.setMode('endless');game.start();const p=game.physics;
 const canvas=wxFixture().wx.createCanvas(),cached=wxFixture().wx.createCanvas();context(canvas);context(cached);
 const r=new Renderer(canvas,{cache:cached,viewport:()=>({width:390,height:546}),pixelRatio:()=>2});
 while(p.balls.length<100)p.balls.push(p.newBall());p.fireRemaining=5;p.pierceRemaining=5;
 for(let i=0;i<40;i++)p.effects.emit(i%3===0?'burn':i%3===1?'slash':'poof',300+i,300,16,undefined,1,-1);
 const snapshot=JSON.stringify([p.balls,p.fireRemaining,p.pierceRemaining,game.score.total]);
 for(let f=0;f<90;f++){for(const b of p.balls)b.x+=1;r.draw(p,false,f*16);}
 for(const b of p.balls)b.x-=90;expect(JSON.stringify([p.balls,p.fireRemaining,p.pierceRemaining,game.score.total])).toBe(snapshot);
 const fx=(r as unknown as {powerFx:{blobs:unknown[];sparks:unknown[];trails:Map<unknown,unknown>}}).powerFx;expect(fx.blobs).toHaveLength(40);expect(fx.sparks).toHaveLength(220);expect(fx.trails.size).toBeLessThanOrEqual(40);
 r.dispose();game.dispose();
});
