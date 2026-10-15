import {setupCityManager} from './city-manager.mjs';
import {blankMapDocument,validateMapDocument,MAP_STORAGE_PREFIX,KINDS} from './city-project.mjs';
import {paintCityScene} from './city-scene.mjs';
import {loadSevilleTextures,onTextureReady} from './seville-textures.mjs';
import {ARENAL_MAP, ARENAL_ROUTE, BARATILLO} from './arenal-data.mjs';
import {buildArenalRoad,buildArenalCrowd,buildArenalSidewalks,buildArenalHouses} from './arenal-layers.mjs';
import {EDITOR_MAPS,DEFAULT_MAP,SCHEMA,buildEditorMap} from './editor-map-catalog.mjs';
import {createPhotoGuides} from './editor-photo-guides.mjs';
import {ROOF_MATERIALS,REALISTIC_ROOFS,SEVILLA_ROOFS,SEVILLA_NEIGHBOURHOOD_ROOFS,SEVILLA_ROOFS_BY_FAMILY,residentialSeed,LANDMARK_ROOF_MATERIALS,TEMPLE_ROOF_MATERIALS,ROAD_MATERIALS,SIDEWALK_MATERIALS,TREE_VARIANTS,roofById,drawRoof,drawSurface,drawTree,drawFurniture,NATIVE_ROOF_IDS} from './editor-materials.mjs';
import {makeGameDraft,GAME_PATCH_PREFIX} from './editor-game-draft.mjs';
import {setupMapPublishing} from './editor-publish.mjs';
import {makeCrowdStroke,picksInRectangle,unifySelections,translateSelections,deleteSelections,selectionGeometry,rotateSelections,captureSelection,mouseAngle,angleDelta} from './editor-interactions.mjs';
import {URBAN_ITEMS,urbanName,urbanIsMarking,urbanContains,newUrbanElement,crosswalkFromDrag,drawUrbanElement} from './editor-urban-elements.mjs';
import {nextRoofId} from './editor-roof-cycle.mjs';
import {pasoPoint,pasoFootprint,pasoRotationHandle,pasoFacingName} from './editor-paso-orientation.mjs';
import {personBlockedByTrees,visibleSpectators} from './editor-tree-crowd-clearance.mjs';
import {drawFacadeDecor,facadeVisualBounds} from './editor-facades.mjs';
import {setupVegetationPreviews} from './editor-vegetation-ui.mjs';
import {setupPlacementPreviews} from './editor-placement-previews.mjs';
import {drawTrafficSign,drawCheckpointGuide} from './editor-object-render.mjs';
let vegetationPreview,placementPreviews;
import {ROOF_BORDERS} from './editor-roof-borders.mjs';
import {setupVisualPanels} from './editor-visual-panels.mjs';
import {paintArenalGround} from './editor-arenal-ground.mjs';
import {streetTriggerRadius,drawStreetTriggerGuide} from './street-identifiers.mjs';

const $=id=>document.getElementById(id);
const canvas=$('editor-canvas'),ctx=canvas.getContext('2d',{alpha:false});
const HOUSE_KEYS=[569,416,463,480,495,562,566,581,554].map(i=>'sharedassets2.assets:'+i);
const FLOOR_KEY='sharedassets2.assets:373';
const LEGACY_STORAGE='apulso-arenal-manual-editor-v1';
const storageFor=key=>'apulso-universal-editor-v2:'+key;
const colors={road:'#45474d',sidewalk:'#aaa49a',bg:'#676863',selected:'#31d5ed',warning:'#ff6562'};
const getId=(key)=>String(key).split(':').at(-1);
const images=new Map();
const roofPreviewCache=new Map(); // Reuse drawings when switching roofs or adding many houses.
const view={cx:40,cy:42,zoom:24,w:900,h:650,dpr:1};
const state={tool:'pan',layer:'house',material:SEVILLA_NEIGHBOURHOOD_ROOFS[0].id,roadMaterial:ROAD_MATERIALS[0].id,sidewalkMaterial:SIDEWALK_MATERIALS[0].id,treeVariant:TREE_VARIANTS[0].id,treeIndex:0,peopleIndex:0,audience:'sharedassets2.assets:379',selected:null,selectedItems:[],working:[],history:[],future:[],busy:false,reference:null,referenceOpacity:.36,referenceScale:1,drag:null,pointers:new Map(),pinch:null,paso:null,unsaved:false};
let sprites={},data=null,baseline=null,frames=false,saveTimer=null,activeMap=DEFAULT_MAP,nativeMaps=[],animationData=null,photoGuides=null,visualPanels=null,cityManager=null;
const baselineCache=new Map();

