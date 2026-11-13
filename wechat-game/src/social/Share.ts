import {GAME_NAME} from '../../../shared/Brand';
import {OCEAN} from '../../../shared/VisualTheme';
import {context} from '../CanvasAdapter';
import type {Wx} from '../Platform';
import type {SocialMode} from './Protocol';
export interface ShareScore {mode:SocialMode;score:number}
export const shareTitle=(s:ShareScore)=>`我在《${GAME_NAME}》${s.mode==='campaign'?'闯关':'无尽'}模式获得 ${s.score} 分，你能超过我吗？`;
export async function scoreShare(wx:Wx,score:ShareScore){
 const canvas=wx.createCanvas();canvas.width=500;canvas.height=400;const c=context(canvas);c.fillStyle=OCEAN.colors.background;c.fillRect(0,0,500,400);c.strokeStyle=OCEAN.colors.accent;c.lineWidth=2;c.beginPath();c.arc(250,193,145,0,Math.PI*2);c.stroke();c.textAlign='center';c.textBaseline='middle';c.font=`800 32px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.gold;c.fillText(GAME_NAME,250,58,460);c.font=`600 21px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.text;c.fillText(score.mode==='campaign'?'十二关闯关挑战':'无尽挑战',250,115,460);c.font=`900 58px ${OCEAN.fonts.numbers}`;c.fillStyle=OCEAN.colors.accent;c.fillText(score.score.toLocaleString('en-US'),250,202,460);c.font=`600 20px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.pink;c.fillText('邀请你来挑战',250,280,460);c.font=`500 12px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.muted;c.fillText('本局展示成绩，以服务器校验结果为准',250,354,460);
 const imageUrl=await new Promise<string|undefined>(resolve=>{let settled=false;const timer=setTimeout(()=>finish(),3000);const finish=(path?:string)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(path);};try{if(!canvas.toTempFilePath){finish();return;}canvas.toTempFilePath({success:r=>finish(r.tempFilePath),fail:()=>finish()});}catch{finish();}});
 return {title:shareTitle(score),imageUrl,query:'source=score&mode='+score.mode};
}
