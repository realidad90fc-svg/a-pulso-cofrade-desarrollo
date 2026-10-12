import {ARENAL_MAP, ARENAL_ROUTE, BARATILLO} from './arenal-data.mjs';
import {buildArenalRoad,buildArenalCrowd,buildArenalSidewalks,buildArenalHouses} from './arenal-layers.mjs';
import {EDITOR_MAPS,DEFAULT_MAP,SCHEMA,buildEditorMap} from './editor-map-catalog.mjs';
import {createPhotoGuides} from './editor-photo-guides.mjs';
import {ROOF_MATERIALS,ROAD_MATERIALS,SIDEWALK_MATERIALS,TREE_VARIANTS,roofById,drawRoof,drawSurface,drawTree,drawFurniture,NATIVE_ROOF_IDS} from './editor-materials.mjs';
import {makeGameDraft,GAME_PATCH_PREFIX} from './editor-game-draft.mjs';
import {setupMapPublishing} from './editor-publish.mjs';

const $=id=>document.getElementById(id);
const canvas=$('editor-canvas'),ctx=canvas.getContext('2d',{alpha:false});
const HOUSE_KEYS=[569,416,463,480,495,562,566,581,554].map(i=>'sharedassets2.assets:'+i);
const FLOOR_KEY='sharedassets2.assets:373';
const LEGACY_STORAGE='apulso-arenal-manual-editor-v1';
const storageFor=key=>'apulso-universal-editor-v2:'+key;
const colors={road:'#45474d',sidewalk:'#aaa49a',bg:'#676863',selected:'#31d5ed',warning:'#ff6562'};
const getId=(key)=>String(key).split(':').at(-1);
const images=new Map();
const view={cx:40,cy:42,zoom:24,w:900,h:650,dpr:1};
const state={tool:'pan',layer:'house',material:ROOF_MATERIALS[0].id,roadMaterial:ROAD_MATERIALS[0].id,sidewalkMaterial:SIDEWALK_MATERIALS[0].id,treeVariant:TREE_VARIANTS[0].id,treeIndex:0,peopleIndex:0,audience:'sharedassets2.assets:379',selected:null,working:[],history:[],future:[],busy:false,reference:null,referenceOpacity:.36,referenceScale:1,drag:null,pointers:new Map(),pinch:null,paso:null,unsaved:false};
let sprites={},data=null,baseline=null,frames=false,saveTimer=null,activeMap=DEFAULT_MAP,nativeMaps=[],animationData=null,photoGuides=null;

