import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {BARATILLO,ADRIANO_BASIS,adrianoPoint,ARENAL_REYES} from './arenal-data.mjs';
import {CentreRoute} from './centre-route.mjs';
import {buildArenalSurroundings,paintArenalPixelArchitecture} from './arenal-urban.mjs';

const B=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const hit=(a,b)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
const P=(s,d,o)=>[s.a[0]+s.t[0]*d+s.n[0]*o,s.a[1]+s.t[1]*d+s.n[1]*o];
const poly=(s,a,b,x,y,side)=>[P(s,a,side*x),P(s,b,side*x),P(s,b,side*y),P(s,a,side*y)];
const allRoads=r=>r.walkable.filter(p=>p.length>=3);
const sidewalkWidth=m=>m.id==='MODULO_ADRIANO'?.57:m.id==='MODULO_PASTOR_LANDERO'?.50:.43;

// Construction sequence: 1) street polygons are the source of truth,
// 2) pedestrians stay outside the drivable surface, 3) facades behind kerbs.
export function rebuildArenalGeometry(route){
 const existing=[...route.nativeRoads,...route.segments.map(s=>s.polygon)];
 route.walkable=existing.filter(p=>p?.length>=3);
 // The CentreRoute disks and old procedural roof/crowd objects are discarded
 // only for this route. All original gameplay, checkpoints and native geometry remain.
 route.houses=[];
 route.lamps=[];
 route.obstacles=route.obstacles.filter(o=>o.kind==='native');
 // Visible chapel facade is also a real collision surface, placed behind the threshold.
 const wall=[adrianoPoint(4.98,2.45),adrianoPoint(7.02,2.45),adrianoPoint(7.02,3.5),adrianoPoint(4.98,3.5)];
 route.obstacles.push({kind:'chapel-wall',poly:wall,rect:B(wall)});
 route.arenalSections=route.segments.filter(s=>s.module.source!==ARENAL_REYES.source);
 route.arenalBlocks=[];
 for(const s of route.arenalSections){
  const L=s.length,w=s.module.halfWidth,foot=sidewalkWidth(s.module);
  for(const sign of[-1,1]){
   const frontage=w+foot+.06;
   // Multiple aligned volumes define a proper street wall, rather than
   // disconnected roofs and triangles cut across intersections.
   const edges=s.module.id==='MODULO_ADRIANO'?[.12,2.4,4.5,7.5,L-.12]:[.12,Math.min(L*.48,L-.2),L-.12];
   for(let k=0;k<edges.length-1;k++){
    const start=edges[k],end=edges[k+1];
    if(end-start<.28)continue;
    if(s.module.id==='MODULO_ADRIANO'&&sign===1&&start>=4.45&&end<=7.55)continue; // actual chapel portal
    const footprint=poly(s,start,end,frontage,frontage+2.1,sign);
    route.arenalBlocks.push({poly:footprint,bounds:B(footprint),front:[P(s,start,sign*frontage),P(s,end,sign*frontage)],t:s.t,n:s.n,sign,material:(k+(sign+1)*2+route.arenalBlocks.length)%5});
   }
  }
 }
 route.arenalSidewalks=[];
 for(const s of route.arenalSections)for(const sign of[-1,1]){
  const p=poly(s,.015,s.length-.015,s.module.halfWidth,s.module.halfWidth+sidewalkWidth(s.module),sign);
  route.arenalSidewalks.push({poly:p,bounds:B(p)});
 }
 buildArenalSurroundings(route);
}

