import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {BARATILLO} from './arenal-data.mjs';
import {pointInPolygon} from './engine.mjs';

// Dedicated REGRESO POR EL ARENAL parcel map.
// Mandatory build order: road -> spectators -> sidewalk -> houses.
// No old map5 background, synthetic turn disks or guessed side-streets.
const EPS=1e-8;
const pt=(s,d,o)=>[s.a[0]+s.t[0]*d+s.n[0]*o,s.a[1]+s.t[1]*d+s.n[1]*o];
const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
const boxhit=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const d2=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0)/2;
const quad=(s,a,b,x,y,sign)=>[pt(s,a,sign*x),pt(s,b,sign*x),pt(s,b,sign*y),pt(s,a,sign*y)];
const rectangle=([x,y,xx,yy])=>[[x,y],[xx,y],[xx,yy],[x,yy]];
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const clipHalf=(shape,a,b,sense,keepInside)=>{
 if(shape.length<3)return [];
 const score=p=>cross(a,b,p)*sense*(keepInside?1:-1);
 const out=[];
 for(let i=0;i<shape.length;i++){
  const p=shape[i],q=shape[(i+1)%shape.length],u=score(p),v=score(q);
  if(u>=-EPS)out.push(p);
  if((u>EPS&&v< -EPS)||(u< -EPS&&v>EPS)){
   const t=u/(u-v);
   out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);
  }
 }
 return out.length>=3&&Math.abs(area(out))>EPS?out:[];
};
const subtractConvex=(subject,cut)=>{
 if(subject.length<3||cut.length<3||!boxhit(bounds(subject),bounds(cut)))return [subject];
 const sense=area(cut)>=0?1:-1;
 let pending=[subject],pieces=[];
 for(let i=0;i<cut.length;i++){
  const a=cut[i],b=cut[(i+1)%cut.length],inside=[];
  for(const poly of pending){
   const outside=clipHalf(poly,a,b,sense,false);
   const remain=clipHalf(poly,a,b,sense,true);
   if(outside.length)pieces.push(outside);
   if(remain.length)inside.push(remain);
  }
  pending=inside;
  if(!pending.length)break;
 }
 return pieces;
};
function carve(poly,cuts){
 let fragments=[poly];
 for(const c of cuts){
  const b=bounds(c);
  fragments=fragments.flatMap(p=>boxhit(bounds(p),b)?subtractConvex(p,c):[p]);
  if(fragments.length===0)break;
 }
 return fragments.filter(p=>Math.abs(area(p))>.006&&p.length>=3);
}
const sidewalkWidth=m=>m.id==='MODULO_ADRIANO'?.54:m.id==='MODULO_PASTOR_LANDERO'?.48:m.style==='avenue'?.60:.43;

export function buildArenalRoad(route){
 // The road polygons are the ONLY traversable surface and the ONLY paved
 // area. Each straight is one native road-width quad; short corner wedges
 // are triangles, not convex hulls stretching across both sides of the turn.
 const seq=['MODULO_ENLACE_ARFE_ADRIANO','MODULO_ADRIANO','MODULO_PASTOR_LANDERO'];
 route.arenalSections=route.segments.filter(s=>seq.includes(s.module.id));
 route.reyesSegment=route.segments.find(s=>s.module.style==='avenue');
 const first=route.arenalSections[0],start=route.scene.start.position;
 const heading=[first.a[0]-start[0],first.a[1]-start[1]],norm=Math.hypot(...heading)||1;
 route.arfeStartAxis=heading.map(x=>x/norm);
 const u=route.arfeStartAxis,n=[-u[1],u[0]],w=first.module.halfWidth;
 const p0=start.map((v,i)=>v-u[i]*1.12),p1=first.a.map((v,i)=>v+u[i]*.28);
 route.startLane=[[p0[0]+n[0]*w,p0[1]+n[1]*w],[p1[0]+n[0]*w,p1[1]+n[1]*w],
 [p1[0]-n[0]*w,p1[1]-n[1]*w],[p0[0]-n[0]*w,p0[1]-n[1]*w]];
 const road=[route.startLane,...route.segments.map(s=>s.polygon)];
 route.turnFaces=[];
 const chain=route.arenalSections;
 for(let i=0;i<chain.length-1;i++){
  const a=chain[i],b=chain[i+1],corner=a.b;
  if(d2(corner,b.a)>.04)continue;
  const va=a.module.halfWidth,vb=b.module.halfWidth;
  for(const sign of[-1,1]){
   const face=[corner,pt(a,a.length,sign*va),pt(b,0,sign*vb)];
   if(Math.abs(area(face))>.001)route.turnFaces.push(face);
  }
 }
 road.push(...route.turnFaces);
 route.walkable=road;
 route.roadBoxes=road.map(bounds);
 route.crossroads=route.arenalSections.flatMap(s=>[s.a,s.b]);
 route.obstacles=[];
 route.nativeRoads=[];route.nativeEdges=[];
 // CentreRoute's constructor creates an inherited audience graph before
 // entering this subclass. Remove those ghosts; the new people are baked
 // exclusively by stage 2 and cannot leak into the rendering layer.
 for(const id of [...route.graph.nodes.keys()])
  if(id.startsWith('centre-spectator-'))route.graph.nodes.delete(id);
 route.houses=[];route.lamps=[];
 route.people=[];route.buildings=[];route.sidewalks=[];
 route.tileCache.clear();
}

