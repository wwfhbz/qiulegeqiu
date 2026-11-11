import {expect,it} from 'vitest';
import {rankingCard,personalRanking,timeText,motionQuality,RankingMotion,type RankingScore} from '../src/online/ranking/Presentation';
const score:RankingScore={rank:130,display_name:'太和·测试玩家',score:314115,reached_level:5,bricks_destroyed:10258,duration_ms:632700};
it('完整展示服务端成绩，不从TOP100推测我的排名或虚构缺失字段',()=>{
 expect(personalRanking(score).title).toBe('我的排名：130');expect(rankingCard(score)).toMatchObject({name:'太和·测试玩家',score:'314,115',level:'第5关',bricks:'10,258',time:'10:32.700',honor:false});
 expect(personalRanking(null)).toMatchObject({title:'我的排名：未上榜',card:null});expect(personalRanking(undefined,false).title).toContain('暂不可用');expect(personalRanking(undefined,true,true).title).toContain('未登录');
 expect(timeText(undefined)).toBe('—');expect(rankingCard({...score,bricks_destroyed:undefined}).bricks).toBe('—');
});
it('前5荣耀按真实排名判断，不按本页位置或并列分数擅自重排',()=>{
 const rows=[6,2,2,1,5,101].map(rank=>Object.freeze({...score,rank,score:100}));const copy=JSON.stringify(rows);
 expect(rows.map(row=>rankingCard(row).rank)).toEqual([6,2,2,1,5,101]);expect(rows.map(row=>rankingCard(row).honor)).toEqual([false,true,true,true,true,false]);expect(rows.map(row=>rankingCard(row).champion)).toEqual([false,false,false,true,false,false]);expect(JSON.stringify(rows)).toBe(copy);
});
it('长Unicode昵称保持服务端原文，由视图截断而非修改玩家身份',()=>{const name='中国·'+ '测𠮷试'.repeat(40);expect(rankingCard({...score,display_name:name}).name).toBe(name);});
it('后台/暂停/减少动态关闭动画，低配降档，显示时钟不推进隐藏时间',()=>{
 expect(motionQuality(false,false,false,false)).toBe('off');expect(motionQuality(true,true,false,false)).toBe('off');expect(motionQuality(true,false,true,false)).toBe('off');expect(motionQuality(true,false,false,true)).toBe('low');expect(motionQuality(true,false,false,false)).toBe('full');
 const clock=new RankingMotion();clock.update(0,true);clock.update(16,true);const before=clock.time;clock.update(1000,false);clock.update(2000,false);expect(clock.time).toBe(before);clock.update(2016,true);expect(clock.time-before).toBe(16);for(let i=1;i<=15;i++)clock.update(2016+i*40,true);expect(clock.low).toBe(true);
});