export function populateArenalPublic(route){
 // Build audience AFTER street geometry and BEFORE architecture. The crowd
 // fills both the pavement and the shoulders of the carriageway, as marked
 // in the reference screenshot, leaving a continuous clearance for TreCai.
 for(const person of route.people)if(person.id)route.graph.nodes.delete(person.id);
 route.people=[];route.cornerAudience=[];route.audienceBands=[];
 route.obstacles=route.obstacles.filter(o=>o.kind!=='visible-street-spectator');
 const sprites=route.sim.resources.animation.graphs;
 const keys=[...new Set(Object.entries(sprites).filter(([key])=>/^mapa\d+$/.test(key)).flatMap(([,graph])=>
  (graph.nodes||[]).filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|mano|brazo/.test(n.path))
   .map(n=>n.sprite.key).filter(key=>route.graph.data.sprites[key])))];
 if(!keys.length)return;
 for(const key of keys){
  const id='arenal-rebuild-sprite-'+key;
  route.graph.nodes.set(id,{id,name:id,path:id,parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,
   sprite:{key,enabled:true,order:0,color:[1,1,1,1]}});
 }
 const start=route.scene.start?.position||[46.73,33.02];
 const crowdPoint=(p,activeCollision=false)=>{
  const ix=route.people.length;
  if(ix>=route.scene.crowd.maxPeople)return;
  const key=keys[((ix*7+Math.floor(p[0]*8)+Math.floor(p[1]*3))%keys.length+keys.length)%keys.length];
  const sp=route.graph.data.sprites[key];
  if(!sp)return;
  const size=sp.rectSize.map(x=>x/sp.pixelsToUnits);
  if(route.obstacles.some(o=>o.center&&Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<(o.radius||.1)+.13&&o.kind!=='visible-street-spectator'))return;
  // Only the front rank touches the paso. Every contact point corresponds
  // to an actual sprite; decorative rows behind can't make invisible walls.
  if(activeCollision){
   if(Math.hypot(p[0]-start[0],p[1]-start[1])<3.25)return;
   if(Math.hypot(p[0]-BARATILLO.position[0],p[1]-BARATILLO.position[1])<2.75)return;
   const radius=.085;
   route.obstacles.push({kind:'visible-street-spectator',center:[...p],radius,
    rect:[p[0]-radius,p[1]-radius,p[0]+radius,p[1]+radius]});
  }
  route.people.push({id:'arenal-public-'+ix,point:p,key,size,baked:true,inCarriageway:activeCollision});
 };
 const front=(id,w)=>id==='MODULO_ADRIANO'?1.17:id==='MODULO_PASTOR_LANDERO'?.96:w-.20;
 for(const s of route.arenalSections){
  const w=s.module.halfWidth,foot=sidewalkWidth(s.module),min=front(s.module.id,w);
  const buffer=s.module.id==='MODULO_ENLACE_ARFE_ADRIANO'?1.45:1.55;
  const outer=w+foot-.09;
  for(const sign of[-1,1]){
   // Continuous dense crowds to both edges: 0.17-unit longitudinal rows,
   // extending from the roadside buildings to the safe central corridor.
   for(let along=.13;along<s.length-.12;along+=.175){
    const nearTurn=along<buffer||along>s.length-buffer;
    const nearChapel=s.module.id==='MODULO_ADRIANO'&&along>3.65&&along<8.25;
    const entry=nearTurn||nearChapel?w+.075:min;
    let row=0;
    for(let offset=entry;offset<=outer;offset+=.175,row++){
     const q=P(s,along+(row%2)*.074,sign*offset);
     // Secondary streets remain visible; don't fill their mouths with rows.
     if((route.visualSideStreets||[]).some(st=>st.moduleId===s.module.id&&st.side===sign&&Math.abs(st.d-along)<st.width*.53&&offset>=w))continue;
     const withinRoad=offset<w-.065&&route.walkable.some(poly=>pointInPolygon(q,poly));
     const contact=withinRoad&&row===0&&Math.round(along/.175)%2===0&&!nearTurn&&!nearChapel;
     crowdPoint(q,contact);
    }
   }
  }
 }
 // Presentation: keep the entire manoeuvre open, but fill the side banks
 // right up to the real chapel facades without blocking the stopping place.
 const s=route.arenalSections.find(s=>s.module.id==='MODULO_ADRIANO');
 if(s)for(const sign of[-1,1]){
  for(const d of[4.25,4.44,4.62,7.63,7.81,8.00]){
   if(sign===1&&d>4.45&&d<7.50)continue;
   for(const off of[.10,.26,.41]){
    crowdPoint(P(s,d,sign*(s.module.halfWidth+off)),false);
   }
  }
 }
}

