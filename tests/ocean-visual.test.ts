import {expect,it,vi} from 'vitest';
import {OCEAN,visualBudget,brickColor,brickColorIndex,rankColor} from '../shared/VisualTheme';
import {Game} from '../src/Game';
import {Renderer} from '../src/Renderer';
import {C} from '../src/GameConfig';
import {wxFixture} from './helpers/WxFixture';
import {context} from '../wechat-game/src/CanvasAdapter';
import {MiniGameApp} from '../wechat-game/src/App';
function renderer(sprites=false){const sprite=wxFixture(),atlas=sprite.wx.createCanvas(),ac=context(atlas),factory=vi.fn(()=>atlas);const front=wxFixture(),cached=wxFixture(),canvas=front.wx.createCanvas(),cache=cached.wx.createCanvas();const c=context(canvas),cc=context(cache);return {c,cc,ac,factory,r:new Renderer(canvas,{cache,...(sprites?{createSurface:factory}:{}),viewport:()=>({width:390,height:546}),pixelRatio:()=>3})};}
it('主题六色与低饱和排名语义，共享配置不携带玩法参数',()=>{
 expect(new Set(OCEAN.bricks).size).toBe(6);expect(rankColor(1)).toBe(OCEAN.rank.gold);expect(rankColor(2)).toBe(OCEAN.rank.silver);expect(rankColor(3)).toBe(OCEAN.rank.bronze);expect(rankColor(4)).not.toBe(rankColor(5));expect(Object.keys(OCEAN)).not.toContain('physics');expect(brickColorIndex(0,0)).toBe(0);
});
it.each([[20,0,16],[21,1,7],[50,1,7],[51,2,0],[100,2,0]])('%i球仅按预算降级拖尾：档位%i、长度%i',(balls,tier,length)=>{const b=visualBudget(balls);expect(b.tier).toBe(tier);expect(b.trailLength).toBe(length);expect(visualBudget(balls,true).particles).toBeLessThanOrEqual(b.particles);});
it('600砖按行色带缓存只首次构建；击碎后仅清除对应格子，不为单砖创建渐变',()=>{
 const g=new Game(),{r,cc}=renderer(),colors=new Set(),fill=vi.fn(()=>{colors.add(cc.fillStyle);}),clear=vi.fn(),gradient=vi.fn();cc.fill=fill;cc.clearRect=clear;cc.createLinearGradient=gradient;
 r.draw(g.physics,true,0);const built=fill.mock.calls.length;expect(built).toBeGreaterThanOrEqual(600);expect(built).toBeLessThanOrEqual(600*3);for(let i=0;i<g.physics.blocks.alive.length;i++)if(g.physics.blocks.alive[i])expect(colors.has(brickColor(Math.floor(i/g.physics.blocks.cols),g.physics.blocks.step,1))).toBe(true);expect(gradient).not.toHaveBeenCalled();
 r.draw(g.physics,true,16);expect(fill).toHaveBeenCalledTimes(built);const before=clear.mock.calls.length;const index=g.physics.blocks.alive.findIndex(Boolean);g.physics.blocks.hit(index);r.draw(g.physics,true,32);expect(clear.mock.calls.length).toBe(before+1);expect(fill).toHaveBeenCalledTimes(built);r.dispose();
});
it('有纹理工厂时：六种斜面砖只预渲染一次，缓存逐砖盖章，帧间不重建',()=>{
 const g=new Game(),{r,cc,factory}=renderer(true),stamp=vi.fn(),gradient=vi.fn();cc.drawImage=stamp;cc.createLinearGradient=gradient;
 r.draw(g.physics,true,0);expect(stamp).toHaveBeenCalledTimes(600);expect(gradient).not.toHaveBeenCalled();const surfaces=factory.mock.calls.length;
 for(let f=1;f<10;f++)r.draw(g.physics,false,f*16);expect(stamp).toHaveBeenCalledTimes(600);expect(factory.mock.calls.length).toBe(surfaces);r.dispose();
});
it.each([20,50,100])('连续渲染%i球不改变Physics、Effects、ChallengeJournal、得分或生命',count=>{
 const g=new Game();g.journal.seed=42;g.physics.setSeed(42);g.start();while(g.physics.balls.length<count)g.physics.balls.push(g.physics.newBall());for(let n=0;n<20;n++)g.update(C.step);const snapshot=JSON.stringify(g),{r}=renderer();for(let frame=0;frame<60;frame++)r.draw(g.physics,false,frame*16);expect(JSON.stringify(g)).toBe(snapshot);r.dispose();g.dispose();
});
it('Web及微信同样保留600/120、1200/86/58配置、五命与新版规则日志',()=>{
 const f=wxFixture(),wx=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),web=new Game();
 try{for(const level of [1,2]){for(const g of [wx.game,web]){g.journal.seed=42;g.physics.setSeed(42);g.start();expect(g.lives).toBe(5);expect(g.physics.blocks.total).toBe(level===1?600:1200);expect(Array.from(g.physics.blocks.powerKinds).filter(n=>n===1)).toHaveLength(level===1?96:86);expect(Array.from(g.physics.blocks.powerKinds).filter(n=>n===2)).toHaveLength(level===1?24:58);}expect(wx.game.journal.events).toEqual(web.journal.events);for(const g of [wx.game,web]){for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);}}}
 finally{wx.dispose();web.dispose();}
});

it('120个道具徽章使用共享纹理图集，不在每帧重复排版120次文字',()=>{
 const g=new Game(),{r,c,ac,factory}=renderer(true);const text=vi.fn();ac.fillText=text;
 for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);r.resize();expect(text).toHaveBeenCalledTimes(9);
 const draw=vi.fn();c.drawImage=draw;r.draw(g.physics,false,0);const perFrame=draw.mock.calls.length;expect(perFrame).toBeGreaterThanOrEqual(120);expect(perFrame).toBeLessThanOrEqual(120*2+8);r.draw(g.physics,false,16);expect(draw).toHaveBeenCalledTimes(perFrame*2);expect(text).toHaveBeenCalledTimes(9);expect(factory.mock.calls.length).toBeLessThan(20);expect(g.physics.powers.items.filter(p=>p.alive)).toHaveLength(120);r.dispose();
});
it('微信错误使用完整原生文字提示且恢复提交状态，不清理挑战记录',async()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),message='本地错误回归：'.repeat(40),modal=vi.fn();f.wx.showModal=modal;const original=JSON.stringify(app.game.journal.events);
 try{await (app as unknown as {task(work:()=>Promise<void>):Promise<void>}).task(async()=>{throw Error(message);});expect(modal).toHaveBeenCalledWith(expect.objectContaining({title:'操作未完成',content:message,showCancel:false}));expect(JSON.stringify(app.game.journal.events)).toBe(original);let retried=false;await (app as unknown as {task(work:()=>Promise<void>):Promise<void>}).task(async()=>{retried=true;});expect(retried).toBe(true);}finally{app.dispose();}
});
