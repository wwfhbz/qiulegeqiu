import {expect,it} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {ASSIST,ASSIST_TIERS,assistTier} from '../src/PowerRules';

const falling=(g:Game)=>g.physics.powers.items.filter(p=>p.alive);
const spawn=(g:Game,kind:'halve'|'triple'|'wide')=>(g.physics as unknown as {spawnPower(x:number,y:number,k:string):void}).spawnPower(400,300,kind);
const balls=(g:Game,n:number)=>{const p=g.physics;while(p.balls.filter(b=>b.alive).length<n)p.balls.push(p.newBall());};
const spy=(g:Game)=>{const kinds:string[]=[],p=g.physics,sp=p.powers.spawn.bind(p.powers);p.powers.spawn=(x,y,k)=>{kinds.push(k);sp(x,y,k);};return kinds;};
/** Keep the balls high and rising so nothing is lost and no brick drop interferes. */
const hover=(g:Game,seconds:number,keep=0)=>{for(let t=0;t<seconds;t+=C.step){if(keep)balls(g,keep);for(const b of g.physics.balls)if(b.alive){b.y=300;b.vy=-Math.abs(b.vy)||-300;}g.update(C.step);}};
const clearQueue=(g:Game)=>{for(const it of g.physics.powers.items)it.alive=false;(g.physics as unknown as {assistQueue:unknown[]}).assistQueue.length=0;};

it('难度分层：1–3 新手、4–6 进阶、7/9/10/11 挑战、8/12 Boss；帮助逐级减少，Boss 关完全不帮',()=>{
 expect([1,2,3,4,5,6,7,8,9,10,11,12].map(l=>assistTier(l).name)).toEqual(['新手','新手','新手','进阶','进阶','进阶','挑战','Boss','挑战','挑战','挑战','Boss']);
 const order=[ASSIST_TIERS.rookie,ASSIST_TIERS.rising,ASSIST_TIERS.hard,ASSIST_TIERS.boss];
 for(let i=1;i<order.length;i++){
  expect(order[i].halveMinBalls).toBeLessThanOrEqual(order[i-1].halveMinBalls);
  expect(order[i].rescueAfter).toBeGreaterThanOrEqual(order[i-1].rescueAfter);
  expect(order[i].queue).toBeLessThanOrEqual(order[i-1].queue);
 }
 expect(ASSIST_TIERS.boss).toMatchObject({halveMinBalls:0,rescueAfter:Infinity,lowBalls:0,endgameAfter:0});
});
it('掉落调度只在闯关存档（练习）中开启：完整挑战、无尽模式保持原规则',()=>{
 const g=new Game();expect(g.physics.assist).toBe(false);
 g.startPractice(3);expect(g.physics.assist).toBe(true);
 g.nextLevel();expect(g.physics.assist).toBe(true);
 g.setMode('endless');expect(g.physics.assist).toBe(false);
 g.setMode('campaign');g.reset();expect(g.physics.assist).toBe(false);
});
it('同屏最多 6 个掉落，多出的排队依次落下而不是消失；队列随难度变短',()=>{
 const g=new Game();g.startPractice(4);g.start();balls(g,20);
 for(let i=0;i<10;i++)spawn(g,'triple');
 expect(falling(g)).toHaveLength(ASSIST.onScreen);
 for(const p of falling(g))p.alive=false;g.update(C.step);expect(falling(g)).toHaveLength(1);
 const boss=new Game();boss.startPractice(8);boss.start();balls(boss,20);
 for(let i=0;i<40;i++)spawn(boss,'triple');
 expect((boss.physics as unknown as {assistQueue:unknown[]}).assistQueue).toHaveLength(ASSIST_TIERS.boss.queue);
});
it('÷2 保护：新手关 8 球及以下变加宽；挑战关和 Boss 关一个球也照样 ÷2',()=>{
 const g=new Game();g.startPractice(3);g.start();
 spawn(g,'halve');expect(falling(g)[0].kind).toBe('wide');
 for(const p of falling(g))p.alive=false;balls(g,9);spawn(g,'halve');expect(falling(g)[0].kind).toBe('halve');
 for(const level of [7,12]){const h=new Game();h.startPractice(level);h.start();spawn(h,'halve');expect(falling(h)[0].kind).toBe('halve');}
});
it('新手关只剩少量球 8 秒掉 ×3；Boss 关不救援',()=>{
 const g=new Game();g.startPractice(3);g.start();const kinds=spy(g);
 hover(g,ASSIST_TIERS.rookie.lowBallsAfter+.1);expect(kinds).toContain('triple');
 const boss=new Game();boss.startPractice(12);boss.start();clearQueue(boss);const none=spy(boss);
 hover(boss,40);expect(none).toHaveLength(0);
});
it('残局定时掉闪电（挑战关也有，防止找最后几块砖），闪电优先劈图案中心',()=>{
 const g=new Game();g.startPractice(7);g.start();const p=g.physics,b=p.blocks;
 const keep=[...b.alive.keys()].filter(i=>b.alive[i]&&!b.isSteel(i));
 for(const i of keep.slice(20))while(b.alive[i])b.hit(i);
 expect(b.remaining).toBeLessThanOrEqual(ASSIST.endgameBricks);
 clearQueue(g);const kinds=spy(g);
 hover(g,ASSIST_TIERS.hard.endgameAfter+.2,6);expect(kinds).toContain('lightning');
 const d=(i:number)=>(i%b.cols+.5-b.cols/2)**2+(Math.floor(i/b.cols)+.5-b.rows/2)**2;
 const left=[...b.alive.keys()].filter(i=>b.alive[i]&&!b.isSteel(i));expect(left.length).toBeGreaterThan(0);
 const centre=[...left].sort((x,y)=>d(x)-d(y))[0],hp=b.hp[centre];balls(g,1);p.lightning();expect(b.alive[centre]===0||b.hp[centre]<hp).toBe(true);
});
it('掉落频率：钢砖关 7/10 稍密，Boss 关 8/12 更稀；完整挑战不变',()=>{
 const g=new Game(),every=(l:number)=>{g.startPractice(l);return g.physics.powerDropEvery;};
 expect([7,10,8,12,9].map(every)).toEqual([20,28,28,34,30]);
 g.startPractice(7);g.physics.assist=false;expect(g.physics.powerDropEvery).toBe(26);
});
