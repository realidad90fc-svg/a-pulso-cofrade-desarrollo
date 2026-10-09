import {paintSanMiguel} from './cathedral-facade.mjs';
import {CentreRoute} from './centre-route.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {SceneGraph,transformPoint} from './original-scene.mjs';
import {pointInPolygon,segmentDistance} from './engine.mjs';
import {cathedralPoint,postigoPoint,CATHEDRAL_MODULE,POSTIGO_MODULE} from './cathedral-data.mjs';
const rect=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]];
const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const inside=(p,r)=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];
// Exact contact with native wall segments; no invisible padding around them.
const segmentsTouch=(a,b,c,d)=>{
 const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 return ((x<=0&&y>=0)||(x>=0&&y<=0))&&((z<=0&&w>=0)||(z>=0&&w<=0));
};
const polygonsTouch=(a,b)=>a.some(p=>pointInPolygon(p,b))||b.some(p=>pointInPolygon(p,a))||a.some((p,i)=>b.some((q,j)=>segmentsTouch(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));
const disk=(p,r)=>Array.from({length:24},(_,i)=>[p[0]+r*Math.cos(i*Math.PI/12),p[1]+r*Math.sin(i*Math.PI/12)]);
export class CathedralRoute extends CentreRoute{
 constructor(sim){
  const road4=sim.mapColliders.find(c=>c.entity.name==='caminosYVallas').world().points.map(cathedralPoint);
  const road5=sim.resources.controls.maps[5].colliders.find(c=>c.name==='caminosYVallas'||c.path==='/mapa5/caminosYVallas').points.map(postigoPoint);
  sim.map.variant.originalWalkable=[road4,road5,rect([-.70,-7.3,.65,3.25]).map(cathedralPoint)];
  // Parent expects a plaza footprint; this is only the NEW connector.
  sim.map.variant.modules.find(m=>m.style==='square').visual={footprint:[12.2,39.2,17.4,49.3]};
  super(sim);
  // The same polygons define the visible paving and its physical edge.
  // Keeping circular limits under square paving produced invisible corner walls.
  this.walkable=this.walkable.map(poly=>poly.length===24?rect(bounds(poly)):poly);
  this.houses=[];for(const person of this.people)if(pointInPolygon(person.point,rect([-2.5,-7.2,2.5,3.25]).map(cathedralPoint))){this.graph.nodes.delete(person.id);person.remove=true;}this.people=this.people.filter(p=>!p.remove);this.nativeRoads=[road4,road5];this.nativeObstacles=[];this.nativeEdges=[];
  this.collectNative(sim.mapColliders,cathedralPoint,4);
  this.postigoGraph=new SceneGraph(sim.resources.animation,'mapa5');sim.graphs.push(this.postigoGraph);sim.renderGraphs.push(this.postigoGraph);
  // Secondary geometry must not replace global Unity tags/names used by the
  // active map controller (especially mapa and the capataz knock sequence).
  const entities=new Map();for(const n of sim.resources.controls.mapNodes[5]){const gn=[...this.postigoGraph.nodes.values()].find(q=>'/' + q.path===n.path);if(!gn)continue;const previous=sim.names.get(n.name),e=sim.entity(n.name,'',{graph:this.postigoGraph,id:gn.id});e.tag=sim.resources.controls.mapTags?.[5]?.[n.path]||'';entities.set(n.path,e);if(previous)sim.names.set(n.name,previous);}
  const cols=sim.resources.controls.maps[5].colliders.map(c=>sim.addCollider(entities.get(c.path),c,false));this.collectNative(cols,postigoPoint,5);
  for(const [g,module,point]of [[sim.mapGraph,CATHEDRAL_MODULE,cathedralPoint],[this.postigoGraph,POSTIGO_MODULE,postigoPoint]]){const root=g.root,pos=point(root.position),a=module.rotation*Math.PI/180;root.position=[...pos,0];root.rotation=[0,0,Math.sin(a/2),Math.cos(a/2)];for(const n of g.nodes.values())if(n.path.includes('/zonaInter')||n.path.includes('/zonaParada'))n.active=false;}
  // Keep all native architecture and spectators. Open ONLY the campaign's new
  // side connection, where the original floor has audience baked into it.
  this.branchCutout=rect([1.13,8.30,6.5,9.65]).map(cathedralPoint);
  for(const n of sim.mapGraph.nodes.values())if(n.path==='mapa4/caminosYVallas/valla'||n.path==='mapa4/caminosYVallas/valla (1)')n.active=false;
  for(const n of sim.mapGraph.nodes.values())if(n.path.includes('/publico/')&&n.sprite){const p=sim.mapGraph.worldMatrix(n.id).slice(4);if(pointInPolygon(p,this.branchCutout))n.active=false;}
  this.nativeRails=[];for(const n of sim.mapGraph.nodes.values())if(n.active&&n.sprite&&n.name.startsWith('vallaRoja')){const sp=sim.resources.animation.sprites[n.sprite.key],w=sp.rectSize[0]/sp.pixelsToUnits,h=sp.rectSize[1]/sp.pixelsToUnits,poly=rect([-w*sp.pivot[0],-h*sp.pivot[1],w*(1-sp.pivot[0]),h*(1-sp.pivot[1])]).map(p=>transformPoint(sim.mapGraph.worldMatrix(n.id),p));this.nativeRails.push({kind:'native-visible-rail',poly,rect:bounds(poly),bodyOnly:true});}
  this.graph.data.sprites['cathedral-stone']={image:'assets/cathedral/stone-wall-v1.png',pixelsToUnits:627,rectSize:[1254,1254],pivot:[.5,.5]};this.graph.nodes.set('cathedral-stone-resource',{id:'cathedral-stone-resource',name:'cathedral-stone-resource',path:'cathedral-stone-resource',parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,sprite:{key:'cathedral-stone',enabled:true,order:-50,color:[1,1,1,1]}});
  this.obstacles.push(...this.nativeObstacles,...this.nativeRails);this.buildAudience();this.follow();
 }
 collectNative(cols,point,id){
  for(const c of cols){const w=c.world();c.enabled=false;if(c.entity.tag!=='Untagged'||c.entity.name==='limiteZonaInter'||c.path.includes('/publico/'))continue;
   const bodyOnly=c.path.includes('/caminosYVallas/'),heightOnly=c.path.includes('/arbolesYBalcones/');
   if(c.entity.name==='caminosYVallas'||id===4&&['/mapa4/caminosYVallas/valla','/mapa4/caminosYVallas/valla (1)'].includes(c.path))continue;
   if(w.edge){const ps=w.points;for(let i=1;i<ps.length;i++){let a=ps[i-1],b=ps[i];if(id===4&&c.entity.name==='igl_1Final'&&a[1]<-3.7&&b[1]<-3.7){const lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);if(lo<-.72)this.nativeEdges.push({a:point([lo,a[1]]),b:point([-.72,a[1]]),bodyOnly,heightOnly});if(hi>.72)this.nativeEdges.push({a:point([.72,a[1]]),b:point([hi,a[1]]),bodyOnly,heightOnly});}else this.nativeEdges.push({a:point(a),b:point(b),bodyOnly,heightOnly});}continue;}
   if(w.circle){const center=point(w.center),r=w.radius;this.nativeObstacles.push({kind:'native',center,radius:r,rect:[center[0]-r,center[1]-r,center[0]+r,center[1]+r],bodyOnly,heightOnly});}
   else{const poly=w.points.map(point);this.nativeObstacles.push({kind:'native',poly,rect:bounds(poly),bodyOnly,heightOnly});}
  }
 }
 validPoint(p,obstacles=this.obstacles){return (this.walkable.some(poly=>pointInPolygon(p,poly))||this.nativeRoads?.some(poly=>poly.some((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length]).distance<.025)))&&!obstacles.some(o=>o.poly?pointInPolygon(p,o.poly):o.center?Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius:inside(p,o.rect));}
 validShape(w,obstacles=this.obstacles){
  const s=this.sim,part=s.stepColliders.find(c=>c.world()===w),body=part?.entity.name==='parihuela',image=['romano','señor'].includes(part?.entity.name);let poly=w.circle?disk(w.center,w.radius):w.points;
  if(body){const {graph,id}=part.entity.transform,n=graph.nodes.get(id),sp=graph.data.sprites[n.sprite.key],width=sp.rectSize[0]/sp.pixelsToUnits,height=sp.rectSize[1]/sp.pixelsToUnits;poly=rect([-width*sp.pivot[0],-height*sp.pivot[1],width*(1-sp.pivot[0]),height*(1-sp.pivot[1])]).map(p=>transformPoint(graph.worldMatrix(id),p));}
  // A small contact inset ONLY for low rails at the exit elbow. The visual
  // mesa, walls, crowd, street width and every other map remain unchanged.
  const pos=s.position(s.stepEntity.transform),softExit=body&&inside([pos.x,pos.y],[12.4,35.9,14.3,37.65]),softRails=softExit?obstacles.filter(o=>o.kind==='native-visible-rail'&&o.rect[0]<14.5&&o.rect[2]>12&&o.rect[1]<38.5&&o.rect[3]>35):[];
  if(softRails.length){const {graph,id}=part.entity.transform,n=graph.nodes.get(id),sp=graph.data.sprites[n.sprite.key],m=graph.worldMatrix(id),width=sp.rectSize[0]/sp.pixelsToUnits,height=sp.rectSize[1]/sp.pixelsToUnits,ix=.10/Math.hypot(m[0],m[1]),iy=.10/Math.hypot(m[2],m[3]),contact=rect([-width*sp.pivot[0]+ix,-height*sp.pivot[1]+iy,width*(1-sp.pivot[0])-ix,height*(1-sp.pivot[1])-iy]).map(p=>transformPoint(m,p));if(softRails.some(o=>polygonsTouch(contact,o.poly)))return false;obstacles=obstacles.filter(o=>!softRails.includes(o));}
  const applicable=o=>(!o.bodyOnly||body)&&(!o.heightOnly||image&&!s.controller.flex);
  obstacles=obstacles.filter(applicable);const edges=this.nativeEdges?.filter(applicable)||[];const inNative=this.nativeRoads?.some(q=>pointInPolygon([pos.x,pos.y],q))||pointInPolygon([pos.x,pos.y],rect([-.7,-7.3,.65,3.25]).map(cathedralPoint));
  const blocked=p=>obstacles.some(o=>o.poly?pointInPolygon(p,o.poly):o.center?Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius:inside(p,o.rect));
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.035));for(let j=0;j<=n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n];if((body||!inNative)&&!this.validPoint(p,obstacles)||blocked(p))return false;}}
  if(edges.some(e=>poly.some((p,i)=>segmentsTouch(p,poly[(i+1)%poly.length],e.a,e.b))))return false;
  return !obstacles.some(o=>!w.edge&&(o.poly|| (o.center?[o.center]:rect(o.rect))).some(p=>pointInPolygon(p,poly)))&&!edges.some(e=>pointInPolygon(e.a,poly)||pointInPolygon(e.b,poly));
 }
 snapshot(){return {...super.snapshot(),geometryVersion:5};}
 restore(v){
  // Relocate the reused Postigo module and old in-progress saves together.
  // The original map itself, elapsed time, recovery and progress stay intact.
  if(!v?.geometryVersion){const s=this.sim,p=s.position(s.stepEntity.transform);
   if(p.y>=51){s.setPosition(s.stepEntity.transform,[p.x+30,p.y,p.z||0]);}
   else if(p.y>46.5&&p.x<15){s.setPosition(s.stepEntity.transform,[14.8+(14.8-p.x)*15.2/14.8,p.y,p.z||0]);s.setAngle(s.stepEntity.transform,-s.angle(s.stepEntity.transform));}
  }
  if((v?.geometryVersion||1)<3){const s=this.sim,p=s.position(s.stepEntity.transform);if(p.y>37&&p.y<42.2&&p.x>13.8&&p.x<15.8)s.setPosition(s.stepEntity.transform,[p.x-1.9,p.y,p.z||0]);}
  if((v?.geometryVersion||1)<4){const s=this.sim,p=s.position(s.stepEntity.transform);if(p.y>43.4&&p.y<48&&p.x>12.9&&p.x<16){s.setPosition(s.stepEntity.transform,[p.x-Math.min(1.9,Math.max(0,(p.y-44)*.95)),p.y,p.z||0]);if(p.y>44&&p.y<46)s.setAngle(s.stepEntity.transform,s.angle(s.stepEntity.transform)+Math.atan2(1.9,2)*180/Math.PI);}}
  if((v?.geometryVersion||1)<5){const s=this.sim,p=s.position(s.stepEntity.transform);if(p.x>=29&&p.y>=51){s.setPosition(s.stepEntity.transform,[...postigoPoint([p.x-30,p.y-52]),p.z||0]);s.setAngle(s.stepEntity.transform,s.angle(s.stepEntity.transform)+POSTIGO_MODULE.rotation);}else if(p.x>28.5&&p.x<31.5&&p.y>48){s.setPosition(s.stepEntity.transform,[29+(p.y-48)*.75,48-(p.y-48)*.125,p.z||0]);s.setAngle(s.stepEntity.transform,s.angle(s.stepEntity.transform)-90);}}
  const original=this.sim.resources.animation.graphs.mapa5.nodes.find(n=>n.id===this.postigoGraph.root.id);
  this.postigoGraph.root.position=[...postigoPoint(original.position),original.position[2]||0];
  const rotation=POSTIGO_MODULE.rotation*Math.PI/180;this.postigoGraph.root.rotation=[0,0,Math.sin(rotation/2),Math.cos(rotation/2)];
  super.restore(v);const c=this.sim.controller;
  if(c.animator.state==='pasoBajado'&&c.mensajeEnviado&&!c.yaHaSonado){c.mensajeEnviado=false;this.sim.buttons[8].interactable=false;}
 }
 buildAudience(){
  // Use the full original wardrobe, rather than the two orange map4 sprites.
  for(const p of this.people)this.graph.nodes.delete(p.id);this.people=[];this.seats=[];this.audienceBands=[];this.nativeSeating=rect([.82,3.4,3.4,8.16]).map(cathedralPoint);
  const keys=[...new Set(Object.entries(this.sim.resources.animation.graphs).filter(([name])=>/^mapa\d+$/.test(name)).flatMap(([,g])=>g.nodes.filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|mano|brazo/.test(n.path)).map(n=>n.sprite.key)))];
  const node=(id,key)=>({id,name:id,path:id,parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,sprite:{key,order:0,enabled:true,color:[1,1,1,1]}});
  for(const key of [...keys,'sharedassets2.assets:374','sharedassets2.assets:509','sharedassets2.assets:606','sharedassets2.assets:563'])this.graph.nodes.set('cathedral-resource-'+key,node('cathedral-resource-'+key,key));
  const bands=[{a:[12.9,37.5],b:[12.9,42.2],seated:true},{a:[12.9,42.2],b:[12.9,46.3]}, {a:[14.6,48],b:[28.3,48]},{a:[29,48],b:[31.95,47.5083]}];
  for(const band of bands){const {a,b,seated}=band,length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-t[1],t[0]];
   for(const sign of [-1,1]){const at=(d,o)=>[a[0]+t[0]*d+n[0]*sign*o,a[1]+t[1]*d+n[1]*sign*o],inner=.78,outer=inner+1.65,poly=[at(0,inner),at(length,inner),at(length,outer),at(0,outer)];
    this.audienceBands.push({poly,seated,a,b,t,n,sign});
    // One occupied-zone boundary, no unfair collisions with individual limbs.
    this.obstacles.push({kind:seated?'seating-boundary':'crowd-boundary',poly,rect:bounds(poly),bodyOnly:!!seated});
    for(let row=0;row<8;row++)for(let d=.12+(seated?0:(row%2)*.075);d<length-.08;d+=seated?.22:.19){const off=inner+.12+row*.195,point=at(d,off+(seated?0:Math.sin(d*13+row*7+sign)*.016)),key=keys[(this.people.length*7+row*3)%keys.length],sp=this.graph.data.sprites[key],size=sp.rectSize.map(x=>x/sp.pixelsToUnits);
     if(!seated&&this.audienceBands.some(b=>b.seated&&pointInPolygon(point,b.poly)))continue;
     this.people.push({id:'cathedral-public-'+this.people.length,point,size,key,baked:true,seated,t,n,sign});if(seated)this.seats.push({point,t,n,sign});
    }
   }
  }
  for(const area of [[9.4,46.3,11.65,47.6],[9.4,47.6,11.65,49.4],[11.65,49.7,14.6,51.5],[14.6,50.43,16.2,52.2]]){const poly=rect(area);this.audienceBands.push({poly,seated:false,corner:true});this.obstacles.push({kind:'crowd-boundary',poly,rect:area});for(let y=area[1]+.1;y<area[3]-.08;y+=.19)for(let x=area[0]+.1;x<area[2]-.08;x+=.19){const point=[x,y],key=keys[(this.people.length*7)%keys.length],sp=this.graph.data.sprites[key];this.people.push({id:'corner-public-'+this.people.length,point,size:sp.rectSize.map(v=>v/sp.pixelsToUnits),key,baked:true,seated:false});}}
  this.obstacles.push({kind:'native-seating',poly:this.nativeSeating,rect:bounds(this.nativeSeating),bodyOnly:true});
  for(let x=.95;x<3.3;x+=.22)for(let y=3.52;y<8.06;y+=.22){const point=cathedralPoint([x,y]),key=keys[(this.people.length*7)%keys.length],sp=this.graph.data.sprites[key],size=sp.rectSize.map(v=>v/sp.pixelsToUnits);this.people.push({id:'cathedral-seated-block-'+this.people.length,point,size,key,baked:true,seated:true,nativeSeating:true});}
 }
 paintNativePatch(ctx,images,r,poly,crop,angle=90,ppu=this.scene.ppu){
  const im=images.get('sharedassets2.assets:509');if(!im)return;const nativePpu=this.sim.resources.animation.sprites['sharedassets2.assets:509'].pixelsToUnits,unitW=crop[2]/nativePpu,unitH=crop[3]/nativePpu,a=angle*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),local=poly.map(([x,y])=>[x*ca+y*sa,-x*sa+y*ca]),b=bounds(local),px=x=>(x-r[0])*ppu,py=y=>(r[3]-y)*ppu;
  ctx.save();ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();ctx.clip();ctx.imageSmoothingEnabled=false;
  for(let u=Math.floor(b[0]/unitW)*unitW;u<b[2];u+=unitW)for(let v=Math.floor(b[1]/unitH)*unitH;v<b[3];v+=unitH){const x=(u+unitW/2)*ca-(v+unitH/2)*sa,y=(u+unitW/2)*sa+(v+unitH/2)*ca;ctx.save();ctx.translate(px(x),py(y));ctx.rotate(-a);ctx.drawImage(im,...crop,-unitW*ppu/2,-unitH*ppu/2,unitW*ppu,unitH*ppu);ctx.restore();}ctx.restore();
 }
 drawFloor(ctx,project,images){
  const r=bounds(this.nativeSeating),p=100,w=Math.ceil((r[2]-r[0])*p),h=Math.ceil((r[3]-r[1])*p);
  if(!this.seatedSurface){const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(w,h);surface.width=w;surface.height=h;const c=surface.getContext('2d');c.filter=this.spriteFilter(this.sim.mapGraph);this.paintNativePatch(c,images,r,this.nativeSeating,[1600,140,360,210],270,p);this.seatedSurface=surface;}
  paintSanMiguel(ctx,project,this.spriteFilter(this.sim.mapGraph));
  ctx.save();ctx.setTransform(...project);ctx.imageSmoothingEnabled=false;ctx.translate(r[0],r[3]);ctx.scale(1/p,-1/p);ctx.drawImage(this.seatedSurface,0,0);ctx.restore();
 }
 updateStreet(){const s=this.sim;if(!this.streetNotice&&!s.buttons?.[0]?.interactable)return;const p=s.position(s.stepEntity.transform);let name;
  if(p.x>=POSTIGO_MODULE.origin[0]){const localX=47.5-p.y,localY=p.x-32;name=localY<6.4?'Almirantazgo':localY<10.2?'Arco del Postigo':localY<16.4?'Dos de Mayo':'Arfe';if(localX>11)name='Arfe';}
  else if(p.y>46.5&&p.x>14.3)name='Fray Ceferino González';else if(p.y>38.2||p.x<16.8)name='Plaza del Triunfo';else name=p.x>28.4?'Puerta de San Miguel':p.x>19.8?'Interior de Catedral':'Puerta de Palos';
  if(this.streetNotice?.id!==name)this.streetNotice={id:name,name,since:s.levelTime};
 }
 spriteFilter(graph){return graph===this.sim.mapGraph||graph===this.postigoGraph?'brightness('+(1-this.scene.ambient.darkness*.55)+')':'none';}
 spriteCutouts(graph,node){if(graph===this.postigoGraph)return [rect([-10,30,POSTIGO_MODULE.origin[0],77])];if(graph!==this.sim.mapGraph)return [];const cuts=[rect([-10,42.8,66,77])];if(node.name==='caminosYVallas')cuts.push(this.branchCutout);if(node.name==='igl_1Final')cuts.push(rect([-.72,-7.32,.72,-7.14]).map(cathedralPoint));return cuts;}
 paintTile(ctx,images,r){
  const v=this.scene,p=v.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p,path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();},box=(b,c)=>{ctx.fillStyle=c;ctx.fillRect(px(b[0]),py(b[3]),(b[2]-b[0])*p,(b[3]-b[1])*p);};
  ctx.filter=this.spriteFilter(this.sim.mapGraph);this.paintNativePatch(ctx,images,r,rect(r),[0,0,96,96]);
  // Reuse original roof materials at a stable scale to close the city blocks.
  for(let x=Math.floor(r[0]/3)*3;x<r[2];x+=3)for(let y=Math.floor(r[1]/3)*3;y<r[3];y+=3){const im=images.get(NATIVE_HOUSE_KEYS[Math.abs(Math.round(x*7+y*3))%NATIVE_HOUSE_KEYS.length]);if(im)ctx.drawImage(im,px(x),py(y+3),3*p,3*p);}
  // The visible streets have square corners, while the independent trajectory guides the manoeuvre.
  for(const poly of this.walkable)this.paintNativePatch(ctx,images,r,poly,[1610,1050,96,96]);
  // Only missing exterior links receive new frontage. Interior and Postigo are
  // drawn by their original graphs above this ground layer.
  for(const h of this.houses){ctx.save();path(h.poly);ctx.clip();const im=images.get(NATIVE_HOUSE_KEYS[h.material]);if(im)ctx.drawImage(im,px(h.bounds[0]),py(h.bounds[3]),(h.bounds[2]-h.bounds[0])*p,(h.bounds[3]-h.bounds[1])*p);ctx.restore();}
  // A single continuous Cathedral flank, its corner and the opposite Archivo.
  // These are proportional exterior footprints from the supplied aerial views;
  // the original interior graph is neither copied nor rebuilt.
  const paving=poly=>this.paintNativePatch(ctx,images,r,poly,[1610,1050,96,96]);
  paving(rect([6.5,42.8,32,53]));
  const building=(poly,key)=>{const b=bounds(poly),im=images.get(key);if(!im)return;ctx.save();ctx.filter='none';path(poly);ctx.clip();const unit=key==='cathedral-stone'?2:3;for(let x=Math.floor(b[0]/unit)*unit;x<b[2];x+=unit)for(let y=Math.floor(b[1]/unit)*unit;y<b[3];y+=unit)ctx.drawImage(im,px(x),py(y+unit),unit*p,unit*p);ctx.fillStyle='rgba(0,0,0,'+(this.scene.ambient.darkness*.55)+')';ctx.fillRect(px(b[0]),py(b[3]),(b[2]-b[0])*p,(b[3]-b[1])*p);ctx.restore();ctx.strokeStyle='#c6bdab';ctx.lineWidth=.08*p;path(poly);ctx.stroke();};
  const cathedral=[[15.5,42.8],[27.5,42.8],[27.5,45.3],[26.9,45.7],[15.9,45.7],[15.5,45.3]];
  const archivo=[[16.2,50.7],[27.3,50.7],[27.8,51.2],[27.8,56],[16.2,56]];
  building(cathedral,images.has('cathedral-stone')?'cathedral-stone':'sharedassets2.assets:554');building(archivo,'sharedassets2.assets:569');
  // Buttresses remain on the building edge, beyond the occupied crowd rows.
  for(let x=16.4;x<26.8;x+=1.1)box([x,45.55,x+.22,45.9],'#c6bdab');
  for(let y=42.9;y<45.2;y+=.85)box([15.3,y,15.6,y+.22],'#c6bdab');
  // Open Triunfo apron and garden stay opposite the Cathedral corner.
  const tree=images.get('sharedassets2.assets:563');
  for(const [x,y] of [[7.4,43.9],[7.5,46.7],[8,50.8],[10.4,52.5]])if(tree)ctx.drawImage(tree,px(x-.65),py(y+.65),1.3*p,1.3*p);
  // Constitución crosses the route before the unchanged Almirantazgo mouth.
  paving(rect([28.6,43,31.4,53]));
  for(const x of [29.4,29.55])box([x,43,x+.025,53],'#77746c');
  // Reuse COMPLETE original occupied rows, including chairs, clothes, limbs
  // and their pavement. No synthetic heads or differently shaded floor patch.
  for(const band of this.audienceBands){const angle=band.t&&Math.abs(band.t[0])>Math.abs(band.t[1])+.1?0:90;this.paintNativePatch(ctx,images,r,band.poly,band.seated?[1600,140,360,210]:[100,1038,400,90],band.seated?(band.sign===1?90:270):angle);
   if(band.seated){const rail=images.get('sharedassets2.assets:606'),[a,b]=band.poly,length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(rail){ctx.save();ctx.translate(px((a[0]+b[0])/2),py((a[1]+b[1])/2));ctx.rotate(-Math.atan2(b[1]-a[1],b[0]-a[0]));ctx.drawImage(rail,-length*p/2,-.04*p,length*p,.08*p);ctx.restore();}}
  }
  paintSanMiguel(ctx,[p,0,0,-p,-r[0]*p,r[3]*p],this.spriteFilter(this.sim.mapGraph),true);
  ctx.filter='none';
  for(const [x,y]of this.lamps)if(inside([x,y],r)){if(v.ambient.lamps){const g=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),p*.8);g.addColorStop(0,'rgba(255,218,148,.4)');g.addColorStop(1,'rgba(255,207,116,0)');ctx.fillStyle=g;ctx.fillRect(px(x)-p,py(y)-p,2*p,2*p);}box([x-.025,y-.025,x+.025,y+.025],'#ffe4ac');}
 }
}
