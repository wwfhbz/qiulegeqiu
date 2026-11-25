import {expect,it} from 'vitest';
import {ShardWallet,SHARD_RULES,SKIN_STAR_GATES,SKIN_SHARD_PRICE,dayKey} from '../src/campaign/Shards';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';

it('碎片：每关首次三星只给一次、每天第一局一次、视频每天8次、无尽每10阶段1片；不足不能兑换',()=>{
 const store={v:undefined as unknown,read(){return this.v;},write(x:unknown){this.v=JSON.parse(JSON.stringify(x));}},w=new ShardWallet(store);
 expect(w.earnThreeStars(3)).toBe(2);expect(w.earnThreeStars(3)).toBe(0);expect(w.balance).toBe(2);
 expect(w.earnDaily('2026-11-23')).toBe(1);expect(w.earnDaily('2026-11-23')).toBe(0);expect(w.earnDaily('2026-11-24')).toBe(1);
 for(let i=0;i<8;i++)expect(w.earnVideo('2026-11-23')).toBe(3);expect(w.earnVideo('2026-11-23')).toBe(0);expect(w.videosLeft('2026-11-23')).toBe(0);expect(w.videosLeft('2026-11-24')).toBe(8);
 expect([9,10,19,20,35].map(ShardWallet.endlessMilestones)).toEqual([0,1,1,2,3]);expect(w.earnEndless(2)).toBe(2);
 const balance=w.balance;expect(balance).toBe(2+2+24+2);
 const again=new ShardWallet(store);expect(again.balance).toBe(balance);expect(again.earnThreeStars(3)).toBe(0);
 expect(again.spend(SKIN_SHARD_PRICE)).toBe(true);expect(again.balance).toBe(balance-10);expect(again.spend(100)).toBe(false);
 expect(Object.values(SKIN_STAR_GATES)).toEqual([3,6,9,12,15,18]);expect(SHARD_RULES.endlessStageStep).toBe(10);expect(dayKey(new Date(2026,0,5).getTime())).toBe('2026-01-05');
});
it('微信：今日第一局得1片；无尽一局每到第10/20阶段各1片且同一局不重复；2.16前按星数解锁的挡板升级后保留',()=>{
 const f=wxFixture(390,844,3);f.storage.set('qiulegeqiu:wechat-stars:v1',JSON.stringify({stars:[3,3,3,3,3,0,0,0,0,0,0,0]}));
 const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});
 try{expect(f.storage.get('qiulegeqiu:wechat-paddles:v1')).toEqual(['neon']);
  (app as unknown as {chooseMode(m:string):void}).chooseMode('endless');const g=app.game;g.start();app.frame(16);expect(app.shards.balance).toBe(1);
  const field=g.physics.endless!;field.descents=95;app.frame(32);expect(g.reachedLevel).toBeGreaterThanOrEqual(10);const after=app.shards.balance;expect(after).toBe(1+Math.floor(g.reachedLevel/10));
  app.frame(48);expect(app.shards.balance).toBe(after);
 }finally{app.dispose();}
});