export function paintRebuiltArenal(route,ctx,images,r){
 const scene=route.scene,p=scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
 const path=ps=>{ctx.beginPath();ps.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
 const fill=(ps,c)=>{path(ps);ctx.fillStyle=c;ctx.fill();};
 const box=(bounds,c)=>{ctx.fillStyle=c;ctx.fillRect(px(bounds[0]),py(bounds[3]),(bounds[2]-bounds[0])*p,(bounds[3]-bounds[1])*p);};
 const line=(a,b,c,width)=>{ctx.strokeStyle=c;ctx.lineWidth=width*p;ctx.beginPath();ctx.moveTo(px(a[0]),py(a[1]));ctx.lineTo(px(b[0]),py(b[1]));ctx.stroke();};
 ctx.imageSmoothingEnabled=false;
 // Reconstructed contextual skyline: original Chicotaz roof sprites plus
 // pixel-scale masonry, roof rows and patios, clipped to urban footprints.
 paintArenalPixelArchitecture(route,ctx,images,r);
 // Do not paint guessed perpendicular roads over actual urban buildings.
 // Unmapped streets must be grounded in the user's aerial references.
 // PHASE 1: visually continuous paving follows EXACT collision polygons.
 // Sidewalk mass is placed BEFORE road asphalt so common seams are erased.
 ctx.save();ctx.lineJoin='miter';ctx.miterLimit=1.5;
 for(const ps of allRoads(route)){
  if(!hit(B(ps),[r[0]-.8,r[1]-.8,r[2]+.8,r[3]+.8]))continue;
  path(ps);ctx.strokeStyle='#c8c2b6';ctx.lineWidth=.92*p;ctx.stroke();
 }
 ctx.restore();
 for(const ps of allRoads(route)){
  if(!hit(B(ps),r))continue;
  // Exactly the SAME pixel material, rotation, sampling and world anchoring
  // used by CathedralRoute's native Arfe reconstruction. No solid gray
  // overlay or stretched asphalt tile at the old/new join.
  CathedralRoute.prototype.paintNativePatch.call(route,ctx,images,r,ps,[1610,1050,96,96]);
 }
 for(const sw of route.arenalSidewalks){
  if(!hit(sw.bounds,r))continue;
  // These kerbs remain outside the road boundary; never triangle-fan across turns.
  const [a,b,c,d]=sw.poly;
  line(a,b,'#eee5d8',.055);line(c,d,'#83796b',.05);
 }
 // Reuse the existing Reyes Católicos route sector and bridge connection.
 if(r[3]>46.8){
  const rectPoly=[[23,46.8],[45.25,46.8],[45.25,60],[23,60]];
  ctx.save();path(rectPoly);ctx.clip();
  const layer=route.reyesLayer,old=layer.scene;
  layer.scene={...old,ppu:p};
  CentreRoute.prototype.paintTile.call(layer,ctx,images,[r[0],r[1]-20,r[2],r[3]-20]);
  layer.scene=old;ctx.restore();
 }
 // PHASE 3 landmark: checkpoint and actual red chapel portal.
 route.paintBaratillo(ctx,r,images);
 route.paintAdrianoFurniture(ctx,r,images);
 ctx.save();ctx.globalAlpha=scene.ambient.darkness;box(r,scene.ambient.tint);ctx.restore();
 // PHASE 2 top layer: crowds positioned on the actual visible pavement.
 for(const person of route.people){
  const [x,y]=person.point,[w,h]=person.size;
  if(!hit([x-w/2,y-h/2,x+w/2,y+h/2],r))continue;
  const im=images.get(person.key)||images.get(route.graph.data.sprites[person.key]?.image);
  if(im)ctx.drawImage(im,px(x-w/2),py(y+h/2),w*p,h*p);
 }
}
