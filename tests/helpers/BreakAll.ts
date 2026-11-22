import type {Game} from '../../src/Game';
/** Test helper: break every breakable brick (hard bricks take several passes) and beat the boss, like a finished level. */
export function breakAll(g:Game){
 const p=g.physics,b=p.blocks;
 for(let pass=0;pass<8&&(b.remaining>0||p.boss?.alive);pass++){
  for(let i=0;i<b.alive.length;i++)if(b.alive[i]&&!b.isSteel(i))b.hit(i);
  while(p.boss?.alive)(p as unknown as {bossHit():void}).bossHit();
 }
}