export function buildArenalCrowd(route){
 const nodes=route.sim.resources.animation.graphs;
 const all=route.graph.data.sprites;
 const keys=[...new Set(Object.entries(nodes).filter(([name])=>/^mapa\d+$/.test(name))
 .flatMap(([,graph])=>(graph.nodes||[]).filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|brazo|mano/.test(n.path))
 .map(n=>n.sprite.key)).filter(k=>all[k]?.rectSize?.[0]>0))];
 if(!keys.length)return;
 const first=route.scene.start.position;
 const limit=route.scene.crowd?.maxPeople||3000;
 const add=(point,collision)=>{
  if(route.people.length>=limit)return;
  const i=route.people.length,key=keys[((i*7+Math.floor(point[0]*9)+Math.floor(point[1]*4))%keys.length+keys.length)%keys.length];
  const sp=all[key];if(!sp)return;
  const size=sp.rectSize.map(x=>x/sp.pixelsToUnits);
  if(!size.every(Number.isFinite))return;
  // Corners remain visually populated; only colliding audience is kept out
  // of the swept turn envelope. Previously this rejected ALL public within
  // 1.5 world units and made empty crossroads.
  if(collision&&route.crossroads.some(c=>d2(point,c)<1.75))return;
  if(collision&&d2(point,first)<3.15)return;
  if(collision&&d2(point,BARATILLO.position)<2.70)return;
  // A person outside their own corridor cannot appear in another road's
  // centre merely because two urban blocks converge.
  if(!collision&&!route.walkable.some(p=>pointInPolygon(point,p))&&
    route.obstacles.some(o=>o.center&&d2(point,o.center)<(o.radius||.08)+.12))return;
  const r=Math.max(.063,Math.min(.092,size[0]*.45));
  const inRoad=route.walkable.some(p=>pointInPolygon(point,p));
  if(collision&&inRoad){
   if(d2(point,first)<3.15||d2(point,BARATILLO.position)<2.65)return;
   route.obstacles.push({kind:'visible-spectator',center:[...point],radius:r,
      rect:[point[0]-r,point[1]-r,point[0]+r,point[1]+r]});
  }
  route.people.push({id:'arenal-person-'+i,point,key,size,baked:true,clearance:r+.018,roadContact:collision&&inRoad});
 };
 for(const s of route.segments){
  const w=s.module.halfWidth,sw=sidewalkWidth(s.module);
  for(const sign of[-1,1]){
   for(let d=.10;d<s.length-.08;d+=.154){
    const nearTurn=d<1.46||d>s.length-1.46;
    const chapel=s.module.id==='MODULO_ADRIANO'&&d>3.55&&d<8.35;
    // A packed band from the first visible street rank to the building-side
    // pavement, with no unexplained vacant strip between public and frontage.
    // The chapel and turns preserve a full-step swept clearance.
    const firstRow=nearTurn||chapel?w+.06:
      s.module.style==='avenue'?1.82:s.module.id==='MODULO_ADRIANO'?1.28:
      s.module.id==='MODULO_PASTOR_LANDERO'?1.12:1.10;
    const outer=w+sw-.095;
    let row=0;
    for(let offset=firstRow;offset<=outer+.001;offset+=.154,row++){
     const position=pt(s,Math.min(s.length-.035,d+(row%2)*.06),sign*offset);
     // Suppress individual street contacts only when another roadway crosses:
     // visible spectators along the footpath still appear at the crossroads.
     const besideOtherRoad=route.segments.some(other=>other!==s&&pointInPolygon(position,other.polygon));
     const active=offset<w-.13&&row===0&&(Math.round(d/.154)%3===0)&&!nearTurn&&!chapel&&!besideOtherRoad;
     // Never place a decorative spectator in the actual crossing lane of
     // another segment; that would look like somebody stranded in the road.
     if(besideOtherRoad&&offset<w)continue;
     add(position,active);
    }
   }
  }
 }
}

