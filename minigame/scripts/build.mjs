// Legacy build command, same source and rules; only the config/output directory differs.
import {cli} from '../../wechat-game/scripts/build.mjs';
import {fileURLToPath} from 'node:url';
await cli(fileURLToPath(new URL('../',import.meta.url)));
