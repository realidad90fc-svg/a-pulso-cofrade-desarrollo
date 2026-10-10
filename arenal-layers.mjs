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
 // This level starts in the MIDDLE of Arfe, immediately after the previous
 // level. Extend the original Arfe direction upstream, beyond the camera,
 // instead of placing the paso against an artificial roof/wall or cul-de-sac.
 // Both centreline and width are inherited from the actual Arfe segment.
 route.arfeStartAxis=[...first.t];
 const w=first.module.halfWidth;
 route.entryFrom=-8.2;
route.startLane=[
  pt(first,route.entryFrom,w),pt(first,.28,w),
  pt(first,.28,-w),pt(first,route.entryFrom,-w)
 ];
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

// This envelope follows the exact road centre lines, not the camera view.
// It protects the full 1.04 x 2.15 TreCai paso and its turning sweep.
// Road spectators may be placed everywhere OUTSIDE this envelope.
const nearestRoad=(route,point)=>{
 let best={distance:Infinity,segment:null,along:0};
 for(const s of route.segments){
  const start=s.module.id==='MODULO_ENLACE_ARFE_ADRIANO'?route.entryFrom:0;
  const along=Math.max(start,Math.min(s.length,(point[0]-s.a[0])*s.t[0]+(point[1]-s.a[1])*s.t[1]));
  const foot=pt(s,along,0),dist=d2(point,foot);
  if(dist<best.distance)best={distance:dist,segment:s,along};
 }
 return best;
};
const tightCore=(route,point)=>{
 const entry=route.arenalSections[0];
 for(const s of route.segments){
  const origin=s.module.id===entry.module.id?route.entryFrom:0;
  const along=Math.max(origin,Math.min(s.length,(point[0]-s.a[0])*s.t[0]+(point[1]-s.a[1])*s.t[1]));
  const distance=d2(point,pt(s,along,0));
  const id=s.module.id;
  const base=id==='MODULO_ADRIANO'?.73:id==='MODULO_PASTOR_LANDERO'?.71:s.module.style==='avenue'?.82:.70;
  // The full long paso must be able to pivot at bends, not only slide along
  // a corridor the width of its shorter side.
  const nearTurn=Math.min(Math.abs(along),Math.abs(s.length-along));
  const sweep=nearTurn<1.6?1.25-(nearTurn/1.6)*.49:base;
  if(distance<Math.max(base,sweep)+.07)return true;
 }
 // Mandatory parallel-to-facade stop at the Baratillo.
 if(d2(point,BARATILLO.position)<1.47)return true;
 return false;
};

