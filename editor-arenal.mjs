import {ARENAL_MAP,ARENAL_ROUTE,BARATILLO} from './arenal-data.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {buildArenalRoad,buildArenalCrowd,buildArenalSidewalks,buildArenalHouses} from './arenal-layers.mjs';

const $=id=>document.getElementById(id);
const canvas=$('map'),ctx=canvas.getContext('2d',{alpha:false});
const format='a-pulso-arenal-editor-v1';
const STORAGE_KEY='a-pulso:editor-arenal:v1';
const HOUSE_KEYS=NATIVE_HOUSE_KEYS;
const CROWD_KEYS=[379,596,549,427,419,426,418,380,423,428,391,607,516,508,386,457,481,454,394,458]
  .map(n=>'sharedassets2.assets:'+n);
const ROAD_TEXTURE='sharedassets2.assets:373';
const COLORS={road:'#414b51',sidewalk:'#9c9894',house:'#b9805c',crowd:'#f0d986'};
const TOOL_NAMES={select:'Seleccionar',pan:'Mover vista',road:'Dibujar calzada',crowd:'Pincel de público',sidewalk:'Dibujar acera',house:'Dibujar edificio',erase:'Borrar',test:'Probar el paso'};
const HINTS={select:'Toca una figura para moverla. Arrastra sus vértices.',pan:'Arrastra para mover el mapa; rueda o ± para zoom.',road:'Marca esquinas de la calle y pulsa Terminar figura.',crowd:'Arrastra para pintar público con sprites originales.',sidewalk:'Dibuja el borde de la acera punto a punto.',house:'Elige una textura, dibuja la parcela y ciérrala.',erase:'Toca o arrastra para borrar público y figuras.',test:'Arrastra el paso; usa el ángulo para comprobar sus giros.'};
const images=new Map(),pendingImages=new Map(),imageData=new Map();
let animationData=null;
const state={
 model:null,tool:'select',texture:HOUSE_KEYS[0],person:CROWD_KEYS[0],selected:null,
 pending:[],view:{x:40,y:40,zoom:16},undo:[],redo:[],stamp:null,drag:null,
 pointers:new Map(),pinch:null,dirty:false,lastEdit:0,saved:false,
 visible:{road:true,crowd:true,sidewalk:true,house:true},grid:true,showPaso:true,showRefs:true,
 paso:{point:[46.73,33.02],heading:147},brush:.28,density:2,
 photo:null,photoBounds:{x:33,y:31,w:13,h:14},photoOpacity:.42
};
function notify(msg){
 const el=$('toast');el.textContent=msg;el.style.display='block';
 clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.style.display='none',3700);
}
function uuid(prefix){return prefix+'-'+Math.random().toString(36).slice(2,11);}
function imageFor(key){
 if(!key)return null;
 if(images.has(key))return images.get(key);
 if(!pendingImages.has(key)){
  const im=new Image();im.decoding='async';
  im.onload=()=>{images.set(key,im);pendingImages.delete(key);render();};
  im.onerror=()=>{pendingImages.delete(key);};
  pendingImages.set(key,im);
  const id=String(key).split(':').pop();
  im.src='./assets/original-animation/sprite-'+id+'.webp';
 }
 return null;
}
function clone(v){return JSON.parse(JSON.stringify(v));}
function emptyMap(){return{format,title:'Regreso por el Arenal',coordinateSystem:'original-unit-y-up',step:{width:1.0386,length:2.15},chapel:[...BARATILLO.position],createdAt:new Date().toISOString(),road:[],crowd:[],sidewalk:[],house:[]};}
function isPoint(p){return Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e5);}
function validPoly(p){return Array.isArray(p)&&p.length>=3&&p.length<300&&p.every(isPoint);}
function checkAndClean(input){
 if(!input||!Array.isArray(input.road)||!Array.isArray(input.crowd)||!Array.isArray(input.sidewalk)||!Array.isArray(input.house))throw Error('Archivo sin las capas road, crowd, sidewalk y house');
 const out=emptyMap();out.title=String(input.title||out.title).slice(0,100);
 for(const type of ['road','sidewalk','house']){
  if(input[type].length>4000)throw Error('Demasiados polígonos');
  out[type]=input[type].filter(it=>validPoly(it.poly)).map(it=>({id:String(it.id||uuid(type)).slice(0,100),poly:clone(it.poly),key:String(it.key||HOUSE_KEYS[0]).slice(0,90)}));
 }
 if(input.crowd.length>30000)throw Error('Demasiado público');
 out.crowd=input.crowd.filter(p=>isPoint(p.point)).map(p=>({id:String(p.id||uuid('p')).slice(0,90),point:[...p.point],key:String(p.key||CROWD_KEYS[0]).slice(0,90)}));
 return out;
}
function snapshot(){return JSON.stringify(state.model);}
function checkpoint(previous){
 const before=previous||snapshot();
 if(state.undo.at(-1)!==before){state.undo.push(before);if(state.undo.length>28)state.undo.shift();}
 state.redo.length=0;changed();
}
function changed(){
 state.dirty=true;state.lastEdit=Date.now();state.saved=false;counts();render();saveLocal();
}
function saveLocal(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({model:state.model,paso:state.paso}));state.saved=true;}
 catch(err){state.saved=false;notify('Memoria del navegador llena: exporta tu JSON para no perder el mapa.');}
}
function undo(){
 if(!state.undo.length)return;
 state.redo.push(snapshot());state.model=JSON.parse(state.undo.pop());state.selected=null;state.pending=[];changed();
}
function redo(){
 if(!state.redo.length)return;
 state.undo.push(snapshot());state.model=JSON.parse(state.redo.pop());state.selected=null;state.pending=[];changed();
}
function count(type){return state.model?.[type]?.length||0;}
function counts(){
 $('counts').textContent='Calzadas: '+count('road')+' · Aceras: '+count('sidewalk')+'\nEdificios: '+count('house')+' · Personas: '+count('crowd');
 $('hudStatus').textContent=(state.saved?'Guardado en este navegador':'Cambios sin exportar')+'\n'+(state.model?'Personas '+count('crowd')+' · '+Math.round(state.view.zoom)+' px/m':'Cargando...');
 $('undo').disabled=!state.undo.length;$('redo').disabled=!state.redo.length;
 const type=state.selected?.type;
 const entity=type?state.model[type]?.find(x=>x.id===state.selected.id):null;
 $('selectedInfo').textContent=entity?(type==='crowd'?'Persona individual':({road:'Calzada',sidewalk:'Acera',house:'Casa'}[type]))+' seleccionada · '+entity.id.slice(-6):'Toca una figura para moverla o editar sus esquinas.';
}
function spriteColor(key){return key===ROAD_TEXTURE?COLORS.road:COLORS.house;}
function pointIn(poly,p){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}
function segCross(a,b,c,d){
 const cc=(x,y,z)=>(y[0]-x[0])*(z[1]-x[1])-(y[1]-x[1])*(z[0]-x[0]);
 return cc(a,b,c)*cc(a,b,d)<-1e-9&&cc(c,d,a)*cc(c,d,b)<-1e-9;
}
function intersects(a,b){
 if(a.some(p=>pointIn(b,p))||b.some(p=>pointIn(a,p)))return true;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)
  if(segCross(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
 return false;
}
function convexArea(poly){return Math.abs(poly.reduce((t,p,i)=>{let q=poly[(i+1)%poly.length];return t+p[0]*q[1]-q[0]*p[1]},0)/2);}
function hasSelfCross(poly){
 for(let i=0;i<poly.length;i++)for(let j=i+2;j<poly.length;j++){
  if(i===0&&j===poly.length-1)continue;
  if(segCross(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))return true;
 }
 return false;
}
function bounds(poly){
 let x=Infinity,y=Infinity,xx=-Infinity,yy=-Infinity;
 for(const p of poly){x=Math.min(x,p[0]);y=Math.min(y,p[1]);xx=Math.max(xx,p[0]);yy=Math.max(yy,p[1]);}
 return[x,y,xx,yy];
}
function spriteRect(poly,key){
 const bb=bounds(poly),sprite=imageFor(key);return {bb,img:sprite};
}
function screen([x,y]){
 return [canvas.clientWidth/2+(x-state.view.x)*state.view.zoom,
 canvas.clientHeight/2-(y-state.view.y)*state.view.zoom];
}
function world([x,y]){
 return [state.view.x+(x-canvas.clientWidth/2)/state.view.zoom,
 state.view.y-(y-canvas.clientHeight/2)/state.view.zoom];
}
function eventPoint(ev){const r=canvas.getBoundingClientRect();return[ev.clientX-r.left,ev.clientY-r.top];}
function circleDistance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function trace(poly){
 if(!poly?.length)return;
 ctx.beginPath();poly.forEach((p,i)=>{const [x,y]=screen(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();
}
function drawPoly(poly,color,imgKey,alpha=1){
 if(!poly?.length)return;
 const [x,y,xx,yy]=bounds(poly),[left,top]=screen([x,yy]),[right,bottom]=screen([xx,y]);
 if(right<-25||left>canvas.clientWidth+25||bottom<-25||top>canvas.clientHeight+25)return;
 ctx.save();trace(poly);ctx.clip();ctx.globalAlpha=alpha;
 if(imgKey){
  const image=imageFor(imgKey);
  ctx.fillStyle=color;ctx.fill();
  if(image)ctx.drawImage(image,left,top,Math.max(1,right-left),Math.max(1,bottom-top));
 }else{ctx.fillStyle=color;ctx.fill()}
 ctx.restore();
}
function drawFloor(poly){
 drawPoly(poly,COLORS.road);
 const atlas=imageFor(ROAD_TEXTURE);if(!atlas)return;
 ctx.save();trace(poly);ctx.clip();ctx.globalAlpha=.46;
 const b=bounds(poly),period=1.1;
 for(let x=Math.floor(b[0]/period)*period;x<b[2]+period;x+=period)
  for(let y=Math.floor(b[1]/period)*period;y<b[3]+period;y+=period){
   const p=screen([x,y+period]);
   ctx.drawImage(atlas,322,40,110,110,p[0],p[1],period*state.view.zoom,period*state.view.zoom);
  }
 ctx.restore();
}
function drawGrid(){
 if(!state.grid)return;
 const step=state.view.zoom<13?2:1,tl=world([0,0]),br=world([canvas.clientWidth,canvas.clientHeight]);
 const minX=Math.floor(tl[0]/step)*step,maxX=Math.ceil(br[0]/step)*step;
 const minY=Math.floor(br[1]/step)*step,maxY=Math.ceil(tl[1]/step)*step;
 ctx.beginPath();
 for(let x=minX;x<=maxX;x+=step){const sx=screen([x,0])[0];ctx.moveTo(sx,0);ctx.lineTo(sx,canvas.clientHeight)}
 for(let y=minY;y<=maxY;y+=step){const sy=screen([0,y])[1];ctx.moveTo(0,sy);ctx.lineTo(canvas.clientWidth,sy)}
 ctx.strokeStyle='#b9d5d512';ctx.lineWidth=1;ctx.stroke();
}
function drawCrowd(){
 if(!state.visible.crowd)return;
 const size=Math.max(3,state.view.zoom*.19),r=state.view.zoom;
 const atlasFilter={};
 for(const p of state.model.crowd){
  const [x,y]=screen(p.point);
  if(x<-size||x>canvas.clientWidth+size||y<-size||y>canvas.clientHeight+size)continue;
  const im=imageFor(p.key);
  if(im)ctx.drawImage(im,x-size/2,y-size/2,size,size);
  else{ctx.fillStyle=COLORS.crowd;ctx.fillRect(x-size/3,y-size/3,size*.65,size*.65)}
 }
}
function pasoPolygon(){
 const p=state.paso.point,t=(state.paso.heading-90)*Math.PI/180;
 const u=[Math.cos(t),Math.sin(t)],n=[-u[1],u[0]],hw=.5193,hl=1.075;
 return [[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].map(([a,b])=>[p[0]+n[0]*a+u[0]*b,p[1]+n[1]*a+u[1]*b]);
}
function stepValidity(poly){
 if(!state.model)return true;
 const steps=[...poly,...poly.map((p,i)=>[(p[0]+poly[(i+1)%4][0])/2,(p[1]+poly[(i+1)%4][1])/2]),state.paso.point];
 const roadCoverage=steps.every(p=>state.model.road.some(x=>pointIn(x.poly,p)));
 const peopleContact=state.model.crowd.some(p=>pointIn(poly,p.point));
 const buildingsContact=state.model.house.some(h=>intersects(poly,h.poly));
 return roadCoverage&&!peopleContact&&!buildingsContact;
}
function drawPaso(){
 if(!state.showPaso)return;
 const shape=pasoPolygon(),valid=stepValidity(shape);
 ctx.save();trace(shape);ctx.fillStyle=valid?'#57edaa3d':'#ed535b51';ctx.fill();
 ctx.strokeStyle=valid?'#66f5ac':'#ff5662';ctx.lineWidth=2;ctx.stroke();
 const tip=screen(shape[2]);ctx.fillStyle=valid?'#66f5ac':'#ff5662';ctx.beginPath();ctx.arc(tip[0],tip[1],4,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
function drawLabels(){
 if(!state.showRefs)return;
 const labels=[['Arfe',[46.25,33.05]],['Adriano',[43.5,34.9]],['Baratillo',BARATILLO.position],['Pastor y Landero',[39.1,45]],['Reyes Católicos',[40,49.6]]];
 ctx.textAlign='center';ctx.font='bold 12px system-ui';
 for(const [txt,pos]of labels){
  const [x,y]=screen(pos);if(x<0||y<0||x>canvas.clientWidth||y>canvas.clientHeight)continue;
  ctx.strokeStyle='#07242abe';ctx.lineWidth=3;ctx.strokeText(txt,x,y);
  ctx.fillStyle='#d7f5dc';ctx.fillText(txt,x,y);
 }
}
function drawPending(){
 if(!state.pending.length)return;
 const poly=state.pending;
 ctx.save();ctx.beginPath();poly.forEach((p,i)=>{const [x,y]=screen(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
 ctx.strokeStyle='#a9fceb';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.stroke();ctx.setLineDash([]);
 for(const p of poly){const [x,y]=screen(p);ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#80ffd3';ctx.fill()}
 ctx.restore();
}
function drawSelection(){
 const s=state.selected;if(!s)return;
 const obj=state.model[s.type]?.find(x=>x.id===s.id);if(!obj)return;
 if(s.type==='crowd'){
  const [x,y]=screen(obj.point);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x-8,y-8,16,16);
  return;
 }
 ctx.save();trace(obj.poly);ctx.strokeStyle='#fbdf84';ctx.lineWidth=2.5;ctx.stroke();
 for(const q of obj.poly){const [x,y]=screen(q);ctx.fillStyle='#f9db81';ctx.fillRect(x-5,y-5,10,10)}
 ctx.restore();
}
function drawPhoto(){
 if(!state.photo)return;
 const b=state.photoBounds,[x,y]=screen([b.x,b.y+b.h]);
 ctx.save();ctx.globalAlpha=state.photoOpacity;
 ctx.drawImage(state.photo,x,y,b.w*state.view.zoom,b.h*state.view.zoom);
 ctx.restore();
}
function render(){
 if(!state.model)return;
 const W=canvas.clientWidth,H=canvas.clientHeight;if(W<1||H<1)return;
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#6d7071';ctx.fillRect(0,0,W,H);
 drawPhoto();drawGrid();ctx.imageSmoothingEnabled=false;
 if(state.visible.house)for(const p of state.model.house)drawPoly(p.poly,COLORS.house,p.key);
 if(state.visible.sidewalk)for(const p of state.model.sidewalk){
  drawPoly(p.poly,COLORS.sidewalk);
  const [x,y,xx,yy]=bounds(p.poly);ctx.save();trace(p.poly);ctx.clip();
  ctx.strokeStyle='#bab7aa7c';ctx.lineWidth=.6;
  for(let a=Math.floor(x/.25)*.25;a<xx;a+=.25){ctx.beginPath();let A=screen([a,y]),B=screen([a,yy]);ctx.moveTo(...A);ctx.lineTo(...B);ctx.stroke()}
  for(let b=Math.floor(y/.25)*.25;b<yy;b+=.25){ctx.beginPath();let A=screen([x,b]),B=screen([xx,b]);ctx.moveTo(...A);ctx.lineTo(...B);ctx.stroke()}
  ctx.restore();
 }
 if(state.visible.road)for(const p of state.model.road)drawFloor(p.poly);
 drawCrowd();drawLabels();drawPaso();drawSelection();drawPending();
 if(state.drag?.kind==='crowd'&&state.stamp){const [x,y]=screen(state.stamp);ctx.strokeStyle='#91edba';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,state.brush*state.view.zoom,0,Math.PI*2);ctx.stroke()}
}
function resize(){
 const dpr=Math.min(3,window.devicePixelRatio||1),r=canvas.getBoundingClientRect();
 canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));
 ctx.setTransform(dpr,0,0,dpr,0,0);render();
}
function fit(){
 const b=[26,24,54,59],w=canvas.clientWidth,h=canvas.clientHeight;
 state.view.x=(b[0]+b[2])/2;state.view.y=(b[1]+b[3])/2;
 state.view.zoom=Math.max(7,Math.min(85,(w-40)/(b[2]-b[0]),(h-35)/(b[3]-b[1])));
 render();counts();
}
function zoom(factor,around=[canvas.clientWidth/2,canvas.clientHeight/2]){
 const old=world(around);state.view.zoom=Math.max(5,Math.min(190,state.view.zoom*factor));
 const after=world(around);state.view.x+=old[0]-after[0];state.view.y+=old[1]-after[1];render();counts();
}
function setTool(name){
 state.tool=name;state.pending=[];
 for(const el of document.querySelectorAll('[data-tool]'))el.classList.toggle('active',el.dataset.tool===name);
 $('currentTool').textContent=TOOL_NAMES[name];$('toolHint').textContent=HINTS[name];
 $('finishPoly').disabled=!['road','sidewalk','house'].includes(name);
 $('cancelPoly').disabled=state.pending.length===0;render();
}
function findHit(w){
 if(!state.model)return null;
 const crowd=state.model.crowd,limit=.18+8/state.view.zoom;
 if(state.visible.crowd)for(let i=crowd.length-1;i>=0;i--){
  if(circleDistance(w,crowd[i].point)<limit)return {type:'crowd',id:crowd[i].id,vertex:-1};
 }
 for(const type of ['house','sidewalk','road']){
  if(!state.visible[type])continue;
  const arr=state.model[type];
  for(let i=arr.length-1;i>=0;i--){
   const poly=arr[i].poly;
   for(let v=0;v<poly.length;v++)if(circleDistance(w,poly[v])<9/state.view.zoom)
    return {type,id:arr[i].id,vertex:v};
   if(pointIn(poly,w))return {type,id:arr[i].id,vertex:-1};
  }
 }
 return null;
}
function paintCrowd(w){
 const key=state.person;
 if(!state.model)return;
 const r=state.brush,dens=state.density,step=dens===3?.145:dens===2?.19:.25;
 let accepted=0;
 for(let dx=-r;dx<=r;dx+=step)for(let dy=-r;dy<=r;dy+=step){
  if(dx*dx+dy*dy>r*r+1e-9)continue;
  const pt=[w[0]+dx,w[1]+dy];
  if(state.model.house.some(h=>pointIn(h.poly,pt)))continue;
  if(state.model.crowd.some(p=>Math.abs(p.point[0]-pt[0])<.095&&Math.abs(p.point[1]-pt[1])<.095))continue;
  state.model.crowd.push({id:uuid('publico'),point:pt,key});accepted++;
  if(state.model.crowd.length>=18000)return;
 }
 if(accepted){state.dirty=true;render();}
}
function eraseAt(w){
 const hit=findHit(w);if(!hit)return;
 const a=state.model[hit.type],i=a.findIndex(p=>p.id===hit.id);
 if(i>=0)a.splice(i,1);state.selected=null;render();
}
function dragSelected(delta,origin){
 const info=state.selected;if(!info)return;
 const obj=state.model[info.type].find(x=>x.id===info.id);if(!obj)return;
 if(info.type==='crowd'){
  obj.point=[origin.point[0]+delta[0],origin.point[1]+delta[1]];return;
 }
 if(info.vertex>=0){
  const poly=clone(origin.poly);poly[info.vertex]=[poly[info.vertex][0]+delta[0],poly[info.vertex][1]+delta[1]];
  obj.poly=poly;return;
 }
 obj.poly=origin.poly.map(p=>[p[0]+delta[0],p[1]+delta[1]]);
}
function finishPolygon(){
 const type=state.tool;
 if(!['road','sidewalk','house'].includes(type))return;
 const poly=clone(state.pending);
 if(poly.length<3){notify('Necesitas al menos tres puntos.');return}
 if(convexArea(poly)<.045||hasSelfCross(poly)){notify('Polígono incorrecto: evita cruces y figuras demasiado pequeñas.');return}
 // A building is never allowed to replace road, pavement or people.
 if(type==='house'&&(
  [...state.model.road,...state.model.sidewalk].some(x=>intersects(poly,x.poly))||
  state.model.crowd.some(p=>pointIn(poly,p.point)))){
  notify('Casa rechazada: aquí hay calzada, acera o público.');return;
 }
 if(type==='sidewalk'&&state.model.road.some(x=>intersects(poly,x.poly))){
  notify('Acera rechazada: no debe invadir la calzada.');return;
 }
 const old=snapshot();
 state.model[type].push({id:uuid(type),poly,key:type==='house'?state.texture:null});
 state.pending=[];checkpoint(old);state.selected={type,id:state.model[type].at(-1).id,vertex:-1};
 counts();notify('Figura añadida.');render();
}
function deleteSelection(){
 if(!state.selected)return;
 const before=snapshot(),info=state.selected,arr=state.model[info.type],i=arr.findIndex(x=>x.id===info.id);
 if(i>=0){arr.splice(i,1);state.selected=null;checkpoint(before)}
}
function pickTexture(key){
 state.texture=key;for(const button of document.querySelectorAll('.swatchButton'))button.classList.toggle('active',button.dataset.key===key);
 if(state.selected?.type==='house'){
  const shape=state.model.house.find(x=>x.id===state.selected.id);
  if(shape){const before=snapshot();shape.key=key;checkpoint(before);}
 }
}
function exportMap(){
 if(!state.model)return;
 const data=clone(state.model);
 data.updatedAt=new Date().toISOString();data.paso=clone(state.paso);
 data.editorVersion='1.0';data.textureSource='chicotaz-22.apk';
 const errors=[];
 for(const house of data.house){
  if(data.road.some(road=>intersects(house.poly,road.poly)))errors.push('Casa invade calzada');
  if(data.crowd.some(p=>pointIn(house.poly,p.point)))errors.push('Casa invade público');
 }
 if(errors.length&&!confirm('Detectados '+errors.length+' posibles conflictos entre capas. ¿Exportar igualmente?'))return;
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='A_PULSO_ARENAL_MAPA_MANUAL_'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 notify('Mapa exportado. Puedes enviarme el JSON para incorporarlo al juego.');
}
function makeSegment(m){
 const a=m.points[0],b=m.points[1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const t=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-t[1],t[0]],w=m.halfWidth;
 return{module:m,a,b,length:l,t,n,polygon:[
  [a[0]+n[0]*w,a[1]+n[1]*w],[b[0]+n[0]*w,b[1]+n[1]*w],
  [b[0]-n[0]*w,b[1]-n[1]*w],[a[0]-n[0]*w,a[1]-n[1]*w]
 ]};
}
async function loadGameMap(){
 const data=animationData||await (await fetch('./assets/original-animation.json')).json();
 animationData=data;
 const route={
  segments:ARENAL_MAP.modules.map(makeSegment),scene:{start:ARENAL_ROUTE.start,crowd:ARENAL_ROUTE.crowd},
  sim:{resources:{animation:{graphs:data.graphs}}},graph:{data:{sprites:data.sprites},nodes:new Map()},
  tileCache:{clear(){}},walkable:[],obstacles:[],people:[],sidewalks:[],buildings:[]
 };
 buildArenalRoad(route);buildArenalCrowd(route);buildArenalSidewalks(route);buildArenalHouses(route);
 const m=emptyMap();
 m.road=route.walkable.map(poly=>({id:uuid('road'),poly:clone(poly)}));
 m.sidewalk=route.sidewalks.map(({poly})=>({id:uuid('sidewalk'),poly:clone(poly)}));
 m.crowd=route.people.map(p=>({id:uuid('publico'),point:[...p.point],key:p.key}));
 m.house=route.buildings.map(p=>({id:uuid('house'),poly:clone(p.poly),key:p.key}));
 return m;
}
function selectNewMap(newMap){
 const old=state.model?snapshot():null;state.model=checkAndClean(newMap);
 state.selected=null;state.pending=[];if(old)checkpoint(old);else changed();
 counts();render();
}
function dragStart(ev){
 const point=eventPoint(ev),w=world(point);
 state.pointers.set(ev.pointerId,point);
 if(state.pointers.size===2){
  const pts=[...state.pointers.values()],mid=[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2];
  state.pinch={distance:circleDistance(...pts),mid,startZoom:state.view.zoom,startWorld:world(mid)};
  state.drag=null;return;
 }
 if(state.pointers.size>2)return;
 const t=state.tool;
 if(t==='pan'){state.drag={kind:'pan',point,center:[state.view.x,state.view.y]};return}
 if(t==='test'){state.drag={kind:'test',start:w,origin:[...state.paso.point]};state.paso.point=[...w];render();return}
 if(t==='crowd'){state.drag={kind:'crowd',before:snapshot()};state.stamp=w;paintCrowd(w);return}
 if(t==='erase'){state.drag={kind:'erase',before:snapshot()};eraseAt(w);return}
 if(['road','house','sidewalk'].includes(t)){
  if(state.pending.length>=3&&circleDistance(w,state.pending[0])<10/state.view.zoom)finishPolygon();
  else state.pending.push(w);
  $('cancelPoly').disabled=false;render();return;
 }
 const hit=findHit(w);
 state.selected=hit;counts();
 if(hit){
  const obj=state.model[hit.type].find(x=>x.id===hit.id);
  state.drag={kind:'object',start:w,original:clone(obj),before:snapshot(),moved:false};
 }else state.drag={kind:'pan',point,center:[state.view.x,state.view.y]};
 render();
}
function dragMove(ev){
 const point=eventPoint(ev);if(state.pointers.has(ev.pointerId))state.pointers.set(ev.pointerId,point);
 if(state.pinch&&state.pointers.size>=2){
  const pts=[...state.pointers.values()].slice(0,2),mid=[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2];
  const f=circleDistance(...pts)/Math.max(1,state.pinch.distance);
  state.view.zoom=Math.min(190,Math.max(5,state.pinch.startZoom*f));
  const now=world(mid);state.view.x+=state.pinch.startWorld[0]-now[0];state.view.y+=state.pinch.startWorld[1]-now[1];
  render();return;
 }
 const d=state.drag;if(!d||state.pointers.size>1)return;
 const w=world(point);
 if(d.kind==='pan'){
  state.view.x=d.center[0]-(point[0]-d.point[0])/state.view.zoom;
  state.view.y=d.center[1]+(point[1]-d.point[1])/state.view.zoom;render();
 }else if(d.kind==='crowd'){
  if(!state.stamp||circleDistance(w,state.stamp)>.12){state.stamp=w;paintCrowd(w)}
 }else if(d.kind==='erase'){eraseAt(w)}
 else if(d.kind==='test'){state.paso.point=w;render()}
 else if(d.kind==='object'){
  const delta=[w[0]-d.start[0],w[1]-d.start[1]];
  if(Math.hypot(...delta)>.016)d.moved=true;
  dragSelected(delta,d.original);render();
 }
}
function dragEnd(ev){
 state.pointers.delete(ev.pointerId);
 if(state.pointers.size<2)state.pinch=null;
 if(!state.drag)return;
 const d=state.drag;state.drag=null;state.stamp=null;
 if(d.kind==='crowd'||d.kind==='erase'||d.kind==='object'&&d.moved){
  if(snapshot()!==d.before)checkpoint(d.before);
 }else if(d.kind==='test')saveLocal();
 counts();render();
}
function wire(){
 for(const el of document.querySelectorAll('[data-tool]'))el.addEventListener('click',()=>setTool(el.dataset.tool));
 for(const el of document.querySelectorAll('[data-layer]'))el.addEventListener('change',()=>{state.visible[el.dataset.layer]=el.checked;render()});
 $('showGrid').onchange=e=>{state.grid=e.target.checked;render()};
 $('showPaso').onchange=e=>{state.showPaso=e.target.checked;render()};
 $('showRefs').onchange=e=>{state.showRefs=e.target.checked;render()};
 $('brush').oninput=e=>{state.brush=Number(e.target.value);$('brushLabel').textContent=state.brush.toFixed(2)+' m'};
 $('density').oninput=e=>{state.density=Number(e.target.value);$('densityLabel').textContent=['','Baja','Alta','Muy alta'][state.density]};
 $('rotation').oninput=e=>{state.paso.heading=Number(e.target.value);$('rotationLabel').textContent=state.paso.heading+'°';render();saveLocal()};
 $('finishPoly').onclick=finishPolygon;$('cancelPoly').onclick=()=>{state.pending=[];render();$('cancelPoly').disabled=true};
 $('undo').onclick=undo;$('redo').onclick=redo;
 $('deleteSelected').onclick=deleteSelection;
 $('bringFront').onclick=()=>{
  if(!state.selected)return;
  let obj=state.model[state.selected.type].find(x=>x.id===state.selected.id);
  if(!obj)return;const before=snapshot(),dup=clone(obj);dup.id=uuid(state.selected.type);
  if(dup.point)dup.point=dup.point.map(x=>x+.21);
  if(dup.poly)dup.poly=dup.poly.map(p=>p.map(x=>x+.21));
  state.model[state.selected.type].push(dup);state.selected={type:state.selected.type,id:dup.id,vertex:-1};checkpoint(before);
 };
 $('exportBtn').onclick=exportMap;
 $('importBtn').onclick=()=>$('importFile').click();
 $('importFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const obj=JSON.parse(await f.text());selectNewMap(obj);notify('Mapa importado correctamente');}
  catch(error){notify('No se ha podido importar: '+error.message)}
  e.target.value='';
 };
 $('resetFromGame').onclick=async()=>{
  if(!confirm('¿Restaurar el mapa actual del juego? Se sustituirá el contenido del editor (puedes deshacer).'))return;
  try{selectNewMap(await loadGameMap());notify('Mapa del juego restaurado')}catch(e){notify('Error al cargar mapa: '+e.message)}
 };
 $('onlyRoads').onclick=()=>{
  if(!confirm('¿Conservar solo las calzadas y borrar público, aceras y casas? Puedes deshacer.'))return;
  const before=snapshot();for(const t of ['crowd','sidewalk','house'])state.model[t]=[];
  checkpoint(before);notify('Ahora puedes construir el resto manualmente.');
 };
 $('clearLayer').onclick=()=>{
  let t=state.tool==='erase'||state.tool==='select'||state.tool==='pan'||state.tool==='test'?'crowd':state.tool;
  if(!confirm('¿Vaciar toda la capa «'+t+'»? Puedes deshacer.'))return;
  const before=snapshot();state.model[t]=[];checkpoint(before);
 };
 $('zoomIn').onclick=()=>zoom(1.25);$('zoomOut').onclick=()=>zoom(.8);$('zoomFit').onclick=fit;
 $('moreOptions').onclick=()=>{$('sidebar').classList.toggle('show-options')};
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);dragStart(e)});
 canvas.addEventListener('pointermove',dragMove);
 canvas.addEventListener('pointerup',dragEnd);
 canvas.addEventListener('pointercancel',dragEnd);
 canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(state.pending.length)finishPolygon()});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?.85:1.15,eventPoint(e))},{passive:false});
 document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
  if(typing)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();exportMap()}
  if(e.key==='Escape'){state.pending=[];state.selected=null;render()}
  if(e.key==='Enter'){e.preventDefault();finishPolygon()}
  if(e.key==='Delete'||e.key==='Backspace')deleteSelection();
 });
 const imgs=$('palette');
 for(const key of HOUSE_KEYS){
  const btn=document.createElement('button');btn.className='swatchButton tiny';btn.dataset.key=key;btn.title='Textura original '+key;
  const img=document.createElement('img');img.className='swatch';img.alt='Original '+key.split(':').at(-1);
  img.src='./assets/original-animation/sprite-'+key.split(':').pop()+'.webp';
  btn.append(img);btn.onclick=()=>pickTexture(key);imgs.append(btn);
 }
 pickTexture(HOUSE_KEYS[0]);
 const capture=document.createElement('button');capture.className='tiny';capture.textContent='📷 Guardar imagen PNG';
 document.querySelector('.headerActions').insertBefore(capture,$('exportBtn'));
 capture.onclick=()=>{const a=document.createElement('a');a.download='A_PULSO_ARENAL_PREVIA.png';a.href=canvas.toDataURL('image/png');a.click()};
 const aerial=document.createElement('button');aerial.className='tiny';aerial.textContent='🛰 Imagen aérea';
 document.querySelector('.headerActions').insertBefore(aerial,$('exportBtn'));
 const upload=document.createElement('input');upload.type='file';upload.accept='image/*';upload.hidden=true;document.body.append(upload);
 aerial.onclick=()=>upload.click();
 upload.onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  const im=new Image();im.onload=()=>{
   state.photo=im;
   const h=19,w=h*(im.width/im.height);
   state.photoBounds={x:state.view.x-w/2,y:state.view.y-h/2,w,h};render();
   notify('Imagen aérea añadida. En Opciones puedes ajustar su posición y opacidad.');
  };
  im.src=URL.createObjectURL(file);
 };
 const aerialOptions=document.createElement('div');aerialOptions.className='sideSection';
 aerialOptions.innerHTML='<h2>Imagen aérea de referencia</h2><div class="small">Superposición opcional para calcar calles y casas reales. La imagen se usa solo en este navegador.</div><label>Opacidad <input id="photoAlpha" type="range" min="0" max="1" step=".05" value=".42"></label><div class="row"><label>X <input id="photoX" type="number" step=".2" value="33"></label><label>Y <input id="photoY" type="number" step=".2" value="31"></label></div><label>Anchura en unidades <input id="photoW" type="number" step=".5" min=".5" value="13"></label>';
 $('sidebar').append(aerialOptions);
 for(const [id,k]of [['photoAlpha','opacity'],['photoX','x'],['photoY','y'],['photoW','w']]){
  $(id).addEventListener('input',e=>{
   const v=Number(e.target.value);
   if(k==='opacity')state.photoOpacity=v;
   else if(k==='w'){const ratio=state.photoBounds.w/state.photoBounds.h;state.photoBounds.w=v;state.photoBounds.h=v/ratio}
   else state.photoBounds[k]=v;
   render();
  });
 }
}
async function boot(){
 wire();setTool('select');resize();fit();
 try{
  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved){
   const j=JSON.parse(saved);state.model=checkAndClean(j.model);if(j.paso&&isPoint(j.paso.point)){state.paso=j.paso;$('rotation').value=state.paso.heading;$('rotationLabel').textContent=state.paso.heading+'°'}
   notify('Borrador recuperado de este navegador.');
  }else{
   state.model=checkAndClean(await loadGameMap());
   notify('Mapa actual cargado con los sprites originales. Ya puedes editarlo.');
   saveLocal();
  }
 }catch(e){
  console.error('Error al iniciar editor',e);
  state.model=emptyMap();
  notify('No se pudo precargar el mapa; el editor está vacío: '+e.message);
 }
 counts();render();
 for(const key of [...HOUSE_KEYS,...CROWD_KEYS,ROAD_TEXTURE])imageFor(key);
}
new ResizeObserver(resize).observe(canvas.parentElement);
boot();