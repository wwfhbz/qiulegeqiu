/** Frozen baseline regression harness: old assertions keep testing the exact original ten rules. */
import {Game} from '../../src/Game';
import {LevelManager} from '../../src/LevelManager';
import {LEGACY_LEVELS} from '../../src/LegacyLevels';
import type {AudioSystem} from '../../src/Audio';
export class LegacyGame extends Game {
 constructor(canvas?:HTMLCanvasElement,onChange?:(game:Game)=>void,levels=new LevelManager(LEGACY_LEVELS),audio?:AudioSystem){super(canvas,onChange,levels,audio);}
}
