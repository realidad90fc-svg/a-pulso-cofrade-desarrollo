import {CAMPAIGN_DATA} from './campaign-data.mjs';
import {CITY_KEY,MAP_STORAGE_PREFIX,validateMapDocument,validateProject,resolveCityMap,selectCityZone,polygonBounds} from './city-project.mjs';
import {EDITOR_MAPS} from './editor-map-catalog.mjs';
import {RuntimeEditorDraft,loadEditorDraftImages} from './game-editor-bridge.mjs';
import {paintCityScene} from './city-scene.mjs';
import {inverse,multiply} from './original-scene.mjs';
import {pointInPolygon} from './engine.mjs';
import {makeArenalPreviewDraft} from './editor-game-draft.mjs';
import {shapeOnSurfaces} from './map-geometry.mjs';
import {MAP_KINDS} from './editor-game-draft.mjs';
import {registerCustomAssets} from './custom-assets.mjs';

export function readCityPreview(search,storage){
 const params=new URLSearchParams(search),key=params.get('cityMap');if(!key)return null;
 const raw=storage.getItem(MAP_STORAGE_PREFIX+key);if(!raw)throw Error('Guarda el mapa en el editor de este mismo dominio antes de probarlo.');
 const saved=validateMapDocument(JSON.parse(raw)),projectRaw=storage.getItem(CITY_KEY);
 const project=projectRaw?validateProject(JSON.parse(projectRaw)):null;
 const get=mapKey=>{const r=storage.getItem(MAP_STORAGE_PREFIX+mapKey);if(!r)throw Error('Abre y guarda el mapa compartido «'+mapKey+'» antes de probarlo.');return validateMapDocument(JSON.parse(r))};
 const meta=EDITOR_MAPS.find(m=>m.key===key)||project?.maps.find(m=>m.key===key),zoneId=params.get('cityZone');
 let document=project?resolveCityMap(project,key,get):saved;
 if(zoneId){if(!project)throw Error('No se encuentra el catálogo de zonas.');document=selectCityZone(project,zoneId,mapKey=>resolveCityMap(project,mapKey,get));}
 if(zoneId&&document.bounds){const b=document.bounds,start=document.startPose||document.paso;if(start&&(start.x<b[0]||start.x>b[2]||start.y<b[1]||start.y>b[3]))throw Error('La salida está fuera de esta zona. Registra la zona con el paso colocado dentro de ella.');}
 const visit=project?.itineraries[params.get('cityBrotherhood')]?.find(v=>v.zoneId===zoneId);
 if(visit?.crowd==='none')document.people=[];
 if(visit?.mandatory){
  if(!document.checkpoints.length)throw Error('Añade un checkpoint dentro de esta zona para definir la presentación obligatoria.');
  document.checkpoints[0]={...document.checkpoints[0],mandatory:true,name:visit.presentation||document.checkpoints[0].name||'Presentación obligatoria'};
 }
 return{key,name:document.metadata.zoneName||document.metadata.map||meta?.name||key,document,
  draft:makeArenalPreviewDraft(document),
  isolated:meta?.type==='user'||!!zoneId||!!saved.zoneRefs?.length||(meta?.type==='native'&&!!saved.metadata?.precisionGeometry),
  nativeId:meta?.nativeId||meta?.route?.mapId||CAMPAIGN_DATA.routes.find(r=>r.mapKey===key)?.mapId||1};
}
function samples(shape){
 if(shape.circle)return Array.from({length:16},(_,i)=>[shape.center[0]+Math.cos(i*Math.PI/8)*shape.radius,shape.center[1]+Math.sin(i*Math.PI/8)*shape.radius]);
 const points=shape.points||[],result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.12));for(let j=0;j<n;j++)result.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n])}return result;
}
export class CityRoute{
 constructor(sim){
  this.sim=sim;this.document=sim.map.variant.document;registerCustomAssets(this.document.resources||[]);this.surfaces=[...this.document.roads,...this.document.sidewalks].filter(o=>o.walkable!==false);this.walkable=this.surfaces.map(o=>o.poly);
  if(!this.walkable.length)throw Error('Dibuja al menos una calle o acera antes de probar este mapa.');
  this.checkpoints=(this.document.checkpoints||[]).map((cp,i)=>({...cp,id:cp.id||'city-control-'+i,radius:cp.radius||.65}));
  this.checkpointIds=[];this.finished=false;this.checkpointReached=false;
  this.contacts=new RuntimeEditorDraft({mapKey:sim.map.variant.key,resources:this.document.resources||[],layers:{...Object.fromEntries(MAP_KINDS.map(k=>[k,this.document[k]||[]])),checkpoints:[]},total:1});
  sim.renderGraphs=sim.graphs.filter(g=>g!==sim.mapGraph);
  const start=this.document.startPose||this.document.paso;
  sim.setPosition(sim.stepEntity.transform,[start.x,start.y,0]);sim.setAngle(sim.stepEntity.transform,start.angle);
  if(!this.document.metadata.inheritNativeLimits){sim.controller.limiteActual=3600;sim.controller.limiteActual2=7200;}
  this.follow();sim.vm.invoke('cameraController.LateUpdate',sim.cameraController);
 }
 validShape(shape){return shapeOnSurfaces(samples(shape),this.surfaces)}
 follow(){const s=this.sim,p=s.position(s.stepEntity.transform),a=s.angle(s.stepEntity.transform)*Math.PI/180;
  for(const [e,d,turn]of [[s.capatazEntity,1.15,-90],[s.contraEntity,-1.3,90],...(s.cortejos||[]).map((e,i)=>[e,[3,-3,-4.5][i],0])])if(e){s.setPosition(e.transform,[p.x-Math.sin(a)*d,p.y+Math.cos(a)*d,0]);s.setAngle(e.transform,a*180/Math.PI+turn)}
 }
 tick(){
  const s=this.sim;this.follow();
  if(s.state.status!=='playing')return;
  for(const c of s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity))if(!this.validShape(c.world())){s.prefs.motivoGameOver=c.entity.name.startsWith('manigueta')?3:2;s.send(s.stepEntity,'gameOverMet');return}
  this.contacts.collision(s);if(s.state.status!=='playing')return;
  const position=s.position(s.stepEntity.transform),lowered=s.controller.animator.state==='pasoBajado';
  for(const cp of this.checkpoints){
   if(this.checkpointIds.includes(cp.id)||Math.hypot(position.x-cp.position[0],position.y-cp.position[1])>cp.radius)continue;
   if((cp.mandatory||cp.finish)&&!lowered)continue;
   if(!cp.mandatory&&!cp.finish&&(!s.state.lifted||s.controller.martillo))continue;
   if(cp.finish&&this.checkpoints.some(q=>q.mandatory&&!this.checkpointIds.includes(q.id)))continue;
   this.checkpointIds.push(cp.id);this.checkpointReached=true;s.mapController.zonaInterPasada=true;
   if(cp.finish){this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
   else{s.checkpointState=s.snapshot();s.emit('checkpoint')}
  }
 }
 snapshot(){return{checkpointIds:[...this.checkpointIds],finished:this.finished,checkpointReached:this.checkpointReached}}
 restore(value){this.checkpointIds=[...(value?.checkpointIds||[])];this.finished=!!value?.finished;this.checkpointReached=!!value?.checkpointReached;this.follow()}
 drawFloor(){}
 drawScene(ctx,project,images,canvas){
  const inv=inverse(project);if(!inv)return;
  const corners=[[0,0],[canvas.width,0],[canvas.width,canvas.height],[0,canvas.height]].map(([x,y])=>[inv[0]*x+inv[2]*y+inv[4],inv[1]*x+inv[3]*y+inv[5]]),bounds=polygonBounds(corners);
  ctx.save();ctx.setTransform(...multiply(project,[1,0,0,-1,0,0]));
  paintCityScene(ctx,this.document,(x,y)=>[x,-y],1,key=>images.get(key),bounds,{labels:false});ctx.restore();
 }
 drawMarkers(ctx,project){
  ctx.save();ctx.setTransform(...multiply(project,[1,0,0,-1,0,0]));
  for(const cp of this.checkpoints){ctx.save();ctx.translate(cp.position[0],-cp.position[1]);ctx.rotate(-(cp.angle||0)*Math.PI/180);ctx.strokeStyle=this.checkpointIds.includes(cp.id)?'#9dd36c':cp.mandatory?'#e9bc63':'#71d9d0';ctx.lineWidth=.045;ctx.strokeRect(-.55,-1.1,1.1,2.2);ctx.restore()}ctx.restore();
 }
}
export async function loadCityImages(route,load,images){if(route?.document)await loadEditorDraftImages({layers:route.document},load,images)}
