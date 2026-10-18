import {CentreRoute} from './centre-route.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {ADRIANO_BASIS,ADRIANO_URBAN_DETAIL,adrianoPoint,ARENAL_REYES} from './arenal-data.mjs';
import {TemplePresentations} from './temple-presentations.mjs';
import {buildArenalRoad,buildArenalCrowd,buildArenalSidewalks,buildArenalHouses,paintArenalScene} from './arenal-layers.mjs';

const rect=([x,y,xx,yy])=>[[x,y],[xx,y],[xx,yy],[x,yy]];
const bounds=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const intersects=(a,b)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
const at=(s,d,o)=>[s.a[0]+s.t[0]*d+s.n[0]*o,s.a[1]+s.t[1]*d+s.n[1]*o];
const lane=(s,from,to,inner,outer,side)=>[at(s,from,side*inner),at(s,to,side*inner),at(s,to,side*outer),at(s,from,side*outer)];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hull=points=>{
 const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lower=[],upper=[];
 for(const q of p){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}
 for(let i=p.length-1;i>=0;i--){const q=p[i];while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}
 return [...lower.slice(0,-1),...upper.slice(0,-1)];
};

// Stand-alone regeneration of REGRESO POR EL ARENAL.
// The previous arena-rebuild and arenal-urban renderers are NOT imported.
// Each tile uses one source of truth (walkable) for road, kerb and collision.
// The map5 APK bitmap and all legacy building sprites stay in game assets,
// but are NOT drawn on top of this route; no texture/roof ghosting.
export class ArenalRoute extends CentreRoute {
 constructor(sim){
  super(sim);
  // Old mapa5 scenery was precomposed for a DIFFERENT topology, and its
  // late-order rooftops covered the playable roads. Keep all original assets,
  // map colliders, step and physics, but render only this custom environment.
  sim.renderGraphs=sim.renderGraphs.filter(graph=>graph!==sim.mapGraph);
  this.nativeRoads=[];
  this.nativeEdges=[];
  this.obstacles=[];
  this.houses=[];
  this.lamps=[];
  this.people=[];
  this.audienceBands=[];
  this.tileCache.clear();
  this._startChecked=false;
  // Strict build order: roadway, people, pavement, architecture.
  this.buildStreets();
  this.buildAudienceFromStreets();
  this.buildSidewalks();
  this.buildBuildingBlocks();
  this.buildAdrianoFurniture();
  this.presentations=new TemplePresentations(this.scene.presentations);
  this.presentationIds=[];this.confirmation=null;
  this.follow();
 }
 buildStreets(){buildArenalRoad(this);}
 buildSidewalks(){buildArenalSidewalks(this);}
 buildBuildingBlocks(){buildArenalHouses(this);}
 buildAudienceFromStreets(){buildArenalCrowd(this);}
 paintTile(ctx,images,r){paintArenalScene(this,ctx,images,r);}
 buildAdrianoFurniture(){
  const detail=ADRIANO_URBAN_DETAIL;
  this.adrianoTrees=detail.trees.filter(o=>o.d<ADRIANO_BASIS.length-.14).map(({d,side},i)=>({id:'adriano-tree-'+i,point:adrianoPoint(d,side*(2.45+.12)),d,side}));
  this.adrianoSigns=detail.signs.map(({d,side,type},i)=>({id:'adriano-sign-'+i,point:adrianoPoint(d,side*(2.45+.065)),d,side,type}));
  // Decorative trees and signs are painted, but no longer create tiny,
  // hard-to-see failure colliders against the candelabra. This route's
  // contact obstacles belong exclusively to spectators actually rendered
  // on the carriageway. Every roadway edge is defined by the asphalt map.

 }
 ensureInitialClearance(){
  if(this._startChecked)return;this._startChecked=true;
  const s=this.sim,initial=this.scene.start.position,pos=s.position(s.stepEntity.transform);
  if(s.levelTime>.25||Math.hypot(pos.x-initial[0],pos.y-initial[1])>.12)return;
  const parts=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity);
  const clear=()=>parts.every(c=>{c._frame=-1;return this.validShape(c.world());});
  if(clear())return;
  const original=[pos.x,pos.y,pos.z||0],axis=this.arfeStartAxis,normal=[-axis[1],axis[0]];
  const shifts=[-.08,-.16,-.24,-.34,-.46,-.58,-.68,.08,.16,.24,.32];
  const offsets=[0,.06,-.06,.12,-.12];
  for(const d of shifts)for(const lateral of offsets){
   const q=[initial[0]+axis[0]*d+normal[0]*lateral,initial[1]+axis[1]*d+normal[1]*lateral,0];
   s.setPosition(s.stepEntity.transform,q);
   if(clear()){this._startAdjusted=true;return;}
  }
  s.setPosition(s.stepEntity.transform,original);for(const c of parts)c._frame=-1;
  console.warn('Arenal: sin posición inicial segura; revisar colisiones de Arfe.');
 }
 follow(){super.follow();}
 updateStreet(){const p=this.sim.position(this.sim.stepEntity.transform);if(p.x>45.2&&p.y<35.3){if(this.streetNotice?.id!=='arfe')this.streetNotice={id:'arfe',name:'Arfe',since:this.sim.levelTime};return;}super.updateStreet();}
 tick(){
  const s=this.sim;if(!s.gameplay?.replacesCollisions)this.ensureInitialClearance();this.follow();this.updateStreet();
  const shapes=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity);
  if(!s.gameplay?.replacesCollisions)for(const c of shapes)if(!this.validShape(c.world())){s.prefs.motivoGameOver=c.entity.name.startsWith('manigueta')?3:c.entity.name.startsWith('candelabro')?4:2;s.send(s.stepEntity,'gameOverMet');return;}
  if(s.gameplay?.ownsEvents)return;
  const p=s.position(s.stepEntity.transform),moving=['alante','atras','derAl','izqAl','derAt','izqAt'].some(k=>s.controller[k]),stopped=!moving&&!s.controller.martillo;
  const events=this.presentations.update({position:[p.x,p.y],heading:s.angle(s.stepEntity.transform),dt:s.dt,stopped,playing:s.state.status==='playing'});
  for(const event of events){this.presentationIds=[...this.presentations.completed];this.confirmation={label:'✓ PRESENTACIÓN COMPLETADA · CHECKPOINT GUARDADO',since:s.levelTime};this.tileCache.clear();if(event.checkpoint){const cp=this.checkpoints.find(c=>c.presentationId===event.id);if(cp&&!this.checkpointIds.includes(cp.id)){this.checkpointIds.push(cp.id);this.checkpointReached=true;s.emit('checkpoint');}}}
  const f=this.scene.finish,delta=Math.abs(((s.angle(s.stepEntity.transform)-f.heading+540)%360)-180);
  const inFinish=s.controller.animator.state==='pasoBajado'&&delta<=f.tolerance&&shapes.every(c=>{const w=c.world();return(w.circle?Array.from({length:24},(_,i)=>[w.center[0]+w.radius*Math.cos(i*Math.PI/12),w.center[1]+w.radius*Math.sin(i*Math.PI/12)]):w.points).every(q=>pointInPolygon(q,f.polygon));});
  if(inFinish){if(!this.presentations.mandatoryComplete){this.confirmation={label:'FALTAN PRESENTACIONES DEL RECORRIDO',since:s.levelTime};return;}this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
 }
 snapshot(){return {...super.snapshot(),presentations:this.presentations?.snapshot()||{completed:[]},geometryVersion:1};}
 restore(v){super.restore(v);this.presentations.restore(v?.presentations);this.presentationIds=[...this.presentations.completed];this.checkpointIds=this.checkpoints.filter(c=>this.presentationIds.includes(c.presentationId)).map(c=>c.id);this.checkpointReached=this.checkpointIds.length>0;this.confirmation=null;this.follow();}
 drawOverlay(ctx,w,h,dpr){
  super.drawOverlay(ctx,w,h,dpr);
  if(this.sim.timeScale===0||this.sim.state.status!=='playing')return;
  const note=this.confirmation,showConfirmation=note&&this.sim.levelTime-note.since<=4;
  const cfg=this.presentations.configs.find(c=>!this.presentations.completed.includes(c.id))||(showConfirmation?this.presentations.configs.at(-1):null);
  if(this.sim.gameplay?.ownsEvents||!cfg)return;
  const p=this.sim.position(this.sim.stepEntity.transform);
  const distance=Math.hypot(p.x-cfg.position[0],p.y-cfg.position[1]);
  if(!showConfirmation&&(this.presentations.completed.includes(cfg.id)||distance>5.2))return;
  const degrees=Math.abs(((this.sim.angle(this.sim.stepEntity.transform)-cfg.heading+540)%360)-180);
  const stopped=!['alante','atras','derAl','izqAl','derAt','izqAt'].some(k=>this.sim.controller[k])&&!this.sim.controller.martillo;
  const hold=Math.max(0,Math.min(cfg.holdSeconds,this.presentations.hold[cfg.id]||0));
  const title=showConfirmation?note.label:cfg.label||'PRESENTACIÓN DEL RECORRIDO';
  let detail='';
  if(!showConfirmation){
   if(distance>cfg.positionTolerance)detail=`Sitúa el paso sobre la marca azul · ${distance.toFixed(1)} m`;
   else if(degrees>cfg.headingTolerance)detail='Alinea el paso paralelo a la fachada, sin girarlo hacia la puerta';
   else if(!stopped)detail='Detén el paso para realizar la presentación';
   else detail=`Presentación ante la capilla · ${Math.max(0,cfg.holdSeconds-hold).toFixed(1)} s`;
  }
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const bw=Math.min(w-24,420),x=(w-bw)/2,y=Math.max(120,h*.16),bh=showConfirmation?38:63;
  ctx.fillStyle='rgba(37,19,24,.95)';ctx.fillRect(x,y,bw,bh);ctx.strokeStyle='#c1a674';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,bw-1,bh-1);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4e5c9';ctx.font=`bold ${Math.min(13,Math.max(10,bw/32))}px Georgia,serif`;ctx.fillText(title,w/2,y+17,bw-14);
  if(!showConfirmation){ctx.fillStyle='#d9c9ad';ctx.font=`${Math.min(12,Math.max(10,bw/35))}px Arial,sans-serif`;ctx.fillText(detail,w/2,y+41,bw-12);if(hold>0){ctx.fillStyle='#9fc9d3';ctx.fillRect(x+8,y+57,(bw-16)*hold/cfg.holdSeconds,3);}}
  ctx.restore();
 }
 paintAdrianoFurniture(ctx,r,images){
  const p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const nativeTree=images.get(ADRIANO_URBAN_DETAIL.treeSprite);
  for(const item of this.adrianoTrees||[]){if(this.editorLayeredTrees)continue;const [x,y]=item.point;if(!intersects([x-.55,y-.55,x+.55,y+.55],r))continue;
   // A real tree pit and trunk under a native Chicotaz canopy (not an unrelated emoji/tree).
   ctx.fillStyle='#968d7c';ctx.fillRect(px(x-.17),py(y+.17),.34*p,.34*p);
   ctx.fillStyle='#514738';ctx.fillRect(px(x-.135),py(y+.135),.27*p,.27*p);
   ctx.fillStyle='#403b30';ctx.beginPath();ctx.arc(px(x),py(y),.060*p,0,Math.PI*2);ctx.fill();
   if(nativeTree){ctx.globalAlpha=.96;ctx.drawImage(nativeTree,px(x-.43),py(y+.43),.86*p,.86*p);ctx.globalAlpha=1;}
  }
  for(const item of this.adrianoSigns||[]){if(this.editorLayeredSigns)continue;const [x,y]=item.point;if(!intersects([x-.25,y-.25,x+.25,y+.25],r))continue;
   // Semana Santa traffic restriction signs in the original top-down sprite scale.
   ctx.fillStyle='#313c42';ctx.beginPath();ctx.arc(px(x)+.028*p,py(y)+.025*p,.075*p,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#d0d2ca';ctx.beginPath();ctx.arc(px(x),py(y),.126*p,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#bd302e';ctx.beginPath();ctx.arc(px(x),py(y),.118*p,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#244e7a';ctx.beginPath();ctx.arc(px(x),py(y),.090*p,0,Math.PI*2);ctx.fill();
   const diag=(positive)=>{ctx.beginPath();ctx.moveTo(px(x+(-positive)*.068),py(y+.068));ctx.lineTo(px(x+(positive)*.068),py(y-.068));ctx.lineWidth=.026*p;ctx.strokeStyle='#ce3d39';ctx.stroke();};
   diag(1);if(item.type==='no-stopping')diag(-1);
  }
 }
}
