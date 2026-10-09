const rgba=c=>`rgba(${Math.round(Math.min(1,c.r)*255)},${Math.round(Math.min(1,c.g)*255)},${Math.round(Math.min(1,c.b)*255)},${c.a})`;
export function layoutRects(data,rootKey,width,height){
 const root=data.roots[rootKey],ref=root.referenceResolution.x,scale=width/ref;
 const rects=new Map([[rootKey,{x:0,y:0,w:width,h:height,scale:1,active:true}]]);
 function walk(key){
  const n=data.nodes[key],p=rects.get(n.parentKey);if(!p)return;
  const w=(p.w/scale*(n.anchorMax.x-n.anchorMin.x)+n.sizeDelta.x)*scale;
  const h=(p.h/scale*(n.anchorMax.y-n.anchorMin.y)+n.sizeDelta.y)*scale;
  const x=p.x+p.w*n.anchorMin.x+n.anchoredPosition.x*scale-n.pivot.x*n.sizeDelta.x*scale;
  const y=p.y+p.h*n.anchorMin.y+n.anchoredPosition.y*scale-n.pivot.y*n.sizeDelta.y*scale;
  rects.set(key,{x,y,w,h,active:p.active&&n.activeSelf,scale});
  for(const child of n.childKeys||[])walk(child);
 }
 for(const child of data.nodes[rootKey].childKeys)walk(child);
 return rects;
}
function richText(text){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/&lt;size=(\d+)&gt;/g,'<span data-size="$1">').replace(/&lt;\/size&gt;/g,'</span>').replace(/&lt;(\/?)(b|i)&gt;/g,'<$1$2>').replace(/\n/g,'<br>');}
export class OriginalLayout {
 constructor(data,rootKey,container,{onClick=null,excludeButtons=false,filter=null}={}){
  this.data=data;this.rootKey=rootKey;this.container=container;this.elements=new Map();this.nodesByName=new Map();this.excludeButtons=excludeButtons;this.onClick=onClick;
  this.host=document.createElement('div');this.host.className='native-layout';container.append(this.host);
  const excluded=new Set();const skipTree=key=>{excluded.add(key);for(const k of data.nodes[key].childKeys||[])skipTree(k);};
  if(excludeButtons)for(const key of data.roots[rootKey].nodes)if(data.nodes[key]?.button)skipTree(key);
  for(const key of data.roots[rootKey].nodes){const n=data.nodes[key];if(key===rootKey||excluded.has(key)||filter&&!filter(n))continue;
   if(!n.image&&!n.text&&!n.button)continue;
   const el=document.createElement(n.button?'button':'div');el.className='original-ui-element';el.dataset.nativeName=n.name;
   if(n.image){const im=document.createElement('img');im.src=n.image.spriteURL||'';im.alt='';im.draggable=false;im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:'+(n.image.preserveAspect?'contain':'fill');el.append(im);el.image=im;}
   if(n.text){const span=document.createElement('span');span.innerHTML=richText(n.text.text);span.style.cssText='width:100%;white-space:pre-wrap;overflow:visible;line-height:1';el.append(span);el.label=span;}
   if(n.button){el.style.pointerEvents='auto';el.style.background='transparent';el.style.padding='0';el.onclick=()=>onClick?.(n);el.disabled=!n.button.interactable;el.setAttribute('aria-label',this.labelFor(n));}
   this.elements.set(key,el);this.nodesByName.set(n.name,key);this.host.append(el);
  }
  if(data.roots[rootKey].name==='MenuCreditos'){
   const text=[...this.elements].find(([key])=>data.nodes[key].name==='Text');const area=data.roots[rootKey].nodes.find(key=>data.nodes[key].name==='ScrollArea');
   if(text&&area){this.scroll=document.createElement('div');this.scroll.className='original-credit-scroll';this.scrollKey=area;this.scrollTextKey=text[0];this.scroll.append(text[1]);this.host.append(this.scroll);for(const [key,el]of this.elements)if(/Scrollbar/.test(data.nodes[key].path))el.hidden=true;}
  }
  this.resize();
 }
 labelFor(n){for(const k of n.childKeys||[]){const c=this.data.nodes[k];if(c.text)return c.text.text;}return n.name.replace(/^Button/,'');}
 resize(){
  const w=this.container.clientWidth,h=this.container.clientHeight;this.width=w;this.height=h;this.rects=layoutRects(this.data,this.rootKey,w,h);
  for(const [key,el]of this.elements){const n=this.data.nodes[key],r=this.rects.get(key);if(!r)continue;
   el.style.left=r.x+'px';el.style.top=(h-r.y-r.h)+'px';el.style.width=Math.max(0,r.w)+'px';el.style.height=Math.max(0,r.h)+'px';el.hidden=!r.active;
   const scale=n.localScale||{x:1,y:1};el.style.transform=`scale(${scale.x},${scale.y})`;
   if(n.image){el.style.opacity=n.image.color.a;el.image.hidden=!n.image.enabled;}
   if(n.text){el.style.color=rgba(n.text.color);el.style.fontSize=n.text.fontSize*r.scale+'px';el.style.fontWeight=[1,3].includes(n.text.fontStyle)?'bold':'normal';el.style.fontStyle=[2,3].includes(n.text.fontStyle)?'italic':'normal';el.style.display='flex';el.style.alignItems=['flex-start','center','flex-end'][Math.floor(n.text.alignment/3)];el.style.textAlign=['left','center','right'][n.text.alignment%3];el.label.hidden=!n.text.enabled;for(const s of el.querySelectorAll('[data-size]'))s.style.fontSize=s.dataset.size*r.scale+'px';}
  }
  if(this.scroll){const area=this.rects.get(this.scrollKey),el=this.elements.get(this.scrollTextKey);this.scroll.style.cssText=`position:absolute;left:${area.x}px;top:${h-area.y-area.h}px;width:${area.w}px;height:${area.h}px;overflow-y:auto;pointer-events:auto;touch-action:pan-y`;el.style.left='0';el.style.top='0';el.style.width='100%';for(const [key,e]of this.elements)if(/Scrollbar/.test(this.data.nodes[key].path))e.hidden=true;}
 }
 setText(name,text,color=null){const el=this.elements.get(this.elements.has(name)?name:this.nodesByName.get(name));if(!el?.label)return;if(el._text!==text){el.label.innerHTML=richText(String(text));el._text=text;for(const s of el.querySelectorAll('[data-size]'))s.style.fontSize=s.dataset.size*(this.width/this.data.roots[this.rootKey].referenceResolution.x)+'px';}if(color)el.style.color=Array.isArray(color)?`rgb(${color.slice(0,3).map(v=>Math.round(v*255)).join(',')})`:rgba(color);}
 setImage(name,url){const el=this.elements.get(this.nodesByName.get(name));if(el?.image&&el.image.getAttribute('src')!==url)el.image.src=url;}
 setVisible(name,visible){const el=this.elements.get(this.nodesByName.get(name));if(el)el.hidden=!visible;}
 setScale(name,x,y){const el=this.elements.get(this.nodesByName.get(name));if(el)el.style.transform=`scale(${x},${y})`;}
 destroy(){this.host.remove();}
}
