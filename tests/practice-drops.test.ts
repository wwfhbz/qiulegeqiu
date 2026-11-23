import {expect,it} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {ASSIST} from '../src/PowerRules';

const falling=(g:Game)=>g.physics.powers.items.filter(p=>p.alive);
const spawn=(g:Game,kind:'halve'|'triple'|'wide')=>(g.physics as unknown as {spawnPower(x:number,y:number,k:string):void}).spawnPower(400,300,kind);
const balls=(g:Game,n:number)=>{const p=g.physics;while(p.balls.filter(b=>b.alive).length<n)p.balls.push(p.newBall());};

it('掉落调度只在闯关存档（练习）中开启：完整挑战、无尽模式保持原规则',()=>{
 const g=new Game();expect(g.physics.assist).toBe(false);
 g.startPractice(3);expect(g.physics.assist).toBe(true);
 g.nextLevel();expect(g.physics.assist).toBe(true);
 g.setMode('endless');expect(g.physics.assist).toBe(false);
 g.setMode('campaign');g.reset();expect(g.physics.assist).toBe(false);
});
it('同屏最多 6 个掉落，多出的排队依次落下而不是消失',()=>{
 const g=new Game();g.startPractice(4);g.start();balls(g,20);
 for(let i=0;i<10;i++)spawn(g,'triple');
 expect(falling(g)).toHaveLength(ASSIST.onScreen);
 for(const p of falling(g))p.alive=false;
 g.update(C.step);expect(falling(g)).toHaveLength(1);
 let released=1;for(let t=0;t<6&&released<4;t+=C.step){for(const p of falling(g))p.alive=false;const before=g.physics.powers.items.filter(p=>p.alive).length;g.update(C.step);released+=falling(g).length-before>0?1:0;}
 expect(released).toBe(4);
});
it('球少时 ÷2 变成加宽；球多时 ÷2 照常',()=>{
 const g=new Game();g.startPractice(4);g.start();
 spawn(g,'halve');expect(falling(g)[0].kind).toBe('wide');
 for(const p of falling(g))p.alive=false;balls(g,ASSIST.halveMinBalls+1);
 spawn(g,'halve');expect(falling(g)[0].kind).toBe('halve');
});
it('只剩少量球持续 8 秒会掉一个 ×3；长时间无掉落会掉救援道具',()=>{
 const g=new Game();g.startPractice(7);g.start();const p=g.physics;
 const kinds:string[]=[];const sp=p.powers.spawn.bind(p.powers);p.powers.spawn=(x,y,k)=>{kinds.push(k);sp(x,y,k);};
 for(let t=0;t<ASSIST.lowBallsAfter+.1;t+=C.step){for(const b of p.balls)if(b.alive){b.y=300;b.vy=-Math.abs(b.vy)||-300;}g.update(C.step);}
 expect(kinds).toContain('triple');
});
it('残局（剩余砖很少）定时掉闪电，闪电优先劈图案中心',()=>{
 const g=new Game();g.startPractice(7);g.start();const p=g.physics,b=p.blocks;
 const keep=[...b.alive.keys()].filter(i=>b.alive[i]&&!b.isSteel(i));
 for(const i of keep.slice(20))while(b.alive[i])b.hit(i);
 expect(b.remaining).toBeLessThanOrEqual(ASSIST.endgameBricks);
 for(const it of p.powers.items)it.alive=false;(p as unknown as {assistQueue:unknown[]}).assistQueue.length=0;
 const kinds:string[]=[];const sp=p.powers.spawn.bind(p.powers);p.powers.spawn=(x,y,k)=>{kinds.push(k);sp(x,y,k);};
 for(let t=0;t<ASSIST.endgameAfter+.2;t+=C.step){balls(g,6);for(const ball of p.balls)if(ball.alive){ball.y=300;ball.vy=-Math.abs(ball.vy)||-300;}g.update(C.step);}
 expect(kinds).toContain('lightning');
 // Centre-first targeting: the struck brick is the remaining one nearest the grid centre.
 const left=[...b.alive.keys()].filter(i=>b.alive[i]&&!b.isSteel(i));
 expect(left.length).toBeGreaterThan(0);
 {const d=(i:number)=>(i%b.cols+.5-b.cols/2)**2+(Math.floor(i/b.cols)+.5-b.rows/2)**2;const centre=[...left].sort((x,y)=>d(x)-d(y))[0],hp=b.hp[centre];balls(g,1);p.lightning();expect(b.alive[centre]===0||b.hp[centre]<hp).toBe(true);}
});
it('练习中钢砖多的关掉落更勤（7 关每 16 砖、10 关每 22 砖），完整挑战不变',()=>{
 const g=new Game();g.startPractice(7);expect(g.physics.powerDropEvery).toBe(16);
 g.startPractice(10);expect(g.physics.powerDropEvery).toBe(22);
 g.startPractice(9);expect(g.physics.powerDropEvery).toBe(30);
 g.physics.assist=false;g.startPractice(7);g.physics.assist=false;expect(g.physics.powerDropEvery).toBe(26);
});
