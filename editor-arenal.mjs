import {ARENAL_MAP, ARENAL_ROUTE, BARATILLO} from './arenal-data.mjs';
import {buildArenalRoad,buildArenalCrowd,buildArenalSidewalks,buildArenalHouses} from './arenal-layers.mjs';

const $=id=>document.getElementById(id);
const canvas=$('editor-canvas'),ctx=canvas.getContext('2d',{alpha:false});
const HOUSE_KEYS=[569,416,463,480,495,562,566,581,554].map(i=>'sharedassets2.assets:'+i);
const FLOOR_KEY='sharedassets2.assets:373';
const STORAGE='apulso-arenal-manual-editor-v1';
const colors={road:'#45474d',sidewalk:'#aaa49a',bg:'#676863',selected:'#31d5ed',warning:'#ff6562'};
const getId=(key)=>String(key).split(':').at(-1);
const images=new Map();
const view={cx:40,cy:42,zoom:24,w:900,h:650,dpr:1};
const state={tool:'pan',layer:'house',material:HOUSE_KEYS[0],audience:'sharedassets2.assets:379',selected:null,working:[],history:[],future:[],busy:false,reference:null,referenceOpacity:.36,referenceScale:1,drag:null,pointers:new Map(),pinch:null,paso:null,unsaved:false};
let sprites={},data=null,baseline=null,frames=false,saveTimer=null;

