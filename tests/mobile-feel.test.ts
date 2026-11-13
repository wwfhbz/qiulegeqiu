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
