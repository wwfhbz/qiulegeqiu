import {it,expect,vi} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {nicknameQuotaText,beijingTime,type NicknameQuota} from '../shared/NicknamePolicy';
import {ApiResponseError} from '../shared/ApiErrors';
import type {Me} from '../src/online/ApiClient';
const q=(allowed=true):NicknameQuota=>({allowed,weeklyRemaining:allowed?2:0,yearlyRemaining:allowed?6:4,nextAllowedAt:allowed?null:Date.parse('2026-06-08T00:00:00+08:00'),weekResetsAt:Date.parse('2026-06-08T00:00:00+08:00'),yearResetsAt:Date.parse('2027-01-01T00:00:00+08:00'),timeZone:'Asia/Shanghai'});
it('额度文案使用服务器数据和北京时间，耗尽提示下一时刻',()=>{expect(nicknameQuotaText(q())).toContain('本周剩余：2次');expect(nicknameQuotaText(q(false))).toContain('2026年6月8日 00:00（北京时间）');expect(beijingTime(Date.parse('2026-12-31T16:00:00Z'))).toBe('2027年1月1日 00:00（北京时间）');});
it.each([[320,568],[390,844]])('微信%s×%s提交页能修改昵称、即时刷新；上限或取消不影响提交且不改变游戏日志',async(w,h)=>{
 const f=wxFixture(w,h),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),x=app as unknown as {online:boolean;chooseMode(m:string):void;scoreEntry():Promise<void>;changeNickname():Promise<void>;submit():Promise<void>;sync:{submit:()=>Promise<{verificationStatus:string}>};board:()=>Promise<void>};x.chooseMode('campaign');x.online=true;let name='旧昵称',quota=q(),denied=false,cancel=false;const toasts:string[]=[];f.wx.showToast=o=>{toasts.push(o.title);};f.wx.showModal=o=>o.success?.({confirm:!cancel,content:'新昵称'});
 vi.spyOn(app.api,'me').mockImplementation(async()=>({csrfToken:'fixture',player:{id:'stable',nickname:name,region_code:'ISO:CN',prefix:'中国',display_name:'中国·'+name,status:'active'},best:null,nicknameChange:quota,rankingAvailable:true}) as Me&{rankingAvailable:boolean});
 const request=vi.spyOn(app.api,'request').mockImplementation(async(path:string)=>{if(path==='/players/nickname'){if(denied)throw new ApiResponseError('昵称修改次数已达上限',429,'NICKNAME_CHANGE_LIMIT');name='新昵称';quota={...q(),weeklyRemaining:1,yearlyRemaining:5};}return {} as never;});const submit=vi.fn(async()=>({verificationStatus:'verified'}));x.sync.submit=submit;x.board=vi.fn(async()=>{});
 try{const before=JSON.stringify(app.game.journal.events);await x.scoreEntry();expect(app.panel.lines.join('')).toContain('当前昵称：旧昵称');expect(app.panel.actions.some(a=>a.label==='修改昵称')).toBe(true);await x.changeNickname();expect(app.panel.lines.join('')).toContain('当前昵称：新昵称');expect(app.panel.lines.join('')).toContain('本周剩余：1次');app.frame(100);expect(app.panel.hits.every(hit=>hit.rect.y+hit.rect.height<h-34)).toBe(true);
  quota=q(false);denied=true;await x.changeNickname();expect(toasts.at(-1)).toContain('仍可提交成绩');expect(app.panel.actions.some(a=>a.label==='提交成绩')).toBe(true);cancel=true;const calls=request.mock.calls.length;await x.changeNickname();expect(request.mock.calls).toHaveLength(calls);await x.submit();expect(submit).toHaveBeenCalledTimes(1);expect(JSON.stringify(app.game.journal.events)).toBe(before);expect(request.mock.calls.some(([path])=>path==='/players')).toBe(false);
 }finally{app.dispose();}
});
it('闯关榜按永久scope识别，不因未来规则版本变动失效，也不误认旧版本隔离API',async()=>{
 const {assertGlobalBoard}=await import('../shared/Challenge');expect(()=>assertGlobalBoard({board:'global',rankingRulesVersion:'future',rankingScope:'all-campaign-versions'})).not.toThrow();expect(()=>assertGlobalBoard({board:'global',rankingRulesVersion:'1.8.0-arcade-5l-12lv-powerpts-v6'})).toThrow('后端需要更新');
});
it('微信单机成绩入口不请求资料或修改昵称，不绕过原有单机成绩限制',async()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),x=app as unknown as {online:boolean;scoreEntry():Promise<void>};x.online=false;const me=vi.spyOn(app.api,'me');try{await x.scoreEntry();expect(me).not.toHaveBeenCalled();expect(app.game.journal.events).toHaveLength(0);}finally{app.dispose();}
});