function show(message,type='info'){
 const el=$('status');el.textContent=message;
 el.dataset.type=type;
}
function count(kind){return(data?.[kind]||[]).length}
function selectionContains(type,index){return state.selectedItems.some(o=>o.type===type&&o.index===index)}
function setSelection(items){
 state.selectedItems=unifySelections(items).filter(o=>data?.[o.type]?.[o.index]);
 state.selected=state.selectedItems.at(-1)||null;
 if(state.selected?.type==='labels'){
  const label=data.labels[state.selected.index];$('street-name-text').value=label?.[0]||'';
  $('street-trigger-radius').value=String(streetTriggerRadius(label));
 }
 if(state.selected?.type==='houses'&&state.selectedItems.length===1){
  const house=data.houses[state.selected.index];
  const savedDetail=['auto','none','patio','castillete','claraboya','instalaciones','terraza','lavadero'].includes(house.roofDetail)?house.roofDetail:'auto';
  $('roof-detail').value=savedDetail;
  $('roof-border').value=ROOF_BORDERS.some(b=>b.id===house.roofBorder)?house.roofBorder:'auto';
  const inset=Math.max(.035,Math.min(.075,Number(house.roofInset)||.05));
  $('roof-inset').value=String(inset);
  $('roof-inset-value').textContent=inset.toFixed(3).replace('.',',')+' m';
  previewRoofDetail();
 }
 updateCounts();visualPanels?.refreshSelected();cityManager?.refreshSelected();requestDraw();
}
function clearSelection(){setSelection([])}
function savedStart(){return data?.startPose||data?.paso}
function restorePreviewStart(){if(savedStart())state.paso={...savedStart()};updateStartStatus();requestDraw()}
function updateStartStatus(){
 if(!data)return;
 const start=savedStart(),fixed=!!data.startPose;
 $('start-status').textContent=fixed?'INICIO FIJADO: X '+start.x.toFixed(2)+' · Y '+start.y.toFixed(2)+' · '+start.angle.toFixed(1)+'° · frente hacia el '+pasoFacingName(start.angle):'Inicio original del mapa';
 updatePasoDirectionStatus();
 $('clear-start').disabled=!fixed;
}
function updatePasoDirectionStatus(){
 const p=state.paso||data?.paso;if(!p)return;
 const angle=((p.angle||0)%360+360)%360;
 $('paso-direction').textContent='AVANCE REAL: '+pasoFacingName(angle).toUpperCase()+' · '+angle.toFixed(1)+'° (motor del juego)';
}
function deleteSelected(){
 if(!state.selectedItems.length)return;
 snapshot();const n=deleteSelections(data,state.selectedItems);
 clearSelection();changed();show(n+' elementos eliminados de la selección.','good');
}
function updateCounts(){
 if(!data)return;
 $('counts').textContent=count('roads')+' calles · '+count('people')+' personas · '+count('sidewalks')+' aceras · '+count('houses')+' edificios · '+count('trees')+' árboles · '+count('signs')+' señales · '+count('checkpoints')+' controles · '+count('fences')+' vallas · '+count('chairs')+' sillas · '+count('labels')+' nombres · '+count('urban')+' urbanos';
 $('tool-name').textContent=({pan:'Mover plano',select:'Seleccionar',road:'Dibujar calzada',sidewalk:'Dibujar acera',house:'Dibujar edificio',people:'Pintar público','people-row':'Fila de público','street-name':'Nombre de calle',urban:'Urbanismo sevillano',tree:'Colocar árbol',fence:'Colocar valla roja',chair:'Colocar silla','fence-row':'Trazar fila de vallas','chair-row':'Trazar fila de sillas',sign:'Colocar señal',checkpoint:'Colocar checkpoint',erase:'Borrar',paso:'Probar paso',reference:'Ajustar fotografía'})[state.tool]||state.tool;
 const chosen=state.selectedItems.length;
 $('selection').textContent=chosen>1?chosen+' elementos seleccionados':state.selected?('Seleccionado: '+nameOf(state.selected.type)+' '+(state.selected.index+1)):'Sin selección';
 $('delete-selected').disabled=chosen===0;
 $('clear-selected').disabled=chosen===0;
}
function nameOf(type){return{roads:'Calle',sidewalks:'Acera',houses:'Edificio',people:'Persona',trees:'Árbol',fences:'Valla',chairs:'Silla',signs:'Señal',checkpoints:'Checkpoint',labels:'Nombre de calle',urban:'Elemento urbano'}[type]||type}
function snapshot(){
 if(!data)return;
 state.history.push(JSON.stringify(data));
 if(state.history.length>16)state.history.shift();
 state.future.length=0;
}
function changed(){
 state.unsaved=true;updateCounts();requestDraw();cityManager?.refresh();vegetationPreview?.sync();
 clearTimeout(saveTimer);saveTimer=setTimeout(saveLocal,900);
}
function saveLocal(){
 if(!data)return;
 try{localStorage.setItem(storageFor(activeMap),JSON.stringify(data));localStorage.setItem(GAME_PATCH_PREFIX+activeMap,JSON.stringify(makeGameDraft(data,baseline)));state.unsaved=false;cityManager?.saveIndex();updatePlayLink();show('Diseño guardado. Abre Juego ↗ en este mismo dominio para probar los cambios.','good');}
 catch(e){show('No se pudo guardar localmente: exporta el archivo JSON.','error')}
}
function undo(){
 if(!state.history.length)return;
 state.future.push(JSON.stringify(data));
 data=JSON.parse(state.history.pop());clearSelection();restorePreviewStart();changed();
}
function redo(){
 if(!state.future.length)return;
 state.history.push(JSON.stringify(data));
 data=JSON.parse(state.future.pop());clearSelection();restorePreviewStart();changed();
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
// Preview and validation share the same ground rules as the live game.
// Pavements are traversable, never impassable edges of the carriageway.
function onTraversableSurface(p){
 return (data?.roads||[]).some(o=>o.poly&&inPolygon(p,o.poly))
  ||(data?.sidewalks||[]).some(o=>o.poly&&inPolygon(p,o.poly));
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
function drawTexture(poly,key,fallback,variant=0,roofOptions={}){
 const b=rect(poly);if(!bboxHit(b,visualBounds()))return;
 const base=roofById(key),baseIndex=Math.max(0,NATIVE_ROOF_IDS.indexOf(Number(String(base.key).split(':').at(-1))));
 // Accept ALL registered roof material IDs, including the new 'realista-' family.
// Previously the editor silently replaced them with a native roof sprite.
const material=typeof key==='string'&&key!==''
 &&(key===base.id||/^(realista-|sevilla-|roof-|landmark-|temple-)/.test(key))
 ?base.id:'roof-'+baseIndex+'-'+variant%4;
 drawRoof(ctx,poly,material,pixel,getImage,view.zoom,roofOptions);
}
function drawFloor(poly,kind='roads',material=ROAD_MATERIALS[0].id){
 const b=rect(poly);if(!bboxHit(b,visualBounds()))return;
 drawSurface(ctx,poly,kind,material,pixel,view.zoom,getImage(FLOOR_KEY),visualBounds());
}
function drawPeople(){
 const v=visualBounds();
 for(let i=0;i<data.people.length;i++){
  const a=data.people[i],x=a.point[0],y=a.point[1];
  if(personBlockedByTrees(a,data.trees))continue;
  if(x<v[0]-.2||x>v[2]+.2||y<v[1]-.2||y>v[3]+.2)continue;
  const img=getImage(a.key),dims=spriteDims(a.key),p=pixel(x,y);
  const w=Math.max(2,dims[0]*view.zoom),h=Math.max(2,dims[1]*view.zoom);
  ctx.save();ctx.translate(...p);ctx.rotate(-(a.angle||0)*Math.PI/180);
  if(img){ctx.drawImage(img,-w/2,-h/2,w,h)}
  else{ctx.fillStyle='#d4a47c';ctx.beginPath();ctx.arc(0,0,Math.max(2,w/2),0,Math.PI*2);ctx.fill()}
  ctx.restore();
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
function renderStaticScene(){
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 ctx.imageSmoothingEnabled=false;ctx.fillStyle=colors.bg;ctx.fillRect(0,0,view.w,view.h);
 // Show the very same cobbled ground as the game wherever the Arenal
 // polygons leave an exposed gap. Keep Google Earth reference photos ABOVE
 // this backdrop, and preserve the grey canvas on every other map.
 if(data?.metadata?.mapKey==='RegresoArenal'&&$('roads-on')?.checked)
  paintArenalGround(ctx,pixel,view.zoom,visualBounds(),ARENAL_MAP.bounds);
 const showMaterialsAbovePhotos=$('surface-clear-preview')?.checked;
 photoGuides?.draw(showMaterialsAbovePhotos?'material-background':'background');
 if(!data)return;
 // Orden visual fijo: los tejados se pintan sobre aceras y calzada,
 // independientemente del orden de creación o del solapamiento de polígonos.
 // Existing Arenal polygons often have no material ID. Use the SAME
 // default in editor and playable map, never an index-dependent legacy
 // material that can randomly display flat asphalt or wrong paving.
 if(data.zoneRefs?.length&&cityManager){
  try{paintCityScene(ctx,cityManager.linkedScene(),pixel,view.zoom,getImage,visualBounds(),{labels:$('labels-on').checked})}
  catch(error){show(error.message,'error')}
 }
 const isArenal=data.metadata?.mapKey==='RegresoArenal';
 const roadDefault=isArenal?'road-art-granite':'road-art-granite';
 const curbDefault=isArenal?'sidewalk-art-caliza':'sidewalk-art-caliza';
 if($('roads-on').checked)for(let i=0;i<data.roads.length;i++){
  const o=data.roads[i];
  drawFloor(o.poly,'roads',o.material||roadDefault||ROAD_MATERIALS[i%12].id);
 }
 if($('sidewalks-on').checked){
  for(let i=0;i<data.sidewalks.length;i++){
   const o=data.sidewalks[i];
   drawFloor(o.poly,'sidewalks',o.material||curbDefault||SIDEWALK_MATERIALS[i%12].id);
  }
 }
 if($('houses-on').checked){
  for(let i=0;i<data.houses.length;i++){
   const o=data.houses[i];drawTexture(o.poly,o.material||o.key,'#b97357',i%4,o);
  }
  // Applied after the roof: balcony/awning/storefront decorations stay visible
  // without changing the original polygon, scale, physics or roof texture.
  for(const o of data.houses)if(o.facade&&bboxHit(facadeVisualBounds(o),visualBounds()))
   drawFacadeDecor(ctx,o,pixel,view.zoom);
 }
 if($('urban-on').checked)for(const o of data.urban||[])if(urbanIsMarking(o.type))drawUrbanElement(ctx,o,pixel,view.zoom);
 if($('public-on').checked)drawPeople();
 if($('trees-on').checked)for(const t of data.trees||[])drawTree(ctx,t,pixel,view.zoom,getImage);
 if($('fences-on').checked)for(const f of data.fences||[])drawFurniture(ctx,f,'fence',pixel,view.zoom);
 if($('chairs-on').checked)for(const c of data.chairs||[])drawFurniture(ctx,c,'chair',pixel,view.zoom);
 if($('signs-on').checked)for(const t of data.signs||[])drawTrafficSign(ctx,t,pixel,view.zoom);
 if($('urban-on').checked)for(const o of data.urban||[])if(!urbanIsMarking(o.type))drawUrbanElement(ctx,o,pixel,view.zoom);
 drawGrid();
 if(!showMaterialsAbovePhotos)photoGuides?.draw('overlay');
 if($('checkpoints-on').checked)for(const cp of data.checkpoints||[])drawCheckpointGuide(ctx,cp,pixel,view.zoom);
 if($('labels-on').checked)for(const label of data.labels)drawStreetTriggerGuide(ctx,label,pixel,view.zoom);
 if(data.startPose){
   const start=data.startPose,q=pixel(start.x,start.y),front=pasoPoint(start,0,.9),end=pixel(...front);
   ctx.save();ctx.strokeStyle='#f1c75b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q[0],q[1],11,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(...end);ctx.stroke();
   ctx.fillStyle='#f1c75b';ctx.font='bold 12px system-ui';ctx.fillText('INICIO',q[0]+15,q[1]-15);ctx.restore();
  }
}
// Maps, roofs, sprites and Google Earth photos rarely change on mouse hover.
// Reuse their rasterized frame for interaction previews instead of redrawing
// the entire scenery on every pointer event.
const staticMapCanvas=document.createElement('canvas');
const staticMapCtx=staticMapCanvas.getContext('2d',{alpha:false});
let staticMapDirty=true;
function draw(){
 frames=false;
 if(!view.w||!view.h)return;
 if(staticMapDirty||staticMapCanvas.width!==canvas.width||staticMapCanvas.height!==canvas.height){
  renderStaticScene();
  staticMapCanvas.width=canvas.width;
  staticMapCanvas.height=canvas.height;
  staticMapCtx.setTransform(1,0,0,1,0,0);
  staticMapCtx.drawImage(canvas,0,0);
  staticMapDirty=false;
 }else{
  ctx.setTransform(1,0,0,1,0,0);
  ctx.drawImage(staticMapCanvas,0,0);
 }
 ctx.setTransform(view.dpr,0,0,view.dpr,0,0);
 if(!data)return;
  if(state.drag?.action==='urban-mark'){
  const a=state.drag,o=crosswalkFromDrag(a.type,a.start,a.end,Number($('urban-depth').value));
  drawUrbanElement(ctx,o,pixel,view.zoom,true);
 }
 if(state.drag?.action==='people-row'){
  const a=state.drag,start=pixel(...a.start),end=pixel(...a.end),spacing=Math.max(.15,Number($('people-row-spacing').value)||.25);
  const span=dist(a.start,a.end),count=Math.min(180,Math.floor(span/spacing)+1);
  ctx.save();ctx.strokeStyle='#f3d07a';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<count;i++){const t=count<=1?0:i/(count-1),world=[a.start[0]+(a.end[0]-a.start[0])*t,a.start[1]+(a.end[1]-a.start[1])*t];if(personBlockedByTrees(world,data.trees))continue;const pos=pixel(...world);ctx.beginPath();ctx.arc(...pos,3,0,Math.PI*2);ctx.fillStyle='#ffdfa6';ctx.fill()}
  ctx.restore();
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
 for(const selection of state.selectedItems){
  const item=data[selection.type]?.[selection.index];
  if(!item)continue;
  ctx.strokeStyle=colors.selected;ctx.lineWidth=2;
  if(selection.type==='labels'&&Array.isArray(item)){
   const p=pixel(...item[1]);ctx.save();ctx.font='600 12px system-ui';const w=Math.max(22,ctx.measureText(item[0]).width);ctx.strokeRect(p[0]+3,p[1]-14,w+8,19);ctx.restore();
  }else if(item.poly){
   polygon(item.poly);ctx.stroke();
   if(state.selectedItems.length===1)for(const q of item.poly){const p=pixel(...q);ctx.fillStyle='#fff';ctx.fillRect(p[0]-4,p[1]-4,8,8)}
  }else if(item.point||item.position){
   if(selection.type==='fences'||selection.type==='chairs')drawFurniture(ctx,item,selection.type==='fences'?'fence':'chair',pixel,view.zoom,true);
    else if(selection.type==='urban')drawUrbanElement(ctx,item,pixel,view.zoom,true);
   else {const p=pixel(...(item.point||item.position));ctx.beginPath();ctx.arc(p[0],p[1],7,0,Math.PI*2);ctx.stroke()}
  }
 }
 if(state.tool==='select'&&state.selectedItems.length){
  const position=rotationHandlePosition();
  if(position){
   const [cx,hy]=position.handle,[ax,ay]=position.anchor;
   ctx.save();ctx.strokeStyle='#f4cd77';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(cx,hy);ctx.stroke();
   ctx.fillStyle='#142b36';ctx.beginPath();ctx.arc(cx,hy,12,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillStyle='#f8e4a6';ctx.fillText('↻',cx,hy+.5);ctx.restore();
  }
 }
 if(state.drag?.action==='marquee'){
  const {start,end}=state.drag,x=Math.min(start[0],end[0]),y=Math.min(start[1],end[1]),
   w=Math.abs(end[0]-start[0]),h=Math.abs(end[1]-start[1]);
  ctx.save();ctx.fillStyle='rgba(67,163,231,.17)';ctx.strokeStyle='#8bddff';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);
  ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore();
 }
 if(state.tool==='reference')photoGuides?.draw('handles');
 if(state.tool==='paso'||$('paso-on').checked)drawPaso();
 if(state.tool==='people'&&state.mouseWorld){
  const p=pixel(...state.mouseWorld);ctx.beginPath();ctx.arc(...p,.22*view.zoom,0,Math.PI*2);ctx.strokeStyle='#ffba57';ctx.lineWidth=2;ctx.stroke();
 }
}
function drawPaso(){
 const p=state.paso||data.paso;if(!p)return;
 const corners=pasoFootprint(p);if(!corners.length)return;
 updatePasoDirectionStatus();
 ctx.save();polygon(corners);
 ctx.fillStyle='rgba(108,59,151,.58)';ctx.fill();
 ctx.lineWidth=2.5;ctx.strokeStyle='#efc96e';ctx.stroke();
 const frontLine=[pasoPoint(p,-.5193,1.075),pasoPoint(p,.5193,1.075)];
 const backLine=[pasoPoint(p,-.5193,-1.075),pasoPoint(p,.5193,-1.075)];
 for(const [line,color] of [[frontLine,'#4af2ce'],[backLine,'#e89984']]){
  const a=pixel(...line[0]),b=pixel(...line[1]);
  ctx.strokeStyle=color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
 }
 // Forward arrow uses the same axis as sim.setAngle() in the native engine.
 const begin=pixel(...pasoPoint(p,0,.53)),tip=pixel(...pasoPoint(p,0,1.5));
 const dx=tip[0]-begin[0],dy=tip[1]-begin[1],n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n;
 ctx.beginPath();ctx.moveTo(...begin);ctx.lineTo(...tip);
 ctx.strokeStyle='#4af2ce';ctx.lineWidth=3.5;ctx.stroke();
 ctx.beginPath();ctx.moveTo(...tip);
 ctx.lineTo(tip[0]-ux*12-uy*6,tip[1]-uy*12+ux*6);
 ctx.lineTo(tip[0]-ux*12+uy*6,tip[1]-uy*12-ux*6);
 ctx.closePath();ctx.fillStyle='#4af2ce';ctx.fill();
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='bold 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#142331';
 const frontLabel=[tip[0]+ux*24,tip[1]+uy*24];ctx.strokeText('FRENTE',...frontLabel);ctx.fillStyle='#b7fff0';ctx.fillText('FRENTE',...frontLabel);
 const backLabel=pixel(...pasoPoint(p,0,-1.35));
 ctx.font='bold 10px system-ui';ctx.strokeText('TRASERA',...backLabel);ctx.fillStyle='#ffd6c0';ctx.fillText('TRASERA',...backLabel);
 const center=pixel(p.x,p.y);ctx.beginPath();ctx.arc(...center,3,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
 if(state.tool==='paso'){
  const handle=pasoRotationHandle(p,view.zoom,pixel);
  ctx.strokeStyle='#ffdc83';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(...handle);ctx.stroke();
  ctx.fillStyle='#142b36';ctx.beginPath();ctx.arc(...handle,12,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff1b9';ctx.font='bold 17px system-ui';ctx.fillText('↻',...handle);
  const okay=corners.every(onTraversableSurface);
  $('paso-test').textContent=!(data.roads.length+data.sidewalks.length)?'Dibuja calzada o acera bajo el paso':okay?'Paso sobre superficie transitable (calzada o acera)':'Paso fuera de la calzada y las aceras';
  $('paso-test').dataset.ok=okay?'yes':'no';
 }
 ctx.restore();
}
function requestDraw(overlayOnly=false){
 placementPreviews?.sync();
 if(!overlayOnly)staticMapDirty=true;
 if(!frames){frames=true;requestAnimationFrame(draw)}
}
function resize(){
 const r=canvas.getBoundingClientRect();
 view.w=Math.max(100,r.width);view.h=Math.max(100,r.height);
 // Electron uses its own CSS-scale canvas, but on HiDPI monitors painting
 // a 2× full-window image quadruples pixels and can cause severe lag.
 // This only changes raster density; geometry, world units and saved data
 // remain identical. Web editor retains existing density for browser users.
 view.dpr=location.protocol==='apulso:'?1:Math.min(2,devicePixelRatio||1);
 canvas.width=Math.round(view.w*view.dpr);canvas.height=Math.round(view.h*view.dpr);
 requestDraw();
}
function rotatePasoOnMobile(delta){
 if(!window.matchMedia('(max-width:850px), (max-height:600px) and (pointer:coarse)').matches)return;
 if(state.tool!=='paso'||!data)return;
 const p=state.paso||data.paso;
 if(!p)return;
 snapshot();
 state.paso={...p,angle:(((p.angle||0)+delta)%360+360)%360};
 changed();
 updatePasoDirectionStatus();
}
// Positive Unity angles turn the front toward the left/west.
$('mobile-step-left')?.addEventListener('click',()=>rotatePasoOnMobile(5));
$('mobile-step-right')?.addEventListener('click',()=>rotatePasoOnMobile(-5));

function configureTool(name){
 state.tool=name;state.working=[];state.drag=null;canvas.dataset.tool=name;
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
 if($('labels-on').checked){
  const c=pixel(...p);ctx.save();ctx.font='600 12px system-ui';
  for(let i=data.labels.length-1;i>=0;i--){
   const [name,loc]=data.labels[i]||[];if(!Array.isArray(loc)||!name)continue;
   const a=pixel(...loc),width=Math.max(22,ctx.measureText(name).width);
   if(Math.hypot(c[0]-a[0],c[1]-a[1])<=9||c[0]>=a[0]&&c[0]<=a[0]+width+13&&c[1]>=a[1]-19&&c[1]<=a[1]+9){ctx.restore();return{type:'labels',index:i,vertex:-1}}
  }
  ctx.restore();
 }

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
 if($('urban-on').checked)for(let i=(data.urban||[]).length-1;i>=0;i--){
  const item=data.urban[i];if(urbanContains(item,p,Math.max(.06,9/view.zoom)))return{type:'urban',index:i,vertex:-1};
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
let pendingAudience=null,pendingAudienceSignature='';
function nextAudienceKey(){
 const ids=[...$('public-sprite').options].map(o=>o.value).filter(Boolean);
 if(!ids.length)return null;
 const mode=$('public-mode').value,signature=ids.join('|')+':'+state.audience;
 if(mode==='cycle')return ids[state.peopleIndex%ids.length];
 if(mode!=='random')return state.audience;
 if(!pendingAudience||pendingAudienceSignature!==signature){pendingAudience=ids[Math.floor(Math.random()*ids.length)];pendingAudienceSignature=signature}
 return pendingAudience;
}
function updatePeopleHint(){
 const mode=$('public-mode').value,key=nextAudienceKey();
 $('public-next').textContent='Siguiente referencia: '+(key?.split(':').at(-1)||'—')+(mode==='cycle'?' (rotativa)':mode==='random'?' (aleatoria preparada)':' (fija)');
}
function appendPerson(q){
 if(personBlockedByTrees(q,data.trees))return false;
 const ids=[...$('public-sprite').options].map(o=>o.value).filter(Boolean);
 if(!ids.length)return false;
 const mode=$('public-mode').value;
 const key=nextAudienceKey();
 if(!key)return false;
 const sprite=sprites[key],size=sprite?.rectSize?sprite.rectSize.map(x=>x/(sprite.pixelsToUnits||100)):[.19,.19];
 data.people.push({point:q.map(x=>+x.toFixed(3)),key,size});
 if(mode==='cycle')state.peopleIndex=(state.peopleIndex+1)%ids.length;
 if(mode==='random')pendingAudience=null;
 return true;
}
function selectionVisibility(type){
 return $( {roads:'roads-on',sidewalks:'sidewalks-on',houses:'houses-on',
  people:'public-on',trees:'trees-on',fences:'fences-on',chairs:'chairs-on',
  signs:'signs-on',checkpoints:'checkpoints-on',labels:'labels-on',urban:'urban-on'}[type]).checked;
}
function toggleInSelection(base,item){
 if(!item)return base;
 const has=base.some(o=>o.type===item.type&&o.index===item.index);
 return has?base.filter(o=>o.type!==item.type||o.index!==item.index):[...base,item];
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
 if(before!==data.people.length){clearSelection();changed();return}
 const chosen=selectAt(p);
 if(chosen){data[chosen.type].splice(chosen.index,1);clearSelection();changed()}
}
function finishPolygon(){
 if(state.working.length<3){show('Marca al menos 3 puntos para cerrar el polígono.','error');return}
 const kind={road:'roads',sidewalk:'sidewalks',house:'houses'}[state.tool];
 if(!kind)return;
 const poly=state.working.map(a=>a.map(x=>Math.round(x*100)/100));
 const a=Math.abs(poly.reduce((v,p,i)=>{const q=poly[(i+1)%poly.length];return v+p[0]*q[1]-p[1]*q[0]},0))/2;
 if(a<.015){show('Polígono demasiado estrecho o cruzado. Corrige sus puntos.','error');return}
 snapshot();
 const roof=roofById(state.material);
 data[kind].push(kind==='houses'?{poly,key:roof.key,material:roof.id,kind:'manual',roofInset:Number($('roof-inset').value)||.05,roofDetail:$('roof-detail').value,roofBorder:$('roof-border').value,roofSimplify:$('roof-simplify').checked,roofSeed:residentialSeed(poly,data.houses.length)}:{poly,material:kind==='roads'?state.roadMaterial:state.sidewalkMaterial});
 state.working=[];changed();
 if(kind==='houses'){
  advanceRoof();
  show('Casa terminada: '+roof.name+'. Próximo tejado: '+roofById(state.material).name+'.','good');
 }else show('Polígono añadido. Revisa si invade otra capa.','good');
}
function rotationHandlePosition(){
 const geometry=selectionGeometry(data,state.selectedItems);
 if(!geometry)return null;
 const box=geometry.bounds,center=geometry.center;
 const top=pixel(center[0],box[3]);
 const hy=Math.max(22,Math.min(view.h-22,top[1]-38));
 return{center,handle:[top[0],hy],anchor:[top[0],Math.max(8,Math.min(view.h-8,top[1]))]};
}
function onRotationHandle(pos){
 if(state.tool!=='select'||!state.selectedItems.length)return null;
 const handle=rotationHandlePosition();
 return handle&&dist(pos,handle.handle)<17?handle:null;
}
function pointEvent(e){const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
function pointerDown(e){
 if(e.pointerType==='mouse'&&e.button!==0)return; // primary/left button only
 e.preventDefault();
 canvas.setPointerCapture(e.pointerId);
 const pos=pointEvent(e);
 state.pointers.set(e.pointerId,pos);
 if(state.pointers.size===2){
  const arr=[...state.pointers.values()];
  state.pinch={gap:dist(arr[0],arr[1]),mid:[(arr[0][0]+arr[1][0])/2,(arr[0][1]+arr[1][1])/2],zoom:view.zoom};
  state.drag=null;return;
 }
 const q=world(...pos);state.mouseWorld=q;
 if(state.tool==='pan'){state.drag={action:'pan',pos};return}
 if(state.tool==='reference'){photoGuides?.pointerDown(pos);return}
 if(state.tool==='paso'){
  const current=state.paso||data.paso,center=pixel(current.x,current.y),
   handle=pasoRotationHandle(current,view.zoom,pixel);
  // Fingers hide the small knob; give touch a larger target without
  // changing the original 17px mouse hitbox or the paso's geometry.
  const rotateHitRadius=e.pointerType==='touch'?35:e.pointerType==='pen'?23:17;
  if(dist(pos,handle)<rotateHitRadius){
   state.drag={action:'rotate-paso',angle:mouseAngle([current.x,current.y],q),moved:false};return;
  }
  snapshot();state.drag={action:'paso',pos};state.paso={...current,x:q[0],y:q[1]};changed();return;
 }
 if(['road','sidewalk','house'].includes(state.tool)){
  if(state.working.length>=3&&dist(q,state.working[0])<10/view.zoom){finishPolygon();return}
  state.working.push(q);requestDraw();return;
 }
 if(state.tool==='people'){
  snapshot();const brush=makeCrowdStroke(visibleSpectators(data.people,data.trees));
  state.drag={action:'people',brush};
  if(brush.start(q,appendPerson)){updatePeopleHint();changed()}
  return;
 }
 if(state.tool==='street-name'){
  const name=$('street-name-text').value.trim();
  if(!name){show('Escribe el nombre de calle en el panel antes de colocarlo.','error');return}
  const radius=Number($('street-trigger-radius').value);
  if(!Number.isFinite(radius)||radius<.2||radius>5){show('El radio del punto debe estar entre 0,2 y 5 metros.','error');return}
  snapshot();data.labels.push([name.slice(0,90),q.map(v=>+v.toFixed(3)),{radius}]);
  setSelection([{type:'labels',index:data.labels.length-1,vertex:-1}]);changed();return;
 }
 if(state.tool==='people-row'){state.drag={action:'people-row',start:q,end:q};requestDraw();return}
 if(state.tool==='tree'){snapshot();const treeId=$('tree-cycle').checked?TREE_VARIANTS[state.treeIndex%TREE_VARIANTS.length].id:state.treeVariant;data.trees.push({point:q.map(x=>+x.toFixed(3)),radius:Number($('tree-radius').value),variant:treeId,rotation:Math.round((state.treeIndex*47)%360),scale:.88+(state.treeIndex%5)*.06,source:'manual'});state.treeIndex++;changed();return}
 if(state.tool==='fence'||state.tool==='chair'){snapshot();addFurniture(state.tool,q,0);changed();return}
 if(state.tool==='fence-row'||state.tool==='chair-row'){state.drag={action:'furniture-row',type:state.tool==='fence-row'?'fence':'chair',start:q,end:q};requestDraw();return}
 if(state.tool==='urban'){
  const type=$('urban-type').value||'crosswalk';
  if(urbanIsMarking(type)){state.drag={action:'urban-mark',type,start:q,end:q};requestDraw();return}
  snapshot();data.urban.push(newUrbanElement(type,q));
  changed();show(urbanName(type)+' colocado. Selecciónalo para moverlo o girarlo.','good');return;
 }
 if(state.tool==='sign'){snapshot();data.signs.push({point:q.map(x=>+x.toFixed(3)),type:'traffic',source:'manual'});changed();return}
 if(state.tool==='checkpoint'){snapshot();const id='manual-'+Date.now();data.checkpoints.push({id,name:'Control '+(data.checkpoints.length+1),position:q.map(x=>+x.toFixed(3))});changed();return}
 if(state.tool==='erase'){snapshot();eraseAt(q);state.drag={action:'erase'};return}
 if(state.tool==='select'){
  const rotate=onRotationHandle(pos);
  if(rotate){
   state.drag={action:'rotate',center:rotate.center,items:state.selectedItems.map(o=>({...o})),
    originals:captureSelection(data,state.selectedItems),angle:mouseAngle(rotate.center,q),
    total:0,moved:false};
   requestDraw();return;
  }
  const hit=selectAt(q);
  const ctrl=e.ctrlKey||e.metaKey,shift=e.shiftKey;
  const existing=state.selectedItems.map(o=>({...o}));
  if(ctrl&&hit&&!shift){
   setSelection(toggleInSelection(existing,hit));
   return;
  }
  // Empty canvas => Windows rectangle. Shift forces a rectangle even over
  // a polygon; Shift-click (no drag) adds/removes one item.
  if(!hit||shift){
   if(!ctrl&&!shift)clearSelection();
   state.drag={action:'marquee',start:pos,end:pos,base:(ctrl||shift)?existing:[],additive:ctrl||shift,clicked:shift?hit:null};
   requestDraw();return;
  }
  if(!selectionContains(hit.type,hit.index))setSelection([hit]);
  state.drag={action:'select',pos,start:pos,selection:hit,items:state.selectedItems.map(o=>({...o})),moved:false};
  requestDraw();
 }
}
function pointerMove(e){
 const pos=pointEvent(e);
 const known=state.pointers.has(e.pointerId);
 if(known)state.pointers.set(e.pointerId,pos);
 if(state.pointers.size>=2&&state.pinch){
  const pts=[...state.pointers.values()],gap=Math.max(1,dist(pts[0],pts[1]));
  zoomAt(gap/state.pinch.gap,[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2]);
  state.pinch.gap=gap;return;
 }
 const q=world(...pos);state.mouseWorld=q;$('coords').textContent=q.map(x=>x.toFixed(2)).join(' · ');
 if(state.tool==='reference'){photoGuides?.pointerMove(pos);return}
 if(!state.drag||!known){if(state.tool==='people'||state.working.length)requestDraw(true);return}
 const a=state.drag,dx=(pos[0]-(a.pos?.[0]??pos[0]))/view.zoom,
  dy=-(pos[1]-(a.pos?.[1]??pos[1]))/view.zoom;
 if(a.action==='pan'){view.cx-=dx;view.cy-=dy;a.pos=pos;requestDraw();return}
 if(a.action==='people'){
  // Sample evenly along each pointer segment. Strokes are gap-free at any
  // mouse speed, and one Ctrl+Z reverts the whole continuous stroke.
  const spacing=Number($('public-spacing').value)||.22;
  const added=a.brush.continue(q,spacing,p=>a.brush.placed<4500&&appendPerson(p));
  if(added){updatePeopleHint();changed()}
  return;
 }
 if(a.action==='erase'){eraseAt(q);return}
 if(a.action==='furniture-row'||a.action==='people-row'||a.action==='urban-mark'){a.end=q;requestDraw();return}
 if(a.action==='paso'){state.paso.x=q[0];state.paso.y=q[1];changed();return}
 if(a.action==='rotate-paso'){
  const p=state.paso||data.paso,angle=mouseAngle([p.x,p.y],q),step=angleDelta(a.angle,angle);
  a.angle=angle;if(!Number.isFinite(step)||Math.abs(step)<.01)return;
  if(!a.moved){snapshot();a.moved=true}
  state.paso.angle=(((state.paso.angle||0)+step)%360+360)%360;
  changed();return;
 }
 if(a.action==='marquee'){a.end=pos;requestDraw();return}
 if(a.action==='rotate'){
  const current=mouseAngle(a.center,q);
  const step=angleDelta(a.angle,current);a.angle=current;
  if(!Number.isFinite(step)||Math.abs(step)<.01)return;
  if(!a.moved){snapshot();a.moved=true}
  a.total+=step;rotateSelections(data,a.items,a.center,a.total,a.originals);
  changed();return;
 }
 if(a.action==='select'){
  if(!a.moved&&dist(pos,a.start)<4)return;
  if(!a.moved){snapshot();a.moved=true}
  if(a.items.length===1&&a.selection.vertex>=0){
   const obj=data[a.selection.type]?.[a.selection.index];
   if(obj?.poly?.[a.selection.vertex])obj.poly[a.selection.vertex]=q.map(x=>+x.toFixed(3));
  }else translateSelections(data,a.items,dx,dy);
  a.pos=pos;changed();
 }
}
function pointerUp(e){
 const a=state.drag,ending=e.type!=='pointercancel';
 if(ending&&a?.action==='urban-mark'){
  snapshot();data.urban.push(crosswalkFromDrag(a.type,a.start,a.end,Number($('urban-depth').value)));
  changed();show(urbanName(a.type)+' colocado. Puedes girarlo o deshacerlo con Ctrl+Z.','good');
 }
 if(ending&&a?.action==='people-row'){
  snapshot();const brush=makeCrowdStroke(visibleSpectators(data.people,data.trees)),spacing=Math.max(.15,Number($('people-row-spacing').value)||.25);
  let n=brush.start(a.start,appendPerson);
  if(dist(a.start,a.end)>.001)n+=brush.continue(a.end,spacing,p=>brush.placed<4500&&appendPerson(p));
  if(n){updatePeopleHint();changed();show(n+' personas colocadas en fila. Puedes deshacer toda la fila con Ctrl+Z.','good')}
  else{state.history.pop();show('No hay espacio libre para añadir público en esa fila.','info')}
 }
 if(ending&&a?.action==='furniture-row'){
  snapshot();
  if(dist(a.start,a.end)>=.05)addFurnitureRow(a.type,a.start,a.end);
  else addFurniture(a.type,a.start,0);
  changed();
 }
 if(ending&&a?.action==='marquee'){
  if(dist(a.start,a.end)<4){
   if(a.clicked)setSelection(toggleInSelection(a.base,a.clicked));
   else setSelection(a.base);
  }else{
   const start=world(...a.start),end=world(...a.end);
   const found=picksInRectangle(data,start,end,selectionVisibility);
   const result=a.additive?unifySelections([...a.base,...found]):found;
   setSelection(result);
   show(result.length+' elementos seleccionados por área.','good');
  }
 }
 state.pointers.delete(e.pointerId);
 if(state.pointers.size<2)state.pinch=null;
 if(!state.pointers.size){state.drag=null;photoGuides?.pointerUp()}
 requestDraw();
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
 validateMapDocument(loaded);
 data=loaded;clearSelection();state.history=[];state.future=[];
 if(!data.paso)data.paso={...baseline.paso};
 if(!data.checkpoint)data.checkpoint=[...baseline.checkpoint];
 if(!data.labels)data.labels=[];
 for(const kind of ['trees','signs','checkpoints','fences','chairs','urban'])if(!Array.isArray(data[kind]))data[kind]=structuredClone(baseline[kind]||[]);
 if(!data.bounds)data.bounds=baseline.bounds;
 state.paso={...savedStart()};updateStartStatus();state.peopleIndex=data.people.length;state.treeIndex=data.trees.length;
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
function roofsInCategory(group=$('roof-category').value){
 return group==='realistic'?REALISTIC_ROOFS:
  group==='common'?SEVILLA_NEIGHBOURHOOD_ROOFS:
  group==='flat'?SEVILLA_ROOFS_BY_FAMILY('flat'):
  group==='tile'?SEVILLA_ROOFS_BY_FAMILY('tile'):
  group==='mixed'?SEVILLA_ROOFS_BY_FAMILY('mixed'):
  group==='temple'?[...LANDMARK_ROOF_MATERIALS.filter(m=>['cathedral','salvador','santaAna','baratillo'].includes(m.landmark)),...TEMPLE_ROOF_MATERIALS]:
  group==='landmark'?LANDMARK_ROOF_MATERIALS:ROOF_MATERIALS.filter(item=>group==='extra'?item.family!==0:item.family===0);
}
function advanceRoof(){
 state.material=nextRoofId(roofsInCategory(),state.material,$('roof-mode').value);
 palette();
}
for(const border of ROOF_BORDERS){
 const option=document.createElement('option');option.value=border.id;option.textContent=border.name;
 $('roof-border').append(option);
}
function previewRoofDetail(){
 const preview=$('roof-detail-preview');if(!preview)return;
 const c=preview.getContext('2d'),w=preview.width,h=preview.height;
 c.clearRect(0,0,w,h);
 c.fillStyle='#686c66';c.fillRect(0,0,w,h);
 // Bird's-eye street strip and the roof geometry in identical world scale
 // to the editor/game. No fake front elevation and no external images.
 c.fillStyle='#818078';c.fillRect(0,h*.76,w,h*.24);
 const poly=[[.75,.64],[8.60,.64],[8.60,4.12],[.75,4.12]],z=28;
 drawRoof(c,poly,state.material,(x,y)=>[x*z,h-y*z],
  ()=>null,z,{roofInset:Number($('roof-inset').value)||.05,roofDetail:$('roof-detail').value,roofBorder:$('roof-border').value});
}
function palette(){
 const parent=$('palettes');parent.replaceChildren();
 const roofs=roofsInCategory();
 const mode=$('roof-mode').value;
 $('roof-selected').textContent=(mode==='fixed'?'Tejado elegido: ':'Próximo tejado: ')+roofById(state.material).name;
 $('roof-mode-help').textContent=mode==='fixed'?'Se mantendrá el mismo tejado hasta que lo cambies.':
  mode==='random'?'Cada casa tendrá un acabado aleatorio distinto del anterior.':
  'Al cerrar cada casa, cambiará automáticamente al siguiente tejado de la categoría.';
 for(const roof of roofs){
  const id=Number(roof.key.split(':').at(-1)),button=document.createElement('button');
  button.className='swatch'+(state.material===roof.id?' chosen':'');
  button.title=roof.name+(roof.description?' · '+roof.description:'');
  button.type='button';
  // Every roof thumbnail is painted with the SAME top-down renderer as
  // actual gameplay: never show a facade atlas image for a roof preview.
  let preview=roofPreviewCache.get(roof.id);
  if(!preview){
   preview=document.createElement('canvas');preview.width=144;preview.height=90;
   preview.setAttribute('aria-label','Vista cenital de '+roof.name);
   drawRoof(preview.getContext('2d'),[[.25,.2],[5.75,.2],[5.75,3.35],[.25,3.35]],roof.id,
    (x,y)=>[x*24,90-y*24],()=>null,24,{roofInset:.05,roofDetail:'none'});
   roofPreviewCache.set(roof.id,preview);
  }
  button.appendChild(preview);
  const name=document.createElement('small');name.textContent=roof.name;
  button.appendChild(name);
  button.onclick=()=>{state.material=roof.id;palette();requestDraw()};
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
 previewRoofDetail();
}
function setupUrbanPalette(){
 const select=$('urban-type');select.replaceChildren();
 for(const item of URBAN_ITEMS){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.appendChild(option)}
 select.value='crosswalk';
 const update=()=>{
  const type=select.value,mark=urbanIsMarking(type);
  $('urban-depth').disabled=!mark;
  $('urban-hint').textContent=mark?
   'Arrastra de un lado de la calle al otro para fijar el ancho del paso. La longitud de las franjas se ajusta arriba.':
   'Elige 🚦 Urbanismo y haz clic para colocar este objeto. Después puedes moverlo y girarlo con Seleccionar.';
  $('urban-depth-value').textContent=Number($('urban-depth').value).toFixed(1).replace('.',',')+' m';
  const canvas=$('urban-preview'),c=canvas.getContext('2d');
  c.clearRect(0,0,canvas.width,canvas.height);
  c.fillStyle='#52565b';c.fillRect(0,0,canvas.width,canvas.height);
  drawUrbanElement(c,newUrbanElement(type,[0,0],{depth:Number($('urban-depth').value)}),
   (x,y)=>[canvas.width/2+x*30,canvas.height/2-y*30],30);
 };
 select.onchange=update;$('urban-depth').oninput=update;update();
}
// Single application path for the gallery and the explicit Apply button.
// Uses the live selected objects, not a stale preview or a cached material ID.
// Works for multi-select, respects undo, and stores the original geometry.
function applySurfaceToSelection(kind=null){
 const selected=state.selectedItems.filter(o=>
  (o.type==='roads'||o.type==='sidewalks')&&(!kind||o.type===kind)&&data[o.type]?.[o.index]);
 if(!selected.length){
  if(!kind)show('Selecciona una calzada o acera con «Seleccionar» antes de aplicar.','error');
  return 0;
 }
 // Bring guide images behind surfaces ONLY during material inspection.
 // This does not change the stored position/scale/opacity of any guide.
 $('surface-clear-preview').checked=true;
 requestDraw();
 const differences=selected.filter(o=>{
  const material=o.type==='roads'?state.roadMaterial:state.sidewalkMaterial;
  return data[o.type][o.index].material!==material;
 });
 if(differences.length){
  snapshot();
  for(const item of differences){
   const material=item.type==='roads'?state.roadMaterial:state.sidewalkMaterial;
   data[item.type][item.index].material=material;
  }
  changed();
 }
 // Preserve selected outlines to make the applied surface immediately clear.
 const names=selected.map(item=>{
  const material=item.type==='roads'?state.roadMaterial:state.sidewalkMaterial;
  const m=(item.type==='roads'?ROAD_MATERIALS:SIDEWALK_MATERIALS).find(x=>x.id===material);
  return m?.name||material;
 });
 const label=[...new Set(names)].join(', ');
 const message=selected.length+' superficie(s) · '+label+(differences.length?' · APLICADO':' · YA APLICADO');
 $('surface-apply-status').textContent=message;
 show(message,'good');
 return differences.length;
}
function bind(){
 for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>configureTool(button.dataset.tool);
 for(const id of ['grid-on','labels-on','houses-on','roads-on','sidewalks-on','public-on','paso-on','trees-on','signs-on','checkpoints-on','fences-on','chairs-on','urban-on','surface-clear-preview'])$(id).onchange=requestDraw;
 $('finish-shape').onclick=finishPolygon;
 $('cancel-shape').onclick=()=>{state.working=[];requestDraw()};
 $('delete-selected').onclick=deleteSelected;
 $('clear-selected').onclick=clearSelection;
 $('road-material').onchange=e=>{state.roadMaterial=e.target.value};
 $('sidewalk-material').onchange=e=>{state.sidewalkMaterial=e.target.value};
 $('tree-variant').onchange=e=>{state.treeVariant=e.target.value};
 $('roof-category').onchange=()=>{
  const category=$('roof-category').value,roofs=roofsInCategory(category);
  state.material=roofs[0]?.id||state.material;
  $('roof-mode').value=(category==='temple'||category==='landmark')?'fixed':'cycle';
  palette();
 };
 $('show-new-roofs').onclick=()=>{
  $('roof-category').value='realistic';
  $('roof-category').onchange();
  show('25 texturas detalladas visibles. Selecciona los edificios a los que quieres aplicarlas.','good');
 };
 $('roof-mode').onchange=palette;
 $('roof-inset').oninput=()=>{const v=Number($('roof-inset').value);$('roof-inset-value').textContent=v.toFixed(3).replace('.',',')+' m';previewRoofDetail();};
 $('roof-detail').onchange=previewRoofDetail;
 $('roof-border').onchange=previewRoofDetail;
 $('public-mode').onchange=updatePeopleHint;
 $('public-spacing').oninput=e=>{$('public-spacing-value').textContent=Number(e.target.value).toFixed(2).replace('.',',')+' m'};
 $('people-row-spacing').oninput=e=>{$('people-row-spacing-value').textContent=Number(e.target.value).toFixed(2).replace('.',',')+' m'};
 $('rename-street').onclick=()=>{
  const selected=state.selectedItems.filter(x=>x.type==='labels'),name=$('street-name-text').value.trim();
  if(!selected.length){show('Selecciona antes el nombre de calle que quieres cambiar.','error');return}
  if(!name){show('Escribe el nuevo nombre antes de renombrar.','error');return}
  const radius=Number($('street-trigger-radius').value);
  if(!Number.isFinite(radius)||radius<.2||radius>5){show('El radio del punto debe estar entre 0,2 y 5 metros.','error');return}
  snapshot();for(const sel of selected)if(data.labels[sel.index]){
   data.labels[sel.index][0]=name.slice(0,90);data.labels[sel.index][2]={radius};
  }
  changed();show(selected.length+' puntos de anuncio actualizados.','good');
 };
 $('remove-street').onclick=()=>{
  const selected=state.selectedItems.filter(x=>x.type==='labels');
  if(!selected.length){show('Selecciona antes uno o varios nombres de calle.','error');return}
  snapshot();const n=deleteSelections(data,selected);clearSelection();changed();show(n+' nombres de calle eliminados.','good');
 };
 $('street-name-text').addEventListener('keydown',e=>{if(e.key==='Enter'){$('rename-street').click();e.preventDefault()}});
 $('furniture-spacing').oninput=e=>{$('furniture-spacing-value').textContent=Number(e.target.value).toFixed(2)};
 $('apply-roof').onclick=()=>{
  const selected=state.selectedItems.filter(o=>o.type==='houses');
  if(!selected.length){show('Selecciona primero una o varias casas.','error');return}
  snapshot();const mode=$('roof-mode').value;
  let count=0;
  for(const sel of selected){
   const obj=data.houses[sel.index];if(!obj)continue;
   const roof=roofById(state.material);obj.material=roof.id;obj.key=roof.key;
   obj.roofInset=Number($('roof-inset').value)||.05;obj.roofDetail=$('roof-detail').value;obj.roofBorder=$('roof-border').value;obj.roofSimplify=$('roof-simplify').checked;
    if(!Number.isFinite(obj.roofSeed))obj.roofSeed=residentialSeed(obj.poly,sel.index);
   count++;state.material=nextRoofId(roofsInCategory(),roof.id,mode);
  }
  changed();palette();show('Tejado aplicado a '+count+' edificios'+(mode==='fixed'?'.':' con alternancia.'),'good');
 };
 $('apply-surface').onclick=()=>applySurfaceToSelection();
 const selectedFurniture=()=>state.selectedItems.filter(o=>['fences','chairs'].includes(o.type));
 $('duplicate-selected').onclick=()=>{
  const items=selectedFurniture();if(!items.length){show('Selecciona una o varias vallas o sillas.','error');return}
  snapshot();const duplicated=[];
  for(const item of items){
   const obj=data[item.type]?.[item.index];if(!obj)continue;
   data[item.type].push({...obj,point:[+(obj.point[0]+.3).toFixed(3),+(obj.point[1]+.3).toFixed(3)]});
   duplicated.push({type:item.type,index:data[item.type].length-1,vertex:-1});
  }
  setSelection(duplicated);changed();
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
  snapshot();data=JSON.parse(JSON.stringify(baseline));clearSelection();restorePreviewStart();changed();
 };
 $('brush-size').oninput=()=>{$('brush-value').textContent=Number($('brush-size').value).toFixed(2)+' m'};
 $('set-start').onclick=()=>{
  const pose=state.paso;
  if(!pose||![pose.x,pose.y,pose.angle].every(Number.isFinite)){show('Coloca el paso antes de fijar la salida.','error');return}
  snapshot();delete data.startReset;data.startPose={x:+pose.x.toFixed(3),y:+pose.y.toFixed(3),angle:+(((pose.angle%360)+360)%360).toFixed(3)};
  updateStartStatus();changed();
  const complete=pasoFootprint(pose,1.36,3.0);
  if(!(data.roads?.length||data.sidewalks?.length))show('Inicio guardado, pero aún no hay suelo transitable. Dibuja calzada o acera bajo toda la huella, incluida la manigueta.','info');
  else if(complete.some(p=>!onTraversableSurface(p)))show('Inicio guardado con aviso: puede rozar una pared o estar fuera de la calzada y las aceras. Revisa el espacio libre antes de jugar.','info');
  else show('Inicio guardado. Hay espacio aproximado; comprueba las colisiones reales al probar el juego.','good');
 };
 $('go-start').onclick=()=>{
  restorePreviewStart();const start=savedStart();
  if(start){configureTool('paso');focusAt(start.x,start.y,Math.min(45,Math.max(view.zoom,20)))}
 };
 $('clear-start').onclick=()=>{if(!data.startPose)return;snapshot();delete data.startPose;data.startReset=true;restorePreviewStart();changed();show('Inicio original restaurado.','good')};
 $('goto-start').onclick=()=>{const start=savedStart();if(start)focusAt(start.x,start.y,Math.min(45,Math.max(view.zoom,20)))};
 $('goto-chapel').onclick=()=>{const p=data.checkpoints?.[0]?.position||data.checkpoint;focusAt(...p,Math.min(48,Math.max(view.zoom,20)))};
 $('goto-all').onclick=fitMap;
 $('zoom-in').onclick=()=>zoomAt(1.3);$('zoom-out').onclick=()=>zoomAt(1/1.3);
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
  if(e.key==='Escape'){state.working=[];photoGuides?.cancelCalibration();clearSelection();requestDraw()}
  if(e.key==='Delete'||e.key==='Backspace')deleteSelected();
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
 const paso=state.paso||data.paso,footprint=pasoFootprint(paso);
 if(!footprint.every(onTraversableSurface))warnings.push('El paso de prueba queda fuera de la calzada y las aceras');
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
 activeMap=key;clearSelection();state.working=[];state.mouseWorld=null;
 void photoGuides?.switchMap(key);
 state.history=[];state.future=[];state.pinch=null;state.drag=null;state.pointers.clear();
 baseline=getBaselineDocument(key);
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
 cityManager?.refresh();updatePlayLink();
 $('map-kind').textContent=chosen.type==='user'?'Mapa propio: enlaza calles existentes o construye nuevos tramos.':chosen.type==='native'?'Mapa clásico del APK: geometría guía de colisiones; no es una reproducción visual exacta.':chosen.type==='mixed'?'Recorrido combinado: se conserva el mapa original junto a las ampliaciones.':chosen.type==='arenal'?'Arenal: taller con geometría detallada.':'Recorrido modular: aceras y público orientativos que puedes ajustar.';
 configureTool('pan');fitMap();
 show(restoring?'Edición de «'+chosen.name+'» recuperada.':'«'+chosen.name+'» cargado para editar.','good');
}
function getBaselineDocument(key){
 if(!baselineCache.has(key))baselineCache.set(key,buildEditorMap(key,animationData,nativeMaps,prepareMap));
 return structuredClone(baselineCache.get(key));
}
function getStoredDocument(key){
 const raw=localStorage.getItem(storageFor(key));
 if(raw){const doc=JSON.parse(raw);validateMapDocument(doc);return doc}
 return getBaselineDocument(key);
}
function registerUserMap(meta){
 if(EDITOR_MAPS.some(m=>m.key===meta.key))return;
 EDITOR_MAPS.push({...meta,type:'user'});
 const selector=$('map-select');let group=selector.querySelector('[data-user-maps]');
 if(!group){group=document.createElement('optgroup');group.label='Mis mapas de Sevilla';group.dataset.userMaps='true';selector.append(group)}
 const option=document.createElement('option');option.value=meta.key;option.textContent=meta.name;group.append(option);
}
function updatePlayLink(){
 for(const id of ['editor-play','editor-play-mobile']){const link=$(id);if(link)link.href='./index.html?cityMap='+encodeURIComponent(activeMap);}
}
async function init(){
 try{
  show('Cargando geometría y sprites originales del juego…');
  const responses=await Promise.all([fetch('./assets/original-animation.json'),fetch('./assets/game-data.json')]);
  for(const response of responses)if(!response.ok)throw Error('No se pudo cargar el catálogo HTTP '+response.status);
  const values=await Promise.all(responses.map(response=>response.json()));
  animationData=values[0];nativeMaps=values[1].maps||[];sprites=animationData.sprites;
  await loadSevilleTextures();
  for(const key of [...HOUSE_KEYS,FLOOR_KEY,'sharedassets2.assets:379','sharedassets2.assets:563'])spriteFor(key);
  const selector=$('map-select');
  for(const groupName of ['Recorridos de A Pulso','Mapas clásicos del APK']){
   const group=document.createElement('optgroup');group.label=groupName;
   for(const item of EDITOR_MAPS.filter(x=>groupName==='Mapas clásicos del APK' ? x.type==='native' : x.type!=='native')){
    const opt=document.createElement('option');opt.value=item.key;opt.textContent=item.name;group.appendChild(opt);
   }
   selector.appendChild(group);
  }
  photoGuides=createPhotoGuides({ctx,pixel,world,requestDraw,show,getMapKey:()=>activeMap,getView:()=>view,
    activateReferenceTool:()=>configureTool('reference'),
    focusImage:photo=>{
     // Show the full calibrated photo without changing its true world-space size.
     const usableW=Math.max(150,view.w-70),usableH=Math.max(150,view.h-70);
     view.cx=photo.position[0];view.cy=photo.position[1];
     view.zoom=Math.max(1.5,Math.min(145,usableW/(photo.width*photo.scale),usableH/(photo.height*photo.scale)));
     requestDraw();
    }});
  palette();setupUrbanPalette();bind();
  visualPanels=setupVisualPanels({state,getData:()=>data,snapshot,changed,show,
   getFloorImage:()=>getImage(FLOOR_KEY),applySurface:applySurfaceToSelection});
  vegetationPreview=setupVegetationPreviews({state,getImage});
  placementPreviews=setupPlacementPreviews({state,getImage,spriteDims,getRoofs:()=>roofsInCategory(),
   chooseRoof:id=>{state.material=id;palette();requestDraw()},configureTool,nextAudience:nextAudienceKey,
   getPaso:()=>state.paso||data?.paso,getFacade:()=>visualPanels.readInputs(),
   getPhotos:()=>photoGuides?.previewItems()||[],selectPhoto:id=>photoGuides?.selectPreview(id)});
  const treeImage=spriteFor('sharedassets2.assets:563');
  onTextureReady(key=>{if(key.startsWith('tree-')||key==='chair-carrera')requestDraw()});
  if(treeImage&&!treeImage.complete)treeImage.addEventListener('load',()=>vegetationPreview?.redraw(),{once:true});
  // The native asphalt grain sprite may arrive after the editor UI: update
  // the thumbnails once, so the gallery matches the finished map texture.
  const floorImage=spriteFor(FLOOR_KEY);
  if(floorImage&&!floorImage.complete)
   floorImage.addEventListener('load',()=>visualPanels?.redrawFloorPreviews(),{once:true});
  resize();
  setupMapPublishing({getMapKey:()=>activeMap,getData:()=>data,getBaseline:()=>baseline,saveLocal,show});
  cityManager=setupCityManager({catalog:EDITOR_MAPS,getData:()=>data,getBaseline:()=>baseline,
   getMapKey:()=>activeMap,getDocument:getStoredDocument,openMap:switchMap,
   onRegisterMap:registerUserMap,onNewDocument:(key,doc)=>{switchMap(key);setData(doc);saveLocal()},
   snapshot,changed,saveLocal,show,focus:focusAt,getSelection:()=>state.selectedItems,
   getView:()=>({...view,bounds:visualBounds()}),getImage,getPreviewStart:()=>state.paso});
  $('open-city').onclick=()=>cityManager.open();
  const requested=new URLSearchParams(location.search).get('map');
  switchMap(EDITOR_MAPS.some(m=>m.key===requested)?requested:DEFAULT_MAP);
  $('loading').hidden=true;
 }catch(err){show('Error preparando el editor: '+err.message,'error');$('loading').textContent='No se ha podido cargar el editor. '+err.message;console.error(err)}
}
init();
