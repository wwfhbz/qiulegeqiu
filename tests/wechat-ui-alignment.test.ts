import {it,expect} from 'vitest';
import {layout,inside} from '../wechat-game/src/Layout';
import {modePickerLayout} from '../wechat-game/src/ModePicker';
import {wxFixture} from './helpers/WxFixture';
import {MiniGameApp} from '../wechat-game/src/App';
import {VIEW} from '../src/Viewport';
const devices=[[320,568,20,568],[375,812,44,778],[390,844,47,810],[430,932,59,898],[412,915,24,891],[768,1024,24,1000]];
it.each(devices)('手机/平板 %s×%s：模式卡片在球场中央，触摸区域独立且不覆盖胶囊',(width,height,safe,bottom)=>{
 const v=layout(width,height,safe,bottom,safe+36,safe+4,width-95),picker=modePickerLayout(width,v.arena.y,v.bottom,v.arena.y+v.arena.height*.43);
 expect(v.hudY).toBeGreaterThanOrEqual(v.titleY+v.titleHeight);expect(v.arena.y).toBeGreaterThanOrEqual(v.hudY+v.hudHeight);expect(v.arena.width/v.arena.height).toBeCloseTo(VIEW.width/VIEW.height,12);expect(v.pad.y+v.pad.height).toBeLessThanOrEqual(bottom);
 expect(picker.card.y).toBeGreaterThanOrEqual(v.arena.y);expect(picker.card.y+picker.card.height).toBeLessThanOrEqual(v.bottom);expect(picker.rows[1].y).toBeGreaterThan(picker.rows[0].y+picker.rows[0].height);for(const row of picker.rows){expect(row.height).toBeGreaterThanOrEqual(44);expect(inside(picker.card,row.x+row.width,row.y+row.height)).toBe(true);}
});
it.each(['campaign','endless'] as const)('真实触摸选%s：仅改变既有模式，空白不穿透或自动发射',mode=>{
 const f=wxFixture(390,844),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{app.frame(16);const before=app.game.journal.events.length;const blank=f.touch(1,10,400);f.events.down(blank);f.events.up(blank);expect(app.picking).toBe(true);expect(app.game.journal.events.length).toBe(before);const hit=app.panel.hits[mode==='campaign'?0:1].rect,t=f.touch(2,hit.x+hit.width-15,hit.y+hit.height/2);f.events.down(t);f.events.up(t);app.frame(32);expect(app.game.mode).toBe(mode);expect(app.game.state).toBe('ready');expect(app.game.lives).toBe(mode==='campaign'?5:3);expect(app.game.journal.events).toHaveLength(0);expect(app.panel.open).toBe(false);expect(f.texts).toContain('球球出击');expect(f.texts).toContain('分数');expect(f.texts).toContain(mode==='campaign'?'01/12':'第1阶段');}finally{app.dispose();}
});
it('方向或窗口变化后重算卡片命中，不复用旧坐标',()=>{const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{app.frame(16);const x=app.panel.hits[0].rect.x;f.wx.getWindowInfo=()=>({windowWidth:430,windowHeight:932,pixelRatio:3,safeArea:{top:59,bottom:898,left:0,right:430}});f.wx.getMenuButtonBoundingClientRect=()=>({top:63,bottom:95,left:335});app.resize();app.frame(32);expect(app.panel.hits[0].rect.x).not.toBe(x);expect(app.panel.hits[1].rect.y+58).toBeLessThan(898);}finally{app.dispose();}});
