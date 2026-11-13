import {Blocks} from '../Blocks';
import {C} from '../GameConfig';
import {seededRandom} from '../Random';
import {ENDLESS,ENDLESS_CURRENT,descentInterval,type EndlessVariant} from './EndlessRules';

/**
 * Descending brick wall for endless mode, exposed through the ordinary Blocks grid so physics,
 * collisions and the renderer need no special cases.
 *
 * Bricks live in "world rows": row w is spawned on top after the (w - base)th descent and never moves
 * relative to its neighbours. Visible grid row r currently shows world row `base + descents - r`.
 * A brick's journal id is `worldRow * cols + col`, stable for its whole life.
 *
 * Bricks only exist inside the circle and above the brick floor: when a row slides into a narrower part
 * of the bowl its outer cells simply vanish (no points), and the wall stops descending while any brick
 * sits on the floor row. Everything here is deterministic from the seed and the tick count, so the
 * server verifier replays the same field.
 */
export class EndlessField extends Blocks {
  readonly endless=true;
  descents=0;sinceDescent=0;destroyedTotal=0;
  /** Consecutive running ticks with a brick on the floor row (pressure-death timer). */
  pressure=0;
  private seed=1;
  private readonly base=ENDLESS.initialRows-1;
  private patterns=new Map<number,Uint8Array>();
  private maskStart=new Int16Array(0);private maskEnd=new Int16Array(0);
  private rowCount=new Int32Array(0);
  floorRow=0;
  variant:EndlessVariant=ENDLESS_CURRENT;

  /** Configure the endless grid and spawn the initial wall for this seed. */
  start(seed:number,variant:EndlessVariant=ENDLESS_CURRENT){
    this.variant=variant;this.seed=seed>>>0;this.step=ENDLESS.gridStep;this.size=ENDLESS.gridSize;
    this.cols=this.rows=Math.ceil(C.arena.radius*2/this.step);
    if(this.cols*this.rows>this.alive.length)throw Error('无尽网格超过固定存储容量');
    // 'bowl': bricks may sink right to the bottom of the circle; 'legacy' kept the campaign's 80% floor.
    const {x:cx,y:cy,radius:r}=C.arena,floorY=variant.floor==='bowl'?cy+r:variant.floor==='raised'?cy+r-ENDLESS.floorGap:this.top+2*r*(1-C.grid.emptyFraction);
    this.maskStart=new Int16Array(this.rows).fill(-1);this.maskEnd=new Int16Array(this.rows).fill(-2);this.rowCount=new Int32Array(this.rows);this.floorRow=0;
    for(let row=0;row<this.rows;row++){
      const y=this.top+row*this.step;if(y+this.size>floorY)continue;
      for(let col=0;col<this.cols;col++){
        const x=this.left+col*this.step;let inside=true;
        for(const dx of [0,this.size])for(const dy of [0,this.size])if((x+dx-cx)**2+(y+dy-cy)**2>r*r)inside=false;
        if(!inside)continue;
        if(this.maskStart[row]<0)this.maskStart[row]=col;this.maskEnd[row]=col;this.floorRow=row;
      }
    }
    this.patterns.clear();this.descents=0;this.sinceDescent=0;this.destroyedTotal=0;this.pressure=0;
    for(let w=0;w<=this.base;w++)this.patterns.set(w,this.spawnRow(w));
    this.destroyed.length=0;this.generation++;this.rebuild();
  }
  private spawnRow(world:number){
    const random=seededRandom((this.seed^Math.imul(world+1,0x9e3779b1))>>>0),row=new Uint8Array(this.cols);
    for(let col=0;col<this.cols;col++)row[col]=random()<ENDLESS.rowFill?1:0;
    return row;
  }
  worldRow(visibleRow:number){return this.base+this.descents-visibleRow;}
  /** Stable journal id for a currently visible cell. */
  worldId(index:number){return this.worldRow(Math.floor(index/this.cols))*this.cols+index%this.cols;}
  /** Visible index of a live brick by journal id, or -1 if it is not currently hittable. */
  indexOfWorld(id:number){
    if(!Number.isSafeInteger(id)||id<0)return -1;
    const world=Math.floor(id/this.cols),col=id%this.cols,row=this.base+this.descents-world;
    if(row<0||row>this.floorRow)return -1;
    const index=row*this.cols+col;return this.alive[index]?index:-1;
  }
  /** True while any brick sits on the floor row: the wall cannot move further down. */
  get blocked(){return this.rowCount[this.floorRow]>0;}
  /** Advance one simulation tick; returns true when the wall descended this tick. */
  tick(){
    // The pressure timer reads the state left by the previous tick's contacts, like the descent check.
    if(this.blocked)this.pressure++;else this.pressure=0;
    this.sinceDescent++;
    if(this.sinceDescent<descentInterval(this.descents,this.variant)||this.blocked)return false;
    this.descend();this.sinceDescent=0;return true;
  }
  /** Seconds-equivalent progress toward the next descent, for the HUD (0–1). */
  get descentProgress(){return Math.min(1,this.sinceDescent/descentInterval(this.descents,this.variant));}
  /**
   * Relief after a pressure death: remove every brick in the `rows` rows nearest the floor. These are not
   * player hits — no score, no drops, no destroyed count — and the pressure timer restarts.
   */
  relief(rows:number){
    let cleared=0;
    for(let row=Math.max(0,this.floorRow-rows+1);row<=this.floorRow;row++){const pattern=this.patterns.get(this.worldRow(row));if(!pattern)continue;
      for(let col=0;col<this.cols;col++){const i=row*this.cols+col;if(this.alive[i]){pattern[col]=0;cleared++;}}}
    this.pressure=0;this.destroyed.length=0;this.generation++;this.rebuild();return cleared;
  }
  private descend(){
    this.descents++;const top=this.base+this.descents;this.patterns.set(top,this.spawnRow(top));
    // Rows that slid past the floor can never be hit again.
    for(const world of this.patterns.keys())if(world<top-this.floorRow)this.patterns.delete(world);
    this.destroyed.length=0;this.generation++;this.rebuild();
  }
  private rebuild(){
    this.alive.fill(0);this.rowCount.fill(0);let total=0;
    for(let row=0;row<=this.floorRow;row++){
      const pattern=this.patterns.get(this.worldRow(row));if(!pattern||this.maskStart[row]<0)continue;
      for(let col=this.maskStart[row];col<=this.maskEnd[row];col++)if(pattern[col]){this.alive[row*this.cols+col]=1;this.rowCount[row]++;total++;}
    }
    this.total=this.remaining=total;this.revision++;
  }
  override hit(index:number){
    if(!this.alive[index])return false;
    const row=Math.floor(index/this.cols);this.patterns.get(this.worldRow(row))![index%this.cols]=0;this.rowCount[row]--;this.destroyedTotal++;
    return super.hit(index);
  }
}
