import {it,expect} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import type {Touch} from '../wechat-game/src/Platform';
type Internals={modePicker():void;rankingBoard:string};
for(const [width,height,dpr] of [[320,568,1],[390,844,3],[430,932,2]])for(const shape of ['client','xy','page'] as const){
 it(`${width}×${height} DPR${dpr} ${shape}：真实触摸闯关→无尽→闯关，轻微移动可选`,()=>{
  const f=wxFixture(width,height,dpr),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),internal=app as unknown as Internals;
  const point=(x:number,y:number):Touch=>({identifier:7,...(shape==='client'?{clientX:x,clientY:y}:shape==='xy'?{x,y}:{pageX:x,pageY:y})});
  try{for(const mode of ['campaign','endless','campaign'] as const){if(!app.picking)internal.modePicker();app.frame(16);const r=app.panel.hits[mode==='campaign'?0:1].rect,x=r.x+r.width/2,y=r.y+r.height/2,t=point(x,y),end=point(x+10,y+2);f.events.down({touches:[t],changedTouches:[t]});f.events.move({touches:[end],changedTouches:[end]});f.events.up({touches:[],changedTouches:[end]});app.frame(32);expect(app.game.mode).toBe(mode);expect(app.game.lives).toBe(mode==='campaign'?5:3);expect(app.game.levels.count).toBe(mode==='campaign'?12:1);expect(app.game.physics.endless!==undefined).toBe(mode==='endless');expect(internal.rankingBoard).toBe(mode==='campaign'?'global':'endless');expect(app.panel.open).toBe(false);expect(app.game.state).toBe('ready');expect(app.game.journal.events).toHaveLength(0);expect(f.texts).toContain(mode==='campaign'?'01/12':'第1阶段');}}
  finally{app.dispose();}
 });
}
it('丢弃非法坐标；拖动离开按钮不触发；取消后下一次触摸可用',()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{app.frame(16);const r=app.panel.hits[1].rect;f.events.down({touches:[],changedTouches:[{identifier:1,clientX:NaN,clientY:r.y}]});expect(app.picking).toBe(true);const t={identifier:2,x:r.x+10,y:r.y+10},end={...t,x:r.x+r.width+30};f.events.down({touches:[t],changedTouches:[t]});f.events.up({touches:[],changedTouches:[end]});expect(app.game.mode).toBe('campaign');f.events.down({touches:[t],changedTouches:[t]});f.events.cancel();f.events.down({touches:[t],changedTouches:[t]});f.events.up({touches:[],changedTouches:[t]});expect(app.game.mode).toBe('endless');}finally{app.dispose();}
});
it('进行中和暂停对局拒绝切换，不清空分数/日志；结束后可选择任意模式',()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{app.chooseMode('campaign');app.game.start();for(const paused of [false,true]){if(paused)app.game.pause();const snapshot=JSON.stringify(app.game.journal);app.chooseMode('endless');expect(app.game.mode).toBe('campaign');expect(JSON.stringify(app.game.journal)).toBe(snapshot);}app.game.state='gameOver';app.chooseMode('endless');expect(app.game.mode).toBe('endless');expect(app.game.lives).toBe(3);app.game.state='victory';app.chooseMode('campaign');expect(app.game.mode).toBe('campaign');expect(app.game.lives).toBe(5);}finally{app.dispose();}
});
