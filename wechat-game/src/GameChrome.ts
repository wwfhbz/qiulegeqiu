import {OCEAN} from '../../shared/VisualTheme';
import {canvasText,panel} from '../../shared/CanvasUI';
import type {Game} from '../../src/Game';
import type {Rect} from './Layout';
/** Same grouping, colours and hierarchy as the web .hud; read-only live Game state. */
export function drawHud(c:CanvasRenderingContext2D,g:Game,r:Rect){
 c.save();const gradient=c.createLinearGradient(0,r.y,0,r.y+r.height);gradient?.addColorStop(0,'rgba(255,255,255,.14)');gradient?.addColorStop(1,'rgba(255,255,255,.06)');panel(c,r,gradient||OCEAN.colors.panel,'rgba(255,255,255,.16)',20);
 const field=g.physics.endless,b=g.physics.blocks,progress=field?Math.round(field.descentProgress*100):Math.round(b.removed/Math.max(1,b.total)*100),left=r.x+12,right=r.x+r.width-12,center=r.x+r.width/2;
 canvasText(c,field?'阶段':'关卡',left,r.y+15,64,10,OCEAN.colors.muted);canvasText(c,field?`第${g.reachedLevel}阶段`:`${String(g.levels.current.number).padStart(2,'0')}/${g.levels.count}`,left,r.y+34,70,16,OCEAN.colors.text);
 canvasText(c,'分数',center,r.y+13,r.width*.38,10,OCEAN.colors.muted,'center');const gold=c.createLinearGradient(0,r.y+20,0,r.y+43);gold?.addColorStop(0,'#FFFFFF');gold?.addColorStop(.5,'#FFE27A');gold?.addColorStop(1,'#FFB31F');c.fillStyle=gold||OCEAN.colors.gold;c.font=`900 28px ${OCEAN.fonts.numbers}`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(g.score.total),center,r.y+35,r.width*.40);
 canvasText(c,'生命',right,r.y+15,72,10,OCEAN.colors.muted,'right');const hearts='♥'.repeat(Math.max(0,g.lives)),lost='♡'.repeat(Math.max(0,g.maxLives-g.lives));c.font=`500 15px ${OCEAN.fonts.body}`;const lostWidth=c.measureText(lost).width;if(lost)canvasText(c,lost,right,r.y+34,90,15,'rgba(255,255,255,.22)','right');if(hearts)canvasText(c,hearts,right-lostWidth,r.y+34,Math.min(90,r.width*.28),15,OCEAN.colors.heart,'right');
 c.fillStyle='rgba(255,255,255,.10)';c.fillRect(left,r.y+50,r.width-24,1);canvasText(c,`球 × ${g.physics.balls.length}`,left,r.y+65,66,11,OCEAN.colors.secondary);canvasText(c,field?`已下沉${field.descents}行`:`剩余 ${b.remaining}`,left+68,r.y+65,76,11,OCEAN.colors.secondary);
 const x=left+150,w=Math.max(24,right-x);canvasText(c,`${progress}%`,right,r.y+59,w,9,OCEAN.colors.positive,'right');panel(c,{x,y:r.y+67,width:w,height:6},'rgba(10,4,40,.5)',undefined,3);if(progress>0)panel(c,{x,y:r.y+67,width:Math.max(1,w*progress/100),height:6},OCEAN.colors.positive,undefined,3);c.restore();
}
