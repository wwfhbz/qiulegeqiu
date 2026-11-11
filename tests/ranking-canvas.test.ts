import {expect,it,vi} from 'vitest';
import {RankingCanvas,rankingLayout} from '../wechat-game/src/RankingCanvas';
import {context} from '../wechat-game/src/CanvasAdapter';
import {wxFixture} from './helpers/WxFixture';
import type {RankingScore} from '../src/online/ranking/Presentation';
const rows:RankingScore[]=Array.from({length:20},(_,i)=>({rank:i+1,display_name:'中国·本地测试昵称很长的排行榜玩家',score:123456,reached_level:5,bricks_destroyed:10258,duration_ms:632700}));
it.each([[320,568],[390,844],[768,1024]])('Canvas排行榜%s×%s滚动不覆盖固定个人卡及44像素操作区',(w,h)=>{
 const f=wxFixture(w,h),c=context(f.wx.createCanvas()),next=vi.fn(),inspect=vi.fn();const panel=new RankingCanvas({state:'ready',items:rows,offset:0,nextOffset:20,best:{...rows[0],rank:130}},[{label:'下一页',run:next}],inspect);
 panel.draw(c,w,86,h-42,0,true,w<360);expect(f.texts).toContain('我的排名：130');const geometry=rankingLayout(w,86,h-42);expect(geometry.body.y+geometry.body.height).toBeLessThan(geometry.navY);expect(geometry.navY+44).toBeLessThan(geometry.my.y);expect(geometry.my.y+geometry.my.height).toBeLessThanOrEqual(h-42);
 panel.scroll(-100000);expect(panel.scrollY).toBeGreaterThan(0);panel.draw(c,w,86,h-42,16,true,w<360);expect(panel.hits.filter(hit=>hit.rect.y<geometry.navY).every(hit=>hit.rect.y>=geometry.body.y&&hit.rect.y+hit.rect.height<=geometry.body.y+geometry.body.height)).toBe(true);
 panel.tap(20,geometry.navY+10);expect(next).toHaveBeenCalledOnce();expect(inspect).not.toHaveBeenCalled();panel.scroll(100000);expect(panel.scrollY).toBe(0);
});
it.each(['loading','error','ready'] as const)('Canvas %s、空榜和未上榜均如实展示',state=>{
 const f=wxFixture(),c=context(f.wx.createCanvas()),panel=new RankingCanvas({state,items:[],offset:0,nextOffset:null,best:null},[]);
 panel.draw(c,375,86,770,100,true,false);expect(f.texts).toContain('我的排名：未上榜');expect(f.texts.some(t=>t.includes(state==='loading'?'正在加载':state==='error'?'无法加载':'没有上榜'))).toBe(true);
});
it('Canvas暂停不推进光效时钟，低端设备绘制更少星芒，不改变数据',()=>{
 const f=wxFixture(),c=context(f.wx.createCanvas()),panel=new RankingCanvas({state:'ready',items:rows,offset:0,nextOffset:20,best:null},[]),copy=JSON.stringify(rows);
 panel.draw(c,390,86,800,0,true,false);panel.draw(c,390,86,800,16,true,false);const segments=vi.fn();c.lineTo=segments;panel.draw(c,390,86,800,32,true,false);const fullCount=segments.mock.calls.length;segments.mockClear();panel.draw(c,390,86,800,48,true,true);expect(segments.mock.calls.length).toBeLessThan(fullCount);const before=panel.motion.time;panel.draw(c,390,86,800,1000,false,false);panel.draw(c,390,86,800,2000,false,false);expect(panel.motion.time).toBe(before);expect(JSON.stringify(rows)).toBe(copy);
});
