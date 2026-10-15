// Apply editor layers to real-time game preview on the SAME origin as the editor.
// The production game retains its native source data; local drafts are opt-in
// by existence and can be disabled via ?editor=off.
import {multiply,inverse} from './original-scene.mjs';
import {drawRoof,drawSurface,drawTree,drawFurniture,roofById,ROAD_MATERIALS,SIDEWALK_MATERIALS} from './editor-materials.mjs';
import {GAME_PATCH_PREFIX,EDITOR_PATCH_SCHEMA,MAP_KINDS} from './editor-game-draft.mjs';
import {urbanIsMarking,urbanCollisionSize,drawUrbanElement} from './editor-urban-elements.mjs';
import {pointInPolygon} from './engine.mjs';
import {personBlockedByTrees,visibleSpectators} from './editor-tree-crowd-clearance.mjs';
import {drawFacadeDecor,facadeVisualBounds} from './editor-facades.mjs';
import {StreetIdentifiers} from './street-identifiers.mjs';
import {drawTrafficSign,drawCheckpointGuide} from './editor-object-render.mjs';
import {customObjectCollider,drawCustomObject,loadDocumentAssets,registerCustomAssets} from './custom-assets.mjs';
import {surfacesOverlapPolygon} from './map-geometry.mjs';
import {validateMapDocument} from './city-project.mjs';

