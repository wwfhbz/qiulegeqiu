// Deliberately labelled local test data; never seed or submit these to production.
export const rankingRows=Array.from({length:100},(_,i)=>({rank:i+1,display_name:(i%2?'太和':'中国')+'·本地测试球球'+String(i+1).padStart(2,'0'),score:i===2?995000:1000000-i*5000,reached_level:Math.max(1,12-Math.floor(i/10)),bricks_destroyed:42000-i*200,duration_ms:632700+i*1234}));
export const myRanking={...rankingRows[0],rank:130,display_name:'太和·本地个人测试',score:314115,reached_level:5,bricks_destroyed:10258,duration_ms:632700};
export function identity(rules,best=myRanking){return {csrfToken:'local-ui-fixture',board:'global',rankingRulesVersion:rules,player:{id:'local-ui-test',nickname:'本地个人测试',region_code:'CN:341222',prefix:'太和',status:'active',display_name:'太和·本地个人测试'},best};}
