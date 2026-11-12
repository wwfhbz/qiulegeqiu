/** Frozen baseline regression harness: old assertions keep testing the exact original ten rules. */
import {Game} from '../../src/Game';
import {LevelManager} from '../../src/LevelManager';
import {LEGACY_LEVELS} from '../../src/LegacyLevels';
import type {GameHost} from '../../src/platform/Contracts';
import type {AudioSystem} from '../../src/Audio';
export class LegacyGame extends Game {
 constructor(host?:GameHost,onChange?:(game:Game)=>void,levels=new LevelManager(LEGACY_LEVELS),audio?:AudioSystem){super(host,onChange,levels,audio);this.physics.tripleRuleVersion=1;}
}
