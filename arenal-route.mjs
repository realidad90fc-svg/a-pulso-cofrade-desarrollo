import {CentreRoute} from './centre-route.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {BARATILLO,PRESENTACION_BARATILLO,ADRIANO_BASIS,ADRIANO_URBAN_DETAIL,adrianoPoint,ARENAL_REYES} from './arenal-data.mjs';
import {TemplePresentations} from './temple-presentations.mjs';

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
  this.buildStreets();
  this.buildBuildingBlocks();
  this.buildAdrianoFurniture();
  this.buildAudienceFromStreets();
  this.presentations=new TemplePresentations(this.scene.presentations);
  this.presentationIds=[];this.confirmation=null;
  this.follow();
 }
 buildStreets(){
  // Same staged place references, with *all* old synthetic disks removed.
  const modules=['MODULO_ENLACE_ARFE_ADRIANO','MODULO_ADRIANO','MODULO_PASTOR_LANDERO'];
  this.arenalSections=this.segments.filter(s=>modules.includes(s.module.id));
  this.reyesSegment=this.segments.find(s=>s.module===ARENAL_REYES);
  this.walkable=this.segments.map(s=>s.polygon);
  // TreCai enters from the last genuinely playable Arfe fragment; link a
  // short STRAIGHT corridor to that street, never a circular turning plaza.
  const first=this.arenalSections[0],start=this.scene.start.position;
  const axis=[first.a[0]-start[0],first.a[1]-start[1]],len=Math.hypot(...axis)||1;
  const u=axis.map(q=>q/len),normal=[-u[1],u[0]],w=first.module.halfWidth;
  const rear=start.map((v,i)=>v-u[i]*1.12);
  const beyond=first.a.map((v,i)=>v+u[i]*.35);
  this.startLane=[rear.map((x,i)=>x+normal[i]*w),beyond.map((x,i)=>x+normal[i]*w),beyond.map((x,i)=>x-normal[i]*w),rear.map((x,i)=>x-normal[i]*w)];
  this.walkable.unshift(this.startLane);
  this.arfeStartAxis=u;
  // Only tight four-point junctions; no 24-sided artificial circular corners.
  this.turnFaces=[];
  for(let i=0;i<this.arenalSections.length-1;i++){
   const from=this.arenalSections[i],to=this.arenalSections[i+1],p=from.b;
   if(distance(p,to.a)>.05)continue;
   const a=from.module.halfWidth,b=to.module.halfWidth;
   const face=[[p[0]+from.n[0]*a,p[1]+from.n[1]*a],[p[0]+to.n[0]*b,p[1]+to.n[1]*b],[p[0]-to.n[0]*b,p[1]-to.n[1]*b],[p[0]-from.n[0]*a,p[1]-from.n[1]*a]];
   // Road spans define the corner; these mitred connectors contain no
   // arbitrary lane-radius enlargement and share the same painted material.
   this.turnFaces.push(hull(face));
  }
  this.walkable.push(...this.turnFaces);
  this.roadBoxes=this.walkable.map(bounds);
  this.sidewalkDepth=module=>module?.id==='MODULO_ADRIANO'?.54:module?.id==='MODULO_PASTOR_LANDERO'?.47:module?.style==='avenue'?.62:.41;
  // Visible and collidable footprint are identical. Decorative buildings
  // are always beneath the final road surface; no overwriting the step lane.
  this.crossroads=this.arenalSections.map(s=>[s.a,s.b]).flat();
 }
 buildBuildingBlocks(){
  this.buildings=[];
  const baseKeys=NATIVE_HOUSE_KEYS.length;
  for(const s of this.segments){
   const half=s.module.halfWidth,sidewalk=this.sidewalkDepth(s.module);
   for(const sign of[-1,1]){
    const near=half+sidewalk+.07;
    const isAdriano=s.module.id==='MODULO_ADRIANO';
    const groups=isAdriano&&sign===1?[[.18,4.43],[7.43,s.length-.18]]:[[.18,s.length-.18]];
    for(const [from,to]of groups){
     let blockIndex=0;
     for(let d=from;d<to-.20;d+=1.7){
      const end=Math.min(to,d+1.63);
      if(end-d<.34)continue;
      const p=lane(s,d,end,near,near+2.10+((blockIndex+1)%3)*.32,sign);
      this.buildings.push({poly:p,bbox:bounds(p),key:NATIVE_HOUSE_KEYS[(this.buildings.length+blockIndex*3)%baseKeys]});
      blockIndex++;
     }
    }
   }
  }
 }
 buildAudienceFromStreets(){
  // Public is installed after lanes and before rooftops: a visible sprite
  // is always present at every obstacle. More people on street shoulders,
  // with a wide enough centre for the complete unscaled paso.
  const sprites=this.sim.resources.animation.graphs,all=this.graph.data.sprites;
  const keys=[...new Set(Object.entries(sprites).filter(([k])=>/^mapa\d+$/.test(k))
   .flatMap(([,graph])=>(graph.nodes||[]).filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|brazo|mano/.test(n.path))
     .map(n=>n.sprite.key).filter(key=>all[key]?.rectSize?.[0]>0)))];
  if(!keys.length)return;
  const max=this.scene.crowd?.maxPeople||3000,start=this.scene.start.position;
  const add=(point,contact)=>{
   if(this.people.length>=max)return;
   const i=this.people.length,key=keys[((i*7+Math.floor(point[0]*9)+Math.floor(point[1]*4))%keys.length+keys.length)%keys.length];
   const sp=all[key],size=sp.rectSize.map(n=>n/sp.pixelsToUnits);
   if(!sp||!Number.isFinite(size[0]))return;
   if(this.obstacles.some(o=>o.center&&distance(o.center,point)<(o.radius||.08)+.13))return;
   if(contact){
    if(distance(point,start)<3.1||distance(point,BARATILLO.position)<2.7)return;
    if(this.crossroads.some(c=>distance(point,c)<1.55))return;
    const r=Math.max(.060,Math.min(.092,size[0]*.48));
    this.obstacles.push({kind:'visible-spectator',center:point,radius:r,rect:[point[0]-r,point[1]-r,point[0]+r,point[1]+r]});
   }
   this.people.push({id:'arenal-spectator-'+i,key,point,size,baked:true});
  };
  for(const s of this.segments){
   const w=s.module.halfWidth,sw=this.sidewalkDepth(s.module);
   for(const sign of[-1,1]){
    for(let d=.14;d<s.length-.10;d+=.18){
     const nearCorner=d<1.60||d>s.length-1.6,chapel=s.module.id==='MODULO_ADRIANO'&&d>3.75&&d<8.05;
     // At awkward bends, the audience stays on the real footpath, not in
     // a shortcut through the junction. Away from them it tightens the lane.
     let inner=(nearCorner||chapel)?w+.12:
      s.module.style==='avenue'?1.95:s.module.id==='MODULO_ADRIANO'?1.35:
      s.module.id==='MODULO_PASTOR_LANDERO'?1.17:1.10;
     const outer=w+sw+.42;
     let row=0;
     for(let offset=inner;offset<outer;offset+=.18,row++){
      const q=at(s,d+(row%2)*.06,offset*sign);
      const inStreet=offset<w-.09&&!nearCorner&&!chapel;
      add(q,inStreet&&row===0&&Math.round(d/.18)%2===0);
     }
    }
   }
  }
 }
 // Simple painted strip as behind-the-kerb frontage. Native pixel art
 // textures and tiling come from assets already loaded for other maps.
 paintTile(ctx,images,r){
  const p=this.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  const box=(a,b,c)=>{ctx.fillStyle=c;ctx.fillRect(px(a[0]),py(a[3]),(a[2]-a[0])*p,(a[3]-a[1])*p);};
  const img=key=>images.get(key)||images.get(this.graph.data.sprites[key]?.image);
  ctx.imageSmoothingEnabled=false;
  // BACKGROUND: World aligned Chicotaz 3-unit roofs, never foreign textures.
  box(r,null,'#65605a');
  for(let x=Math.floor(r[0]/3)*3;x<r[2];x+=3)
   for(let y=Math.floor(r[1]/3)*3;y<r[3];y+=3){
    const im=img(NATIVE_HOUSE_KEYS[Math.abs(Math.round(x*7+y*3))%NATIVE_HOUSE_KEYS.length]);
    if(im)ctx.drawImage(im,px(x),py(y+3),3*p,3*p);
   }
  // Architectural volumes are BELOW sidewalk and asphalt. A building can
  // never cover a road tile, even at a seam or sharp corner.
  for(const b of this.buildings){
   if(!intersects(b.bbox,r))continue;
   const im=img(b.key);if(!im)continue;
   ctx.save();path(b.poly);ctx.clip();
   const [x,y,xx,yy]=b.bbox;
   ctx.drawImage(im,px(x),py(yy),(xx-x)*p,(yy-y)*p);
   ctx.restore();
  }
  // PAVEMENTS: one continuous low-contrast ring for the whole road union.
  ctx.save();ctx.lineJoin='miter';ctx.miterLimit=1.5;
  for(let i=0;i<this.walkable.length;i++){
   const poly=this.walkable[i];
   if(!intersects(this.roadBoxes[i],[r[0]-.8,r[1]-.8,r[2]+.8,r[3]+.8]))continue;
   path(poly);ctx.strokeStyle='#bcb4a5';ctx.lineWidth=.68*p;ctx.stroke();
  }
  ctx.restore();
  // ASPHALT/CALZADA: painted LAST using the SAME cropped original APK
  // texture in every tile, including Arfe, junctions, Pastor and Reyes.
  for(let i=0;i<this.walkable.length;i++){
   const poly=this.walkable[i];if(!intersects(this.roadBoxes[i],r))continue;
   CathedralRoute.prototype.paintNativePatch.call(this,ctx,images,r,poly,[1610,1050,96,96]);
  }
  // Accents outside paved street, no fabricated cross streets or roofs over it.
  this.paintBaratillo(ctx,r,images);
  this.paintAdrianoFurniture(ctx,r,images);
  ctx.save();ctx.globalAlpha=this.scene.ambient.darkness;
  box(r,null,this.scene.ambient.tint);ctx.restore();
  for(const person of this.people){
   const [x,y]=person.point,[w,h]=person.size;
   if(x+w/2<r[0]||x-w/2>r[2]||y+h/2<r[1]||y-h/2>r[3])continue;
   const im=img(person.key);if(im)ctx.drawImage(im,px(x-w/2),py(y+h/2),w*p,h*p);
  }
 }
 buildAdrianoFurniture(){
  const detail=ADRIANO_URBAN_DETAIL;
  this.adrianoTrees=detail.trees.filter(o=>o.d<ADRIANO_BASIS.length-.14).map(({d,side},i)=>({id:'adriano-tree-'+i,point:adrianoPoint(d,side*(2.45+.12)),d,side}));
  this.adrianoSigns=detail.signs.map(({d,side,type},i)=>({id:'adriano-sign-'+i,point:adrianoPoint(d,side*(2.45+.065)),d,side,type}));
  // Street furniture touches the visible pavement: no invisible broad collision margin.
  for(const item of this.adrianoTrees)this.obstacles.push({kind:'tree',center:item.point,radius:.12,rect:[item.point[0]-.12,item.point[1]-.12,item.point[0]+.12,item.point[1]+.12]});
  for(const item of this.adrianoSigns)this.obstacles.push({kind:'traffic-sign',center:item.point,radius:.065,rect:[item.point[0]-.065,item.point[1]-.065,item.point[0]+.065,item.point[1]+.065]});
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
}
