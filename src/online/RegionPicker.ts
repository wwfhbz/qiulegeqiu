import { ApiClient } from './ApiClient';
export interface Region {code:string;level:string;name:string;prefix:string;path:string;hasChildren:boolean}
/** Server-paged hierarchy, with direct-administered counties skipping a fictional prefecture. */
export class RegionPicker {
  code='ISO:CN';prefix='中国';private revision=0;
  constructor(private root:HTMLElement,private api:ApiClient,private changed:()=>void){
    root.innerHTML='<p class="region-note">地区是自选展示标签，不代表真实所在地。</p><div class="region-columns"></div><p class="region-selection"></p>';
    void this.load(0,undefined).catch(()=>{});this.display();
  }
  private display(){this.root.querySelector('.region-selection')!.textContent=`已选：${this.prefix}（可停在任意一级）`;}
  private async load(depth:number,parent:string|undefined,q='',offset=0){
    if(depth>3)return;const version=++this.revision;
    const columns=this.root.querySelector('.region-columns')!;
    while(columns.children.length>depth)columns.lastElementChild!.remove();
    const col=document.createElement('div');col.className='region-column';const label=document.createElement('label');label.textContent=['国家/地区','省级','地级/直属县级','县级'][depth];
    const search=document.createElement('input');search.type='search';search.placeholder='搜索名称或代码';search.setAttribute('aria-label',label.textContent+'搜索');search.maxLength=40;
    const select=document.createElement('select');select.size=4;select.setAttribute('aria-label',label.textContent);const tip=document.createElement('small');tip.textContent='正在加载…';label.append(search);col.append(label,select,tip);columns.append(col);
    let timer=0;search.oninput=()=>{clearTimeout(timer);timer=window.setTimeout(()=>void this.load(depth,parent,search.value).catch(()=>{}),300);};
    // Replacing the column for a search should keep the query and focus.
    search.value=q;if(q){search.focus();search.setSelectionRange?.(q.length,q.length);}
    const params=new URLSearchParams({q,offset:String(offset)});if(parent)params.set('parent',parent);
    try{
      const result=await this.api.request<{items:Region[];nextOffset:number|null}>(`/regions?${params}`);if(version!==this.revision)return;
      select.innerHTML='';for(const r of result.items){const option=document.createElement('option');option.value=r.code;option.textContent=r.name;option.title=r.path;select.append(option);}
      tip.textContent=result.items.length?'选择即可使用此级地区':'没有匹配地区；上级选择仍有效';
      select.onchange=()=>{const r=result.items.find(r=>r.code===select.value);if(!r)return;this.code=r.code;this.prefix=r.prefix;this.display();this.changed();while(columns.children.length>depth+1)columns.lastElementChild!.remove();if(r.hasChildren)void this.load(depth+1,r.code).catch(()=>{});else if(['CN:710000','CN:810000','CN:820000'].includes(r.code))tip.textContent='本数据口径仅提供省级，不编造下级划分';};
      if(result.nextOffset!==null){const more=document.createElement('button');more.type='button';more.textContent='更多地区';more.onclick=()=>void this.load(depth,parent,q,result.nextOffset!).catch(()=>{});col.append(more);}
    }catch(error){tip.textContent=(error as Error).message;}
  }
}
