import {CentreRoute} from './centre-route.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {postigoPoint,POSTIGO_MODULE} from './cathedral-data.mjs';
import {BARATILLO,PRESENTACION_BARATILLO,ADRIANO_BASIS,ADRIANO_URBAN_DETAIL,adrianoPoint,ARENAL_REYES,ARENAL_FRAME} from './arenal-data.mjs';
import {CENTRE_MAP} from './centre-data.mjs';
import {TemplePresentations} from './temple-presentations.mjs';
import {rebuildArenalGeometry,populateArenalPublic,paintRebuiltArenal} from './arenal-rebuild.mjs';
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
  rebuildArenalGeometry(this);
  this.presentations=new TemplePresentations(this.scene.presentations);this.presentationIds=[];this.confirmation=null;
  // The native blue checkpoint marker remains visible until the mandatory presentation is validated.
  // Completing a route cannot substitute for this physical stop in front of the chapel.
  this.buildAudience();this.buildReyesLayer();this.buildAdrianoFurniture();this.follow();
 }
 validShape(w,obstacles=this.obstacles){return CathedralRoute.prototype.validShape.call(this,w,obstacles);}
 validPoint(p,obstacles=this.obstacles){return CathedralRoute.prototype.validPoint.call(this,p,obstacles);}
 spriteFilter(graph){return graph===this.sim.mapGraph?'brightness('+(1-this.scene.ambient.darkness*.55)+')':'none';}
 spriteClip(graph){return graph===this.sim.mapGraph?this.nativeKeep:null;}
 buildAudience(){populateArenalPublic(this);}
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

 paintTile(ctx,images,r){paintRebuiltArenal(this,ctx,images,r);}
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
