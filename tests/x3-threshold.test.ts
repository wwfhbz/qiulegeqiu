import {expect,it} from 'vitest';
import {tripleTarget} from '../src/PowerRules';
import {Physics} from '../src/Physics';
import {Game} from '../src/Game';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
const cases=[[1,3],[10,30],[19,57],[20,60],[21,24],[22,25],[30,33],[50,53],[90,93],[99,100],[100,100]];
function fill(p:Physics,n:number){p.resetRound(false);for(let i=0;i<n;i++)p.balls.push(p.newBall());}
it.each(cases)('共享规则与真实Physics道具拾取：%i → %i', (count,target)=>{expect(tripleTarget(count)).toBe(target);const p=new Physics();fill(p,count);const old=p.balls.slice(),velocities=old.map(b=>[b.vx,b.vy]);p.collect('triple');expect(p.balls).toHaveLength(target);expect(new Set(p.balls).size).toBe(target);for(let i=0;i<count;i++){expect(p.balls[i]).toBe(old[i]);expect([old[i].vx,old[i].vy]).toEqual(velocities[i]);}});
it('每次拾取重新判断，20→60→63，21→24→27→30，最终封顶',()=>{const p=new Physics();fill(p,20);p.collect('triple');expect(p.balls).toHaveLength(60);p.collect('triple');expect(p.balls).toHaveLength(63);fill(p,21);for(const n of [24,27,30]){p.collect('triple');expect(p.balls).toHaveLength(n);}for(let n=0;n<50;n++){p.collect('triple');expect(p.balls.length).toBeLessThanOrEqual(100);}expect(p.balls).toHaveLength(100);});
it('有效球数排除死亡球，不凭数组总长跨过20阈值',()=>{const p=new Physics();fill(p,21);p.balls[0].alive=false;p.collect('triple');expect(p.balls).toHaveLength(60);expect(p.balls.every(b=>b.alive)).toBe(true);});
it('球数范围、空场和旧算法仍有明确边界',()=>{expect(tripleTarget(0)).toBe(0);for(const n of [-1,1.5,101,NaN,Infinity])expect(()=>tripleTarget(n)).toThrow();expect(tripleTarget(21,1)).toBe(63);expect(tripleTarget(30,1)).toBe(90);expect(tripleTarget(50,1)).toBe(100);});
it('Web Game与微信Game共用规则，日志只在整局首次发射声明版本',()=>{const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),web=new Game();for(const g of [web,app.game]){g.start();expect(g.journal.events[0]).toMatchObject({type:'launch',tripleRuleVersion:2});for(const [n,target] of cases){fill(g.physics,n);g.physics.collect('triple');expect(g.physics.balls).toHaveLength(target);}g.pause();g.start();expect(g.journal.events.filter(e=>e.type==='launch')).toHaveLength(1);g.reset();g.start();expect(g.journal.events[0]).toMatchObject({tripleRuleVersion:2});}expect(app.game.journal.events).toEqual(web.journal.events);web.dispose();app.dispose();});
