import type {AdUnits} from './Platform';
/**
 * WeChat 流量主 ad unit IDs (公开的广告位标识，不是密钥). Leave a slot empty until the account has 流量主 enabled:
 * an empty ID hides every button that would use it and the game plays exactly as before.
 * 填写方法见 docs/WECHAT_ADS.md：小程序后台 → 流量主 → 广告管理 → 新建广告位，复制 adunit-xxxxxxxx。
 */
export const AD_UNITS:AdUnits={
 rewarded:'',
 interstitial:'',
 banner:'',
};
