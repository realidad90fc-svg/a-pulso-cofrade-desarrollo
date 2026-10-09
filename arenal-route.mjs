import {CentreRoute} from './centre-route.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {postigoPoint,POSTIGO_MODULE} from './cathedral-data.mjs';
import {BARATILLO,PRESENTACION_BARATILLO,ADRIANO_BASIS,ADRIANO_URBAN_DETAIL,adrianoPoint,ARENAL_REYES,ARENAL_FRAME} from './arenal-data.mjs';
import {CENTRE_MAP} from './centre-data.mjs';
import {TemplePresentations} from './temple-presentations.mjs';
const rect=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]];
const bounds=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const intersects=(a,b)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
const clipHalfPlane=(poly,value)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],va=value(a),vb=value(b);if(va>=0)out.push(a);if((va>=0)!==(vb>=0)){const t=va/(va-vb);out.push(a.map((x,k)=>x+(b[k]-x)*t));}}return out;};
const atBand=(a,b,d,o)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1]),t=[(b[0]-a[0])/l,(b[1]-a[1])/l];return[a[0]+t[0]*d-t[1]*o,a[1]+t[1]*d+t[0]*o];};
export class ArenalRoute extends CentreRoute {
 constructor(sim){
  const road=sim.mapColliders.find(c=>c.entity.name==='caminosYVallas').world().points.map(postigoPoint);
  sim.map.variant.originalWalkable=[road];super(sim);
  this.nativeRoads=[road];this.nativeObstacles=[];this.nativeEdges=[];CathedralRoute.prototype.collectNative.call(this,sim.mapColliders,postigoPoint,5);
  this.obstacles.push(...this.nativeObstacles);const root=sim.mapGraph.root,a=POSTIGO_MODULE.rotation*Math.PI/180;root.position=[...postigoPoint(root.position),0];root.rotation=[0,0,Math.sin(a/2),Math.cos(a/2)];
  for(const n of sim.mapGraph.nodes.values())if(n.path.includes('/zonaInter')||n.path.includes('/zonaParada'))n.active=false;
  // Only the CentreRoute synthetic turn disks are removed, NEVER native Arfe.
  // Actual street polygons define both the painted road and collision boundary.
  const nativeCount=this.scene.originalWalkable?.length||0;
  this.walkable=this.walkable.filter((p,i)=>i<nativeCount||p.length!==24);
  this.nativeObstacles=this.nativeObstacles.filter(o=>o.rect[1]<36.5);
  this.obstacles=this.obstacles.filter(o=>o.kind!=='native'||this.nativeObstacles.includes(o));this.nativeEdges=this.nativeEdges.filter(e=>e.a[1]<36.5||e.b[1]<36.5);
  // The original Arfe graph ends here. Clip unused Postigo roofs from NEW streets.
  const angle=147*Math.PI/180;this.arfeDirection=[-Math.sin(angle),Math.cos(angle)];this.arfeNormal=[-this.arfeDirection[1],this.arfeDirection[0]];this.arfeSeam=sim.map.variant.start.position.map((x,i)=>x+this.arfeDirection[i]*1.05);
  const d=this.arfeDirection;
  const nativeKeep=clipHalfPlane(rect([43.6,24,55,36.5]),q=>1.05-((q[0]-this.scene.start.position[0])*d[0]+(q[1]-this.scene.start.position[1])*d[1]));this.nativeKeep=nativeKeep;
  const planes=[q=>q[0]-43.6,q=>36.5-q[1],q=>1.05-((q[0]-this.scene.start.position[0])*d[0]+(q[1]-this.scene.start.position[1])*d[1])];
  const trim=poly=>planes.reduce((p,value)=>clipHalfPlane(p,value),poly);
  const clippedRoad=trim(road);
  this.walkable=this.walkable.filter(p=>p!==road);
  this.walkable.push(clippedRoad);
  // The reused Arfe native floor ends slightly before the TreCai chandeliers'
  // initial footprint. Complete the SAME straight lane, not the turn, with a
  // constant-width connector. No circular turning bay or extra manoeuvre space.
  const link=this.segments.find(s=>s.module.id==='MODULO_ENLACE_ARFE_ADRIANO');
  const start=this.scene.start.position,forward=[link.a[0]-start[0],link.a[1]-start[1]];
  const len=Math.hypot(...forward),u=forward.map(x=>x/len);
  const rear=start.map((x,i)=>x-u[i]*.68);
  const w=link.module.halfWidth,n=[-u[1]*w,u[0]*w];
  const corridor=[[rear[0]+n[0],rear[1]+n[1]],[link.a[0]+n[0],link.a[1]+n[1]],[link.a[0]-n[0],link.a[1]-n[1]],[rear[0]-n[0],rear[1]-n[1]]];
  this.walkable.push(corridor);this.nativeRoads=[clippedRoad,corridor];
  this.arfeStartAxis=u;
  this.obstacles=this.obstacles.filter(o=>{if(o.kind!=='native')return true;if(o.center)return pointInPolygon(o.center,nativeKeep);o.poly=trim(o.poly||rect(o.rect));if(o.poly.length<3)return false;o.rect=bounds(o.poly);return true;});
  this.nativeEdges=this.nativeEdges.flatMap(e=>{let a=e.a,b=e.b;for(const value of planes){const va=value(a),vb=value(b);if(va<0&&vb<0)return [];if((va>=0)!==(vb>=0)){const t=va/(va-vb),q=a.map((x,k)=>x+(b[k]-x)*t);if(va<0)a=q;else b=q;}}return[{...e,a,b}];});
  this.presentations=new TemplePresentations(this.scene.presentations);this.presentationIds=[];this.confirmation=null;
  // The native blue checkpoint marker remains visible until the mandatory presentation is validated.
  // Completing a route cannot substitute for this physical stop in front of the chapel.
  this.buildAudience();this.buildReyesLayer();this.buildAdrianoFurniture();this.follow();
 }
 validShape(w,obstacles=this.obstacles){return CathedralRoute.prototype.validShape.call(this,w,obstacles);}
 validPoint(p,obstacles=this.obstacles){return CathedralRoute.prototype.validPoint.call(this,p,obstacles);}
 spriteFilter(graph){return graph===this.sim.mapGraph?'brightness('+(1-this.scene.ambient.darkness*.55)+')':'none';}
 spriteClip(graph){return graph===this.sim.mapGraph?this.nativeKeep:null;}
 buildAudience(){
  for(const p of this.people)this.graph.nodes.delete(p.id);this.people=[];this.audienceBands=[];this.cornerAudience=[];
  const keys=[...new Set(Object.entries(this.sim.resources.animation.graphs).filter(([name])=>/^mapa\d+$/.test(name)).flatMap(([,g])=>g.nodes.filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|mano|brazo/.test(n.path)).map(n=>n.sprite.key)))];
  for(const key of [...keys,'sharedassets2.assets:509','sharedassets2.assets:606','sharedassets2.assets:563']){const id='arenal-resource-'+key;this.graph.nodes.set(id,{id,name:id,path:id,parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,sprite:{key,enabled:true,order:0,color:[1,1,1,1]}});}
  const addBand=(a,b,from,to,inner,outer,sign)=>{
   if(to<=from)return;const poly=[atBand(a,b,from,sign*inner),atBand(a,b,to,sign*inner),atBand(a,b,to,sign*outer),atBand(a,b,from,sign*outer)],angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
   // Crowd is drawn on the sidewalk, not as an invisible wall intruding into Arfe.
   this.audienceBands.push({poly,angle});
   for(let off=inner+Math.min(.10,(outer-inner)/2);off<outer-.05;off+=.19)for(let along=from+.09;along<to-.07;along+=.19){const key=keys[(this.people.length*7)%keys.length],sp=this.graph.data.sprites[key];const point=atBand(a,b,along,sign*off);if(this.walkable.some(poly=>pointInPolygon(point,poly)))continue;this.people.push({id:'arenal-public-'+this.people.length,point,key,size:sp.rectSize.map(x=>x/sp.pixelsToUnits),baked:true});}
  };
  for(const segment of this.segments){const{a,b,length,module}=segment;if(module.source===ARENAL_REYES.source)continue;
   // Public remains on the real sidewalk, beyond the kerb, including both crossings.
   const inner=module.halfWidth+.045,outer=module.halfWidth+(module.id==='MODULO_ADRIANO'?.52:module.id==='MODULO_PASTOR_LANDERO'?.43:.34);
   for(const sign of[-1,1]){
    if(module.id==='MODULO_ADRIANO'&&sign===1){
     addBand(a,b,.72,4.9,inner,outer,sign);
     addBand(a,b,7.05,length-.72,inner,outer,sign);
    }else addBand(a,b,.68,length-.68,inner,outer,sign);
   }
  }
  // / People at corner *pavements*, not floating on rooftops or blocking manoeuvres.
  // These use original Chicotaz person sprites, with no extra collision wall.
  for(const segment of this.segments){
   if(segment.module.source===ARENAL_REYES.source)continue;
   const {a,b,length,module}=segment;
   if(length<1.55)continue;
   for(const sign of[-1,1])for(const edge of[0,length])for(let d=.12;d<1.08;d+=.145)
    for(let inset=.115;inset<=.515;inset+=.133){
     const along=edge===0?d:length-d;
     const point=atBand(a,b,along,sign*(module.halfWidth+inset));
     if(this.walkable.some(poly=>pointInPolygon(point,poly)))continue;
     const key=keys[(this.cornerAudience.length*3)%keys.length],sp=this.graph.data.sprites[key];
     if(sp)this.cornerAudience.push({point,key,size:sp.rectSize.map(x=>x/sp.pixelsToUnits)});
    }
  }
  // The chapel's central bay remains genuinely open for the whole rotating paso.
  this.lamps=this.lamps.filter(p=>Math.hypot(p[0]-BARATILLO.position[0],p[1]-BARATILLO.position[1])>2.0);this.obstacles=this.obstacles.filter(o=>o.kind!=='lamp'||this.lamps.some(p=>p===o.center));
  this.obstacles.push({kind:'chapel-wall',poly:[adrianoPoint(4.98,2.45),adrianoPoint(7.02,2.45),adrianoPoint(7.02,3.5),adrianoPoint(4.98,3.5)],rect:bounds([adrianoPoint(4.98,2.45),adrianoPoint(7.02,3.5)])});
 }
 // Original APK tree sprite and compact road signs; no invented turns or wider streets.
 buildAdrianoFurniture(){
  const detail=ADRIANO_URBAN_DETAIL;
  this.adrianoTrees=detail.trees.filter(o=>o.d<ADRIANO_BASIS.length-.14).map(({d,side},i)=>({id:'adriano-tree-'+i,point:adrianoPoint(d,side*(2.45+.12)),d,side}));
  this.adrianoSigns=detail.signs.map(({d,side,type},i)=>({id:'adriano-sign-'+i,point:adrianoPoint(d,side*(2.45+.065)),d,side,type}));
  // Street furniture touches the visible pavement: no invisible broad collision margin.
  for(const item of this.adrianoTrees)this.obstacles.push({kind:'tree',center:item.point,radius:.12,rect:[item.point[0]-.12,item.point[1]-.12,item.point[0]+.12,item.point[1]+.12]});
  for(const item of this.adrianoSigns)this.obstacles.push({kind:'traffic-sign',center:item.point,radius:.065,rect:[item.point[0]-.065,item.point[1]-.065,item.point[0]+.065,item.point[1]+.065]});
 }
 buildReyesLayer(){
  // Existing CentreRoute paints the SAME module and bridge approach in local space.
  // A rigid translation places this instance into Arfe's independent native frame.
  const shift=p=>[p[0],p[1]-ARENAL_FRAME.reyesTranslation[1]],source=ARENAL_REYES.source;
  const layer=Object.create(CentreRoute.prototype);layer.scene={...CENTRE_MAP,ambient:this.scene.ambient};layer.graph=this.graph;
  layer.segments=this.segments.filter(s=>s.module===ARENAL_REYES).map(s=>({...s,a:shift(s.a),b:shift(s.b),polygon:s.polygon.map(shift),module:source}));
  layer.walkable=layer.segments.flatMap(s=>[s.polygon,rect([s.a[0]-1.4,s.a[1]-1.4,s.a[0]+1.4,s.a[1]+1.4]),rect([s.b[0]-1.4,s.b[1]-1.4,s.b[0]+1.4,s.b[1]+1.4])]);
  layer.houses=this.houses.filter(h=>h.module===ARENAL_REYES).map(h=>({...h,poly:h.poly.map(shift),bounds:[h.bounds[0],h.bounds[1]-20,h.bounds[2],h.bounds[3]-20],front:h.front.map(shift),module:source}));layer.people=[];layer.lamps=this.lamps.filter(p=>p[1]>46).map(shift);
  const keys=[...new Set(this.people.map(p=>p.key))];let count=0;
  for(let x=33.65;x<45.1;x+=.19)for(const sign of[-1,1])for(let row=0;row<5;row++){const point=[x+(row%2)*.07,29.6+sign*(1+row*.17)],key=keys[count++%keys.length],sp=this.graph.data.sprites[key];if(x>38.2&&x<41.2)continue;layer.people.push({point,key,size:sp.rectSize.map(x=>x/sp.pixelsToUnits),baked:true});}
  for(const [from,to]of[[33.65,38.2],[41.2,45.1]])for(const sign of[-1,1]){const ys=[49.6+sign*.88,49.6+sign*1.82].sort((a,b)=>a-b),poly=rect([from,ys[0],to,ys[1]]);this.obstacles.push({kind:'crowd-boundary',poly,rect:bounds(poly)});}
  this.reyesLayer=layer;
 }
 // Guard against a step being initialized with inherited APK collider heading
 // before the custom route's heading is applied. Only at first, unplayed spawn:
 // choose the nearest clear point on the SAME Arfe lane. Never ignore contact,
 // resize the paso, change physics or reposition it during a running route.
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
 updateStreet(){const p=this.sim.position(this.sim.stepEntity.transform);if(Math.hypot(p.x-BARATILLO.position[0],p.y-BARATILLO.position[1])<2.2){if(this.streetNotice?.id!=='baratillo')this.streetNotice={id:'baratillo',name:'Capilla del Baratillo · Presentación',since:this.sim.levelTime};return;}if(p.x>45.2&&p.y<35.3){if(this.streetNotice?.id!=='arfe')this.streetNotice={id:'arfe',name:'Arfe',since:this.sim.levelTime};return;}super.updateStreet();}
 tick(){
  const s=this.sim;this.ensureInitialClearance();this.follow();this.updateStreet();
  const shapes=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity);
  for(const c of shapes)if(!this.validShape(c.world())){s.prefs.motivoGameOver=c.entity.name.startsWith('manigueta')?3:c.entity.name.startsWith('candelabro')?4:2;s.send(s.stepEntity,'gameOverMet');return;}
  const p=s.position(s.stepEntity.transform),moving=['alante','atras','derAl','izqAl','derAt','izqAt'].some(k=>s.controller[k]),stopped=!moving&&!s.controller.martillo;
  const events=this.presentations.update({position:[p.x,p.y],heading:s.angle(s.stepEntity.transform),dt:s.dt,stopped,playing:s.state.status==='playing'});
  for(const event of events){this.presentationIds=[...this.presentations.completed];this.confirmation={label:'✓ PRESENTACIÓN COMPLETADA · CHECKPOINT GUARDADO',since:s.levelTime};this.tileCache.clear();if(event.checkpoint){const cp=this.checkpoints.find(c=>c.presentationId===event.id);if(cp&&!this.checkpointIds.includes(cp.id)){this.checkpointIds.push(cp.id);this.checkpointReached=true;s.emit('checkpoint');}}}
  const f=this.scene.finish,delta=Math.abs(((s.angle(s.stepEntity.transform)-f.heading+540)%360)-180);
  const inFinish=s.controller.animator.state==='pasoBajado'&&delta<=f.tolerance&&shapes.every(c=>{const w=c.world();return(w.circle?Array.from({length:24},(_,i)=>[w.center[0]+w.radius*Math.cos(i*Math.PI/12),w.center[1]+w.radius*Math.sin(i*Math.PI/12)]):w.points).every(q=>pointInPolygon(q,f.polygon));});
  if(inFinish){if(!this.presentations.mandatoryComplete){this.confirmation={label:'FALTA LA PRESENTACIÓN EN EL BARATILLO',since:s.levelTime};return;}this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
 }
 snapshot(){return {...super.snapshot(),presentations:this.presentations?.snapshot()||{completed:[]},geometryVersion:1};}
 restore(v){super.restore(v);this.presentations.restore(v?.presentations);this.presentationIds=[...this.presentations.completed];this.checkpointIds=this.checkpoints.filter(c=>this.presentationIds.includes(c.presentationId)).map(c=>c.id);this.checkpointReached=this.checkpointIds.length>0;this.confirmation=null;this.follow();}
 drawOverlay(ctx,w,h,dpr){
  super.drawOverlay(ctx,w,h,dpr);
  if(this.sim.timeScale===0||this.sim.state.status!=='playing')return;
  const note=this.confirmation,showConfirmation=note&&this.sim.levelTime-note.since<=4;
  const cfg=PRESENTACION_BARATILLO,p=this.sim.position(this.sim.stepEntity.transform);
  const distance=Math.hypot(p.x-cfg.position[0],p.y-cfg.position[1]);
  if(!showConfirmation&&(this.presentations.completed.includes(cfg.id)||distance>5.2))return;
  const degrees=Math.abs(((this.sim.angle(this.sim.stepEntity.transform)-cfg.heading+540)%360)-180);
  const stopped=!['alante','atras','derAl','izqAl','derAt','izqAt'].some(k=>this.sim.controller[k])&&!this.sim.controller.martillo;
  const hold=Math.max(0,Math.min(cfg.holdSeconds,this.presentations.hold[cfg.id]||0));
  const title=showConfirmation?note.label:'CAPILLA DEL BARATILLO · PRESENTACIÓN OBLIGATORIA';
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
 paintTile(ctx,images,r){
  const v=this.scene,p=v.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p,path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();},box=(b,c)=>{ctx.fillStyle=c;ctx.fillRect(px(b[0]),py(b[3]),(b[2]-b[0])*p,(b[3]-b[1])*p);};ctx.imageSmoothingEnabled=false;
  for(let x=Math.floor(r[0]/3)*3;x<r[2];x+=3)for(let y=Math.floor(r[1]/3)*3;y<r[3];y+=3){const im=images.get(NATIVE_HOUSE_KEYS[Math.abs(Math.round(x*7+y*3))%NATIVE_HOUSE_KEYS.length]);if(im)ctx.drawImage(im,px(x),py(y+3),3*p,3*p);}
  // One native pavement material joins the original Arfe road and new streets.
  const patch=(poly,crop,angle=90)=>CathedralRoute.prototype.paintNativePatch.call(this,ctx,images,r,poly,crop,angle);
  for(const h of this.houses){if(h.module===ARENAL_REYES||!intersects(h.bounds,r))continue;ctx.save();path(h.poly);ctx.clip();const im=images.get(NATIVE_HOUSE_KEYS[h.material]);if(im)ctx.drawImage(im,px(h.bounds[0]),py(h.bounds[3]),(h.bounds[2]-h.bounds[0])*p,(h.bounds[3]-h.bounds[1])*p);ctx.restore();const [a,b]=h.front;ctx.strokeStyle='#cdbca2';ctx.lineWidth=.045*p;ctx.beginPath();ctx.moveTo(px(a[0]),py(a[1]));ctx.lineTo(px(b[0]),py(b[1]));ctx.stroke();for(let k=0;k<3;k++){const q=a.map((x,i)=>x+(b[i]-x)*(k+.3)/3),t=h.t,n=h.n;const window=[atBand(q,[q[0]+t[0],q[1]+t[1]],0,.05),atBand(q,[q[0]+t[0],q[1]+t[1]],.28,.05),atBand(q,[q[0]+t[0],q[1]+t[1]],.28,-.10),atBand(q,[q[0]+t[0],q[1]+t[1]],0,-.10)];path(window);ctx.fillStyle=k===1?'#35464b':'#24292d';ctx.fill();}}
  for(const poly of this.walkable)if(intersects(bounds(poly),r))patch(poly,[1610,1050,96,96]);
  // Existing Reyes Católicos painter and bridgehead: no new street/deck geometry.
  if(r[3]>46.8){ctx.save();path(rect([23,46.8,45.25,60]));ctx.clip();const layer=this.reyesLayer,old=layer.scene;layer.scene={...old,ppu:p};CentreRoute.prototype.paintTile.call(layer,ctx,images,[r[0],r[1]-20,r[2],r[3]-20]);layer.scene=old;ctx.restore();}
  ctx.save();this.clipArchitectureToRealRoad(ctx,r);this.paintContinuousArenal(ctx,r,images);ctx.restore();
  for(const band of this.audienceBands)if(intersects(bounds(band.poly),r))patch(band.poly,[100,1038,400,90],band.angle);
  this.paintBaratillo(ctx,r,images);
  this.paintPastorFacade(ctx,r);
  this.paintArenalCornerAudience(ctx,r,images);
  this.paintAdrianoFurniture(ctx,r,images);
  // Dawn is applied to this new district; the reused Reyes painter already tints itself.
  ctx.save();path(rect([r[0],r[1],r[2],Math.min(r[3],46.8)]));ctx.clip();ctx.globalAlpha=v.ambient.darkness;box(r,v.ambient.tint);ctx.restore();ctx.globalAlpha=1;
  for(const [x,y]of this.lamps)if(x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3]){const g=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),p*.65);g.addColorStop(0,'rgba(255,218,148,.28)');g.addColorStop(1,'rgba(255,207,116,0)');ctx.fillStyle=g;ctx.fillRect(px(x)-p,py(y)-p,2*p,2*p);box([x-.025,y-.025,x+.025,y+.025],'#ffe4ac');}
 }
 // Clip roofs, adjoining facades and sidewalks against ALL real street and
 // rounded junction polygons. Eliminates roof wedges crossing a neighbour lane,
 // without opening even a centimetre of extra navigable space.
 clipArchitectureToRealRoad(ctx,r){
  const p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  for(const poly of this.walkable){
   if(poly.length<3||!intersects(bounds(poly),r))continue;
   ctx.beginPath();ctx.rect(0,0,(r[2]-r[0])*p,(r[3]-r[1])*p);
   poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));
   ctx.closePath();ctx.clip('evenodd');
  }
 }
 paintArenalCornerAudience(ctx,r,images){
  const p=this.scene.ppu;
  for(const item of this.cornerAudience){
   const [x,y]=item.point,[w,h]=item.size;
   if(!intersects([x-w/2,y-h/2,x+w/2,y+h/2],r))continue;
   const image=images.get(item.key);if(image)ctx.drawImage(image,(x-w/2-r[0])*p,(r[3]-y-h/2)*p,w*p,h*p);
  }
 }
 // Each building row is a continuous frontage; roof textures come from the APK.
 // We draw the curb outside the existing collision lane and keep intersections uncut.
 paintContinuousArenal(ctx,r,images){
  const p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  const fill=(poly,color)=>{path(poly);ctx.fillStyle=color;ctx.fill();};
  const line=(a,color,width)=>{path([...a,a[0]]);ctx.strokeStyle=color;ctx.lineWidth=width*p;ctx.stroke();};
  const tiles=['#cfcac0','#d8d3c9','#c6c0b6'];
  const modules=['MODULO_ADRIANO','MODULO_PASTOR_LANDERO','MODULO_ENLACE_ARFE_ADRIANO'];
  for(const seg of this.segments){if(!modules.includes(seg.module.id))continue;
   const {a,b,length,module}=seg;
   if(!intersects(bounds([a,b]),[r[0]-6,r[1]-6,r[2]+6,r[3]+6]))continue;
   const at=(d,o)=>atBand(a,b,d,o);
   for(const side of [-1,1]){
    const kerb=module.halfWidth;
    // Frontages remain BEHIND the actual footpath: no roof on sidewalk.
    const pavement=module.id==='MODULO_ADRIANO'?.62:module.id==='MODULO_PASTOR_LANDERO'?.49:.37;
    const front=kerb+pavement+.055,far=front+3.12;
    const facade=[at(0,side*front),at(length,side*front),at(length,side*far),at(0,side*far)];
    fill(facade,side===1?'#d7c4aa':'#d2c7b6');
    // Opaque, uninterrupted roof mass replaces the seams between original house rectangles.
    const materialIndex=(module.id==='MODULO_ADRIANO'?4:module.id==='MODULO_PASTOR_LANDERO'?2:0)+(side===1?1:0);
    const roof=images.get(NATIVE_HOUSE_KEYS[materialIndex]);
    if(roof){ctx.save();path(facade);ctx.clip();const bb=bounds(facade);ctx.globalAlpha=.93;for(let x=Math.floor(bb[0]/2)*2;x<bb[2];x+=2)for(let y=Math.floor(bb[1]/2)*2;y<bb[3];y+=2)ctx.drawImage(roof,px(x),py(y+2),2*p,2*p);ctx.restore();}
    // The street clip leaves actual swept curbs visible at junctions, without cut roofs.
    // Paint a continuous front before separate entrances and balconies.
    const frontLine=[at(.02,side*(front+.012)),at(length-.02,side*(front+.012))];
    ctx.beginPath();frontLine.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));
    ctx.strokeStyle=side===1?'#e6d7bd':'#f0e2cf';ctx.lineWidth=.075*p;ctx.stroke();
    // NO8DO-like hexagonal tiles, clipped to actual parallel pavement (no arbitrary chamfer).
    const pav=[at(0,side*(kerb+.012)),at(length,side*(kerb+.012)),at(length,side*(kerb+pavement)),at(0,side*(kerb+pavement))];
    fill(pav,'#c8c2b6');ctx.save();path(pav);ctx.clip();ctx.strokeStyle='rgba(100,94,82,.32)';ctx.lineWidth=.011*p;
    const step=.20,rad=.10;
    for(let d=.10;d<length+.16;d+=step*1.5)for(let z=0;z<4;z++){
     const y=kerb+.04+z*rad*1.69,off=side*y,x=d+(z%2)*step*.75;
     ctx.beginPath();for(let k=0;k<6;k++){const q=at(x+Math.cos(k*Math.PI/3)*rad,off+side*Math.sin(k*Math.PI/3)*rad);k?ctx.lineTo(px(q[0]),py(q[1])):ctx.moveTo(px(q[0]),py(q[1]));}ctx.closePath();ctx.stroke();
    }ctx.restore();
    const curb=[at(0,side*(kerb+.01)),at(length,side*(kerb+.01))];
    ctx.beginPath();curb.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));
    ctx.strokeStyle='#938b7c';ctx.lineWidth=.085*p;ctx.stroke();
    ctx.strokeStyle='#eee5d8';ctx.lineWidth=.024*p;ctx.stroke();
    // Architecturally regular balconies: withhold them from the chapel's narrow portal.
    for(let d=.35;d<length-.22;d+=.62){if(module.id==='MODULO_ADRIANO'&&side===1&&d>4.55&&d<7.50)continue;
     const door=d>1.8&&Math.floor(d/.62)%5===2;
     const w=door?.29:.38,depth=door?.09:.14;
     const poly=[at(d,side*(front+.018)),at(d+w,side*(front+.018)),at(d+w,side*(front+.018+depth)),at(d,side*(front+.018+depth))];
     fill(poly,door?'#744c40':'#333b3e');
     if(!door){const rail=[at(d-.025,side*(front+.012)),at(d+w+.025,side*(front+.012))];
      ctx.beginPath();rail.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));
      ctx.strokeStyle='#252b2b';ctx.lineWidth=.022*p;ctx.stroke();}
    }
   }
  }
 }
 paintAdrianoFurniture(ctx,r,images){
  const p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const nativeTree=images.get(ADRIANO_URBAN_DETAIL.treeSprite);
  for(const item of this.adrianoTrees||[]){const [x,y]=item.point;if(!intersects([x-.55,y-.55,x+.55,y+.55],r))continue;
   // A real tree pit and trunk under a native Chicotaz canopy (not an unrelated emoji/tree).
   ctx.fillStyle='#968d7c';ctx.fillRect(px(x-.17),py(y+.17),.34*p,.34*p);
   ctx.fillStyle='#514738';ctx.fillRect(px(x-.135),py(y+.135),.27*p,.27*p);
   ctx.fillStyle='#403b30';ctx.beginPath();ctx.arc(px(x),py(y),.060*p,0,Math.PI*2);ctx.fill();
   if(nativeTree){ctx.globalAlpha=.96;ctx.drawImage(nativeTree,px(x-.43),py(y+.43),.86*p,.86*p);ctx.globalAlpha=1;}
  }
  for(const item of this.adrianoSigns||[]){const [x,y]=item.point;if(!intersects([x-.25,y-.25,x+.25,y+.25],r))continue;
   // Semana Santa traffic restriction signs in the original top-down sprite scale.
   ctx.fillStyle='#313c42';ctx.beginPath();ctx.arc(px(x)+.028*p,py(y)+.025*p,.075*p,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#d0d2ca';ctx.beginPath();ctx.arc(px(x),py(y),.126*p,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#bd302e';ctx.beginPath();ctx.arc(px(x),py(y),.118*p,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#244e7a';ctx.beginPath();ctx.arc(px(x),py(y),.090*p,0,Math.PI*2);ctx.fill();
   const diag=(positive)=>{ctx.beginPath();ctx.moveTo(px(x+(-positive)*.068),py(y+.068));ctx.lineTo(px(x+(positive)*.068),py(y-.068));ctx.lineWidth=.026*p;ctx.strokeStyle='#ce3d39';ctx.stroke();};
   diag(1);if(item.type==='no-stopping')diag(-1);
  }
 }
 paintBaratillo(ctx,r,images){
  const p=this.scene.ppu,origin=BARATILLO.door,t=ADRIANO_BASIS.t,n=ADRIANO_BASIS.n,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const q=([x,y])=>[origin[0]+t[0]*x+n[0]*y,origin[1]+t[1]*x+n[1]*y],poly=ps=>{ctx.beginPath();ps.map(q).forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();},box=(b,c)=>{poly(rect(b));ctx.fillStyle=c;ctx.fill();},line=(ps,c,width)=>{ctx.beginPath();ps.map(q).forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.strokeStyle=c;ctx.lineWidth=width*p;ctx.stroke();};
  // Low cream façade, red Baroque door surround, dark studded door, upper niche.
  // Like original landmarks it is painted in the overhead game's own plane.
  box([-1.02,0,1.02,1.12],'#c7b698');box([-1.10,.91,1.10,1.03],'#ddd1b5');box([-.78,-.025,.78,.08],'#e3d8bd');box([-.65,.04,.65,.72],'#87443d');box([-.55,.05,.55,.64],'#3d2927');
  for(let y=.12;y<.63;y+=.10)for(let x=-.46;x<.53;x+=.10)box([x,y,x+.018,y+.018],'#ae9670');line([[0,.05],[0,.63]],'#191b1b',.025);
  poly([[-.78,.70],[0,.93],[.78,.70]]);ctx.fillStyle='#934a40';ctx.fill();line([[-.78,.70],[0,.93],[.78,.70]],'#b47a61',.04);
  box([-.20,.79,.20,1.03],'#87443d');box([-.12,.82,.12,.99],'#38535b');box([-.035,.84,.035,.93],'#c5a873');line([[-.035,1.09],[-.035,1.28]],'#756b59',.035);line([[-.13,1.20],[.06,1.20]],'#756b59',.03);
  for(const side of[-1,1]){box([side*.86-.085,.22,side*.86+.085,.44],'#ded5bb');box([side*.85-.05,-.02,side*.85+.05,.14],'#303336');box([side*.85-.032,.012,side*.85+.032,.105],'#ffe8b2');const w=q([side*.85,.05]),g=ctx.createRadialGradient(px(w[0]),py(w[1]),0,px(w[0]),py(w[1]),.8*p);g.addColorStop(0,'rgba(255,220,140,.35)');g.addColorStop(1,'rgba(255,220,140,0)');ctx.fillStyle=g;ctx.fillRect(px(w[0])-p,py(w[1])-p,2*p,2*p);}
  // Lit threshold, contiguous fronts and a native tree beside, not across, the bay.
  line([[-.48,.02],[.48,.02]],'#ffe3a3',.07);box([-2.2,.04,-1.07,.38],'#d2c09d');box([1.07,.04,2.2,.38],'#e1d8c1');box([-2,.07,-1.27,.16],'#263536');box([1.3,.07,2,.16],'#25343a');
  // Pavement-level checkpoint, aligned with the *actual* validation point; it does not
  // enlarge the street or alter the paso's physics. The native blue marker stands over it.
  const target=BARATILLO.position,dx=target[0]-origin[0],dy=target[1]-origin[1];
  const along=dx*t[0]+dy*t[1],across=dx*n[0]+dy*n[1],done=this.presentationIds?.includes(PRESENTACION_BARATILLO.id);
  const half=PRESENTACION_BARATILLO.positionTolerance;
  poly([[along-half,across-half],[along+half,across-half],[along+half,across+half],[along-half,across+half]]);
  ctx.strokeStyle=done?'#d3b46d':'#83c8dc';ctx.lineWidth=.045*p;ctx.setLineDash([.13*p,.075*p]);ctx.stroke();ctx.setLineDash([]);
  if(!done){line([[along,across-.16],[along,across+.12]],'#d7e7db',.045);poly([[along-.11,across+.06],[along+.11,across+.06],[along,across+.25]]);ctx.fillStyle='#d7e7db';ctx.fill();}
 }
 paintPastorFacade(ctx,r){
  const segment=this.segments.find(s=>s.module.id==='MODULO_PASTOR_LANDERO');if(!segment)return;const{a,b,length}=segment,p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  // Recognisable white/yellow arcaded frontage from the supplied Arenal reference.
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  for(let d=1.6;d<length-1.4;d+=.70){const corners=[atBand(a,b,d,1.64),atBand(a,b,d+.64,1.64),atBand(a,b,d+.64,2.12),atBand(a,b,d,2.12)];path(corners);ctx.fillStyle='#dcd6c3';ctx.fill();const arch=[atBand(a,b,d+.10,1.65),atBand(a,b,d+.54,1.65),atBand(a,b,d+.54,1.90),atBand(a,b,d+.45,2.01),atBand(a,b,d+.20,2.01),atBand(a,b,d+.10,1.90)];path(arch);ctx.fillStyle='#30373a';ctx.fill();const lip=[atBand(a,b,d,1.65),atBand(a,b,d+.64,1.65)];ctx.strokeStyle='#be9a50';ctx.lineWidth=.045*p;ctx.beginPath();ctx.moveTo(px(lip[0][0]),py(lip[0][1]));ctx.lineTo(px(lip[1][0]),py(lip[1][1]));ctx.stroke();}
 }
}