const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
const validStart=p=>p&&typeof p==='object'&&!Array.isArray(p)&&[p.x,p.y,p.angle].every(Number.isFinite)&&Math.abs(p.x)<2000&&Math.abs(p.y)<2000&&Math.abs(p.angle)<360000;
const polygon=poly=>Array.isArray(poly)&&poly.length>=3&&poly.length<=5000&&poly.every(valid);
const bbox=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
const hits=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const segment=(a,b,c,d)=>{
 const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const x=orient(a,b,c),y=orient(a,b,d),z=orient(c,d,a),w=orient(c,d,b);
 return ((x>1e-9&&y< -1e-9)||(x< -1e-9&&y>1e-9))&&((z>1e-9&&w< -1e-9)||(z< -1e-9&&w>1e-9));
};
function overlaps(a,b){
 if(!hits(bbox(a),bbox(b)))return false;
 if(a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a)))return true;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  if(segment(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;
 }
 return false;
}
function around(center,width,height,angle=0){
 const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);
 return [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([x,y])=>[center[0]+x*c-y*s,center[1]+x*s+y*c]);
}
function shapePolygon(w){
 if(w.circle)return Array.from({length:12},(_,i)=>[w.center[0]+Math.cos(i*Math.PI/6)*w.radius,w.center[1]+Math.sin(i*Math.PI/6)*w.radius]);
 return w.points||[];
}
function obstaclesFor(layers){
 const obstacles=[];
 for(const o of layers.fences||[])if(valid(o.point))obstacles.push({poly:around(o.point,o.width||.95,o.depth||.18,o.angle||0),reason:9});
 for(const o of layers.chairs||[])if(valid(o.point))obstacles.push({poly:around(o.point,o.width||.40,o.depth||.43,o.angle||0),reason:9});
 for(const o of layers.houses||[])if(polygon(o.poly))obstacles.push({poly:o.poly,holes:o.holes||[],reason:2});
 for(const o of layers.customObjects||[]){const poly=customObjectCollider(o);if(poly)obstacles.push({poly,reason:9})}
 for(const o of layers.trees||[])if(valid(o.point)){
  const r=Math.min(.65,Math.max(.10,(o.radius||.35)*(o.scale||1)*.43));
  obstacles.push({poly:around(o.point,o.size?Math.min(1.3,o.size[0]*.43):r*2,o.size?Math.min(1.3,o.size[1]*.43):r*2,o.rotation||0),reason:2});
 }
 for(const o of layers.urban||[])if(valid(o.point)){
   const size=urbanCollisionSize(o);
   if(size)obstacles.push({poly:around(o.point,size[0],size[1],o.angle||0),reason:9});
  }
  for(const o of layers.people||[])if(valid(o.point)&&!personBlockedByTrees(o,layers.trees)){
  const r=.065;obstacles.push({poly:around(o.point,o.edit?.resized?(o.size?.[0]||.19)*.13/.19:r*2,o.edit?.resized?(o.size?.[1]||.19)*.13/.19:r*2,o.angle||0),reason:13});
 }
 return obstacles.map(o=>({...o,box:bbox(o.poly)}));
}
function parseDraft(obj,key){
 if(obj?.schema!==EDITOR_PATCH_SCHEMA||obj.mapKey!==key||!obj.layers||!Number.isFinite(obj.total)||obj.total<1)return null;
 const layers=Object.fromEntries(MAP_KINDS.map(kind=>{
  const arr=obj.layers[kind];return [kind,Array.isArray(arr)?arr.slice(0,kind==='people'?12000:kind==='houses'?7000:6000):[]]
 }));
 registerCustomAssets(obj.resources||[]);
 const authoringScene=obj.authoringScene?validateMapDocument({...obj.authoringScene,resources:obj.resources||[]}):null;
 return{mapKey:key,layers,total:obj.total,resources:obj.resources||[],authoringScene,arenalScene:obj.arenalScene||null,labelScene:Array.isArray(obj.labelScene)?obj.labelScene:null,startPose:validStart(obj.startPose)?{...obj.startPose}:null};
}
function readDraft(key){
 try{
  const raw=localStorage.getItem(GAME_PATCH_PREFIX+key);
  if(!raw||raw.length>4500000)return null;
  return parseDraft(JSON.parse(raw),key);
 }catch(e){console.warn('A Pulso: no se pudo leer el borrador del mapa',e);return null}
}
export async function resolveEditorDraft(sim){
 if(sim.tutorial)return null;
 const key=sim.map.variant?.key||'native-'+sim.map.id;
 // A local draft takes priority only for its owner on this specific browser.
 // ?editor=off bypasses local drafts, but keeps the published public map.
 const useLocal=new URLSearchParams(location.search).get('editor')!=='off';
 if(useLocal){const local=readDraft(key);if(local)return local;}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch('./published-maps/'+encodeURIComponent(key)+'.json',
   {cache:'no-store',signal:controller.signal});
  if(!response.ok)return null;return parseDraft(await response.json(),key);
 }catch(e){
  if(e?.name!=='AbortError')console.warn('No hay diseño público para el mapa '+key,e);
  return null;
 }finally{clearTimeout(timeout)}
}
// New game only. Never apply this to a checkpoint/saved snapshot.
// Evaluate the ACTUAL engine colliders after moving the whole paso. A simple
// editor rectangle misses the manigueta and candelabros. Do not invent a
// new start if real physics says it would collide on the first frame.
export function inspectEditorSpawn(sim){
 const s=sim,parts=(s.stepColliders||[]).filter(c=>c.enabled&&c.entity!==s.contraEntity);
 const route=s.routeAdapter,overlays=s.editorDraft?.obstacles||route?.contacts?.obstacles||[];
 for(const c of parts){
  c._frame=-1;
  let world;try{world=c.world()}catch{return{ok:false,reason:'No se pudo calcular el volumen de la cuadrilla.'}}
  const part=c.entity?.name?.startsWith('manigueta')?'la manigueta':c.entity?.name?.startsWith('candelabro')?'los candelabros':'el paso';
  if(typeof route?.validShape==='function'){
   try{if(!route.validShape(world))return{ok:false,reason:part+' queda fuera del espacio transitable o toca una pared'};}
   catch{return{ok:false,reason:'No se pudo comprobar la salida con la geometría del recorrido'}}
  }
  const polygonPoints=shapePolygon(world);
  if(polygon(polygonPoints)){
   const bb=bbox(polygonPoints);
   for(const item of overlays)if(hits(bb,item.box||bbox(item.poly))&&surfacesOverlapPolygon(polygonPoints,item)){
    return{ok:false,reason:part+' invade '+(item.reason===13?'al público':item.reason===9?'mobiliario de la calle':'un edificio')}
   }
  }
 }
 return{ok:true,reason:''};
}
export function applyEditorStart(sim,p){
 if(!validStart(p)||sim.tutorial||!sim.stepEntity?.transform)return{ok:false,reason:'Posición inicial no válida'};
 const entities=[sim.stepEntity,sim.capatazEntity,sim.contraEntity,...(sim.cortejos||[])].filter(e=>e?.transform);
 const previous=entities.map(e=>({entity:e,pos:sim.position(e.transform),angle:sim.angle(e.transform)}));
 const initialChecked=sim.routeAdapter?._startChecked;
 const restore=()=>{
  for(const {entity,pos,angle}of previous){
   sim.setPosition(entity.transform,[pos.x,pos.y,pos.z||0]);sim.setAngle(entity.transform,angle);
  }
  if(sim.routeAdapter&&initialChecked!==undefined)sim.routeAdapter._startChecked=initialChecked;
  for(const c of sim.stepColliders||[])c._frame=-1;
  sim.routeAdapter?.follow?.();
  try{sim.vm?.invoke?.('cameraController.LateUpdate',sim.cameraController)}catch{}
  sim.sync?.();
 };
 const position=sim.position(sim.stepEntity.transform);
 sim.setPosition(sim.stepEntity.transform,[p.x,p.y,position.z||0]);
 sim.setAngle(sim.stepEntity.transform,p.angle);
 for(const c of sim.stepColliders||[])c._frame=-1;
 if(sim.routeAdapter?.follow)sim.routeAdapter.follow();
 else{
  const a=p.angle*Math.PI/180,s=Math.sin(a),c=Math.cos(a);
  for(const [entity,d,turn]of [[sim.capatazEntity,1.2,-90],[sim.contraEntity,-1.3,90]])if(entity?.transform){
   sim.setPosition(entity.transform,[p.x-s*d,p.y+c*d,0]);sim.setAngle(entity.transform,p.angle+turn);
  }
  for(const [i,entity]of (sim.cortejos||[]).entries())if(entity?.transform){
   const d=[3,-3,-4.5][i];sim.setPosition(entity.transform,[p.x-s*d,p.y+c*d,0]);sim.setAngle(entity.transform,p.angle);
  }
 }
 const inspection=inspectEditorSpawn(sim);
 if(!inspection.ok){
  restore();
  return {ok:false,reason:inspection.reason};
 }
 if(sim.routeAdapter&&'_startChecked' in sim.routeAdapter)sim.routeAdapter._startChecked=true;
 try{sim.vm?.invoke?.('cameraController.LateUpdate',sim.cameraController)}catch{}
 sim.sync?.();
 return{ok:true,reason:''};
}
export function attachEditorDraft(sim,draftOverride=undefined){
 if(sim.tutorial)return null;
 const key=sim.map.variant?.key||'native-'+sim.map.id;
 const draft=draftOverride===undefined?readDraft(key):draftOverride;
 if(!draft)return null;
 // Arenal uses the exact saved road, pavement, housing and spectator
 // arrays. This connects its editable geometry to the game tile cache.
 const route=sim.routeAdapter;
 if(key==='RegresoArenal'&&route&&draft.arenalScene){
  const scene=draft.arenalScene;
  if(Array.isArray(scene.roads)&&scene.roads.every(o=>polygon(o.poly))){
   route.walkable=scene.roads.map(o=>o.poly.map(p=>[...p]));
   route.roadBoxes=route.walkable.map(bbox);
   route.editorRoadSurfaces=scene.roads.map((o,i)=>({
    // Original editor polygons often have no stored 'material'. Do not
    // silently turn those into road-0..11 (flat asphalt/grey). The explicit
    // choice always wins, including deliberately selected original asphalt.
    ...o,poly:o.poly.map(p=>[...p]),material:o.material||'road-art-granite'
   }));
  }
  if(Array.isArray(scene.sidewalks)&&scene.sidewalks.every(o=>polygon(o.poly))){
   route.sidewalks=scene.sidewalks.map((o,i)=>({
    ...o,poly:o.poly.map(p=>[...p]),bbox:bbox(o.poly),
    material:o.material||'sidewalk-art-caliza'
   }));
   // Full Arenal sidewalks will be rendered by the base scene, beneath
   // buildings. Do not overlay them again with a generic editor floor.
   route.editorSidewalkMaterialReady=true;
  }
  // CentreRoute.validPoint includes route.sidewalks as traversable ground.
  // Do NOT append them to route.walkable: the Arenal renderer uses that
  // array to paint asphalt over the original pavement texture.
  if(Array.isArray(scene.houses)&&scene.houses.every(o=>polygon(o.poly))){
   const old=route.buildings||[];
   route.buildings=scene.houses.map(o=>{
    const original=old.find(h=>JSON.stringify(h.poly)===JSON.stringify(o.poly));
    const item={...(original||{}),...o,poly:o.poly.map(p=>[...p]),bbox:bbox(o.poly),key:o.key||original?.key||'sharedassets2.assets:569',material:o.material||original?.material,roofInset:o.roofInset,roofSimplify:o.roofSimplify,roofSeed:o.roofSeed,roofDetail:o.roofDetail,roofBorder:o.roofBorder,facade:o.facade};
    if(!original){item.kind='historic';item.front=[item.poly[0],item.poly[1]];item.outward=[0,1]}
    return item;
   });
  }
  if(Array.isArray(scene.people)&&scene.people.every(o=>valid(o.point))){
   const old=route.people||[],lookup=new Map(old.map(o=>[JSON.stringify(o.point)+'|'+o.key,o]));
   const keep=new Set(scene.people.map(o=>o.point.map(n=>n.toFixed(3)).join(',')));
   route.people=scene.people.map((p,i)=>({...lookup.get(JSON.stringify(p.point)+'|'+p.key),...p,id:'editor-arenal-person-'+i,baked:true,size:p.size||[.19,.19]}));
   route.obstacles=route.obstacles.filter(o=>o.kind!=='visible-spectator'||keep.has(o.center?.map(n=>n.toFixed(3)).join(',')));
  }
  // Tile coverage must include authored geometry, including streets added
  // beyond the original level. Physics and painting use the same polygons.
  const polygons=[...route.walkable,...route.sidewalks.map(o=>o.poly),...(route.buildings||[]).map(o=>o.poly)];
  const boxes=polygons.filter(polygon).map(bbox),original=route.scene.bounds;
  route.renderBounds=[Math.min(original[0],...boxes.map(b=>b[0])),Math.min(original[1],...boxes.map(b=>b[1])),Math.max(original[2],...boxes.map(b=>b[2])),Math.max(original[3],...boxes.map(b=>b[3]))];
  route.tileCache?.clear();
 }else if(route&&Array.isArray(route.walkable)){
  const roads=draft.layers.roads.filter(o=>polygon(o.poly)).map(o=>o.poly.map(p=>[...p]));
  if(roads.length){route.walkable.push(...roads);route.roadBoxes=route.walkable.map(bbox);}
  // Extra sidewalks remain a separate, non-solid collision layer.
  const sidewalks=draft.layers.sidewalks.filter(o=>polygon(o.poly))
   .map(o=>({poly:o.poly.map(p=>[...p]),bbox:bbox(o.poly)}));
  if(sidewalks.length)route.editorWalkable=[...(route.editorWalkable||[]),...sidewalks];
 }
 // The native/Arenal audience is painted outside the editor patch layer:
 // filter it too and remove corresponding spectator contacts.
 if(route&&Array.isArray(route.people)&&draft.layers.trees.length){
  route.people=visibleSpectators(route.people,draft.layers.trees);
  if(Array.isArray(route.obstacles))route.obstacles=route.obstacles.filter(o=>
   o.kind!=='visible-spectator'||!personBlockedByTrees(o.center,draft.layers.trees));
  route.tileCache?.clear();
 }
 sim.editorDraft=new RuntimeEditorDraft(draft);
 if(sim._editorStreetState){sim.editorDraft.streetIdentifiers.restore(sim._editorStreetState);sim._editorStreetState=null}
 sim.editorDraft.baseArenalSidewalks=key==='RegresoArenal'&&!!route?.editorSidewalkMaterialReady;
 sim.editorDraft.baseArenalRoads=key==='RegresoArenal'&&!!route?.editorRoadSurfaces;
 sim.editorDraft.baseArenalHouses=key==='RegresoArenal'&&Array.isArray(draft.arenalScene?.houses);
 sim.editorDraft.baseArenalPeople=key==='RegresoArenal'&&Array.isArray(draft.arenalScene?.people);
 return sim.editorDraft;
}
export class RuntimeEditorDraft{
 constructor(draft){
  this.key=draft.mapKey;this.layers=draft.layers;this.total=draft.total;this.resources=draft.resources||[];
   // Previously discarded by the runtime wrapper: caused editor-defined starts not to load.
   this.startPose=validStart(draft.startPose)?{...draft.startPose}:null;
  this.labels=Array.isArray(draft.labelScene)?draft.labelScene:(this.layers.labels||[]);
  this.streetIdentifiers=new StreetIdentifiers(this.labels);
  // Replacing an Arenal scene also replaces its solid objects. Unchanged
  // buildings and spectators must still block an edited start or road.
  this.obstacles=obstaclesFor({...this.layers,...draft.arenalScene});
  this.lastCollisionFrame=-1;this.reachedCheckpoints=new Set();
 }
 draw(ctx,project,images,canvas){
  const inv=inverse(project);if(!inv)return;
  const coords=[[0,0],[canvas.width,0],[canvas.width,canvas.height],[0,canvas.height]]
   .map(([x,y])=>[inv[0]*x+inv[2]*y+inv[4],inv[1]*x+inv[3]*y+inv[5]]);
  const bound=bbox(coords),viewScale=Math.hypot(project[0],project[1]);
  // Y-flipped drawing plane makes polygon textures follow world coordinates,
  // including camera rotation, without modifying the original camera.
  const oriented=multiply(project,[1,0,0,-1,0,0]),px=(x,y)=>[x,-y];
  const im=key=>images.get(key);
  ctx.save();ctx.setTransform(...oriented);
  ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
  for(const [kind,materials]of [['roads',ROAD_MATERIALS],['sidewalks',SIDEWALK_MATERIALS]]){
   // Only the Arenal full-scene layers, once accepted, are skipped here.
   // All other maps keep the original additive editor painter unchanged.
   if((kind==='sidewalks'&&this.baseArenalSidewalks)
      ||(kind==='roads'&&this.baseArenalRoads))continue;
   const floor=images.get('sharedassets2.assets:373');
   for(const o of this.layers[kind])if(polygon(o.poly)&&hits(bbox(o.poly),bound)){
    drawSurface(ctx,o.poly,kind,o.material||materials[0].id,px,1,floor,bound,o);
   }
  }
  for(const o of this.layers.urban||[])if(valid(o.point)&&urbanIsMarking(o.type)&&hits([o.point[0]-9,o.point[1]-9,o.point[0]+9,o.point[1]+9],bound))
    drawUrbanElement(ctx,o,px,1);
   for(const o of this.layers.houses)if(!this.baseArenalHouses&&polygon(o.poly)&&hits(bbox(o.poly),bound)){
    drawRoof(ctx,o.poly,o.material||o.key,px,im,1,o);
   }
   for(const o of this.layers.houses)if(!this.baseArenalHouses&&o.facade&&polygon(o.poly)&&hits(facadeVisualBounds(o),bound))drawFacadeDecor(ctx,o,px,1);
  for(const o of this.layers.trees)if(valid(o.point)&&hits([o.point[0]-1,o.point[1]-1,o.point[0]+1,o.point[1]+1],bound))drawTree(ctx,o,px,1,im);
  for(const o of this.layers.signs)if(valid(o.point))drawTrafficSign(ctx,o,px,1);
  for(const o of this.layers.urban||[])if(valid(o.point)&&!urbanIsMarking(o.type)&&hits([o.point[0]-2,o.point[1]-2,o.point[0]+2,o.point[1]+2],bound))
    drawUrbanElement(ctx,o,px,1);
   for(const kind of ['fences','chairs'])for(const o of this.layers[kind])if(valid(o.point)&&hits([o.point[0]-2,o.point[1]-2,o.point[0]+2,o.point[1]+2],bound))drawFurniture(ctx,o,kind==='fences'?'fence':'chair',px,1);
  for(const cp of this.layers.checkpoints||[])if(valid(cp.position))drawCheckpointGuide(ctx,cp,px,1,{label:false});
  for(const o of this.layers.customObjects||[])if(valid(o.point))drawCustomObject(ctx,o,px,1);
  for(const o of this.layers.people)if(!this.baseArenalPeople&&valid(o.point)&&!personBlockedByTrees(o,this.layers.trees)){
   const image=images.get(o.key)||images.get(o.key?.split(':').at(-1));
   const x=o.point[0],y=o.point[1],width=o.size?.[0]||.19,height=o.size?.[1]||.19;
   if(!hits([x-width/2,y-height/2,x+width/2,y+height/2],bound))continue;
   ctx.save();ctx.translate(x,-y);ctx.rotate(-(o.angle||0)*Math.PI/180);
   if(image)ctx.drawImage(image,-width/2,-height/2,width,height);
   else{ctx.fillStyle='#b99976';ctx.beginPath();ctx.arc(0,0,.095,0,2*Math.PI);ctx.fill()}
   ctx.restore();
  }
  ctx.restore();
 }
 streetNoticeFor(sim){
  const p=sim.position(sim.stepEntity.transform);
  if(sim.state.status==='playing'&&sim.timeScale!==0)return this.streetIdentifiers.at([p.x,p.y],sim.levelTime);
  return this.streetIdentifiers.notice;
 }
 update(sim){
  if(sim.state.status!=='playing'||!sim.state.lifted||sim.controller?.martillo)return;
  const checkpoints=this.layers.checkpoints||[];
  if(!checkpoints.length)return;
  const pos=sim.position(sim.stepEntity.transform);
  for(const cp of checkpoints){
   if(!valid(cp.position)||this.reachedCheckpoints.has(cp.id))continue;
   if(Math.hypot(pos.x-cp.position[0],pos.y-cp.position[1])>Math.max(.30,Math.min(2,cp.radius||.65)))continue;
   this.reachedCheckpoints.add(cp.id);
   // The game's native checkpoint and campaign logic still validate their
   // own prerequisites (notably the mandatory Baratillo presentation).
   sim.emit('checkpoint');
   if(!sim.routeAdapter&&!sim.checkpointState)sim.checkpointState=sim.snapshot();
  }
 }
 collision(sim){
  if(sim.state.status!=='playing'||!this.obstacles.length||this.lastCollisionFrame===sim.frameCount)return;
  this.lastCollisionFrame=sim.frameCount;
  const s=sim,parts=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity);
  for(const c of parts){
   const poly=shapePolygon(c.world());if(!polygon(poly))continue;
   const bounds=bbox(poly);
   for(const o of this.obstacles)if(hits(bounds,o.box)&&surfacesOverlapPolygon(poly,o)){
    s.prefs.motivoGameOver=o.reason;
    s.send(s.stepEntity,'gameOverMet');return;
   }
  }
 }
}
export async function loadEditorDraftImages(layer,load,images){
 if(!layer)return;
 await loadDocumentAssets({...layer.layers,resources:layer.resources||layer.layers.resources||[]});
 const all=[...new Set([
  ...layer.layers.houses.map(o=>roofById(o.material||o.key).key),
  ...layer.layers.people.map(o=>o.key),
  ...(layer.layers.roads.length?['sharedassets2.assets:373']:[])
 ].filter(Boolean))];
 // Animation sprite identifiers use the same extracted asset paths as the base engine.
 const sprites=layer.animationSprites||null;
 const queue=all.filter(key=>!images.has(key));
 let n=0;await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(n<queue.length){const key=queue[n++];
  const match=/sharedassets2\.assets:(\d+)/.exec(key);if(!match)continue;
  const path='assets/original-animation/sprite-'+match[1]+'.webp';
  try{const image=await load(path);images.set(key,image)}catch(e){console.warn('No se pudo cargar sprite editado',key,e)}
 }}));
}
