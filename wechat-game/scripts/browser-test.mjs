// Cross-platform launcher: no shell-only environment assignment is needed on Windows.
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url));
process.chdir(repo);process.env.WECHAT_GAME_DIR='wechat-game';process.env.WECHAT_BROWSER_OUT='work/wechat-game';
await import('../../tests/browser-minigame.mjs');