export function buildArenalCrowd(route){
 const nodes=route.sim.resources.animation.graphs,all=route.graph.data.sprites;
 const keys=[...new Set(Object.entries(nodes).filter(([name])=>/^mapa\d+$/.test(name))
  .flatMap(([,graph])=>(graph.nodes||[]).filter(n=>n.sprite&&n.path.includes('/publico/')&&!/pierna|brazo|mano/.test(n.path))
   .map(n=>n.sprite.key)).filter(k=>all[k]?.rectSize?.[0]>0))];
 if(!keys.length)return;
 const limit=route.scene.crowd?.maxPeople||9800,seen=new Set();
 const collisionMap=new Set();
 const add=(point)=>{
  if(route.people.length>=limit)return;
  const grid=Math.round(point[0]/.083)+','+Math.round(point[1]/.083);
  if(seen.has(grid))return;
  const onStreet=route.walkable.some(poly=>pointInPolygon(point,poly));
  // Never paint a spectator in the clearance of the paso or its revirás.
  if(onStreet&&tightCore(route,point))return;
  const i=route.people.length,key=keys[((i*7+Math.floor(point[0]*9)+Math.floor(point[1]*4))%keys.length+keys.length)%keys.length],sp=all[key];
  if(!sp)return;
  const size=sp.rectSize.map(n=>n/sp.pixelsToUnits);
  if(!size.every(Number.isFinite))return;
  // Pixel sprites measure around .19 world units. Let their visual edges
  // join into a compact crowd, with a clear pedestrian-free central lane.
  seen.add(grid);
  const radius=Math.min(.098,Math.max(.065,size[0]*.45));
  // Only the visible foremost audience rank provides collisions. The full
  // row behind it remains a visual crowd, not thousands of costly invisible
  // contacts evaluated for every candelabro each frame.
  const closest=onStreet?nearestRoad(route,point):null;
  const threshold=closest?.segment?.module.style==='avenue'?1.13:1.02;
  const collide=onStreet&&closest.distance<threshold&&(i%2===0);
  // Every actual contact in the street must match a visible spectator,
  // and the contact circle is limited to the centre of that sprite.
  if(collide){
   const blockkey=Math.round(point[0]/.13)+','+Math.round(point[1]/.13);
   if(!collisionMap.has(blockkey)){
    collisionMap.add(blockkey);
    route.obstacles.push({kind:'visible-spectator',center:[...point],radius,
      rect:[point[0]-radius,point[1]-radius,point[0]+radius,point[1]+radius]});
   }
  }
  route.people.push({id:'arenal-person-'+i,point:[...point],key,size,baked:true,clearance:radius+.018,roadContact:collide});
 };
 // In route order, not module source order. No cap exhausted before the
 // end of Pastor y Landero or Reyes Católicos.
 const seq=['MODULO_ENLACE_ARFE_ADRIANO','MODULO_ADRIANO','MODULO_PASTOR_LANDERO','MODULO_REYES_CATOLICOS'];
 const ordered=[...route.segments].sort((a,b)=>seq.indexOf(a.module.id)-seq.indexOf(b.module.id));
 for(const s of ordered){
  const w=s.module.halfWidth,sw=sidewalkWidth(s.module);
  const from=s.module.id==='MODULO_ENLACE_ARFE_ADRIANO'?route.entryFrom+.13:.12;
  const roofline=w+sw+.11;
  const inner=s.module.style==='avenue'?.84:s.module.id==='MODULO_ADRIANO'?.76:.73;
  const outer=roofline-.13; // a sprite's outer edge stops at the facade
  for(const sign of[-1,1]){
   let column=0;
   for(let d=from;d<s.length-.12;d+=.14,column++){
    let row=0;
    for(let off=inner;off<=outer+.002;off+=.153,row++){
     const along=Math.min(s.length-.08,d+(row%2)*.065);
     const q=pt(s,along,sign*(off+(Math.sin(row*7.1+column*3.3)*.012)));
     // Don't create stray spectators in the centre of another street.
     if(route.segments.some(other=>other!==s&&pointInPolygon(q,other.polygon)&&tightCore(route,q)))continue;
     add(q);
    }
   }
  }
 }
 // Close-packed, outside the actual lane, with safe centre and turning
 // clearance validated using original paso dimensions.
}

export function buildArenalSidewalks(route){
 route.sidewalks=[];
 // Sidewalks are exterior parcels; we subtract EVERY road polygon,
 // including adjacent streets, before saving any sidewalk piece.
 for(const s of route.segments){
  const w=s.module.halfWidth,foot=sidewalkWidth(s.module);
  const from=s.module.id==='MODULO_ENLACE_ARFE_ADRIANO'?route.entryFrom+.025:.08;
  for(const sign of[-1,1]){
   const poly=quad(s,from,s.length-.08,w+.025,w+foot+.11,sign);
   for(const part of carve(poly,route.walkable))
    route.sidewalks.push({poly:part,bbox:bounds(part)});
  }
 }
}

