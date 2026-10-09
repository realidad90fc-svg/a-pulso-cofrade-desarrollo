import {pointInPolygon} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {BARATILLO,ADRIANO_BASIS,adrianoPoint,ARENAL_REYES} from './arenal-data.mjs';
import {CentreRoute} from './centre-route.mjs';

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
}

export function populateArenalPublic(route){
 for(const person of route.people)if(person.id)route.graph.nodes.delete(person.id);
 route.people=[];route.cornerAudience=[];route.audienceBands=[];
 const sprites=route.sim.resources.animation.graphs;
 const keys=[...new Set(Object.entries(sprites).filter(([key])=>/^mapa\d+$/.test(key)).flatMap(([,graph])=>(graph.nodes||[]).filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|mano|brazo/.test(n.path)).map(n=>n.sprite.key)).filter(key=>route.graph.data.sprites[key]))];
 if(!keys.length)return;
 for(const key of keys){const id='arenal-rebuild-sprite-'+key;route.graph.nodes.set(id,{id,name:id,path:id,parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,sprite:{key,enabled:true,order:0,color:[1,1,1,1]}});}
 const register=(point)=>{
  if(route.walkable.some(road=>pointInPolygon(point,road)))return;
  if(route.obstacles.some(o=>o.center&&Math.hypot(point[0]-o.center[0],point[1]-o.center[1])<((o.radius||.1)+.10)))return;
  const ix=route.people.length,key=keys[(ix*7+Math.floor(point[0]*8)+Math.floor(point[1]*3))%keys.length]||keys[0],sprite=route.graph.data.sprites[key];
  route.people.push({id:'arenal-ped-'+ix,point,key,size:sprite.rectSize.map(x=>x/sprite.pixelsToUnits),baked:true});
 };
 for(const s of route.arenalSections){
  const w=s.module.halfWidth,foot=sidewalkWidth(s.module);
  for(const sign of[-1,1]){
   for(let along=.10;along<s.length-.08;along+=.17){
    if(s.module.id==='MODULO_ADRIANO'&&sign===1&&along>4.55&&along<7.45)continue;
    for(let offset=.10;offset<foot-.03;offset+=.16){
     register(P(s,along+(Math.round(offset*100)%2)*.07,sign*(w+offset)));
    }
   }
  }
  // Complete the crowd at right-angle intersections, preserving the
  // crossable road polygon and original paso footprint.
  for(const d of[.14,.30,.47,.66,.86])for(const sign of[-1,1])for(const offset of[.09,.25,.40]){
   register(P(s,d,sign*(w+offset)));
   register(P(s,s.length-d,sign*(w+offset)));
  }
 }
 // A dense presentation audience on either side of the chapel door,
 // never a solid invisible wall in the play area.
 const chapel=route.arenalSections.find(s=>s.module.id==='MODULO_ADRIANO');
 if(chapel)for(const side of[-1,1])for(const d of[4.40,4.57,7.36,7.53])for(const off of[.10,.25,.40]){
  register(P(chapel,d,side*(chapel.module.halfWidth+off)));
 }
}

export function paintRebuiltArenal(route,ctx,images,r){
 const scene=route.scene,p=scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
 const path=ps=>{ctx.beginPath();ps.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
 const fill=(ps,c)=>{path(ps);ctx.fillStyle=c;ctx.fill();};
 const box=(bounds,c)=>{ctx.fillStyle=c;ctx.fillRect(px(bounds[0]),py(bounds[3]),(bounds[2]-bounds[0])*p,(bounds[3]-bounds[1])*p);};
 const line=(a,b,c,width)=>{ctx.strokeStyle=c;ctx.lineWidth=width*p;ctx.beginPath();ctx.moveTo(px(a[0]),py(a[1]));ctx.lineTo(px(b[0]),py(b[1]));ctx.stroke();};
 ctx.imageSmoothingEnabled=false;
 // PHASE 3 lowest layer: coherent land parcels and whole building volumes.
 box(r,'#d1c2a9');
 const roofPalette=['#9f463e','#b66c51','#d2baa0','#ad6b4e','#b39174'];
 for(const b of route.arenalBlocks){
  if(!hit(b.bounds,r))continue;
  fill(b.poly,roofPalette[b.material]);
  const [a,z]=b.front;
  line(a,z,'#ead6b5',.055);
  const L=Math.hypot(z[0]-a[0],z[1]-a[1]);
  const n=Math.floor(L/.52);
  for(let i=0;i<n;i++){
   const d=(i+.25)/Math.max(n,1),q=[a[0]+(z[0]-a[0])*d,a[1]+(z[1]-a[1])*d];
   const depth=.11;
   const second=[q[0]+b.n[0]*b.sign*depth,q[1]+b.n[1]*b.sign*depth];
   line(q,second,'#453b38',.07);
  }
 }
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
  // All asphalt matches the original road and obstacle limits precisely.
  fill(ps,'#58595b');
  ctx.save();path(ps);ctx.clip();
  const floor=images.get('sharedassets2.assets:373');
  if(floor){ctx.globalAlpha=.36;for(let x=Math.floor(r[0]);x<r[2];x++)for(let y=Math.floor(r[1]);y<r[3];y++){ctx.drawImage(floor,322,40,110,110,px(x),py(y+1),p,p);}ctx.globalAlpha=1;}
  ctx.restore();
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
