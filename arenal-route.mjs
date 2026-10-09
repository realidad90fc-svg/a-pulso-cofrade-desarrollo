import {CentreRoute} from './centre-route.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {postigoPoint,POSTIGO_MODULE} from './cathedral-data.mjs';
import {BARATILLO,ADRIANO_BASIS,adrianoPoint,ARENAL_REYES,ARENAL_FRAME} from './arenal-data.mjs';
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
  // A square joining footprint matches the painted street; no hidden rounded limits.
  this.walkable=this.walkable.map(p=>p.length===24?rect(bounds(p)):p);
  this.nativeObstacles=this.nativeObstacles.filter(o=>o.rect[1]<36.5);
  this.obstacles=this.obstacles.filter(o=>o.kind!=='native'||this.nativeObstacles.includes(o));this.nativeEdges=this.nativeEdges.filter(e=>e.a[1]<36.5||e.b[1]<36.5);
  // The original Arfe graph ends here. Clip unused Postigo roofs from NEW streets.
  const angle=147*Math.PI/180;this.arfeDirection=[-Math.sin(angle),Math.cos(angle)];this.arfeNormal=[-this.arfeDirection[1],this.arfeDirection[0]];this.arfeSeam=sim.map.variant.start.position.map((x,i)=>x+this.arfeDirection[i]*1.05);
  const d=this.arfeDirection;
  const nativeKeep=clipHalfPlane(rect([43.6,24,55,36.5]),q=>1.05-((q[0]-this.scene.start.position[0])*d[0]+(q[1]-this.scene.start.position[1])*d[1]));this.nativeKeep=nativeKeep;
  const planes=[q=>q[0]-43.6,q=>36.5-q[1],q=>1.05-((q[0]-this.scene.start.position[0])*d[0]+(q[1]-this.scene.start.position[1])*d[1])];
  const trim=poly=>planes.reduce((p,value)=>clipHalfPlane(p,value),poly);
  const clippedRoad=trim(road);this.walkable=this.walkable.filter(p=>p!==road);this.walkable.push(clippedRoad);this.nativeRoads=[clippedRoad];
  this.obstacles=this.obstacles.filter(o=>{if(o.kind!=='native')return true;if(o.center)return pointInPolygon(o.center,nativeKeep);o.poly=trim(o.poly||rect(o.rect));if(o.poly.length<3)return false;o.rect=bounds(o.poly);return true;});
  this.nativeEdges=this.nativeEdges.flatMap(e=>{let a=e.a,b=e.b;for(const value of planes){const va=value(a),vb=value(b);if(va<0&&vb<0)return [];if((va>=0)!==(vb>=0)){const t=va/(va-vb),q=a.map((x,k)=>x+(b[k]-x)*t);if(va<0)a=q;else b=q;}}return[{...e,a,b}];});
  this.presentations=new TemplePresentations(this.scene.presentations);this.presentationIds=[];this.confirmation=null;
  // No trigger marker floating over the chapel manoeuvre. Architecture guides it.
  const marker=this.graph.nodes.get('centre-checkpoint-marker');if(marker)marker.sprite.enabled=false;
  this.buildAudience();this.buildReyesLayer();this.follow();
 }
 validShape(w,obstacles=this.obstacles){return CathedralRoute.prototype.validShape.call(this,w,obstacles);}
 validPoint(p,obstacles=this.obstacles){return CathedralRoute.prototype.validPoint.call(this,p,obstacles);}
 spriteFilter(graph){return graph===this.sim.mapGraph?'brightness('+(1-this.scene.ambient.darkness*.55)+')':'none';}
 spriteClip(graph){return graph===this.sim.mapGraph?this.nativeKeep:null;}
 buildAudience(){
  for(const p of this.people)this.graph.nodes.delete(p.id);this.people=[];this.audienceBands=[];
  const keys=[...new Set(Object.entries(this.sim.resources.animation.graphs).filter(([name])=>/^mapa\d+$/.test(name)).flatMap(([,g])=>g.nodes.filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|mano|brazo/.test(n.path)).map(n=>n.sprite.key)))];
  for(const key of [...keys,'sharedassets2.assets:509','sharedassets2.assets:606','sharedassets2.assets:563']){const id='arenal-resource-'+key;this.graph.nodes.set(id,{id,name:id,path:id,parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,sprite:{key,enabled:true,order:0,color:[1,1,1,1]}});}
  const addBand=(a,b,from,to,inner,outer,sign)=>{
   if(to<=from)return;const poly=[atBand(a,b,from,sign*inner),atBand(a,b,to,sign*inner),atBand(a,b,to,sign*outer),atBand(a,b,from,sign*outer)],angle=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
   this.audienceBands.push({poly,angle});this.obstacles.push({kind:'crowd-boundary',poly,rect:bounds(poly)});
   for(let off=inner+Math.min(.10,(outer-inner)/2);off<outer-.05;off+=.19)for(let along=from+.09;along<to-.07;along+=.19){const key=keys[(this.people.length*7)%keys.length],sp=this.graph.data.sprites[key];this.people.push({id:'arenal-public-'+this.people.length,point:atBand(a,b,along,sign*off),key,size:sp.rectSize.map(x=>x/sp.pixelsToUnits),baked:true});}
  };
  for(const segment of this.segments){const{a,b,length,module}=segment;if(module.source===ARENAL_REYES.source)continue;
   const inner=module.id==='MODULO_ADRIANO'?.86:.79,outer=inner+1.3;
   for(const sign of[-1,1]){
    if(module.id==='MODULO_ADRIANO'){addBand(a,b,1.4,3.8,inner,outer,sign);if(sign===1){addBand(a,b,3.8,4.8,1.64,2.39,sign);addBand(a,b,7.2,8.2,1.64,2.39,sign);}else addBand(a,b,3.8,8.2,2.30,2.43,sign);addBand(a,b,8.2,length-1.35,inner,outer,sign);}
    else addBand(a,b,1.4,length-1.35,inner,Math.min(outer,module.halfWidth-.05),sign);
   }
  }
  // The chapel's central bay remains genuinely open for the whole rotating paso.
  this.lamps=this.lamps.filter(p=>Math.hypot(p[0]-BARATILLO.position[0],p[1]-BARATILLO.position[1])>2.0);this.obstacles=this.obstacles.filter(o=>o.kind!=='lamp'||this.lamps.some(p=>p===o.center));
  this.obstacles.push({kind:'chapel-wall',poly:[adrianoPoint(4.98,2.45),adrianoPoint(7.02,2.45),adrianoPoint(7.02,3.5),adrianoPoint(4.98,3.5)],rect:bounds([adrianoPoint(4.98,2.45),adrianoPoint(7.02,3.5)])});
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
 follow(){super.follow();}
 updateStreet(){const p=this.sim.position(this.sim.stepEntity.transform);if(Math.hypot(p.x-BARATILLO.position[0],p.y-BARATILLO.position[1])<2.2){if(this.streetNotice?.id!=='baratillo')this.streetNotice={id:'baratillo',name:'Capilla del Baratillo · Presentación',since:this.sim.levelTime};return;}if(p.x>45.2&&p.y<35.3){if(this.streetNotice?.id!=='arfe')this.streetNotice={id:'arfe',name:'Arfe',since:this.sim.levelTime};return;}super.updateStreet();}
 tick(){
  const s=this.sim;this.follow();this.updateStreet();
  const shapes=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity);
  for(const c of shapes)if(!this.validShape(c.world())){s.prefs.motivoGameOver=c.entity.name.startsWith('manigueta')?3:c.entity.name.startsWith('candelabro')?4:2;s.send(s.stepEntity,'gameOverMet');return;}
  const p=s.position(s.stepEntity.transform),moving=['alante','atras','derAl','izqAl','derAt','izqAt'].some(k=>s.controller[k]),stopped=!moving&&!s.controller.martillo;
  const events=this.presentations.update({position:[p.x,p.y],heading:s.angle(s.stepEntity.transform),dt:s.dt,stopped,playing:s.state.status==='playing'});
  for(const event of events){this.presentationIds=[...this.presentations.completed];this.confirmation={label:event.label,since:s.levelTime};if(event.checkpoint){const cp=this.checkpoints.find(c=>c.presentationId===event.id);if(cp){this.checkpointIds.push(cp.id);this.checkpointReached=true;s.emit('checkpoint');}}}
  const f=this.scene.finish,delta=Math.abs(((s.angle(s.stepEntity.transform)-f.heading+540)%360)-180);
  const inFinish=s.controller.animator.state==='pasoBajado'&&delta<=f.tolerance&&shapes.every(c=>{const w=c.world();return(w.circle?Array.from({length:24},(_,i)=>[w.center[0]+w.radius*Math.cos(i*Math.PI/12),w.center[1]+w.radius*Math.sin(i*Math.PI/12)]):w.points).every(q=>pointInPolygon(q,f.polygon));});
  if(inFinish){if(!this.presentations.mandatoryComplete){this.confirmation={label:'FALTA LA PRESENTACIÓN EN EL BARATILLO',since:s.levelTime};return;}this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
 }
 snapshot(){return {...super.snapshot(),presentations:this.presentations?.snapshot()||{completed:[]},geometryVersion:1};}
 restore(v){super.restore(v);this.presentations.restore(v?.presentations);this.presentationIds=[...this.presentations.completed];this.checkpointIds=this.checkpoints.filter(c=>this.presentationIds.includes(c.presentationId)).map(c=>c.id);this.checkpointReached=this.checkpointIds.length>0;this.confirmation=null;this.follow();}
 drawOverlay(ctx,w,h,dpr){
  const note=this.confirmation;if(!note||this.sim.levelTime-note.since>4){super.drawOverlay(ctx,w,h,dpr);return;}
  if(this.sim.timeScale===0||this.sim.state.status!=='playing')return;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);const x=20,y=Math.max(112,h*.145);ctx.fillStyle='rgba(37,19,24,.94)';ctx.fillRect(x,y,w-40,38);ctx.strokeStyle='#a68b55';ctx.strokeRect(x+.5,y+.5,w-41,37);ctx.fillStyle='#eee0c5';ctx.font='14px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(note.label,w/2,y+19,w-58);ctx.restore();
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
  for(const band of this.audienceBands)if(intersects(bounds(band.poly),r))patch(band.poly,[100,1038,400,90],band.angle);
  this.paintBaratillo(ctx,r,images);
  this.paintPastorFacade(ctx,r);
  // Dawn is applied to this new district; the reused Reyes painter already tints itself.
  ctx.save();path(rect([r[0],r[1],r[2],Math.min(r[3],46.8)]));ctx.clip();ctx.globalAlpha=v.ambient.darkness;box(r,v.ambient.tint);ctx.restore();ctx.globalAlpha=1;
  for(const [x,y]of this.lamps)if(x>=r[0]&&x<=r[2]&&y>=r[1]&&y<=r[3]){const g=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),p*.65);g.addColorStop(0,'rgba(255,218,148,.28)');g.addColorStop(1,'rgba(255,207,116,0)');ctx.fillStyle=g;ctx.fillRect(px(x)-p,py(y)-p,2*p,2*p);box([x-.025,y-.025,x+.025,y+.025],'#ffe4ac');}
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
  const tree=images.get('sharedassets2.assets:563'),z=q([1.8,-.13]);if(tree)ctx.drawImage(tree,px(z[0]-.34),py(z[1]+.34),.68*p,.68*p);
 }
 paintPastorFacade(ctx,r){
  const segment=this.segments.find(s=>s.module.id==='MODULO_PASTOR_LANDERO');if(!segment)return;const{a,b,length}=segment,p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  // Recognisable white/yellow arcaded frontage from the supplied Arenal reference.
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  for(let d=1.6;d<length-1.4;d+=.70){const corners=[atBand(a,b,d,1.64),atBand(a,b,d+.64,1.64),atBand(a,b,d+.64,2.12),atBand(a,b,d,2.12)];path(corners);ctx.fillStyle='#dcd6c3';ctx.fill();const arch=[atBand(a,b,d+.10,1.65),atBand(a,b,d+.54,1.65),atBand(a,b,d+.54,1.90),atBand(a,b,d+.45,2.01),atBand(a,b,d+.20,2.01),atBand(a,b,d+.10,1.90)];path(arch);ctx.fillStyle='#30373a';ctx.fill();const lip=[atBand(a,b,d,1.65),atBand(a,b,d+.64,1.65)];ctx.strokeStyle='#be9a50';ctx.lineWidth=.045*p;ctx.beginPath();ctx.moveTo(px(lip[0][0]),py(lip[0][1]));ctx.lineTo(px(lip[1][0]),py(lip[1][1]));ctx.stroke();}
 }
}
