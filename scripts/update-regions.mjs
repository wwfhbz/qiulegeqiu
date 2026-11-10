/** Rebuild a pinned, auditable MCA-derived snapshot. No invented county names. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import countries from 'i18n-iso-countries';
const commit='e2c2b2e1fb4ce1fb76e879aa0b80e229adaf950c';
const url=`https://raw.githubusercontent.com/yescallop/areacodes/${commit}/data/2025.txt`;
if(process.argv.includes('--download')) execFileSync('curl',['-fLsS','--max-time','60',url,'-o','server/data/cn-2025.txt']);
const raw=readFileSync('server/data/cn-2025.txt','utf8');
const cn=raw.trim().split(/\r?\n/).map(line=>{const match=/^(\d{6}) (.+)$/.exec(line);if(!match)throw Error('行政代码格式错误');return {code:match[1],name:match[2]};});
const names=JSON.parse(readFileSync('node_modules/i18n-iso-countries/langs/zh.json','utf8')).countries;
const common=['CN','US','JP','KR','GB','FR','DE','CA','AU','RU','IN','BR','IT','ES','MX','ID','TR','SA','ZA','AR'];
const aliases={TW:'710000',HK:'810000',MO:'820000'};
const prefix=name=> /自治区|自治州|自治县|自治旗/.test(name)?name:name.replace(/特别行政区$|省$|市$|县$|区$|旗$|盟$/,'');
const rows=Object.entries(countries.getAlpha2Codes()).filter(([iso])=>!aliases[iso]).map(([iso])=>({code:`ISO:${iso}`,parent:null,level:'country',name:iso==='CN'?'中国':Array.isArray(names[iso])?names[iso][0]:names[iso],prefix:iso==='CN'?'中国':Array.isArray(names[iso])?names[iso][0]:names[iso],country:iso,priority:common.includes(iso)?common.indexOf(iso):100}));
const codes=new Set(cn.map(r=>r.code));
for(const r of cn){
 const level=r.code.endsWith('0000')?'province':r.code.endsWith('00')?'prefecture':'county';
 const parent=level==='province'?'ISO:CN':level==='prefecture'?`CN:${r.code.slice(0,2)}0000`:`CN:${codes.has(r.code.slice(0,4)+'00')?r.code.slice(0,4)+'00':r.code.slice(0,2)+'0000'}`;
 rows.push({code:`CN:${r.code}`,parent,level,name:r.name,prefix:prefix(r.name),country:'CN',priority:100});
}
const byCode=new Map(rows.map(r=>[r.code,r]));
for(const row of rows)if(row.parent&&!byCode.has(row.parent))throw Error('缺少上级 '+row.code);
if(cn.length!==3212||cn.filter(r=>r.code.endsWith('0000')).length!==34)throw Error('数据数量变化，必须人工核对版本和变更后再更新基线');
const levels=Object.fromEntries(['province','prefecture','county'].map(level=>[level,rows.filter(r=>r.level===level).length]));
const metadata={version:'MCA-derived-2025-12-31+ISO3166-1-7.14.0',upstreamCommit:commit,upstream:url,sha256:createHash('sha256').update(raw).digest('hex'),officialSources:['https://dmfw.mca.gov.cn/XzqhVersionPublish.html','https://www.mca.gov.cn/mzsj/xzqh/2025/202401xzqh.html','https://www.iso.org/obp/ui/#search/code/'],mirrorLicense:'CC0-1.0',countrySource:'i18n-iso-countries@7.14.0 (MIT), ISO 3166-1 alpha-2',counts:{countries:249,...levels,total:rows.length},aliases,limitations:['使用可复现的2025年末民政部来源社区快照，未经直连官方逐条复核，不宣称2026最新。','台湾、香港、澳门在此民政部口径仅提供省级代码，不编造县级/非同口径划分。','直辖市及省直辖县级单位直接挂省级，不虚构市辖区等地级实体。','地区标签由玩家自选，不验证真实所在地。']};
writeFileSync('server/data/regions.json',JSON.stringify({metadata,common,aliases,regions:rows})+'\n');
writeFileSync('server/data/regions-manifest.json',JSON.stringify(metadata,null,2)+'\n');
console.log(metadata.counts);