function show(message,type='info'){
 const el=$('status');el.textContent=message;
 el.dataset.type=type;
}
function count(kind){return(data?.[kind]||[]).length}
function updateCounts(){
 if(!data)return;
 $('counts').textContent=count('roads')+' calles · '+count('people')+' personas · '+count('sidewalks')+' aceras · '+count('houses')+' edificios';
 $('tool-name').textContent=({pan:'Mover plano',select:'Seleccionar',road:'Dibujar calzada',sidewalk:'Dibujar acera',house:'Dibujar edificio',people:'Pintar público',erase:'Borrar',paso:'Probar paso',reference:'Ajustar fotografía'})[state.tool]||state.tool;
 $('selection').textContent=state.selected?('Seleccionado: '+nameOf(state.selected.type)+' '+(state.selected.index+1)):'Sin selección';
}
function nameOf(type){return{roads:'Calle',sidewalks:'Acera',houses:'Edificio',people:'Persona'}[type]||type}
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
 try{localStorage.setItem(STORAGE,JSON.stringify(data));state.unsaved=false;show('Diseño guardado en este navegador. Exporta JSON para conservar otra copia.','good');}
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
function drawTexture(poly,key,fallback){
 const b=rect(poly),v=visualBounds();if(!bboxHit(b,v))return;
 ctx.save();polygon(poly);ctx.clip();
 const im=getImage(key);
 if(im){const p=pixel(b[0],b[3]);ctx.imageSmoothingEnabled=false;ctx.drawImage(im,p[0],p[1],(b[2]-b[0])*view.zoom,(b[3]-b[1])*view.zoom)}
 else{ctx.fillStyle=fallback;ctx.fillRect(0,0,view.w,view.h)}
 ctx.restore();
}
function drawFloor(poly,key=FLOOR_KEY){
 const b=rect(poly),v=visualBounds();if(!bboxHit(b,v))return;
 polygon(poly);ctx.save();ctx.clip();
 ctx.fillStyle=colors.road;ctx.fillRect(0,0,view.w,view.h);
 const im=getImage(key);
 if(im){
  ctx.imageSmoothingEnabled=false;
  const minx=Math.floor(Math.max(b[0],v[0])),maxx=Math.ceil(Math.min(b[2],v[2]));
  const miny=Math.floor(Math.max(b[1],v[1])),maxy=Math.ceil(Math.min(b[3],v[3]));
  for(let x=minx;x<maxx;x++)for(let y=miny;y<maxy;y++){
   const p=pixel(x,y+1);
   ctx.globalAlpha=.75;ctx.drawImage(im,322,40,110,110,p[0],p[1],view.zoom,view.zoom);
  }
 }
 ctx.restore();
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
 if(state.reference){
  const im=state.reference.image,pos=state.reference.position;
  const p=pixel(pos[0],pos[1]+state.reference.height*state.referenceScale);
  ctx.globalAlpha=state.referenceOpacity;
  ctx.drawImage(im,p[0],p[1],state.reference.width*state.referenceScale*view.zoom,state.reference.height*state.referenceScale*view.zoom);
  ctx.globalAlpha=1;
 }
 if(!data)return;
 if($('houses-on').checked)for(const o of data.houses)drawTexture(o.poly,o.key,'#b97357');
 if($('sidewalks-on').checked){
  for(const o of data.sidewalks){polygon(o.poly);ctx.fillStyle=colors.sidewalk;ctx.fill()}
 }
 if($('roads-on').checked)for(const o of data.roads)drawFloor(o.poly);
 if($('public-on').checked)drawPeople();
 drawGrid();
 const marker=pixel(...data.checkpoint);
 ctx.strokeStyle='#58f7dc';ctx.lineWidth=2;ctx.beginPath();
 ctx.moveTo(marker[0]-9,marker[1]);ctx.lineTo(marker[0]+9,marker[1]);
 ctx.moveTo(marker[0],marker[1]-9);ctx.lineTo(marker[0],marker[1]+9);ctx.stroke();
 ctx.fillStyle='#a6fff0';ctx.font='11px system-ui';ctx.fillText('BARATILLO',marker[0]+12,marker[1]-5);
 if($('labels-on').checked){
  for(const [name,p]of data.labels){
   const xy=pixel(...p);ctx.font='600 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#171a20';ctx.strokeText(name,xy[0]+6,xy[1]);ctx.fillStyle='#fff5e7';ctx.fillText(name,xy[0]+6,xy[1]);
  }
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
   else if(item.point){const p=pixel(...item.point);ctx.beginPath();ctx.arc(p[0],p[1],9,0,Math.PI*2);ctx.stroke()}
  }
 }
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
 view.zoom=Math.min(145,Math.max(9,view.zoom*factor));
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
function addPerson(q){
 if(data.people.some(a=>dist(a.point,q)<.135))return;
 const s=sprites[state.audience],size=s?s.rectSize.map(x=>x/(s.pixelsToUnits||100)):[.19,.19];
 data.people.push({point:q.map(x=>+x.toFixed(3)),key:state.audience,size});
 changed();
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
 data[kind].push(kind==='houses'?{poly,key:state.material,kind:'manual'}:{poly});
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
 if(state.tool==='reference'&&state.reference){state.drag={action:'reference',pos,start:[...state.reference.position]};return}
 if(state.tool==='paso'){snapshot();state.drag={action:'paso',pos};state.paso={...(state.paso||data.paso),x:q[0],y:q[1]};changed();return}
 if(['road','sidewalk','house'].includes(state.tool)){
  if(state.working.length>=3&&dist(q,state.working[0])<10/view.zoom){finishPolygon();return}
  state.working.push(q);requestDraw();return;
 }
 if(state.tool==='people'){snapshot();addPerson(q);state.drag={action:'people'};return}
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
 if(!state.drag){requestDraw();return}
 const a=state.drag,dx=(pos[0]-a.pos[0])/view.zoom,dy=-(pos[1]-a.pos[1])/view.zoom;
 if(a.action==='pan'){view.cx-=dx;view.cy-=dy;a.pos=pos;requestDraw();return}
 if(a.action==='reference'&&state.reference){state.reference.position[0]+=dx;state.reference.position[1]+=dy;a.pos=pos;requestDraw();return}
 if(a.action==='people'){if(!last||dist(pos,last)>2)addPerson(q);return}
 if(a.action==='erase'){eraseAt(q);return}
 if(a.action==='paso'){state.paso.x=q[0];state.paso.y=q[1];changed();return}
 if(a.action==='select'){
  const item=data[a.selection.type]?.[a.selection.index];if(!item)return;
  if(item.poly){
   if(a.selection.vertex>=0){item.poly[a.selection.vertex]=q.map(x=>+x.toFixed(3))}
   else for(const p of item.poly){p[0]+=dx;p[1]+=dy}
  }else if(item.point){item.point=q.map(x=>+x.toFixed(3))}
  a.pos=pos;changed();
 }
}
function pointerUp(e){
 state.pointers.delete(e.pointerId);
 if(state.pointers.size<2)state.pinch=null;
 if(!state.pointers.size)state.drag=null;
}
function downloadJSON(){
 const output={...data,metadata:{...data.metadata,exportedAt:new Date().toISOString()}};
 const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='arenal-mapa-manual-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);show('Archivo JSON exportado. Puedes pasármelo para incorporarlo al juego.','good');
}
function setData(loaded){
 if(!loaded||!Array.isArray(loaded.roads)||!Array.isArray(loaded.houses)||!Array.isArray(loaded.sidewalks)||!Array.isArray(loaded.people))throw new Error('El archivo no contiene un diseño del Arenal válido.');
 for(const type of ['roads','houses','sidewalks'])
  if(loaded[type].some(p=>!Array.isArray(p.poly)||p.poly.length<3||p.poly.some(x=>!Array.isArray(x)||!Number.isFinite(x[0])||!Number.isFinite(x[1]))))throw new Error('Hay polígonos inválidos en '+type);
 data=loaded;state.selected=null;state.history=[];state.future=[];
 if(!data.paso)data.paso={x:ARENAL_ROUTE.start.position[0],y:ARENAL_ROUTE.start.position[1],angle:ARENAL_ROUTE.start.angle||147};
 if(!data.checkpoint)data.checkpoint=[...BARATILLO.position];
 if(!data.labels)data.labels=[];
 state.paso={...data.paso};changed();
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
 const parent=$('palettes');parent.innerHTML='';
 for(const id of [569,416,463,480,495,562,566,581,554]){
  const key='sharedassets2.assets:'+id,button=document.createElement('button');
  button.className='swatch'+(state.material===key?' chosen':'');button.title='Edificio original '+id;button.type='button';
  const image=document.createElement('img');image.src='./assets/original-animation/sprite-'+id+'.webp';image.alt='Tejado '+id;
  button.appendChild(image);button.onclick=()=>{state.material=key;palette();requestDraw()};
  parent.appendChild(button);
 }
 const audience=$('public-sprite');audience.innerHTML='';
 const ids=[379,596,549,427,419,426,418,380,508,386,607,516,394,458,454,423,428,391];
 for(const id of ids){
  const key='sharedassets2.assets:'+id;if(!sprites[key])continue;
  const op=document.createElement('option');op.value=key;op.textContent='Persona '+id;audience.appendChild(op);
 }
 audience.value=state.audience;audience.onchange=()=>{state.audience=audience.value};
}
function bind(){
 for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>configureTool(button.dataset.tool);
 for(const id of ['grid-on','labels-on','houses-on','roads-on','sidewalks-on','public-on','paso-on'])$(id).onchange=requestDraw;
 $('finish-shape').onclick=finishPolygon;
 $('cancel-shape').onclick=()=>{state.working=[];requestDraw()};
 $('delete').onclick=()=>{
  if(!state.selected){show('Selecciona una casa, calle, acera o persona.','error');return}
  snapshot();data[state.selected.type].splice(state.selected.index,1);state.selected=null;changed();
 };
 $('undo').onclick=undo;$('redo').onclick=redo;
 $('save').onclick=saveLocal;$('export').onclick=downloadJSON;
 $('import').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const obj=JSON.parse(await file.text());setData(obj);show('Mapa importado. No altera el juego publicado.','good')}
  catch(err){show('No se pudo importar: '+err.message,'error')}
  e.target.value='';
 };
 $('reset').onclick=()=>{
  if(!confirm('¿Volver a la versión de partida del editor? Exporta antes tu trabajo si quieres conservarlo.'))return;
  snapshot();data=JSON.parse(JSON.stringify(baseline));state.selected=null;changed();
 };
 $('brush-size').oninput=()=>{$('brush-value').textContent=Number($('brush-size').value).toFixed(2)+' m'};
 $('goto-start').onclick=()=>focusAt(...ARENAL_ROUTE.start.position,45);
 $('goto-chapel').onclick=()=>focusAt(...BARATILLO.position,48);
 $('goto-all').onclick=()=>focusAt(39.4,41,Math.min(view.w/37,view.h/43));
 $('zoom-in').onclick=()=>zoomAt(1.3);$('zoom-out').onclick=()=>zoomAt(1/1.3);
 $('paso-left').onclick=()=>{state.paso.angle=(state.paso.angle-5+360)%360;changed()};
 $('paso-right').onclick=()=>{state.paso.angle=(state.paso.angle+5)%360;changed()};
 $('reference-file').onchange=e=>{
  const f=e.target.files?.[0];if(!f)return;
  const url=URL.createObjectURL(f),im=new Image();
  im.onload=()=>{state.reference={image:im,position:[view.cx-6,view.cy-5],width:12,height:12*im.naturalHeight/im.naturalWidth};requestDraw();show('Foto cargada. Usa «Ajustar foto» para desplazarla y la escala para cuadrarla.','good')};
  im.src=url;e.target.value='';
 };
 $('reference-opacity').oninput=e=>{state.referenceOpacity=Number(e.target.value)/100;requestDraw()};
 $('reference-scale').oninput=e=>{state.referenceScale=Number(e.target.value)/100;requestDraw()};
 $('reference-clear').onclick=()=>{state.reference=null;requestDraw()};
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
async function init(){
 try{
  show('Cargando geometría y sprites auténticos del APK…');
  const response=await fetch('./assets/original-animation.json');
  if(!response.ok)throw Error('No se pudo cargar el catálogo original HTTP '+response.status);
  const animation=await response.json();sprites=animation.sprites;
  for(const key of [...HOUSE_KEYS,FLOOR_KEY,'sharedassets2.assets:379'])spriteFor(key);
  baseline=prepareMap(animation);
  let saved=null;try{saved=JSON.parse(localStorage.getItem(STORAGE)||'null')}catch{}
  setData(saved?.schema===baseline.schema?saved:baseline);
  palette();bind();configureTool('pan');resize();focusAt(...ARENAL_ROUTE.start.position,36);
  show(saved?.schema===baseline.schema?'He recuperado tu edición guardada.':'Mapa del juego cargado: ya puedes editarlo.','good');
  $('loading').hidden=true;
 }catch(err){show('Error preparando el editor: '+err.message,'error');$('loading').textContent='No se ha podido cargar el editor. '+err.message}
}
init();
