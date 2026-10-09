import {paintAyuntamiento} from './city-landmarks.mjs';
import {SceneGraph} from './original-scene.mjs';
import {pointInPolygon,segmentDistance} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
const rect=([x,y,xx,yy])=>[[x,y],[xx,y],[xx,yy],[x,yy]];
const inRect=(p,r)=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];
const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
const intersects=(a,b)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
const polygonAt=(a,b,width)=>{const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/d*width,(b[0]-a[0])/d*width];return [[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];};
const disk=(p,r)=>Array.from({length:24},(_,i)=>[p[0]+r*Math.cos(i*Math.PI/12),p[1]+r*Math.sin(i*Math.PI/12)]);
const samples=w=>w.circle?disk(w.center,w.radius):w.points;

// A map adapter around the original simulation. Only the environment, contacts
// and helper placement are supplied here; the paso is never steered or scaled.
export class CentreRoute{
 constructor(sim){
  this.sim=sim;this.scene=sim.map.variant;const v=this.scene;this.points=v.path;this.distances=[0];
  for(let i=1;i<this.points.length;i++)this.distances.push(this.distances.at(-1)+Math.hypot(this.points[i][0]-this.points[i-1][0],this.points[i][1]-this.points[i-1][1]));this.length=this.distances.at(-1);
  this.segments=[];this.walkable=[...(v.originalWalkable||[])];this.obstacles=[];this.houses=[];this.lamps=[];this.people=[];this.tileCache=new Map();
  for(const module of v.modules){
   for(let i=1;i<module.points.length;i++){const a=module.points[i-1],b=module.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=[(b[0]-a[0])/length,(b[1]-a[1])/length],n=[-t[1],t[0]],polygon=polygonAt(a,b,module.halfWidth);
    this.segments.push({a,b,t,n,length,module,polygon});this.walkable.push(polygon);
    // Each street has actual facades. The small joining disks leave only the
    // space needed for the unchanged ~2 × 1 native footprint to rotate.
    this.walkable.push(disk(a,v.turnRadius),disk(b,v.turnRadius));
    for(let d=module.style==='square'?length:module.style==='avenue'?4.45:.35;d<length-.25;d+=2.05)for(const side of [-1,1]){const end=Math.min(d+1.99,length-.10),near=module.halfWidth+.025,far=near+3.7;
     const p=(along,offset)=>[a[0]+t[0]*along+n[0]*offset*side,a[1]+t[1]*along+n[1]*offset*side];
     const poly=[p(d,near),p(end,near),p(end,far),p(d,far)];this.houses.push({poly,bounds:bounds(poly),front:[p(d,near),p(end,near)],t,n,side,module,material:(this.houses.length+(module.style==='avenue'?3:0))%NATIVE_HOUSE_KEYS.length});
    }
    for(let d=1.1;d<length-.8;d+=2.7)for(const sign of [-1,1]){const offset=module.halfWidth-.14;this.lamps.push([a[0]+t[0]*d+n[0]*offset*sign,a[1]+t[1]*d+n[1]*offset*sign]);}
   }
   if(module.polygon)this.walkable.push(module.polygon);
   for(const branch of module.branches){const b=[branch.position[0]+branch.direction[0]*branch.length,branch.position[1]+branch.direction[1]*branch.length];this.walkable.push(polygonAt(branch.position,b,branch.width));}
   for(const [x,y,r]of module.trees)this.obstacles.push({kind:'tree',center:[x,y],radius:r,rect:[x-r,y-r,x+r,y+r]});
   if(module.townHall)this.obstacles.push({kind:'building',rect:module.townHall.rect});
   if(module.monument){const m=module.monument;this.obstacles.push({kind:'monument',center:m.position,radius:m.radius,rect:[m.position[0]-m.radius,m.position[1]-m.radius,m.position[0]+m.radius,m.position[1]+m.radius]});}
  }
  // At joined/diagonal streets a frontage lamp can otherwise land in the
  // neighbouring street. Keep all posts out of the shared passage/turn bay.
  this.lamps=this.lamps.filter(p=>this.nearest(...p).distance>1.05&&this.points.slice(1,-1).every(q=>Math.hypot(p[0]-q[0],p[1]-q[1])>1.4));
  for(const [x,y]of this.lamps)this.obstacles.push({kind:'lamp',center:[x,y],radius:.05,rect:[x-.05,y-.05,x+.05,y+.05]});
  const [x,y,xx,yy]=v.bounds,material={image:v.image,pixelsToUnits:v.ppu,rectSize:[Math.round((xx-x)*v.ppu),Math.round((yy-y)*v.ppu)],pivot:[.5,.5]};
  const node=(id,p,key,enabled=true)=>({id,name:id,path:id,parent:null,position:[...p,0],rotation:[0,0,0,1],scale:[1,1,1],active:true,sprite:{key,order:-50,enabled,color:[1,1,1,1]}});
  const nodes=[node('reference-architecture',[(x+xx)/2,(y+yy)/2],'centre-architecture')];for(const key of [...NATIVE_HOUSE_KEYS,'sharedassets2.assets:373'])nodes.push(node('resource-'+key,[0,0],key,false));
  const animation={...sim.resources.animation,sprites:{...sim.resources.animation.sprites,'centre-architecture':material},graphs:{...sim.resources.animation.graphs,centreRoute:{nodes,animators:[]}}};
  // Reuse the actual base-game blue/yellow sprites, oriented in world space.
  const marker=(id,position,key,angle,height)=>{const n=node(id,position,key);const radians=angle*Math.PI/180;n.rotation=[0,0,Math.sin(radians/2),Math.cos(radians/2)];n.scale=[1,height/2.27,1];n.sprite.order=2;nodes.push(n);};
  this.checkpoints=v.checkpoints|| (v.checkpoint?[v.checkpoint]:[]);this.checkpointIds=[];
  this.checkpoints.forEach((cp,i)=>marker(cp.id===v.checkpoint?.id?'centre-checkpoint-marker':'centre-checkpoint-marker-'+cp.id,cp.position,'sharedassets1.assets:75',cp.angle??315,2.27));
  marker('centre-finish-marker',v.end.position,'sharedassets1.assets:78',v.finish.heading,2.2);
  this.graph=new SceneGraph(animation,'centreRoute');sim.graphs.push(this.graph);sim.renderGraphs=[this.graph,...sim.graphs.filter(g=>(v.reuseNativeMap||g!==sim.mapGraph)&&g!==this.graph)];
  const examples=[...sim.mapGraph.nodes.values()].filter(n=>n.sprite&&n.path.includes('/publico/')&&!n.path.includes('/pierna')&&!n.path.includes('/mano'));
  for(const key of new Set(examples.map(n=>n.sprite.key)))this.graph.nodes.set('crowd-resource-'+key,node('crowd-resource-'+key,[0,0],key,false));
  let index=0;const occupied=new Set();
  const add=(point,decorative=false)=>{const ex=examples[index++%examples.length];if(!ex||this.people.length>=v.crowd.maxPeople)return;const near=this.nearest(...point),sp=animation.sprites[ex.sprite.key],size=sp.rectSize.map(x=>x/sp.pixelsToUnits),polygon=rect([point[0]-size[0]/2,point[1]-size[1]/2,point[0]+size[0]/2,point[1]+size[1]/2]);
   if(near.distance<.64+size[0]/2||this.points.slice(1,-1).some(p=>Math.hypot(point[0]-p[0],point[1]-p[1] )<1.16)||(!decorative&&!this.validShape({points:polygon}))||decorative&&polygon.some(p=>this.obstacles.some(o=>o.center?Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius:inRect(p,o.rect))))return;
   const grid=point.map(p=>Math.round(p/.14)).join(',');if(occupied.has(grid))return;occupied.add(grid);
   const id='centre-spectator-'+index,baked=decorative||near.distance>1.04,n=structuredClone(ex);Object.assign(n,{id,name:id,path:id,parent:null,position:[...point,0],rotation:[0,0,0,1],scale:[1,1,1],active:false});n.sprite={...n.sprite,order:1,color:v.ambient.crowdTint};if(!baked)this.graph.nodes.set(id,n);this.people.push({id,point,size,polygon,key:n.sprite.key,baked});
  };
  // First lines use native sprites; the many outer rows are baked per visible
  // tile, with no individual spectator colliders or crowd simulation.
  for(const segment of this.segments){const {a,t,n,length,module}=segment;for(let d=.15;d<length;d+=v.crowd.spacing)for(const sign of [-1,1])for(let row=0;row<module.crowdRows;row++){
   const offset=(module.style==='avenue'?1:.78)+row*.17,jitter=Math.sin(index*1.71)*.011,along=d+(row%2)*.08;add([a[0]+t[0]*along+n[0]*sign*(offset+jitter),a[1]+t[1]*along+n[1]*sign*(offset+jitter)]);
  }}
  for(const module of v.modules){const areas=[...(module.polygon?[module.polygon]:[]),...module.branches.map(b=>polygonAt(b.position,[b.position[0]+b.direction[0]*b.length,b.position[1]+b.direction[1]*b.length],b.width))];
   for(const poly of areas){const r=bounds(poly);for(let y=r[1]+.1;y<r[3];y+=.215)for(let x=r[0]+.1+(Math.round(y/.215)%2)*.1;x<r[2];x+=.215)if(pointInPolygon([x,y],poly))add([x,y]);}
  }
  // Fill the outer shoulders of every joining manoeuvre, keeping only the
  // swept clearance of the native paso. People remain purely visual.
  for(const [cx,cy] of this.points.slice(1,-1))for(let y=cy-1.8;y<=cy+1.8;y+=.19)for(let x=cx-1.8;x<=cx+1.8;x+=.19)if(Math.hypot(x-cx,y-cy)<1.85)add([x,y]);
  // The plaza extends behind the dense audience: decorative shoulders
  // reveal its rectangular urban footprint without changing the playable lane.
  const square=v.modules.find(m=>m.style==='square'),visual=square?.visual?.footprint;
  if(visual)
  for(let y=visual[1]+.18;y<visual[3]-.18;y+=.19)for(let x=visual[0]+.18;x<visual[2]-.18;x+=.19)if(!this.walkable.some(poly=>pointInPolygon([x,y],poly)))add([x,y],true);
  sim.setPosition(sim.stepEntity.transform,[...v.start.position,0]);sim.setAngle(sim.stepEntity.transform,v.start.angle);this.finished=false;this.checkpointReached=false;this.follow();sim.vm.invoke('cameraController.LateUpdate',sim.cameraController);
 }
 nearest(x,y){let best={distance:Infinity};for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],r=segmentDistance([x,y],a,b);if(r.distance<best.distance)best={...r,along:this.distances[i-1]+Math.hypot(r.point[0]-a[0],r.point[1]-a[1])};}return best;}
 at(d){let i=1;while(i<this.distances.length-1&&this.distances[i]<d)i++;const a=this.points[i-1],b=this.points[i],t=(d-this.distances[i-1])/(this.distances[i]-this.distances[i-1]);return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(-(b[0]-a[0]),b[1]-a[1])};}
 validPoint(p,obstacles=this.obstacles){return this.walkable.some(poly=>pointInPolygon(p,poly))&&!obstacles.some(o=>o.center?Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius:inRect(p,o.rect));}
 validShape(w,obstacles=this.obstacles){const poly=samples(w);return poly.every((a,i)=>{const b=poly[(i+1)%poly.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05));for(let j=0;j<=n;j++)if(!this.validPoint([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],obstacles))return false;return true;})&&!obstacles.some(o=>!w.edge&&(o.center?[o.center]:rect(o.rect)).some(p=>pointInPolygon(p,poly)));}
 follow(){this.checkpoints.forEach((cp,i)=>{const marker=this.graph.nodes.get(cp.id===this.scene.checkpoint?.id?'centre-checkpoint-marker':'centre-checkpoint-marker-'+cp.id);if(marker)marker.active=!this.checkpointIds.includes(cp.id);});const s=this.sim,p=s.position(s.stepEntity.transform),a=s.angle(s.stepEntity.transform)*Math.PI/180,d=this.nearest(p.x,p.y).along;for(const [e,offset,rotation]of [[s.capatazEntity,1.2,-90],[s.contraEntity,-1.3,90]]){s.setPosition(e.transform,[p.x-Math.sin(a)*offset,p.y+Math.cos(a)*offset,0]);s.setAngle(e.transform,s.angle(s.stepEntity.transform)+rotation);}s.cortejos.forEach((e,i)=>{const q=this.at(d+[3.5,-3,-4.5][i]);s.setPosition(e.transform,[q.x,q.y,0]);s.setAngle(e.transform,q.angle*180/Math.PI);});
  if(this.lastCrowdAlong===undefined||Math.abs(d-this.lastCrowdAlong)>.3){this.lastCrowdAlong=d;for(const person of this.people)if(!person.baked)this.graph.nodes.get(person.id).active=Math.hypot(person.point[0]-p.x,person.point[1]-p.y)<=this.scene.crowd.liveDistance;}
 }
 updateStreet(){
  const s=this.sim;if(!this.streetNotice&&!s.buttons?.[0]?.interactable)return;
  const p=s.position(s.stepEntity.transform),ranked=this.segments.map(segment=>({segment,...segmentDistance([p.x,p.y],segment.a,segment.b)})).sort((a,b)=>a.distance-b.distance),best=ranked[0],current=ranked.find(q=>q.segment.module.id===(this.streetNotice?.moduleId||this.streetNotice?.id));
  const selected=current&&current.distance<=best.distance+.18?current:best,module=selected.segment.module,along=Math.hypot(selected.point[0]-selected.segment.a[0],selected.point[1]-selected.segment.a[1]),zone=module.sectorLabels?.filter(z=>along>=z.from).at(-1),id=zone?module.id+':'+zone.id:module.id;
  if(this.streetNotice?.id===id)return;
  this.streetNotice={id,moduleId:module.id,name:zone?.name||module.name,since:s.levelTime};
 }

 drawOverlay(ctx,width,height,dpr){
  const notice=this.streetNotice;if(!notice||this.sim.timeScale===0||this.sim.state.status!=='playing')return;
  const age=this.sim.levelTime-notice.since,duration=3.5;if(age<0||age>=duration)return;
  const alpha=Math.min(1,age/.18,(duration-age)/.55),w=Math.min(260,width-40),h=34,x=(width-w)/2,y=Math.max(112,height*.145);
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=alpha;ctx.fillStyle='rgba(37,19,24,.94)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#a68b55';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle='#eee0c5';ctx.font='17px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(notice.name,x+w/2,y+h/2,w-20);ctx.restore();
 }
 tick(){const s=this.sim;this.updateStreet();this.follow();const shapes=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity).map(c=>({c,w:c.world()})),hull=bounds(shapes.flatMap(({w})=>samples(w))),nearby=this.obstacles.filter(o=>intersects(hull,o.rect));
  for(const {c,w}of shapes)if(!this.validShape(w,nearby)){s.prefs.motivoGameOver=c.entity.name.startsWith('manigueta')?3:c.entity.name.startsWith('candelabro')?4:2;s.send(s.stepEntity,'gameOverMet');return;}
  const pos=s.position(s.stepEntity.transform);for(const cp of this.checkpoints)if(!this.checkpointIds.includes(cp.id)&&s.state.lifted&&!s.controller.martillo&&Math.hypot(pos.x-cp.position[0],pos.y-cp.position[1])<=cp.radius){this.checkpointIds.push(cp.id);this.checkpointReached=this.checkpointIds.includes(this.scene.checkpoint?.id);s.emit('checkpoint');}
  const f=this.scene.finish,delta=Math.abs(((s.angle(s.stepEntity.transform)-f.heading+540)%360)-180);
  if(s.controller.animator.state==='pasoBajado'&&delta<=f.tolerance&&shapes.every(({w})=>samples(w).every(p=>pointInPolygon(p,f.polygon)))){this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
 }
 snapshot(){return {finished:this.finished,checkpointReached:this.checkpointReached,checkpointIds:[...this.checkpointIds]};}
 restore(v){this.finished=!!v?.finished;this.checkpointReached=!!v?.checkpointReached;this.checkpointIds=[...(v?.checkpointIds|| (v?.checkpointReached&&this.scene.checkpoint?[this.scene.checkpoint.id]:[]))];this.streetNotice=null;this.follow();}
 drawFloor(){}
 drawMarkers(){} // Markers are the original sprites in the scene graph.

 drawArchitecture(ctx,m,im,sprite,node,images){
  // Only visible world tiles exist as canvas surfaces. An LRU cap releases
  // distant sectors while retaining the lightweight complete collision data.
  const det=m[0]*m[3]-m[1]*m[2],inv=p=>[(m[3]*(p[0]-m[4])-m[2]*(p[1]-m[5]))/det,(-m[1]*(p[0]-m[4])+m[0]*(p[1]-m[5]))/det];
  const corners=[[0,0],[ctx.canvas.width,0],[ctx.canvas.width,ctx.canvas.height],[0,ctx.canvas.height]].map(inv),r=bounds(corners),v=this.scene,t=v.tileSize*v.ppu;
  ctx.save();ctx.setTransform(...m);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;
  for(let iy=Math.max(0,Math.floor(r[1]/t));iy<=Math.min(Math.ceil(sprite.rectSize[1]/t)-1,Math.floor(r[3]/t));iy++)for(let ix=Math.max(0,Math.floor(r[0]/t));ix<=Math.min(Math.ceil(sprite.rectSize[0]/t)-1,Math.floor(r[2]/t));ix++){
   const key=ix+','+iy;let canvas=this.tileCache.get(key);if(!canvas){canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(t,t):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(t,t);canvas.width=t;canvas.height=t;this.paintTile(canvas.getContext('2d'),images,[v.bounds[0]+ix*v.tileSize,v.bounds[3]-(iy+1)*v.tileSize,v.bounds[0]+(ix+1)*v.tileSize,v.bounds[3]-iy*v.tileSize]);}this.tileCache.delete(key);this.tileCache.set(key,canvas);while(this.tileCache.size>v.maxCachedTiles){const oldest=this.tileCache.keys().next().value;this.tileCache.delete(oldest);}ctx.drawImage(canvas,ix*t,iy*t);
  }ctx.restore();
 }
 paintTile(ctx,images,r){const v=this.scene,p=v.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  const fill=(poly,c)=>{path(poly);ctx.fillStyle=c;ctx.fill();},box=(r,c)=>fill(rect(r),c);
  const line=(a,c,width)=>{ctx.strokeStyle=c;ctx.lineWidth=width*p;ctx.beginPath();a.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.stroke();};
  const image=key=>images.get(key)||images.get(this.graph.data.sprites[key]?.image),floor=image('sharedassets2.assets:373');ctx.imageSmoothingEnabled=false;
  // Surrounding blocks extend beyond the played path, so no camera corner is
  // left black. All roofs and house textures come from the existing game.
  box(r,'#65605a');for(let y=Math.floor(r[1]/3)*3;y<r[3];y+=3)for(let x=Math.floor(r[0]/3)*3;x<r[2];x+=3){const key=NATIVE_HOUSE_KEYS[Math.abs(Math.floor(x*7+y*3))%NATIVE_HOUSE_KEYS.length],im=image(key);if(im)ctx.drawImage(im,px(x),py(y+3),3*p,3*p);}
  for(const h of this.houses){if(!intersects(h.bounds,r))continue;const im=image(NATIVE_HOUSE_KEYS[h.material]);if(!im)continue;ctx.save();path(h.poly);ctx.clip();ctx.drawImage(im,px(h.bounds[0]),py(h.bounds[3]),(h.bounds[2]-h.bounds[0])*p,(h.bounds[3]-h.bounds[1])*p);ctx.restore();}
  for(const poly of this.walkable){if(!intersects(bounds(poly),r))continue;ctx.save();path(poly);ctx.clip();box(r,'#747268');if(floor)for(let y=Math.floor(r[1]/1.1)*1.1;y<r[3];y+=1.1)for(let x=Math.floor(r[0]/1.1)*1.1;x<r[2];x+=1.1)ctx.drawImage(floor,322,40,110,110,px(x),py(y+1.1),1.1*p,1.1*p);ctx.restore();}
  for(const {a,b,n,module}of this.segments){if(!intersects(bounds(polygonAt(a,b,module.halfWidth)),r))continue;for(const sign of [-1,1]){const offset=module.style==='avenue'?1.85:module.halfWidth-.14;line([[a[0]+n[0]*offset*sign,a[1]+n[1]*offset*sign],[b[0]+n[0]*offset*sign,b[1]+n[1]*offset*sign]],'#b3aa96',.07);}
   if(module.style==='avenue'){line([a,b],'#555b5b',3.6);if(floor){ctx.save();path(polygonAt(a,b,1.8));ctx.clip();ctx.globalAlpha=.15;for(let y=r[1];y<r[3];y+=1.1)for(let x=r[0];x<r[2];x+=1.1)ctx.drawImage(floor,322,40,110,110,px(x),py(y+1.1),1.1*p,1.1*p);ctx.restore();}}
  }
  const plaza=v.modules.find(m=>m.style==='square'),hall=plaza.townHall;
  if(intersects(plaza.visual.footprint,r)){
   ctx.save();path(rect(plaza.visual.footprint));ctx.clip();box(r,plaza.visual.paving);
   if(floor){ctx.globalAlpha=.28;for(let y=Math.floor(r[1]/.65)*.65;y<r[3];y+=.65)for(let x=Math.floor(r[0]/.65)*.65;x<r[2];x+=.65)ctx.drawImage(floor,322,40,110,110,px(x),py(y+.65),.65*p,.65*p);ctx.globalAlpha=1;}
   // Pale stone panels and darker joints make the square visually distinct.
   for(let x=50.8;x<59.4;x+=1.1)line([[x,30.8],[x,36.3]],'rgba(103,93,78,.28)',.024);
   for(let y=30.8;y<=36.3;y+=1.1)line([[50.8,y],[59.4,y]],'rgba(103,93,78,.28)',.024);
   ctx.restore();const outline=rect(plaza.visual.footprint);line([...outline,outline[0]],'#d1c6b0',.08);
  }
  for(const [i,front]of plaza.visual.frontages.entries())if(intersects(front,r)){
   box(front,plaza.visual.facadePalette[i]);const west=i===0,roof=image(NATIVE_HOUSE_KEYS[(i+3)%NATIVE_HOUSE_KEYS.length]);if(roof)ctx.drawImage(roof,px(front[0]),py(front[3]),(front[2]-front[0])*p,(front[3]-front[1])*p);box(west?[front[2]-.34,front[1],front[2],front[3]]:[front[0],front[1],front[2],front[1]+.34],plaza.visual.facadePalette[i]);
   if(west){for(let y=front[1]+.22;y<front[3]-.15;y+=.55){box([front[2]-.22,y,front[2]-.06,y+.26],'#2f3835');line([[front[2]-.30,y-.025],[front[2],y-.025]],'#a2957b',.035);}}
   else{for(let x=front[0]+.20;x<front[2]-.15;x+=.55){box([x,front[1]+.06,x+.24,front[1]+.22],'#2f3835');line([[x-.02,front[1]+.03],[x+.28,front[1]+.03]],'#a2957b',.035);}}
  }
  // Visible balcony rails, cierros and commercial fronts use the same masonry
  // palette. No brand names, floating labels or historical gateway are added.
  for(const h of this.houses){if(!intersects(h.bounds,r))continue;line(h.front,h.module.style==='avenue'?'#d5cdbb':'#d6c0a2',.04);const [a,b]=h.front,segments=3;
   for(let i=0;i<segments;i++){const d=(i+.2)/segments,q=[a[0]+(b[0]-a[0])*d,a[1]+(b[1]-a[1])*d],length=.30,t=h.t,n=h.n;
    const polygon=polygonAt([q[0]+n[0]*h.side*.02,q[1]+n[1]*h.side*.02],[q[0]+t[0]*length+n[0]*h.side*.02,q[1]+t[1]*length+n[1]*h.side*.02],.06);fill(polygon,h.module.style==='commercial'||h.module.style==='expectation'?'#263f48':'#19272c');line([q,[q[0]+t[0]*length,q[1]+t[1]*length]],'#a48a63',.024);
   }
  }
  if(intersects(hall.rect,r))paintAyuntamiento({ctx,box,line,fill,hall});
  const monument=plaza.monument,q=monument.position;
  box([q[0]-.38,q[1]-.38,q[0]+.38,q[1]+.38],'#c8bda5');box([q[0]-.27,q[1]-.27,q[0]+.27,q[1]+.27],'#dfd1b4');
  box([q[0]-.20,q[1]-.23,q[0]+.20,q[1]+.23],'#928872');
  // Small bronze equestrian silhouette: horse, raised neck, rider and legs.
  const horse=[[-.27,-.03],[-.18,.10],[.12,.09],[.20,.22],[.32,.20],[.34,.10],[.22,.03],[.20,-.12],[-.20,-.12]];
  fill(horse.map(([x,y])=>[q[0]+x,q[1]+y]),'#3f5145');
  line([[q[0]-.19,q[1]-.08],[q[0]-.22,q[1]-.23]],'#34453a',.045);line([[q[0]+.16,q[1]-.07],[q[0]+.21,q[1]-.20]],'#34453a',.045);
  box([q[0]-.07,q[1]+.05,q[0]+.04,q[1]+.24],'#536550');ctx.fillStyle='#657558';ctx.beginPath();ctx.arc(px(q[0]-.01),py(q[1]+.27),.055*p,0,Math.PI*2);ctx.fill();

  for(const module of v.modules)for(const [x,y,radius]of module.trees){box([x-.20,y-.20,x+.20,y+.20],'#a69a81');ctx.fillStyle='#244333';ctx.beginPath();ctx.arc(px(x),py(y),radius*p,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#3d5b39':'#315238';ctx.beginPath();ctx.arc(px(x)+Math.cos(i)*radius*p*.4,py(y)+Math.sin(i)*radius*p*.4,radius*p*.43,0,Math.PI*2);ctx.fill();}}
  // A few metres of the old bridge remain behind the new starting position.
  // The river, continuous quay and splayed bridgehead replace the abrupt
  // roof/deck seam. This is visual dressing; the playable footprint is intact.
  box(v.bridgeTail.water,v.ambient.water);
  for(let y=20;y<40;y+=.42){line([[28.2,y],[31.8,y+.06]],'rgba(149,175,164,.16)',.022);}
  box([32.2,19,33.65,40],'#938d7a');line([[32.2,19],[32.2,40]],'#b7ad91',.10);line([[32.32,19],[32.32,40]],'#4f5852',.04);
  fill([[33.65,26.25],[36.6,26.25],[38,26.9],[38,32.3],[36.6,32.95],[33.65,32.95]],'#a79e89');
  if(floor){ctx.save();path([[32.2,19],[33.65,19],[33.65,26.25],[36.6,26.25],[38,26.9],[38,32.3],[36.6,32.95],[33.65,32.95],[33.65,40],[32.2,40]]);ctx.clip();ctx.globalAlpha=.55;for(let y=Math.floor(r[1]/.8)*.8;y<r[3];y+=.8)for(let x=Math.floor(r[0]/.8)*.8;x<r[2];x+=.8)ctx.drawImage(floor,322,40,110,110,px(x),py(y+.8),.8*p,.8*p);ctx.restore();}
  for(const sign of [-1,1]){const y=29.6+sign*2.65;box([34.25,y-.16,34.95,y+.16],'#6b675b');line([[34.25,y],[34.95,y]],'#b9aa86',.09);}
  box([28,27.8,34.8,31.4],'#646969');
  fill([[34.8,27.8],[36.15,27.15],[37.95,27.8],[37.95,31.4],[36.15,32.05],[34.8,31.4]],'#646969');
  line([[34.8,28.28],[36.25,28.05],[38,27.75]],'#b3aa96',.07);line([[34.8,30.92],[36.25,31.15],[38,31.45]],'#b3aa96',.07);
  for(const y of [27.8,31.4]){line([[28,y],[34.8,y]],'#acbab4',.06);for(let x=28.15;x<34.7;x+=.47){ctx.strokeStyle='#b7c2b9';ctx.lineWidth=.028*p;ctx.beginPath();ctx.ellipse(px(x),py(y),.18*p,.13*p,0,0,Math.PI*2);ctx.stroke();}}
  for(const sign of [-1,1]){const y=29.6+sign*1.8;line([[34.8,y],[35.65,y+sign*.37],[36.15,y+sign*.37]],'#c9c3ac',.08);box([34.68,y-.13,34.93,y+.13],'#c6bda5');}

  // Integrated stone pad, not a floating arcade finish. Its invisible trigger
  // still requires the entire native paso to be lowered inside this footprint.
  // Preserve the native pavement beneath the transparent yellow frame.
  for(const person of this.people)if(person.baked&&inRect(person.point,[r[0]-.2,r[1]-.2,r[2]+.2,r[3]+.2])){const im=image(person.key);if(im)ctx.drawImage(im,px(person.point[0]-person.size[0]/2),py(person.point[1]+person.size[1]/2),person.size[0]*p,person.size[1]*p);}
  ctx.globalAlpha=v.ambient.darkness;box(r,v.ambient.tint);ctx.globalAlpha=1;
  for(const [x,y]of this.lamps)if(inRect([x,y],[r[0]-1,r[1]-1,r[2]+1,r[3]+1])){if(v.ambient.lamps){const gradient=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),.85*p);gradient.addColorStop(0,'rgba(255,218,148,.38)');gradient.addColorStop(1,'rgba(255,207,116,0)');ctx.fillStyle=gradient;ctx.fillRect(px(x)-p,py(y)-p,2*p,2*p);}box([x-.035,y-.035,x+.035,y+.035],'#ffe4ac');}
 }
}