export function buildArenalSidewalks(route){
 route.sidewalks=[];
 // Sidewalks are exterior parcels; we subtract EVERY road polygon,
 // including adjacent streets, before saving any sidewalk piece.
 for(const s of route.segments){
  const w=s.module.halfWidth,foot=sidewalkWidth(s.module);
  for(const sign of[-1,1]){
   const poly=quad(s,.08,s.length-.08,w+.025,w+foot+.11,sign);
   for(const part of carve(poly,route.walkable))
    route.sidewalks.push({poly:part,bbox:bounds(part)});
  }
 }
}

export function buildArenalHouses(route){
 route.buildings=[];
 const reservations=route.people.map(p=>rectangle([p.point[0]-p.clearance,p.point[1]-p.clearance,
   p.point[0]+p.clearance,p.point[1]+p.clearance]));
 // Frontages can touch the pavement. Clip against all three earlier
 // occupied layers before accepting any building fragment.
 const cuts=[...route.walkable,...route.sidewalks.map(x=>x.poly),...reservations];
 for(const s of route.segments){
  const w=s.module.halfWidth,foot=sidewalkWidth(s.module);
  const near=w+foot+.115; // sidewalk reaches w+foot+.11 => no 0.32m void
  const isAdriano=s.module.id==='MODULO_ADRIANO';
  const isArfe=s.module.id==='MODULO_ENLACE_ARFE_ADRIANO';
  const isPastor=s.module.id==='MODULO_PASTOR_LANDERO';
  const isReyes=s.module.style==='avenue';
  for(const sign of[-1,1]){
   // Conservative parcels rather than fabricating two identical rows of
   // houses everywhere. Adriano's chapel/Maestranza flank is a landmark,
   // not a shopping-street row of cloned houses. Leave its frontage clear.
   if(isAdriano&&sign===1)continue;
   // Reyes Católicos reaches the more open riverside approach; do not fill
   // the ungrounded side of the avenue with roofs.
   if(isReyes&&sign===1)continue;
   let ranges=isAdriano?[[.48,s.length-.55]]:
    isArfe?[[.30,s.length-.33]]:
    isPastor?(sign===1?[[1.80,s.length-.5]]:[[.60,s.length-.45]]):
    isReyes?[[1.3,s.length-1.15]]:[];
   for(const [start,stop] of ranges){
    for(let d=start;d<stop-.26;d+=1.58){
     const end=Math.min(stop,d+1.54);
     if(end-d<.34)continue;
     const original=quad(s,d,end,near,near+2.35,sign);
     const pieces=carve(original,cuts);
     const key=NATIVE_HOUSE_KEYS[(route.buildings.length+Math.floor(d*3)+(sign+1)*2)%NATIVE_HOUSE_KEYS.length];
     for(const poly of pieces){
      if(Math.abs(area(poly))<.045)continue;
      route.buildings.push({poly,bbox:bounds(poly),key});
     }
    }
   }
  }
 }
}

