import {context} from '../src/CanvasAdapter';
import {panel} from '../../shared/CanvasUI';
import {ball} from '../../src/online/ranking/Artwork';
import {OCEAN} from '../../shared/VisualTheme';
import {cloudKey,cloudScore,friendRows,rulesFor,type SocialMode,type KV,type FriendRecord,type CloudScore} from '../src/social/Protocol';
interface Image {src:string;onload?:()=>void;onerror?:()=>void}
export interface OpenWx {
 onMessage(fn:(message:Record<string,unknown>)=>void):void;
 getSharedCanvas():{width:number;height:number;getContext(kind:'2d'):CanvasRenderingContext2D};
 getFriendCloudStorage(options:{keyList:string[];success:(r:{data:FriendRecord[]})=>void;fail:()=>void}):void;
 getUserCloudStorage(options:{keyList:string[];success:(r:{KVDataList:KV[]})=>void;fail:()=>void}):void;
 setUserCloudStorage(options:{KVDataList:KV[];success:()=>void;fail:()=>void}):void;
 createImage?():Image;
}
/** No application HTTP requests, main-domain callback or friend identity export exists here. */
export function createOpenDataRuntime(wx:OpenWx){
 const canvas=wx.getSharedCanvas(),c=context(canvas);let mode:SocialMode='campaign',width=320,height=400,ratio=1,scroll=0,visible=false,revision=0,state='loading',rows:ReturnType<typeof friendRows>=[],own:CloudScore|undefined;
 let syncFailed=false;
 const avatars=new Map<string,Image|null>(),pending=new Map<SocialMode,CloudScore>(),working=new Set<SocialMode>();
 const text=(value:string,x:number,y:number,w:number,size=13,color:string=OCEAN.colors.text)=>{c.font=`600 ${size}px ${OCEAN.fonts.body}`;c.fillStyle=color;c.textAlign='left';c.textBaseline='middle';let shown=[...value].slice(0,80).join('');while(shown.length>1&&c.measureText(shown).width>w)shown=[...shown].slice(0,-2).join('')+'…';c.fillText(shown,x,y,Math.max(1,w));};
 function draw(){if(!visible)return;c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,width,height);c.fillStyle=OCEAN.colors.background;c.fillRect(0,0,width,height);
  if(state!=='ready'||!rows.length){text(state==='loading'?'正在读取同玩好友…':state==='error'?'好友榜暂不可用，请刷新或检查授权':'还没有同玩好友的有效记录',16,36,width-32,14);text('仅展示微信允许返回的同玩好友',16,65,width-32,11,OCEAN.colors.muted);return;}
  const start=Math.max(0,Math.floor(scroll/64)),end=Math.min(rows.length,Math.ceil((scroll+height)/64));
  for(let i=start;i<end;i++){const {friend,record}=rows[i],y=i*64-scroll,mine=!!own&&own.marker===record.marker;
   panel(c,{x:4,y:y+3,width:width-8,height:58},mine?'#263B55':i<5?'#463723':'#101D31',mine?OCEAN.colors.accent:i<5?OCEAN.colors.gold:OCEAN.colors.line,10);text(String(i+1),12,y+32,30,16,i<5?OCEAN.colors.gold:OCEAN.colors.secondary);
   const avatar=avatars.get(friend.avatarUrl);if(avatar){try{c.drawImage(avatar as unknown as CanvasImageSource,45,y+14,36,36);}catch{/* Invalid remote image: retain default below on later reload. */}}else{ball(c,63,y+32,18);
    if(friend.avatarUrl?.startsWith('https://')&&!avatars.has(friend.avatarUrl)&&wx.createImage){if(avatars.size>=64)avatars.delete(avatars.keys().next().value!);const image=wx.createImage();avatars.set(friend.avatarUrl,null);image.onload=()=>{if(avatars.has(friend.avatarUrl)){avatars.set(friend.avatarUrl,image);draw();}};image.onerror=()=>{};image.src=friend.avatarUrl;}}
   text((friend.nickname||'微信玩家')+(mine?'（我）':''),90,y+21,width-108,13);text(record.score.toLocaleString('en-US')+' 分',90,y+43,width-108,15,i<5?OCEAN.colors.gold:OCEAN.colors.text);
  }
  if(syncFailed)text('云同步暂失败，点击刷新安全重试',12,height-12,width-24,10,OCEAN.colors.warning);
 }
 function load(){const rev=++revision;state='loading';rows=[];own=undefined;scroll=0;draw();
  wx.getUserCloudStorage({keyList:[cloudKey(mode)],success:r=>{if(rev===revision){own=cloudScore(r.KVDataList.find(k=>k.key===cloudKey(mode))?.value,mode);draw();}},fail:()=>{}});
  wx.getFriendCloudStorage({keyList:[cloudKey(mode)],success:r=>{if(rev!==revision)return;if(!Array.isArray(r.data)){state='error';draw();return;}rows=friendRows(r.data,mode);state='ready';draw();},fail:()=>{if(rev===revision){state='error';draw();}}});
 }
 function sync(m:SocialMode){if(working.has(m)||!pending.has(m))return;working.add(m);const candidate=pending.get(m)!;
  const done=(success:boolean)=>{syncFailed=!success;working.delete(m);if(!success)draw();if(success&&pending.get(m)===candidate)pending.delete(m);if(success&&visible&&mode===m)load();if(success&&pending.has(m))sync(m);};
  wx.getUserCloudStorage({keyList:[cloudKey(m)],success:r=>{const old=cloudScore(r.KVDataList.find(k=>k.key===cloudKey(m))?.value,m);if(old&&old.score>=candidate.score){done(true);return;}
   wx.setUserCloudStorage({KVDataList:[{key:cloudKey(m),value:JSON.stringify(candidate)}],success:()=>done(true),fail:()=>done(false)});},fail:()=>done(false)});
 }
 wx.onMessage(msg=>{const m=msg.mode==='endless'?'endless':'campaign';
  if((msg.type==='sync-best'||msg.type==='show')&&msg.mode!=='campaign'&&msg.mode!=='endless')return;
  if(msg.type==='sync-best'){if(msg.rulesVersion!==rulesFor(m)||!Number.isSafeInteger(msg.score)||(msg.score as number)<0)return;const next:CloudScore={schema:1,score:msg.score as number,rulesVersion:rulesFor(m),marker:Array.from({length:24},()=>Math.floor(Math.random()*36).toString(36)).join('')};if(!pending.has(m)||pending.get(m)!.score<next.score)pending.set(m,next);sync(m);return;}
  if(msg.type==='hide'){visible=false;revision++;return;}
  if(msg.type==='show'){if(!Number.isFinite(msg.width)||!Number.isFinite(msg.height))return;mode=m;width=Math.max(1,Math.min(2048,Number(msg.width)));height=Math.max(1,Math.min(2048,Number(msg.height)));ratio=Math.max(1,Math.min(2,Number(msg.ratio)||1));canvas.width=Math.ceil(width*ratio);canvas.height=Math.ceil(height*ratio);visible=true;load();for(const key of pending.keys())sync(key);}
  if(msg.type==='scroll'&&visible){scroll=Math.max(0,Math.min(Math.max(0,rows.length*64-height),scroll-Number(msg.dy||0)));draw();}
  if(msg.type==='refresh'&&visible){load();for(const key of pending.keys())sync(key);}
 });
}