function show(message,type='info'){
 const el=$('status');el.textContent=message;
 el.dataset.type=type;
}
function count(kind){return(data?.[kind]||[]).length}
function updateCounts(){
 if(!data)return;
 $('counts').textContent=count('roads')+' calles · '+count('people')+' personas · '+count('sidewalks')+' aceras · '+count('houses')+' edificios · '+count('trees')+' árboles · '+count('signs')+' señales · '+count('checkpoints')+' controles · '+count('fences')+' vallas · '+count('chairs')+' sillas';
 $('tool-name').textContent=({pan:'Mover plano',select:'Seleccionar',road:'Dibujar calzada',sidewalk:'Dibujar acera',house:'Dibujar edificio',people:'Pintar público',tree:'Colocar árbol',fence:'Colocar valla roja',chair:'Colocar silla','fence-row':'Trazar fila de vallas','chair-row':'Trazar fila de sillas',sign:'Colocar señal',checkpoint:'Colocar checkpoint',erase:'Borrar',paso:'Probar paso',reference:'Ajustar fotografía'})[state.tool]||state.tool;
 $('selection').textContent=state.selected?('Seleccionado: '+nameOf(state.selected.type)+' '+(state.selected.index+1)):'Sin selección';
}
function nameOf(type){return{roads:'Calle',sidewalks:'Acera',houses:'Edificio',people:'Persona',trees:'Árbol',fences:'Valla',chairs:'Silla',signs:'Señal',checkpoints:'Checkpoint'}[type]||type}
function snapshot(){
 if(!data)return;
 state.history.push(JSON.stringify(data));
 if(state.history.length>16)state.history.shift();
 state.future.length=0;
}
function changed(){
 state.unsaved=true;updateCounts();requestDraw();
 clearTimeout(saveTimer);saveTimer=setTimeout(saveLocal,900);
}
function saveLocal(){
 if(!data)return;
 try{localStorage.setItem(storageFor(activeMap),JSON.stringify(data));localStorage.setItem(GAME_PATCH_PREFIX+activeMap,JSON.stringify(makeGameDraft(data,baseline)));state.unsaved=false;show('Diseño guardado. Abre Juego ↗ en este mismo dominio para probar los cambios.','good');}
 catch(e){show('No se pudo guardar localmente: exporta el archivo JSON.','error')}
}
function undo(){
 if(!state.history.length)return;
 state.future.push(JSON.stringify(data));
 data=JSON.parse(state.history.pop());state.selected=null;changed();
}
function redo(){
 if(!state.future.length)return;
 state.history.push(JSON.stringify(data));
 data=JSON.parse(state.future.pop());state.selected=null;changed();
}
function world(px,py){return [view.cx+(px-view.w/2)/view.zoom,view.cy-(py-view.h/2)/view.zoom]}
function pixel(x,y){return [(x-view.cx)*view.zoom+view.w/2,view.h/2-(y-view.cy)*view.zoom]}
function rect(poly){
 const xx=poly.map(p=>p[0]),yy=poly.map(p=>p[1]);
 return [Math.min(...xx),Math.min(...yy),Math.max(...xx),Math.max(...yy)];
}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function inPolygon(point,poly){
 let hit=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
 }
 return hit;
}
function polygon(poly){
 ctx.beginPath();
 poly.forEach((q,i)=>{const p=pixel(...q);if(i)ctx.lineTo(...p);else ctx.moveTo(...p)});
 ctx.closePath();
}
function spriteFor(key){
 if(images.has(key))return images.get(key);
 const entry=sprites[key];
 if(!entry?.image)return null;
 const im=new Image();im.decoding='async';
 images.set(key,im);im.onload=requestDraw;im.onerror=()=>{images.set(key,null)};
 im.src='./'+entry.image;
 return im;
}
function getImage(key){const im=spriteFor(key);return im?.complete&&im.naturalWidth>0?im:null}
function spriteDims(key){
 const s=sprites[key];return s?.rectSize?s.rectSize.map(x=>x/(s.pixelsToUnits||100)):[.19,.19]
}
function visualBounds(){
 const a=world(0,view.h),b=world(view.w,0);
 return [a[0],a[1],b[0],b[1]];
}
function bboxHit(a,b){return a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1]}
function drawTexture(poly,key,fallback,variant=0){
 const b=rect(poly);if(!bboxHit(b,visualBounds()))return;
 const base=roofById(key),baseIndex=Math.max(0,NATIVE_ROOF_IDS.indexOf(Number(String(base.key).split(':').at(-1))));
 const material=String(key||'').startsWith('roof-')?key:'roof-'+baseIndex+'-'+variant%4;
 drawRoof(ctx,poly,material,pixel,getImage,view.zoom);
}
function drawFloor(poly,kind='roads',material=ROAD_MATERIALS[0].id){
 const b=rect(poly);if(!bboxHit(b,visualBounds()))return;
 drawSurface(ctx,poly,kind,material,pixel,view.zoom,getImage(FLOOR_KEY),visualBounds());
}
function drawPeople(){
 const v=visualBounds();
 for(let i=0;i<data.people.length;i++){
  const a=data.people[i],x=a.point[0],y=a.point[1];
  if(x<v[0]-.2||x>v[2]+.2||y<v[1]-.2||y>v[3]+.2)continue;
  const img=getImage(a.key),dims=spriteDims(a.key),p=pixel(x,y);
  const w=Math.max(2,dims[0]*view.zoom),h=Math.max(2,dims[1]*view.zoom);
  if(img){ctx.drawImage(img,p[0]-w/2,p[1]-h/2,w,h)}
  else{ctx.fillStyle='#d4a47c';ctx.beginPath();ctx.arc(p[0],p[1],Math.max(2,w/2),0,Math.PI*2);ctx.fill()}
 }
}
function drawGrid(){
 if(!$('grid-on').checked)return;
 const v=visualBounds(),step=view.zoom>36?1:2;
 ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1;
 for(let x=Math.floor(v[0]/step)*step;x<v[2];x+=step){
  const p=pixel(x,0)[0];ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,view.h);ctx.stroke();
 }
 for(let y=Math.floor(v[1]/step)*step;y<v[3];y+=step){
  const p=pixel(0,y)[1];ctx.beginPath();ctx.moveTo(0,p);ctx.lineTo(view.w,p);ctx.stroke();
 }
}
function draw(){
 frames=false;
 if(!view.w||!view.h)return;
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 ctx.imageSmoothingEnabled=false;ctx.fillStyle=colors.bg;ctx.fillRect(0,0,view.w,view.h);
 photoGuides?.draw('background');
 if(!data)return;
 if($('houses-on').checked)for(let i=0;i<data.houses.length;i++){const o=data.houses[i];drawTexture(o.poly,o.material||o.key,'#b97357',i%4)}
 if($('sidewalks-on').checked){
  for(let i=0;i<data.sidewalks.length;i++){const o=data.sidewalks[i];drawFloor(o.poly,'sidewalks',o.material||SIDEWALK_MATERIALS[i%SIDEWALK_MATERIALS.length].id)}
 }
 if($('roads-on').checked)for(let i=0;i<data.roads.length;i++){const o=data.roads[i];drawFloor(o.poly,'roads',o.material||ROAD_MATERIALS[i%ROAD_MATERIALS.length].id)}
 if($('public-on').checked)drawPeople();
 if($('trees-on').checked)for(const t of data.trees||[])drawTree(ctx,t,pixel,view.zoom,getImage);
 if($('fences-on').checked)for(const f of data.fences||[])drawFurniture(ctx,f,'fence',pixel,view.zoom);
 if($('chairs-on').checked)for(const c of data.chairs||[])drawFurniture(ctx,c,'chair',pixel,view.zoom);
 if($('signs-on').checked)for(const t of data.signs||[]){
  const p=pixel(...t.point),r=Math.max(4,Math.min(10,.20*view.zoom));
  ctx.fillStyle='#e7d5b7';ctx.strokeStyle='#c23b36';ctx.lineWidth=2;ctx.beginPath();ctx.arc(...p,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(p[0]-r*.7,p[1]+r*.7);ctx.lineTo(p[0]+r*.7,p[1]-r*.7);ctx.stroke();
 }
 drawGrid();
 photoGuides?.draw('overlay');
 if($('checkpoints-on').checked)for(const cp of data.checkpoints||[]){
  const p=pixel(...cp.position);ctx.strokeStyle='#58f7dc';ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(p[0]-9,p[1]);ctx.lineTo(p[0]+9,p[1]);ctx.moveTo(p[0],p[1]-9);ctx.lineTo(p[0],p[1]+9);ctx.stroke();
  ctx.fillStyle='#a6fff0';ctx.font='11px system-ui';ctx.fillText(cp.name||cp.id||'Control',p[0]+12,p[1]-5);
 }
 if($('labels-on').checked){
  for(const [name,p]of data.labels){
   const xy=pixel(...p);ctx.font='600 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#171a20';ctx.strokeText(name,xy[0]+6,xy[1]);ctx.fillStyle='#fff5e7';ctx.fillText(name,xy[0]+6,xy[1]);
  }
 }
 if(state.drag?.action==='furniture-row'){
  const a=state.drag,q=pixel(...a.start),p=pixel(...a.end);ctx.strokeStyle='#ef7264';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...q);ctx.lineTo(...p);ctx.stroke();
 }
 if(state.working.length){
  const line=state.working.map(p=>pixel(...p));
  ctx.beginPath();line.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(state.mouseWorld)ctx.lineTo(...pixel(...state.mouseWorld));
  ctx.strokeStyle='#4febdb';ctx.lineWidth=2;ctx.stroke();
  for(const p of line){ctx.fillStyle='#4febdb';ctx.fillRect(p[0]-4,p[1]-4,8,8)}
 }
 if(state.selected){
  const item=data[state.selected.type]?.[state.selected.index];
  if(item){
   ctx.strokeStyle=colors.selected;ctx.lineWidth=3;
   if(item.poly){polygon(item.poly);ctx.stroke();for(const q of item.poly){const p=pixel(...q);ctx.fillStyle='#fff';ctx.fillRect(p[0]-5,p[1]-5,10,10)}}
   else if(item.point||item.position){if(state.selected.type==='fences'||state.selected.type==='chairs')drawFurniture(ctx,item,state.selected.type==='fences'?'fence':'chair',pixel,view.zoom,true);else {const p=pixel(...(item.point||item.position));ctx.beginPath();ctx.arc(p[0],p[1],9,0,Math.PI*2);ctx.stroke()}}
  }
 }
 if(state.tool==='reference')photoGuides?.draw('handles');
 if(state.tool==='paso'||$('paso-on').checked)drawPaso();
 if(state.tool==='people'&&state.mouseWorld){
  const p=pixel(...state.mouseWorld);ctx.beginPath();ctx.arc(...p,.22*view.zoom,0,Math.PI*2);ctx.strokeStyle='#ffba57';ctx.lineWidth=2;ctx.stroke();
 }
}
function drawPaso(){
 const p=state.paso||data.paso; if(!p)return;
 const angle=(p.angle-90)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),w=1.0386,h=2.15;
 const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[p.x+x*c-y*s,p.y+x*s+y*c]);
 polygon(corners);ctx.fillStyle='rgba(123,65,170,.5)';ctx.fill();
 ctx.strokeStyle='#dfb559';ctx.lineWidth=3;ctx.stroke();
 const center=pixel(p.x,p.y);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(center[0],center[1],3,0,Math.PI*2);ctx.fill();
 if(state.tool==='paso'){
  const okay=corners.every(x=>data.roads.some(o=>inPolygon(x,o.poly)));
  $('paso-test').textContent=okay?'Paso dentro de la calzada':'Paso invade el exterior de la calzada';
  $('paso-test').dataset.ok=okay?'yes':'no';
 }
}
function requestDraw(){if(!frames){frames=true;requestAnimationFrame(draw)}}
function resize(){
 const r=canvas.getBoundingClientRect();
 view.w=Math.max(100,r.width);view.h=Math.max(100,r.height);view.dpr=Math.min(2,devicePixelRatio||1);
 canvas.width=Math.round(view.w*view.dpr);canvas.height=Math.round(view.h*view.dpr);
 requestDraw();
}
function configureTool(name){
 state.tool=name;state.working=[];state.drag=null;
 for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===name);
 $('finish-shape').disabled=!['road','house','sidewalk'].includes(name);
 updateCounts();requestDraw();
}
function zoomAt(factor,loc=[view.w/2,view.h/2]){
 const before=world(...loc);
 view.zoom=Math.min(145,Math.max(1.5,view.zoom*factor));
 const after=world(...loc);
 view.cx+=before[0]-after[0];view.cy+=before[1]-after[1];
 requestDraw();
}
function focusAt(x,y,zoom){
 view.cx=x;view.cy=y;
 if(zoom)view.zoom=zoom;
 requestDraw();
}
function selectAt(p,px){
 for(const [type,checkbox] of [['checkpoints','checkpoints-on'],['signs','signs-on'],['trees','trees-on'],['fences','fences-on'],['chairs','chairs-on']]){
  if(!$(checkbox).checked)continue;
  const items=data[type]||[];
  for(let i=items.length-1;i>=0;i--){
   const q=items[i].point||items[i].position;
   if(q&&dist(q,p)<Math.max(.25,12/view.zoom))return {type,index:i,vertex:-1};
  }
 }
 if($('public-on').checked){
  let near=-1,nearD=Math.max(.13,9/view.zoom);
  for(let i=0;i<data.people.length;i++){
   const d=dist(data.people[i].point,p);
   if(d<nearD){nearD=d;near=i}
  }
  if(near>=0)return{type:'people',index:near,vertex:-1};
 }
 for(const type of ['houses','sidewalks','roads']){
  if(!$(type==='houses'?'houses-on':type==='sidewalks'?'sidewalks-on':'roads-on').checked)continue;
  const arr=data[type];
  for(let i=arr.length-1;i>=0;i--){
   const item=arr[i];
   for(let n=0;n<item.poly.length;n++)if(dist(item.poly[n],p)<11/view.zoom)return{type,index:i,vertex:n};
   if(inPolygon(p,item.poly))return{type,index:i,vertex:-1};
  }
 }
 return null;
}
function updatePeopleHint(){
 const ids=[...$('public-sprite').options].map(o=>o.value).filter(Boolean);
 const mode=$('public-mode').value;
 const key=mode==='cycle'?ids[state.peopleIndex%Math.max(1,ids.length)]:state.audience;
 $('public-next').textContent=mode==='random'?'Siguiente referencia: aleatoria': 'Siguiente referencia: '+(key?.split(':').at(-1)||'—')+(mode==='cycle'?' (rotativa)':' (fija)');
}
function addPerson(q){
 if(data.people.some(a=>dist(a.point,q)<.135))return;
 const ids=[...$('public-sprite').options].map(o=>o.value).filter(Boolean);
 const mode=$('public-mode').value;
 const key=mode==='cycle'?ids[state.peopleIndex%Math.max(1,ids.length)]:mode==='random'?ids[Math.floor(Math.random()*ids.length)]:state.audience;
 if(!key)return;
 const s=sprites[key],size=s?.rectSize?s.rectSize.map(x=>x/(s.pixelsToUnits||100)):[.19,.19];
 data.people.push({point:q.map(x=>+x.toFixed(3)),key,size});
 if(mode==='cycle')state.peopleIndex=(state.peopleIndex+1)%ids.length;
 updatePeopleHint();changed();
}
function addFurniture(type,p,angle=0){
 const kind=type==='fence'?'fences':'chairs';
 const point=p.map(v=>+v.toFixed(3));
 const item={point,angle:+angle.toFixed(1),width:type==='fence'?.95:.40,source:'manual'};
 if(data[kind].some(v=>dist(v.point,point)<.16))return false;
 data[kind].push(item);return true;
}
function addFurnitureRow(type,start,end){
 const spacing=Number($('furniture-spacing').value)||.7,len=dist(start,end);
 const n=Math.min(180,Math.floor(len/spacing)+1);
 const angle=Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI;
 for(let i=0;i<n;i++){
  const t=n===1?0:i/(n-1);
  addFurniture(type,[start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])],angle);
 }
}
function eraseAt(p){
 const radius=Math.max(.20,Number($('brush-size').value||.35));
 const before=data.people.length;
 data.people=data.people.filter(a=>dist(a.point,p)>radius);
 if(before!==data.people.length){state.selected=null;changed();return}
 const chosen=selectAt(p);
 if(chosen){data[chosen.type].splice(chosen.index,1);state.selected=null;changed()}
}
function finishPolygon(){
 if(state.working.length<3){show('Marca al menos 3 puntos para cerrar el polígono.','error');return}
 const kind={road:'roads',sidewalk:'sidewalks',house:'houses'}[state.tool];
 if(!kind)return;
 const poly=state.working.map(a=>a.map(x=>Math.round(x*100)/100));
 const a=Math.abs(poly.reduce((v,p,i)=>{const q=poly[(i+1)%poly.length];return v+p[0]*q[1]-p[1]*q[0]},0))/2;
 if(a<.015){show('Polígono demasiado estrecho o cruzado. Corrige sus puntos.','error');return}
 snapshot();
 data[kind].push(kind==='houses'?{poly,key:roofById(state.material).key,material:state.material,kind:'manual'}:{poly,material:kind==='roads'?state.roadMaterial:state.sidewalkMaterial});
 state.working=[];changed();show('Polígono añadido. Revisa si invade otra capa.','good');
}
function pointEvent(e){const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
function pointerDown(e){
 e.preventDefault();canvas.setPointerCapture(e.pointerId);
 const pos=pointEvent(e);state.pointers.set(e.pointerId,pos);
 if(state.pointers.size===2){
  const arr=[...state.pointers.values()];
  state.pinch={gap:dist(arr[0],arr[1]),mid:[(arr[0][0]+arr[1][0])/2,(arr[0][1]+arr[1][1])/2],zoom:view.zoom};
  state.drag=null;return;
 }
 const q=world(...pos);state.mouseWorld=q;
 if(state.tool==='pan'){state.drag={action:'pan',pos};return}
 if(state.tool==='reference'){photoGuides?.pointerDown(pos);return}
 if(state.tool==='paso'){snapshot();state.drag={action:'paso',pos};state.paso={...(state.paso||data.paso),x:q[0],y:q[1]};changed();return}
 if(['road','sidewalk','house'].includes(state.tool)){
  if(state.working.length>=3&&dist(q,state.working[0])<10/view.zoom){finishPolygon();return}
  state.working.push(q);requestDraw();return;
 }
 if(state.tool==='people'){snapshot();addPerson(q);state.drag={action:'people'};return}
 if(state.tool==='tree'){snapshot();const treeId=$('tree-cycle').checked?TREE_VARIANTS[state.treeIndex%TREE_VARIANTS.length].id:state.treeVariant;data.trees.push({point:q.map(x=>+x.toFixed(3)),radius:Number($('tree-radius').value),variant:treeId,rotation:Math.round((state.treeIndex*47)%360),scale:.88+(state.treeIndex%5)*.06,source:'manual'});state.treeIndex++;changed();return}
 if(state.tool==='fence'||state.tool==='chair'){snapshot();addFurniture(state.tool,q,Number($('furniture-angle').value)||0);changed();return}
 if(state.tool==='fence-row'||state.tool==='chair-row'){state.drag={action:'furniture-row',type:state.tool==='fence-row'?'fence':'chair',start:q,end:q};requestDraw();return}
 if(state.tool==='sign'){snapshot();data.signs.push({point:q.map(x=>+x.toFixed(3)),type:'traffic',source:'manual'});changed();return}
 if(state.tool==='checkpoint'){snapshot();const id='manual-'+Date.now();data.checkpoints.push({id,name:'Control '+(data.checkpoints.length+1),position:q.map(x=>+x.toFixed(3))});changed();return}
 if(state.tool==='erase'){snapshot();eraseAt(q);state.drag={action:'erase'};return}
 if(state.tool==='select'){
  state.selected=selectAt(q,pos);updateCounts();
  if(state.selected){snapshot();state.drag={action:'select',pos,lastWorld:q,selection:{...state.selected}}}
  requestDraw();
 }
}
function pointerMove(e){
 const pos=pointEvent(e);const last=state.pointers.get(e.pointerId);if(last)state.pointers.set(e.pointerId,pos);
 if(state.pointers.size>=2&&state.pinch){
  const pts=[...state.pointers.values()],gap=Math.max(1,dist(pts[0],pts[1]));
  zoomAt(gap/state.pinch.gap,[ (pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2 ]);
  state.pinch.gap=gap;return;
 }
 const q=world(...pos);state.mouseWorld=q;$('coords').textContent=q.map(x=>x.toFixed(2)).join(' · ');
 if(state.tool==='reference'){photoGuides?.pointerMove(pos);requestDraw();return}
 if(!state.drag){requestDraw();return}
 const a=state.drag,dx=(pos[0]-a.pos[0])/view.zoom,dy=-(pos[1]-a.pos[1])/view.zoom;
 if(a.action==='pan'){view.cx-=dx;view.cy-=dy;a.pos=pos;requestDraw();return}
 if(a.action==='people'){if(!last||dist(pos,last)>2)addPerson(q);return}
 if(a.action==='erase'){eraseAt(q);return}
 if(a.action==='furniture-row'){a.end=q;requestDraw();return}
 if(a.action==='paso'){state.paso.x=q[0];state.paso.y=q[1];changed();return}
 if(a.action==='select'){
  const item=data[a.selection.type]?.[a.selection.index];if(!item)return;
  if(item.poly){
   if(a.selection.vertex>=0){item.poly[a.selection.vertex]=q.map(x=>+x.toFixed(3))}
   else for(const p of item.poly){p[0]+=dx;p[1]+=dy}
  }else if(item.point||item.position){const field=item.point?'point':'position';item[field]=q.map(x=>+x.toFixed(3))}
  a.pos=pos;changed();
 }
}
function pointerUp(e){
 if(e.type!=='pointercancel'&&state.drag?.action==='furniture-row'){
  const a=state.drag;snapshot();
  if(dist(a.start,a.end)>=.05)addFurnitureRow(a.type,a.start,a.end);
  else addFurniture(a.type,a.start,Number($('furniture-angle').value)||0);
  changed();
 }
 state.pointers.delete(e.pointerId);
 if(state.pointers.size<2)state.pinch=null;
 if(!state.pointers.size){state.drag=null;photoGuides?.pointerUp()}
}
function downloadJSON(){
 const output={...data,metadata:{...data.metadata,exportedAt:new Date().toISOString()}};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='apulso-'+activeMap.toLowerCase().replace(/[^a-z0-9-]/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);show('Archivo JSON exportado. Puedes pasármelo para incorporarlo al juego.','good');
}
function setData(loaded){
 if(!loaded||!Array.isArray(loaded.roads)||!Array.isArray(loaded.houses)||!Array.isArray(loaded.sidewalks)||!Array.isArray(loaded.people))throw new Error('El archivo no contiene un diseño de mapa válido.');
 if(loaded.metadata?.mapKey!==activeMap)throw new Error('Este archivo corresponde a otro mapa. Selecciónalo antes de importar.');
 for(const type of ['roads','houses','sidewalks'])
  if(loaded[type].some(p=>!Array.isArray(p.poly)||p.poly.length<3||p.poly.some(x=>!Array.isArray(x)||!Number.isFinite(x[0])||!Number.isFinite(x[1]))))throw new Error('Hay polígonos inválidos en '+type);
 data=loaded;state.selected=null;state.history=[];state.future=[];
 if(!data.paso)data.paso={...baseline.paso};
 if(!data.checkpoint)data.checkpoint=[...baseline.checkpoint];
 if(!data.labels)data.labels=[];
 for(const kind of ['trees','signs','checkpoints','fences','chairs'])if(!Array.isArray(data[kind]))data[kind]=structuredClone(baseline[kind]||[]);
 if(!data.bounds)data.bounds=baseline.bounds;
 state.paso={...data.paso};state.peopleIndex=data.people.length;state.treeIndex=data.trees.length;
 if($('public-sprite').options.length)updatePeopleHint();changed();
}
function makeSegments(){
 return ARENAL_MAP.modules.map(m=>{
  const a=m.points[0],b=m.points[1],length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-t[1],t[0]],w=m.halfWidth;
  return{module:m,a,b,length,t,n,polygon:[
   [a[0]+n[0]*w,a[1]+n[1]*w],[b[0]+n[0]*w,b[1]+n[1]*w],
   [b[0]-n[0]*w,b[1]-n[1]*w],[a[0]-n[0]*w,a[1]-n[1]*w]
  ]};
 });
}
function prepareMap(animation){
 const graph={data:{sprites:animation.sprites},nodes:new Map()};
 const route={segments:makeSegments(),sim:{resources:{animation:{graphs:animation.graphs}}},
  graph,scene:{start:ARENAL_ROUTE.start,ppu:96,crowd:ARENAL_ROUTE.crowd,ambient:{darkness:.13,tint:'#414955'}},
  tileCache:{clear(){}},people:[],obstacles:[],walkable:[],paintBaratillo(){},paintAdrianoFurniture(){}};
 buildArenalRoad(route);buildArenalCrowd(route);buildArenalSidewalks(route);buildArenalHouses(route);
 return{
  schema:'apulso-arenal-manual-v1',
  metadata:{map:'Regreso por el Arenal',baseVersion:'git-main',units:'original game world units',instructions:'Import this design into ArenalRoute after review. Coordinates are in the native route coordinate system.'},
  roads:route.walkable.map(poly=>({poly:poly.map(p=>[...p])})),
  sidewalks:route.sidewalks.map(x=>({poly:x.poly.map(p=>[...p])})),
  houses:route.buildings.map(x=>({poly:x.poly.map(p=>[...p]),key:x.key,kind:x.kind||'house'})),
  people:route.people.map(x=>({point:[...x.point],key:x.key,size:[...x.size]})),
  checkpoint:[...BARATILLO.position],
  paso:{x:ARENAL_ROUTE.start.position[0],y:ARENAL_ROUTE.start.position[1],angle:ARENAL_ROUTE.start.angle||147},
  labels:[
   ['Arfe',[48.3,33.8]],['Adriano',[42.6,35.1]],['Capilla del Baratillo',[40.9,35.4]],
   ['Pastor y Landero',[39.0,45.8]],['Reyes Católicos',[40.0,29.6]]
  ]
 };
}
function palette(){
 const parent=$('palettes');parent.replaceChildren();
 for(const roof of ROOF_MATERIALS){
  const id=Number(roof.key.split(':').at(-1)),button=document.createElement('button');
  button.className='swatch'+(state.material===roof.id?' chosen':'');
  button.title=roof.name+' · material del juego '+id;button.type='button';
  const im=document.createElement('img');im.loading='lazy';im.src='./assets/original-animation/sprite-'+id+'.webp';
  im.alt=roof.name;im.style.filter=roof.filter;
  if(roof.family===2)im.style.backgroundColor='#d7cdb8';
  const name=document.createElement('small');name.textContent=roof.name;
  button.append(im,name);button.onclick=()=>{state.material=roof.id;palette();requestDraw()};
  parent.appendChild(button);
 }
 function options(select,items,chosen){
  select.replaceChildren();
  for(const item of items){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;select.appendChild(o)}
  select.value=chosen;
 }
 options($('road-material'),ROAD_MATERIALS,state.roadMaterial);
 options($('sidewalk-material'),SIDEWALK_MATERIALS,state.sidewalkMaterial);
 options($('tree-variant'),TREE_VARIANTS,state.treeVariant);
 const audience=$('public-sprite');audience.replaceChildren();
 const ids=[379,596,549,427,419,426,418,380,508,386,607,516,394,458,454,423,428,391];
 for(const id of ids){
  const key='sharedassets2.assets:'+id;if(!sprites[key])continue;
  const op=document.createElement('option');op.value=key;op.textContent='Persona '+id;audience.appendChild(op);
 }
 audience.value=state.audience;
 audience.onchange=()=>{
  state.audience=audience.value;
  if($('public-mode').value==='cycle')state.peopleIndex=Math.max(0,[...audience.options].findIndex(o=>o.value===audience.value));
  updatePeopleHint();
 };
 updatePeopleHint();
}
function bind(){
 for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>configureTool(button.dataset.tool);
 for(const id of ['grid-on','labels-on','houses-on','roads-on','sidewalks-on','public-on','paso-on','trees-on','signs-on','checkpoints-on','fences-on','chairs-on'])$(id).onchange=requestDraw;
 $('finish-shape').onclick=finishPolygon;
 $('cancel-shape').onclick=()=>{state.working=[];requestDraw()};
 $('delete').onclick=()=>{
  if(!state.selected){show('Selecciona un elemento que quieras borrar.','error');return}
  snapshot();data[state.selected.type].splice(state.selected.index,1);state.selected=null;changed();
 };
 $('road-material').onchange=e=>{state.roadMaterial=e.target.value};
 $('sidewalk-material').onchange=e=>{state.sidewalkMaterial=e.target.value};
 $('tree-variant').onchange=e=>{state.treeVariant=e.target.value};
 $('public-mode').onchange=updatePeopleHint;
 $('furniture-spacing').oninput=e=>{$('furniture-spacing-value').textContent=Number(e.target.value).toFixed(2)};
 $('apply-roof').onclick=()=>{
  const sel=state.selected;
  if(sel?.type!=='houses'){show('Selecciona primero una casa existente.','error');return}
  snapshot();const roof=roofById(state.material),o=data.houses[sel.index];o.material=roof.id;o.key=roof.key;changed();
 };
 $('apply-surface').onclick=()=>{
  const sel=state.selected;if(!sel||!['roads','sidewalks'].includes(sel.type)){show('Selecciona una calle o una acera.','error');return}
  snapshot();data[sel.type][sel.index].material=sel.type==='roads'?state.roadMaterial:state.sidewalkMaterial;changed();
 };
 const selectedFurniture=()=>state.selected&&['fences','chairs'].includes(state.selected.type)?data[state.selected.type][state.selected.index]:null;
 const rotateSelected=degrees=>{
  const o=selectedFurniture();if(!o){show('Selecciona una valla o silla.','error');return}
  snapshot();o.angle=((o.angle||0)+degrees+360)%360;changed();
 };
 $('rotate-selected-left').onclick=()=>rotateSelected(-15);
 $('rotate-selected-right').onclick=()=>rotateSelected(15);
 $('duplicate-selected').onclick=()=>{
  const o=selectedFurniture();if(!o){show('Selecciona una valla o silla.','error');return}
  snapshot();data[state.selected.type].push({...o,point:[o.point[0]+.3,o.point[1]+.3]});
  state.selected.index=data[state.selected.type].length-1;changed();
 };
 $('undo').onclick=undo;$('redo').onclick=redo;
 $('save').onclick=()=>{saveLocal();void photoGuides?.flush()};$('export').onclick=downloadJSON;
 $('map-select').onchange=()=>switchMap($('map-select').value);
 $('import').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{let obj=JSON.parse(await file.text());if(activeMap===DEFAULT_MAP&&obj?.schema==='apulso-arenal-manual-v1')obj={...obj,schema:SCHEMA,metadata:{...baseline.metadata},trees:obj.trees||baseline.trees,signs:obj.signs||baseline.signs,checkpoints:obj.checkpoints||baseline.checkpoints,bounds:obj.bounds||baseline.bounds};setData(obj);show('Mapa importado. No altera el juego publicado.','good')}
  catch(err){show('No se pudo importar: '+err.message,'error')}
  e.target.value='';
 };
 $('reset').onclick=()=>{
  if(!confirm('¿Volver a la versión de partida del editor? Exporta antes tu trabajo si quieres conservarlo.'))return;
  snapshot();data=JSON.parse(JSON.stringify(baseline));state.selected=null;changed();
 };
 $('brush-size').oninput=()=>{$('brush-value').textContent=Number($('brush-size').value).toFixed(2)+' m'};
 $('goto-start').onclick=()=>focusAt(data.paso.x,data.paso.y,Math.min(45,Math.max(view.zoom,20)));
 $('goto-chapel').onclick=()=>{const p=data.checkpoints?.[0]?.position||data.checkpoint;focusAt(...p,Math.min(48,Math.max(view.zoom,20)))};
 $('goto-all').onclick=fitMap;
 $('zoom-in').onclick=()=>zoomAt(1.3);$('zoom-out').onclick=()=>zoomAt(1/1.3);
 $('paso-left').onclick=()=>{state.paso.angle=(state.paso.angle-5+360)%360;changed()};
 $('paso-right').onclick=()=>{state.paso.angle=(state.paso.angle+5)%360;changed()};
 // Photo guide images and positions are private browser data, separate from game geometry.
 photoGuides?.bind();
 $('check').onclick=validate;
 canvas.addEventListener('pointerdown',pointerDown);
 canvas.addEventListener('pointermove',pointerMove);
 canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
 canvas.addEventListener('dblclick',e=>{if(['road','house','sidewalk'].includes(state.tool)){e.preventDefault();finishPolygon()}});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY>0?.85:1.15,pointEvent(e))},{passive:false});
 window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(e.key==='Enter')finishPolygon();
  if(e.key==='Escape'){state.working=[];state.selected=null;requestDraw()}
  if(e.key==='Delete'||e.key==='Backspace')$('delete').click();
  if(e.key==='+'||e.key==='=')zoomAt(1.2);
  if(e.key==='-')zoomAt(.83);
 });
 window.addEventListener('resize',resize);
}
function validate(){
 const warnings=[];
 const inRoad=p=>data.roads.some(x=>inPolygon(p,x.poly));
 const inHouse=p=>data.houses.some(x=>inPolygon(p,x.poly));
 let pedestrianHouse=0,pedestrianRoad=0;
 for(const person of data.people){if(inHouse(person.point))pedestrianHouse++;if(inRoad(person.point))pedestrianRoad++}
 let roofsOnRoad=0;
 for(const house of data.houses){
  const corners=house.poly;
  if(corners.some(inRoad)||data.roads.some(r=>r.poly.some(p=>inPolygon(p,house.poly))))roofsOnRoad++;
 }
 if(roofsOnRoad)warnings.push(roofsOnRoad+' edificios invaden o tocan el camino');
 if(pedestrianHouse)warnings.push(pedestrianHouse+' personas aparecen dentro de edificios');
 const paso=(state.paso||data.paso),angle=(paso.angle-90)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const footprint=[[-.5193,-1.075],[.5193,-1.075],[.5193,1.075],[-.5193,1.075]]
  .map(([x,y])=>[paso.x+x*c-y*s,paso.y+x*s+y*c]);
 if(!footprint.every(inRoad))warnings.push('El paso de prueba queda fuera de la calzada');
 const result=$('validation');result.innerHTML='';
 const heading=document.createElement('strong');heading.textContent=warnings.length?'Revisión: '+warnings.length+' advertencias':'Comprobaciones básicas superadas';
 result.appendChild(heading);
 for(const msg of warnings){const p=document.createElement('p');p.textContent='• '+msg;result.appendChild(p)}
 const p=document.createElement('p');p.textContent=pedestrianRoad+' espectadores están en la calzada. Los pasos por las revirás deben probarse jugando.';result.appendChild(p);
 show(warnings.length?'Revisa las advertencias antes de exportar.':'No hay solapamientos obvios de capas.',''+(warnings.length?'error':'good'));
}
function fitMap(){
 if(!data)return;
 const b=data.bounds;
 const xs=[],ys=[];
 if(!b)for(const type of ['roads','houses','sidewalks'])for(const o of data[type]||[])for(const p of o.poly||[]){xs.push(p[0]);ys.push(p[1])}
 const area=b|| (xs.length?[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]:null);
 if(!area)return;
 const margin=1.8,wd=Math.max(1,area[2]-area[0]+2*margin),ht=Math.max(1,area[3]-area[1]+2*margin);
 focusAt((area[0]+area[2])/2,(area[1]+area[3])/2,Math.min(80,Math.max(1.5,Math.min((view.w-30)/wd,(view.h-30)/ht))));
}
function switchMap(key){
 if(!EDITOR_MAPS.some(m=>m.key===key))return;
 if(data){clearTimeout(saveTimer);saveLocal()}
 activeMap=key;state.selected=null;state.working=[];state.mouseWorld=null;
 void photoGuides?.switchMap(key);
 state.history=[];state.future=[];state.pinch=null;state.drag=null;state.pointers.clear();
 baseline=buildEditorMap(key,animationData,nativeMaps,prepareMap);
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(storageFor(key))||'null')}catch{}
 if(!saved&&key===DEFAULT_MAP){
  try{
   const old=JSON.parse(localStorage.getItem(LEGACY_STORAGE)||'null');
   if(old?.schema==='apulso-arenal-manual-v1')saved={...old,schema:SCHEMA,metadata:{...baseline.metadata},trees:baseline.trees,signs:baseline.signs,checkpoints:baseline.checkpoints,bounds:baseline.bounds};
  }catch{}
 }
 const restoring=saved?.schema===SCHEMA;
 try{setData(restoring?saved:structuredClone(baseline))}
 catch(error){setData(structuredClone(baseline));show('La edición guardada era incompatible: '+error.message,'error')}
 $('map-select').value=key;
 const chosen=EDITOR_MAPS.find(m=>m.key===key);
 $('map-kind').textContent=chosen.type==='native'?'Mapa clásico del APK: geometría guía de colisiones; no es una reproducción visual exacta.':chosen.type==='mixed'?'Recorrido combinado: se conserva el mapa original junto a las ampliaciones.':chosen.type==='arenal'?'Arenal: taller con geometría detallada.':'Recorrido modular: aceras y público orientativos que puedes ajustar.';
 configureTool('pan');fitMap();
 show(restoring?'Edición de «'+chosen.name+'» recuperada.':'«'+chosen.name+'» cargado para editar.','good');
}
async function init(){
 try{
  show('Cargando geometría y sprites originales del juego…');
  const responses=await Promise.all([fetch('./assets/original-animation.json'),fetch('./assets/game-data.json')]);
  for(const response of responses)if(!response.ok)throw Error('No se pudo cargar el catálogo HTTP '+response.status);
  const values=await Promise.all(responses.map(response=>response.json()));
  animationData=values[0];nativeMaps=values[1].maps||[];sprites=animationData.sprites;
  for(const key of [...HOUSE_KEYS,FLOOR_KEY,'sharedassets2.assets:379','sharedassets2.assets:563'])spriteFor(key);
  const selector=$('map-select');
  for(const groupName of ['Recorridos de A Pulso','Mapas clásicos del APK']){
   const group=document.createElement('optgroup');group.label=groupName;
   for(const item of EDITOR_MAPS.filter(x=>groupName==='Mapas clásicos del APK' ? x.type==='native' : x.type!=='native')){
    const opt=document.createElement('option');opt.value=item.key;opt.textContent=item.name;group.appendChild(opt);
   }
   selector.appendChild(group);
  }
  photoGuides=createPhotoGuides({ctx,pixel,world,requestDraw,show,getMapKey:()=>activeMap,getView:()=>view});
  palette();bind();resize();
  setupMapPublishing({getMapKey:()=>activeMap,getData:()=>data,getBaseline:()=>baseline,saveLocal,show});
  const requested=new URLSearchParams(location.search).get('map');
  switchMap(EDITOR_MAPS.some(m=>m.key===requested)?requested:DEFAULT_MAP);
  $('loading').hidden=true;
 }catch(err){show('Error preparando el editor: '+err.message,'error');$('loading').textContent='No se ha podido cargar el editor. '+err.message;console.error(err)}
}
init();
