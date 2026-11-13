import {BALL_SVG,badgeSvg} from './Artwork';
import {referenceSeconds} from './ReferenceLayout';
import {rankingCard,type RankingScore} from './Presentation';
function text(tag:string,value:string,className=''){const el=document.createElement(tag);el.textContent=value;el.className=className;return el;}
export function avatar(){const el=document.createElement('span');el.className='ball-avatar';el.setAttribute('role','img');el.setAttribute('aria-label','统一球球默认头像');el.innerHTML=BALL_SVG;return el;}
export function scoreStats(row:RankingScore){const card=rankingCard(row),stats=document.createElement('div');stats.className='stellar-stats';for(const [label,value] of [['最高关卡',card.level],['消除砖块',card.bricks],['最佳时间',card.time]]){const item=document.createElement('span');item.append(text('small',label),text('strong',value));stats.append(item);}return stats;}
export function rankingElement(row:RankingScore,endless=false){const card=rankingCard(row,endless),el=document.createElement('article');el.className=`stellar-card${card.honor?' honor-card':''}${card.champion?' champion-card':''}`;el.dataset.rankingCard=String(card.rank);el.setAttribute('role','listitem');
 const rank=document.createElement('div');rank.className='stellar-rank';rank.innerHTML=badgeSvg(card.rank);rank.setAttribute('aria-label',card.rankLabel);
 const identity=document.createElement('div');identity.className='stellar-identity';identity.tabIndex=0;identity.setAttribute('role','button');identity.setAttribute('aria-expanded','false');identity.setAttribute('aria-label',card.name+'，展开或收起完整名称');const toggle=()=>identity.setAttribute('aria-expanded',String(identity.classList.toggle('expanded-name')));identity.onclick=toggle;identity.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
 const name=text('strong',card.name,'stellar-name');name.title=card.name;identity.append(avatar(),name);
 const score=text('strong',card.score,'stellar-score');score.setAttribute('aria-label','最高总分 '+card.score);score.style.setProperty('--score-chars',String(card.score.length));
 const level=text('span',card.level,'reference-level');level.setAttribute('aria-label',(endless?'最高阶段 ':'最高关卡 ')+card.level);
 const bricks=text('span',card.bricks,'reference-bricks');bricks.setAttribute('aria-label','消除砖块 '+card.bricks);
 const time=text('span',referenceSeconds(row.duration_ms),'reference-time');time.setAttribute('aria-label','最佳时间 '+time.textContent);time.title='精确时间 '+card.time;
 if(card.honor){const spark=text("span","✦","honor-spark");spark.setAttribute("aria-hidden","true");el.append(spark);}
 el.append(rank,identity,score,level,bricks,time);return el;
}
export function boardStatus(container:HTMLElement,message:string,state:'loading'|'empty'|'error',detail?:string){const box=document.createElement('div');box.className=`stellar-state state-${state}`;box.setAttribute('role',state==='error'?'alert':'status');const icon=text('span',state==='loading'?'◌':state==='error'?'☄':'✧','state-icon');icon.setAttribute('aria-hidden','true');box.append(icon,text('strong',message),text('small',detail??(state==='loading'?'正在读取全球成绩…':state==='error'?'游戏不受影响，点击刷新重试':'完成挑战，留下你的真实成绩')));container.replaceChildren(box);}
