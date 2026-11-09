import './style.css';
import { mountGame } from './GameUI';
const game = mountGame(document.querySelector<HTMLElement>('#app')!);
// Automation/debug access does not change the default player interface.
Object.assign(window, { ballCore: game });
