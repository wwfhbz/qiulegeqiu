import type {Wx,AdUnits,RewardedVideoAd,InterstitialAd,BannerAd} from './Platform';
export type RewardResult='rewarded'|'closed'|'unavailable';
/**
 * Thin wrapper over the WeChat ad components. Rewarded videos are the main income and are only shown when the
 * player asks (revive, +3 balls, unlock a skin); interstitials and the banner follow the quiet policy in App.
 * Every call degrades to "unavailable" instead of throwing, so missing IDs, old base libraries or no fill never
 * block the game.
 */
export class WechatAds {
 private rewarded?:RewardedVideoAd;private interstitial?:InterstitialAd;private banner?:BannerAd;
 private pending?:(result:RewardResult)=>void;private rewardedFailed=0;
 bannerHeight=0;private bannerVisible=false;
 constructor(private wx:Wx,private units:AdUnits){}
 /** A rewarded video can be offered (an ID is configured and the API exists). Fill is only known when shown. */
 get rewardedAvailable(){return !!this.units.rewarded&&!!this.wx.createRewardedVideoAd&&Date.now()-this.rewardedFailed>60000;}
 private rewardedAd(){
  if(this.rewarded||!this.rewardedAvailable)return this.rewarded;
  try{const ad=this.wx.createRewardedVideoAd!({adUnitId:this.units.rewarded});
   ad.onClose(r=>{const done=this.pending;this.pending=undefined;done?.(r?.isEnded===false?'closed':'rewarded');});
   ad.onError(()=>{this.rewardedFailed=Date.now();const done=this.pending;this.pending=undefined;done?.('unavailable');});
   this.rewarded=ad;}catch{this.rewardedFailed=Date.now();}
  return this.rewarded;
 }
 /** Show a rewarded video; resolves 'rewarded' only when it was watched to the end. */
 showRewarded():Promise<RewardResult>{
  const ad=this.rewardedAd();if(!ad||this.pending)return Promise.resolve('unavailable');
  return new Promise<RewardResult>(resolve=>{
   this.pending=resolve;
   const fail=()=>{if(this.pending===resolve){this.pending=undefined;this.rewardedFailed=Date.now();resolve('unavailable');}};
   ad.show().catch(()=>ad.load().then(()=>ad.show()).catch(fail));
  });
 }
 /** Interstitial at a natural pause (the caller applies frequency limits). */
 showInterstitial(){
  if(!this.units.interstitial||!this.wx.createInterstitialAd)return;
  try{this.interstitial??=this.wx.createInterstitialAd({adUnitId:this.units.interstitial});this.interstitial.onError?.(()=>{});void this.interstitial.show().catch(()=>{});}catch{/* Optional income only. */}
 }
 /** Banner pinned to the bottom of the result page; never during play. */
 showBanner(screenWidth:number,screenHeight:number,bottom:number){
  if(!this.units.banner||!this.wx.createBannerAd||this.bannerVisible)return;
  try{
   if(!this.banner){const width=Math.min(screenWidth,360);this.banner=this.wx.createBannerAd({adUnitId:this.units.banner,adIntervals:60,style:{left:(screenWidth-width)/2,top:screenHeight,width}});
    this.banner.onResize(r=>{this.bannerHeight=r.height;if(this.banner){this.banner.style.top=Math.min(screenHeight,bottom)-r.height;this.banner.style.left=(screenWidth-r.width)/2;}});
    this.banner.onError(()=>{this.bannerHeight=0;});}
   this.bannerVisible=true;void this.banner.show().catch(()=>{this.bannerVisible=false;this.bannerHeight=0;});
  }catch{/* Optional income only. */}
 }
 hideBanner(){if(!this.bannerVisible)return;this.bannerVisible=false;try{this.banner?.hide();}catch{/* Ignore. */}}
 dispose(){this.hideBanner();try{this.banner?.destroy();}catch{/* Ignore. */}this.banner=undefined;}
}