export function buildArenalHouses(route){
 route.buildings=[];
 const reservation=route.people.map(p=>rectangle([p.point[0]-p.clearance,p.point[1]-p.clearance,
  p.point[0]+p.clearance,p.point[1]+p.clearance]));
 const cuts=[...route.walkable,...route.sidewalks.map(s=>s.poly)];
 const addLot=(s,from,to,sign,kind,depth=2.5)=>{
  const w=s.module.halfWidth,foot=sidewalkWidth(s.module),near=w+foot+.118;
  // Restrict every façade to a real street-side lot. The route and all
  // spectators were generated first and take absolute precedence.
  for(let d=from;d<to-.28;d+=(kind==='house'?1.55:2.35)){
   const end=Math.min(to,d+(kind==='house'?1.51:2.30));
   if(end-d<.35)continue;
   const original=quad(s,d,end,near,near+depth,sign);
   let fragments=carve(original,cuts);
   // Avoid O(houses * entire city audience), only check local people whose
   // sprite footprint actually meets this exact building parcel.
   const bb=bounds(original);
   const guards=reservation.filter(poly=>boxhit(bounds(poly),bb));
   if(guards.length)fragments=fragments.flatMap(poly=>carve(poly,guards));
   const key=NATIVE_HOUSE_KEYS[(route.buildings.length+Math.floor(Math.abs(d)*3)+sign+4)%NATIVE_HOUSE_KEYS.length];
   for(const poly of fragments){
    if(Math.abs(area(poly))<.07)continue;
    route.buildings.push({poly,bbox:bounds(poly),key,kind,side:sign,
      front:[pt(s,d,sign*near),pt(s,end,sign*near)],
      outward:[s.n[0]*sign,s.n[1]*sign]});
   }
  }
 };
 for(const s of route.segments){
  const id=s.module.id;
  // Arfe genuinely passes between the Maestranza theatre and bullring
  // precinct. Long coordinated built frontages, not detached fake houses;
  // the whole street continues back into the prior map.
  if(id==='MODULO_ENLACE_ARFE_ADRIANO'){
   addLot(s,route.entryFrom+.30,s.length-.32,1,'maestranza',3.1);
   addLot(s,route.entryFrom+.30,s.length-.32,-1,'historic',2.9);
  }else if(id==='MODULO_ADRIANO'){
   // Maestranza's almost triangular urban mass fronts on Adriano. Leave
   // the Baratillo chapel its own mandatory presentation frontage.
   addLot(s,.42,4.34,1,'maestranza',3.3);
   addLot(s,7.62,s.length-.40,1,'maestranza',3.0);
   addLot(s,.35,s.length-.38,-1,'historic',2.7);
  }else if(id==='MODULO_PASTOR_LANDERO'){
   // Mercado del Arenal (Pastor y Landero) has an arcaded, white/albero
   // historic market elevation. It must NOT look like cloned houses.
   addLot(s,1.05,s.length-.55,1,'market',3.1);
   addLot(s,.38,s.length-.34,-1,'historic',2.65);
  }else if(s.module.style==='avenue'){
   // Open bridgehead/riverside side remains open, as in the real Arenal.
   addLot(s,1.20,s.length-1.02,-1,'historic',3.0);
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
  if(lot.kind==='historic'){
   // Existing game's historic residential rooftop sprites.
   ctx.drawImage(image,px(x),py(yy),(xx-x)*p,(yy-y)*p);
  }else{
   // Landmark-compatible masonry rather than rows of cloned residential
   // rooftops: Maestranza cream rendered stone; Arenal Market albero/white.
   ctx.fillStyle=lot.kind==='market'?'#d3b67f':'#cfbea6';ctx.fill();
   ctx.globalAlpha=lot.kind==='market'?.19:.29;
   ctx.drawImage(image,px(x),py(yy),(xx-x)*p,(yy-y)*p);
   ctx.globalAlpha=1;
   const [a,b]=lot.front,vec=[b[0]-a[0],b[1]-a[1]],len=Math.hypot(...vec);
   if(len>.15){
    const t=[vec[0]/len,vec[1]/len],n=lot.outward;
    ctx.beginPath();ctx.moveTo(px(a[0]),py(a[1]));ctx.lineTo(px(b[0]),py(b[1]));
    ctx.strokeStyle=lot.kind==='market'?'#f0e2ba':'#eee7d9';
    ctx.lineWidth=.11*p;ctx.stroke();
    // A continuous arcade along the historic market; regular pale pilasters
    // and door recesses along the bullring's exterior front.
    for(let d=.22;d<len-.09;d+=lot.kind==='market'?.47:.63){
     const z=[a[0]+t[0]*d+n[0]*.13,a[1]+t[1]*d+n[1]*.13];
     ctx.fillStyle=lot.kind==='market'?'#775e3e':'#eee5d4';
     ctx.fillRect(px(z[0]-.055),py(z[1]+.065),.11*p,.13*p);
     if(lot.kind==='market'){
      const c=[z[0]+n[0]*.16,z[1]+n[1]*.16];
      ctx.fillStyle='#f3e5bb';ctx.fillRect(px(c[0]-.055),py(c[1]+.055),.11*p,.11*p);
     }
    }
   }
  }
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
