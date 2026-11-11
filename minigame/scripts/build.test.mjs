import {buildTests} from '../../wechat-game/scripts/build-test-suite.mjs';
import {fileURLToPath} from 'node:url';
buildTests(fileURLToPath(new URL('../',import.meta.url)));
