import {gameplayOf,hasGameplay,validateGameplay} from './map-gameplay.mjs';
import {inSurface,shapeOnSurfaces,surfacesOverlapPolygon} from './map-geometry.mjs';
import {obstaclesFor} from './game-editor-bridge.mjs';
import {StreetIdentifiers} from './street-identifiers.mjs';
const polygon=w=>w.circle?Array.from({length:32},(_,i)=>[w.center[0]+Math.cos(i*Math.PI/16)*w.radius,w.center[1]+Math.sin(i*Math.PI/16)*w.radius]):w.points||[];
const box=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const samples=w=>{const p=polygon(w),out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05));for(let j=0;j<=n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}return out};
const distanceToSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t)};
export class MapGameplayRuntime{
 constructor(doc){
  validateGameplay(doc.gameplay);this.config=gameplayOf(doc);this.document=doc;this.replacesCollisions=this.config.collision.mode==='replace';this.ownsEvents=this.config.route.enabled;
  const zones=this.config.collision.zones.filter(z=>z.enabled);
  this.ground=[...(doc.roads||[]),...(doc.sidewalks||[]),...zones.filter(z=>z.kind==='walkable')].filter(o=>o.walkable!==false);
  this.boundaries=zones.filter(z=>z.kind==='boundary');this.blocked=zones.filter(z=>z.kind==='blocked');
  this.obstacles=this.replacesCollisions?obstaclesFor(doc):[];
  this.completed=new Set();this.holds={};this.previous=null;this.finished=false;this.transitioning=false;this.notice=null;
  this.streetIdentifiers=new StreetIdentifiers([...(doc.labels||[]),...(this.ownsEvents?this.config.route.events.filter(e=>e.type==='announcement').map(e=>[e.name,e.position,{radius:e.radius}]):[])]);
 }
 collisionReason(shape){
  const points=samples(shape),poly=polygon(shape);if(!points.length)return null;
  if(this.replacesCollisions&&!shapeOnSurfaces(points,this.ground))return 1;
  if(this.boundaries.length&&!shapeOnSurfaces(points,this.boundaries))return 1;
  if(this.blocked.some(z=>surfacesOverlapPolygon(poly,z)))return 9;
  const bb=box(poly),obstacle=this.obstacles.find(o=>intersects(bb,o.box)&&surfacesOverlapPolygon(poly,o));if(obstacle)return obstacle.reason;
  return null;
 }
 collision(sim){
  if(sim.state.status!=='playing'||sim.timeScale===0)return;
  for(const c of sim.stepColliders.filter(c=>c.enabled&&c.entity!==sim.contraEntity)){
   const reason=this.collisionReason(c.world());if(reason){sim.prefs.motivoGameOver=reason;sim.send(sim.stepEntity,'gameOverMet');return}
  }
 }
 attach(sim,snapshot=null){
  this.sim=sim;sim.gameplay=this;
  if(this.ownsEvents){sim.controller.limiteActual=this.config.route.threeStars;sim.controller.limiteActual2=this.config.route.twoStars;}
  this.restore(snapshot?.gameplay||sim._gameplayState);delete sim._gameplayState;return this;
 }
 streetNoticeFor(sim){if(sim.state.status==='playing'&&sim.timeScale!==0){const p=sim.position(sim.stepEntity.transform);this.notice=this.streetIdentifiers.at([p.x,p.y],sim.levelTime)}return this.notice}
 tick(sim){
  if(!this.ownsEvents||sim.state.status!=='playing'||sim.timeScale===0)return;
  const pos=sim.position(sim.stepEntity.transform),p=[pos.x,pos.y],prev=this.previous||p,route=this.config.route;
  const lowered=sim.controller.animator.state==='pasoBajado',lifted=!['prelevanta','pasoBajado'].includes(sim.controller.animator.state),stopped=Math.hypot(p[0]-prev[0],p[1]-prev[1])<.002&&!sim.controller.martillo&&!['alante','atras','derAl','izqAl','derAt','izqAt'].some(k=>sim.controller[k]);
  this.streetNoticeFor(sim);
  for(const [i,e]of route.events.entries()){
   if(this.completed.has(e.id)||['entry','announcement'].includes(e.type))continue;
   const inRange=Math.hypot(p[0]-e.position[0],p[1]-e.position[1])<=e.radius;
   const passing=!e.lowered&&e.hold===0&&e.heading===null&&distanceToSegment(e.position,prev,p)<=e.radius;
   const prerequisites=route.events.slice(0,i).filter(q=>!['entry','announcement','exit','finish'].includes(q.type)&&(route.ordered||q.mandatory));
   const allMandatory=route.events.filter(q=>q.mandatory&&!['entry','announcement','exit','finish'].includes(q.type));
   if((!inRange&&!passing)||prerequisites.some(q=>!this.completed.has(q.id))||(['finish','exit'].includes(e.type)&&allMandatory.some(q=>!this.completed.has(q.id)))){this.holds[e.id]=0;continue}
   const delta=e.heading===null?0:Math.abs(((sim.angle(sim.stepEntity.transform)-e.heading+540)%360+360)%360-180);
   if((e.lowered?!lowered:!lifted)||delta>e.tolerance||(e.hold>0&&!stopped)){this.holds[e.id]=0;continue}
   this.holds[e.id]=(this.holds[e.id]||0)+sim.dt;if(this.holds[e.id]+1e-8<e.hold)continue;
   this.completed.add(e.id);
   if(e.type==='exit'){
    this.transitioning=true;sim.timeScale=0;sim.emit('map-transition',{targetMap:e.targetMap,targetEntry:e.targetEntry,eventId:e.id});break;
   }
   if(e.type==='finish'){this.finished=true;sim.send(sim.stepEntity,'finJuegoExito');sim.send(sim.cameraEntity,'exitoMet');break}
   sim.mapController.zonaInterPasada=true;sim.controller.checkpointInt=1;sim.prefs.checkpoint=1;sim.prefs.checkpointGuardado=1;
   this.previous=p;sim.checkpointState=sim.snapshot();sim.emit('checkpoint');sim.emit('route-notice',{message:'✓ '+e.name});
  }
  this.previous=p;
 }
 snapshot(){return{completed:[...this.completed],holds:{...this.holds},previous:this.previous,finished:this.finished,street:this.streetIdentifiers.snapshot()}}
 restore(v){const ids=new Set(this.config.route.events.filter(e=>e.type!=='exit').map(e=>e.id));this.completed=new Set((v?.completed||[]).filter(id=>ids.has(id)));this.holds={};this.previous=v?.previous||null;this.finished=!!v?.finished;this.transitioning=false;if(v?.street)this.streetIdentifiers.restore(v.street)}
 drawMarkers(ctx,project){
  if(!this.ownsEvents)return;ctx.save();ctx.setTransform(...project);
  for(const e of this.config.route.events)if(!['announcement','entry'].includes(e.type)&&!this.completed.has(e.id)){ctx.strokeStyle=e.type==='finish'?'#d8b45b':e.type==='presentation'?'#af91f0':'#6ab6c8';ctx.lineWidth=.035;ctx.beginPath();ctx.arc(...e.position,e.radius,0,2*Math.PI);ctx.stroke()}ctx.restore();
 }
}
export function attachMapGameplay(sim,doc,snapshot=null){if(!hasGameplay(doc?.gameplay))return null;return new MapGameplayRuntime(doc).attach(sim,snapshot)}