export function paintArenalScene(route,ctx,images,r){
 const p=route.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
 const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
 const img=key=>images.get(key)||images.get(route.graph.data.sprites[key]?.image);
 ctx.imageSmoothingEnabled=false;
 const floor=img('sharedassets2.assets:373');
 // A neutral native cobblestone ground: NEVER blanket the whole tile with
 // roof textures. Housing textures exist ONLY inside explicitly carved lots.
 ctx.fillStyle='#7c7974';ctx.fillRect(0,0,(r[2]-r[0])*p,(r[3]-r[1])*p);
 if(floor){
  ctx.save();ctx.globalAlpha=.30;
  for(let x=Math.floor(r[0]/1.12)*1.12;x<r[2];x+=1.12)
   for(let y=Math.floor(r[1]/1.12)*1.12;y<r[3];y+=1.12)
    ctx.drawImage(floor,322,40,110,110,px(x),py(y+1.12),1.12*p,1.12*p);
  ctx.restore();
 }
 // FOURTH-BUILT: buildings are strictly clipped fragments outside street,
 // audience footprints and pavements. Any loose roofs are mathematically
 // impossible rather than painted over.
 for(const lot of route.buildings){
  if(!boxhit(lot.bbox,r))continue;
  const image=img(lot.key);if(!image)continue;
  ctx.save();path(lot.poly);ctx.clip();
  const [x,y,xx,yy]=lot.bbox;
  ctx.drawImage(image,px(x),py(yy),(xx-x)*p,(yy-y)*p);
  ctx.restore();
 }
 // THIRD-BUILT: continuous narrow sidewalks with native stone tone.
 for(const sw of route.sidewalks){
  if(!boxhit(sw.bbox,r))continue;
  ctx.save();path(sw.poly);ctx.clip();
  ctx.fillStyle='#a5a09a';ctx.fill();
  ctx.strokeStyle='#b3ada6';ctx.lineWidth=.015*p;
  const [x,y,xx,yy]=sw.bbox;
  for(let u=Math.floor(x/.22)*.22;u<xx;u+=.22){
   ctx.beginPath();ctx.moveTo(px(u),py(yy));ctx.lineTo(px(u),py(y));ctx.stroke();
  }
  for(let v=Math.floor(y/.22)*.22;v<yy;v+=.22){
   ctx.beginPath();ctx.moveTo(px(x),py(v));ctx.lineTo(px(xx),py(v));ctx.stroke();
  }
  ctx.restore();
 }
 // FIRST-BUILT: only these polygons draw asphalt, exactly the polygons
 // that validate TreCai's collisions. The road is drawn AFTER roofs as an
 // additional safety net; no later building paint can cover the lane.
 for(let i=0;i<route.walkable.length;i++){
  const road=route.walkable[i];if(!boxhit(route.roadBoxes[i],r))continue;
  ctx.save();path(road);ctx.clip();
  ctx.fillStyle='#505359';ctx.fill();
  if(floor){
   ctx.globalAlpha=.60;
   for(let x=Math.floor(r[0]/1.05)*1.05;x<r[2];x+=1.05)
    for(let y=Math.floor(r[1]/1.05)*1.05;y<r[3];y+=1.05)
     ctx.drawImage(floor,322,40,110,110,px(x),py(y+1.05),1.05*p,1.05*p);
   ctx.globalAlpha=1;
  }
  ctx.restore();
 }
 // Exterior kerbs are the visible limit of the *actual* collision road.
 // Avoid artificial seams between overlapping segment and corner polygons.
 const onStreet=q=>route.walkable.some(poly=>pointInPolygon(q,poly));
 ctx.strokeStyle='#c9c0b4';ctx.lineWidth=.042*p;ctx.lineCap='butt';
 for(const poly of route.walkable){
  if(!boxhit(bounds(poly),r))continue;
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],len=d2(a,b);
   if(len<.06)continue;
   // Subsegments are necessary where another street joins partway along
   // an edge. The curb appears only where there is real exterior paving.
   const pieces=Math.ceil(len/.18);
   for(let j=0;j<pieces;j++){
    const t0=j/pieces,t1=(j+1)/pieces,mid=(t0+t1)/2;
    const m=[a[0]+(b[0]-a[0])*mid,a[1]+(b[1]-a[1])*mid];
    const normal=[-(b[1]-a[1])/len,(b[0]-a[0])/len];
    const left=onStreet([m[0]+normal[0]*.024,m[1]+normal[1]*.024]);
    const right=onStreet([m[0]-normal[0]*.024,m[1]-normal[1]*.024]);
    if(left===right)continue;
    const z=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0];
    const w=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1];
    ctx.beginPath();ctx.moveTo(px(z[0]),py(z[1]));ctx.lineTo(px(w[0]),py(w[1]));ctx.stroke();
   }
  }
 }
 route.paintBaratillo(ctx,r,images);
 route.paintAdrianoFurniture(ctx,r,images);
 ctx.save();ctx.globalAlpha=route.scene.ambient.darkness;
 ctx.fillStyle=route.scene.ambient.tint;ctx.fillRect(0,0,(r[2]-r[0])*p,(r[3]-r[1])*p);ctx.restore();
 // SECOND-BUILT: people render above stone, never under a house.
 for(const person of route.people){
  const [x,y]=person.point,[w,h]=person.size;
  if(x+w/2<r[0]||x-w/2>r[2]||y+h/2<r[1]||y-h/2>r[3])continue;
  const image=img(person.key);
  if(image)ctx.drawImage(image,px(x-w/2),py(y+h/2),w*p,h*p);
 }
}
