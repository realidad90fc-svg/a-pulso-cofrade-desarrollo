import {drawRouteMarkers} from './route-markers.mjs';
import {SceneGraph} from './original-scene.mjs';
import {pointInPolygon,segmentDistance} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
const rect=([x,y,xx,yy])=>[[x,y],[xx,y],[xx,yy],[x,yy]];
const edges=poly=>poly.map((a,i)=>[a,poly[(i+1)%poly.length]]);
const cachedBounds=new WeakMap();
function bounds(poly){let b=cachedBounds.get(poly);if(!b){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);b=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];cachedBounds.set(poly,b);}return b;}
function polyHit(shape,polygon){
 const a=shape.circle?[shape.center[0]-shape.radius,shape.center[1]-shape.radius,shape.center[0]+shape.radius,shape.center[1]+shape.radius]:bounds(shape.points),b=bounds(polygon);
 // The dense crowd keeps the same exact contacts; disjoint bounds avoid
 // expensive edge sampling for distant limbs and spectators.
 if(a[2]<b[0]||a[0]>b[2]||a[3]<b[1]||a[1]>b[3])return false;
 if(shape.circle)return pointInPolygon(shape.center,polygon)||edges(polygon).some(([a,b])=>segmentDistance(shape.center,a,b).distance<shape.radius);
 return shape.points.some(p=>pointInPolygon(p,polygon))||(!shape.edge&&polygon.some(p=>pointInPolygon(p,shape.points)))||edges(shape.points).some(([a,b])=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04);for(let j=0;j<=n;j++)if(pointInPolygon([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],polygon))return true;return false;});
}
export class ModularRoute{
 constructor(sim){
  this.sim=sim;this.scene=sim.map.variant;const v=this.scene;this.street=v.modules.find(m=>m.kind==='street');this.chapel=v.modules.find(m=>m.kind==='chapel');this.square=v.modules.find(m=>m.kind==='square');
  this.points=this.street.points;this.distances=[0];for(let i=1;i<this.points.length;i++)this.distances.push(this.distances.at(-1)+Math.hypot(this.points[i][0]-this.points[i-1][0],this.points[i][1]-this.points[i-1][1]));this.length=this.distances.at(-1);
  const road=[];for(const sign of [-1,1]){const side=[];for(let d=0;d<=this.length;d+=.05){const p=this.at(d);side.push([p.x+sign*Math.cos(p.angle)*this.street.halfWidth,p.y+sign*Math.sin(p.angle)*this.street.halfWidth]);}road.push(side);}this.road=[...road[0],...road[1].reverse()];
  this.walkable=[this.road,rect(this.chapel.room),rect(this.chapel.door),...v.modules.filter(m=>m.polygon).map(m=>m.polygon)];this.obstacles=(v.landmarks||[]).map(l=>({...l,kind:'building'}));
  // Walls are the complements of these walkable surfaces. Raised lamps/trees
  // are explicit obstacles, placed outside the guaranteed corridor.
  for(const [i,[x,y]]of v.lamps.entries())this.obstacles.push({id:'lamp-'+i,kind:'lamp',polygon:rect([x-.055,y-.055,x+.055,y+.055])});
  for(const [i,[x,y,r]]of v.trees.entries())this.obstacles.push({id:'tree-'+i,kind:'tree',polygon:rect([x-r,y-r,x+r,y+r])});
  for(const [i,b]of (v.balconies||[]).entries()){const x=this.centerAtY(b.y)+b.side*this.street.halfWidth;this.obstacles.push({id:'balcony-'+i,kind:'balcony',polygon:rect([x-b.projection,b.y-b.width/2,x+b.projection,b.y+b.width/2])});}
  const [x,y,xx,yy]=v.bounds,width=Math.round((xx-x)*v.ppu),height=Math.round((yy-y)*v.ppu);
  const material={image:v.image,pixelsToUnits:v.ppu,rectSize:[width,height],pivot:[.5,.5]};
  const nodes=[{id:'reference-architecture',name:'reference-architecture',path:'reference-architecture',parent:null,position:[(x+xx)/2,(y+yy)/2,0],rotation:[0,0,0,1],scale:[1,1,1],active:true,sprite:{key:'modular-architecture',order:-50,enabled:true,color:[1,1,1,1]}}];
  for(const key of [...NATIVE_HOUSE_KEYS,'sharedassets2.assets:373'])nodes.push({id:'resource-'+key,name:'resource-'+key,path:'resource-'+key,parent:null,position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:true,sprite:{key,order:-50,enabled:false,color:[1,1,1,1]}});
  const animation={...sim.resources.animation,sprites:{...sim.resources.animation.sprites,'modular-architecture':material},graphs:{...sim.resources.animation.graphs,modularRoute:{nodes,animators:[]}}};
  this.graph=new SceneGraph(animation,'modularRoute');sim.graphs.push(this.graph);sim.renderGraphs=[this.graph,...sim.graphs.filter(g=>g!==sim.mapGraph&&g!==this.graph)];
  this.people=[];const examples=[...sim.mapGraph.nodes.values()].filter(n=>n.sprite&&n.path.includes('/publico/')&&!n.path.includes('/pierna')&&!n.path.includes('/mano'));
  const add=(point,index)=>{const example=examples[index%examples.length];if(!example)return;const n=structuredClone(example),sp=animation.sprites[n.sprite.key],size=sp.rectSize.map(v=>v/sp.pixelsToUnits),radius=Math.hypot(...size)/2,polygon=rect([point[0]-size[0]/2,point[1]-size[1]/2,point[0]+size[0]/2,point[1]+size[1]/2]);
   if(this.people.length>=(v.crowd?.maxPeople||650)||!this.validShape({points:polygon})||this.obstacles.some(o=>polyHit({points:polygon},o.polygon)))return;
   // A crowd footprint cannot cross a roof or lie within the passage corridor.
   const near=this.nearest(...point);if((point[1]<28.0&&near.distance<(v.crowd?.clearHalfWidth||.86)+size[0]/2)||(Math.abs(point[1])<2.1&&point[0]>-1.32))return;
   const id='pureza-spectator-'+index;n.id=id;n.name=id;n.path=id;n.parent=null;n.position=[...point,0];n.scale=[1,1,1];n.rotation=[0,0,0,1];n.active=true;n.sprite={...n.sprite,order:1};this.graph.nodes.set(id,n);this.people.push({id,point,radius,polygon});
  };
  // Staggered, irregular groups use the original crowd figures. Multiple
  // rows fit only on actual pavement; the central manoeuvring corridor stays clear.
  const jitter=n=>Math.sin(n*12.9898+78.233)*.016;let i=0;
  for(let d=1;d<this.length-2;d+=v.crowd?.spacing||.32)for(const sign of [-1,1])for(const lane of v.crowd?.lanes||[1.11]){
   const p=this.at(d+jitter(i)+(lane>1.1?.09:0)),offset=lane+jitter(i+31)*.25;
   add([p.x+sign*Math.cos(p.angle)*offset,p.y+sign*Math.sin(p.angle)*offset],i++);
  }
  // Frontage crowd faces the chapel from the outer edge of the turning bay.
  for(let y=-1.4;y<=1.4;y+=.20)add([-1.48+jitter(i)*.3,y+jitter(i)],i++);
  for(const polygon of [...v.crowdAreas.slice(-1),...v.crowdAreas.slice(0,-1)]){const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),gap=v.crowd?.plazaSpacing||.3;let row=0;
   for(let y=Math.min(...ys)+.1;y<Math.max(...ys);y+=gap,row++)for(let x=Math.min(...xs)+.1+(row%2)*gap/2;x<Math.max(...xs);x+=gap){const point=[x+jitter(i),y+jitter(i+7)];if(pointInPolygon(point,polygon))add(point,i++);}
  }
  sim.setPosition(sim.stepEntity.transform,[...v.start.position,0]);sim.setAngle(sim.stepEntity.transform,v.start.angle);this.exited=false;this.finished=false;this.checkpointReached=false;this.follow();sim.vm.invoke('cameraController.LateUpdate',sim.cameraController);
 }
 centerAtY(y){for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i];if(y>=a[1]&&y<=b[1])return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);}return 0;}
 nearest(x,y){let best={distance:Infinity};for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],r=segmentDistance([x,y],a,b);if(r.distance<best.distance)best={...r,along:this.distances[i-1]+Math.hypot(r.point[0]-a[0],r.point[1]-a[1])};}return best;}
 at(distance){let i=1;while(i<this.distances.length-1&&this.distances[i]<distance)i++;const a=this.points[i-1],b=this.points[i],t=(distance-this.distances[i-1])/(this.distances[i]-this.distances[i-1]);return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(-(b[0]-a[0]),b[1]-a[1])};}
 validPoint(p){const near=this.nearest(...p);return (p[1]>=this.points[0][1]&&p[1]<=this.points.at(-1)[1]&&near.distance<=this.street.halfWidth)||this.walkable.slice(1).some(poly=>pointInPolygon(p,poly));}
 validDisk(p,r){return Array.from({length:12},(_,i)=>[p[0]+r*Math.cos(i*Math.PI/6),p[1]+r*Math.sin(i*Math.PI/6)]).every(q=>this.validPoint(q));}
 validShape(w){if(w.circle)return this.validDisk(w.center,w.radius);return edges(w.points).every(([a,b])=>{const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04));for(let i=0;i<=n;i++)if(!this.validPoint([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]))return false;return true;});}
 follow(){const s=this.sim,pos=s.position(s.stepEntity.transform),a=s.angle(s.stepEntity.transform)*Math.PI/180;
  // Helpers follow the player's actual heading at the exit; no rail or assisted
  // rotation is ever applied to the paso itself.
  if(!this.exited){s.setPosition(s.capatazEntity.transform,[pos.x-Math.sin(a)*1.2,pos.y+Math.cos(a)*1.2,0]);s.setAngle(s.capatazEntity.transform,s.angle(s.stepEntity.transform)-90);s.setPosition(s.contraEntity.transform,[pos.x+Math.sin(a)*1.3,pos.y-Math.cos(a)*1.3,0]);s.setAngle(s.contraEntity.transform,s.angle(s.stepEntity.transform)+90);}
  else{const d=this.nearest(pos.x,pos.y).along;for(const [e,offset,angle]of [[s.capatazEntity,1.2,-90],[s.contraEntity,-1.3,90]]){const p=this.at(d+offset);s.setPosition(e.transform,[p.x,p.y,0]);s.setAngle(e.transform,p.angle*180/Math.PI+angle);}}
  s.cortejos.forEach((e,i)=>{const d=this.nearest(pos.x,pos.y).along,p=this.at(d+[3.5,-3,-4.5][i]);s.setPosition(e.transform,[p.x,p.y,0]);s.setAngle(e.transform,p.angle*180/Math.PI);});
 }
 fail(reason){const s=this.sim;if(s.state.status!=='playing')return;s.prefs.motivoGameOver=reason;s.send(s.stepEntity,'gameOverMet');}
 tick(){const s=this.sim,pos=s.position(s.stepEntity.transform);if(pos.x<.3)this.exited=true;this.follow();
  const nearbyObstacles=this.obstacles.filter(o=>o.kind==='building'||o.polygon.some(p=>Math.hypot(p[0]-pos.x,p[1]-pos.y)<2));const nearbyPeople=this.people.filter(p=>Math.hypot(p.point[0]-pos.x,p.point[1]-pos.y)<1.5);
  for(const c of s.stepColliders){if(!c.enabled||c.entity===s.contraEntity)continue;const w=c.world(),reason=c.entity.name.startsWith('manigueta')?3:c.entity.name.startsWith('candelabro')?4:['romano','señor'].includes(c.entity.name)?6:2;
   if(!this.validShape(w)){this.fail(reason);return;}
   if(nearbyObstacles.some(o=>polyHit(w,o.polygon))){this.fail(reason);return;}
   if(nearbyPeople.some(p=>polyHit(w,p.polygon))){this.fail(13);return;}
  }
  const cp=this.scene.checkpoint;if(cp&&!this.checkpointReached&&s.state.lifted&&Math.hypot(pos.x-cp.position[0],pos.y-cp.position[1])<=cp.radius){this.checkpointReached=true;s.emit('checkpoint');}
  const f=this.scene.finish,angle=s.angle(s.stepEntity.transform),delta=Math.abs(((angle-f.heading+540)%360)-180);
  if(this.exited&&s.controller.animator.state==='pasoBajado'&&delta<=f.tolerance&&s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity).every(c=>{const w=c.world();return(w.points||[w.center]).every(p=>pointInPolygon(p,f.polygon));})){
   this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');
  }
 }
 snapshot(){return{exited:this.exited,finished:this.finished,checkpointReached:this.checkpointReached};}
 restore(state){this.exited=!!state?.exited;this.finished=!!state?.finished;this.checkpointReached=!!state?.checkpointReached;this.follow();}
 drawFloor(){} // Pavement and all façades share the cached scene surface.
 drawMarkers(ctx,project){const cp=this.scene.checkpoint;drawRouteMarkers(ctx,project,cp&&!this.checkpointReached?[[cp.position[0]-.6,cp.position[1]-1.1],[cp.position[0]+.6,cp.position[1]-1.1],[cp.position[0]+.6,cp.position[1]+1.1],[cp.position[0]-.6,cp.position[1]+1.1]]:null,this.scene.finish.polygon);}

 drawArchitecture(ctx,m,im,sprite,node,images){
  if(!this.surface){let canvas;try{canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(...sprite.rectSize):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(...sprite.rectSize);}catch{}
   if(canvas?.getContext){canvas.width=sprite.rectSize[0];canvas.height=sprite.rectSize[1];this.paint(canvas.getContext('2d'),images);this.surface=canvas;}}
  ctx.save();ctx.setTransform(...m);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;ctx.drawImage(this.surface||im,0,0,...sprite.rectSize);ctx.restore();
 }
 paint(ctx,images){
  const v=this.scene,ppu=v.ppu,[minX,minY,maxX,maxY]=v.bounds;const px=x=>(x-minX)*ppu,py=y=>(maxY-y)*ppu;
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  const fill=(poly,color)=>{path(poly);ctx.fillStyle=color;ctx.fill();};const fillRect=(r,c)=>fill(rect(r),c);
  ctx.fillStyle='#302f38';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
  const floor=images.get('sharedassets2.assets:373')||images.get(this.graph.data.sprites['sharedassets2.assets:373'].image);
  // Paint a single native paving texture; coordinates of walls and pavement
  // are derived from exactly the same geometry checked by contacts.
  for(const area of this.walkable){ctx.save();path(area);ctx.clip();if(floor)for(let y=minY;y<maxY;y+=1.1)for(let x=minX;x<maxX;x+=1.1)ctx.drawImage(floor,322,40,110,110,px(x),py(y+1.1),ppu*1.1,ppu*1.1);ctx.restore();}
  // Existing crowd stands on narrow stone pavements, with a visible kerb.
  for(const sign of [-1,1]){const outer=[],inner=[];for(let d=0;d<this.length;d+=.08){const p=this.at(d);outer.push([p.x+sign*Math.cos(p.angle)*1.29,p.y+sign*Math.sin(p.angle)*1.29]);inner.push([p.x+sign*Math.cos(p.angle)*1.04,p.y+sign*Math.sin(p.angle)*1.04]);}fill([...outer,...inner.reverse()],'#8b8272');}
  for(const house of v.houses){const r=house.rect;const centerAt=y=>this.centerAtY(y);const frontAt=y=>centerAt(y)+house.side*(this.street.halfWidth+.012+(house.side<0&&Math.abs(y)<1.6?.35:0));const frontA=frontAt(r[1]),frontB=frontAt(r[3]),backA=frontA+house.side*4.4,backB=frontB+house.side*4.4;const poly=[[frontA,r[1]],[backA,r[1]],[backB,r[3]],[frontB,r[3]]],key=NATIVE_HOUSE_KEYS[house.material],image=images.get(key)||images.get(this.graph.data.sprites[key].image);if(image){ctx.save();path(poly);ctx.clip();ctx.beginPath();ctx.rect(0,0,ctx.canvas.width,ctx.canvas.height);for(const area of this.walkable){area.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();}ctx.clip('evenodd');ctx.drawImage(image,px(r[0]),py(r[3]),(r[2]-r[0])*ppu,(r[3]-r[1])*ppu);ctx.restore();}
   const front=(frontA+frontB)/2;ctx.strokeStyle=house.material%2?'#d7c5a5':'#efe1c4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px(frontA),py(r[1]));ctx.lineTo(px(frontB),py(r[3]));ctx.stroke();
   // Cierros/balconies stay on the footprint edge, never in the passage.
   for(let y=r[1]+.4;y<r[3]-.2;y+=.7){if(y>12.35&&y<13.7&&house.side<0)continue;const front=frontAt(y);fillRect([front-.045,y,front+.045,y+.33],'#16191d');if(house.balcony){ctx.strokeStyle='#847963';ctx.lineWidth=1.5;ctx.strokeRect(px(front-.06),py(y+.33),.12*ppu,.33*ppu);}}
  }
  for(const landmark of v.landmarks||[]){const image=images.get(NATIVE_HOUSE_KEYS[landmark.material]),xs=landmark.polygon.map(p=>p[0]),ys=landmark.polygon.map(p=>p[1]);ctx.save();path(landmark.polygon);ctx.clip();if(image)ctx.drawImage(image,px(Math.min(...xs)),py(Math.max(...ys)),(Math.max(...xs)-Math.min(...xs))*ppu,(Math.max(...ys)-Math.min(...ys))*ppu);ctx.restore();path(landmark.polygon);ctx.lineWidth=3;ctx.strokeStyle='#e6d3ad';ctx.stroke();}
  for(const o of this.obstacles.filter(o=>o.kind==='balcony')){fill(o.polygon,'#c6b98e');const xs=o.polygon.map(p=>p[0]),ys=o.polygon.map(p=>p[1]);fillRect([Math.min(...xs)+.025,Math.min(...ys)+.03,Math.max(...xs)-.025,Math.max(...ys)-.03],'#172126');path(o.polygon);ctx.strokeStyle='#4e4435';ctx.lineWidth=2;ctx.stroke();}
  // Local bocacalle at Pureza's northern bend, compressed from the references.

  const ch=this.chapel;fillRect(ch.bounds,'#e9ddba');fillRect(ch.room,'#594d41');
  ctx.save();path(rect(ch.room));ctx.clip();for(let x=ch.room[0];x<ch.room[2];x+=.22)for(let y=ch.room[1];y<ch.room[3];y+=.22)fillRect([x,y,x+.21,y+.21],(Math.round(x/.22)+Math.round(y/.22))%2?'#40382f':'#716452');ctx.restore();
  // Cream/ochre portal, azulejo and paired lanterns echo the provided capilla.
  fillRect(ch.door,'#aaa08b');for(const y of [-.82,.63]){fillRect([1.23,y,1.78,y+.2],'#a8833e');fillRect([1.35,y+.035,1.65,y+.17],'#e2bd6d');}
  fillRect([1.29,-1.65,1.53,-1.0],'#284765');fillRect([1.32,-1.6,1.49,-1.05],'#d6c8a7');
  // Detailed paired ochre pilasters and cream mouldings, with the working
  // opening kept clear. This is map architecture, never a duplicate paso.
  for(const y of [-1.15,.9]){fillRect([1.32,y,1.55,y+.22],'#ba944f');fillRect([1.36,y+.03,1.51,y+.19],'#ead3a3');fillRect([1.27,y-.04,1.62,y+.01],'#d3b67a');}
  for(const y of [-2.05,1.45]){fillRect([1.3,y,1.45,y+.38],'#d9c596');fillRect([1.315,y+.04,1.41,y+.34],'#454438');fillRect([1.31,y+.03,1.37,y+.08],'#b69762');}
  const tx=px(1.40),ty=py(-1.31);ctx.strokeStyle='#627999';ctx.lineWidth=1.5;ctx.strokeRect(tx-3,ty-14,6,28);ctx.strokeStyle='#8c753f';ctx.beginPath();ctx.moveTo(tx,ty-8);ctx.lineTo(tx,ty+8);ctx.moveTo(tx-4,ty-2);ctx.lineTo(tx+4,ty-2);ctx.stroke();
  // Only visible roof/wall strips are built; a cutaway exposes the playable exit.
  fillRect([6.1,-2.3,8,2.3],'#806951');fillRect([2,-2.3,6.1,-1.8],'#967142');fillRect([2,1.8,6.1,2.3],'#967142');
  const roof=images.get(NATIVE_HOUSE_KEYS[7]);if(roof)ctx.drawImage(roof,px(2),py(2.3),4.1*ppu,.5*ppu);
  for(const [x,y,r]of v.trees){ctx.fillStyle='#153526';ctx.beginPath();ctx.arc(px(x),py(y),r*ppu,0,Math.PI*2);ctx.fill();for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#2e4d30':'#244d36';ctx.beginPath();ctx.arc(px(x)+Math.cos(i)*r*ppu*.4,py(y)+Math.sin(i)*r*ppu*.4,r*ppu*.42,0,Math.PI*2);ctx.fill();}}
  // Discreet plaza paving, base of the monument and warm street lights.
  fillRect([-4.7,28.6,-4.15,29.15],'#8e8570');ctx.fillStyle='#4a514b';ctx.beginPath();ctx.arc(px(-4.42),py(28.87),.11*ppu,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=v.ambient.tint;ctx.globalAlpha=v.ambient.darkness;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.globalAlpha=1;
  for(const [x,y]of [...v.lamps,[1.3,-.9],[1.3,.9]]){const gradient=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),ppu*.85);gradient.addColorStop(0,'rgba(255,204,115,.38)');gradient.addColorStop(1,'rgba(255,183,77,0)');ctx.fillStyle=gradient;ctx.fillRect(px(x)-ppu,py(y)-ppu,ppu*2,ppu*2);ctx.fillStyle='#21201c';ctx.fillRect(px(x)-4,py(y)-4,8,8);ctx.fillStyle='#ffe1a4';ctx.fillRect(px(x)-2,py(y)-2,4,4);}
 }
}
