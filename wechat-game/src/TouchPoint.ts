import type {Touch} from './Platform';
/** Input and Canvas hit rectangles both use screen CSS pixels. DPR only scales the backing bitmap. */
export function touchPoint(t:Touch){
 for(const [x,y] of [[t.clientX,t.clientY],[t.x,t.y],[t.pageX,t.pageY]])if(typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y))return {x,y};
 return undefined;
}
