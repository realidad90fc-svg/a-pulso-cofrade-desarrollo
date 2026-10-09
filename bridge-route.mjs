import {drawRouteMarkers} from './route-markers.mjs';
import {bridgeWorldPoint} from './bridge-data.mjs';
import {SceneGraph} from './original-scene.mjs';
import {pointInPolygon,segmentDistance} from './engine.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
const rect=([x,y,xx,yy])=>[[x,y],[xx,y],[xx,yy],[x,yy]];
const inRect=(p,r)=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];
export class BridgeRoute{
 constructor(sim){
  this.sim=sim;this.scene=sim.map.variant;const v=this.scene;this.plaza=v.modules.find(m=>m.kind==='square');this.bridge=v.modules.find(m=>m.kind==='bridge');this.points=v.path;this.distances=[0];for(let i=1;i<this.points.length;i++)this.distances.push(this.distances.at(-1)+Math.hypot(this.points[i][0]-this.points[i-1][0],this.points[i][1]-this.points[i-1][1]));this.length=this.distances.at(-1);
  this.localPlaza=v.layout.modules.find(m=>m.kind==='square');this.localWalkable=[this.localPlaza.polygon,...this.localPlaza.accesses.map(a=>rect(a.rect)),rect(v.layout.modules.find(m=>m.kind==='bridge').deck),rect(v.layout.cityHead)];
  this.walkable=[this.plaza.polygon,...this.plaza.accesses.map(a=>rect(a.rect)),rect(this.bridge.deck),rect(v.cityHead)];
  this.obstacles=[...this.plaza.houses.map(h=>({kind:'wall',rect:h.rect})),...this.plaza.trees.map(([x,y,r])=>({kind:'tree',center:[x,y],radius:r})),...this.plaza.landmarks.map(l=>l.rect?{kind:l.kind,rect:l.rect}:{kind:l.kind,center:l.position,radius:l.radius})];
  this.lamps=[[-3.15,26.1],[1.2,28.5],[-5.9,34.1],[-8.9,28.0],[-8.9,31.2],[-38,27],[-38,32.2]];
  for(let x=-12;x>=-35;x-=this.bridge.lampSpacing)for(const y of [27.94,31.26])this.lamps.push([x,y]);
  this.localLamps=this.lamps;this.lamps=this.localLamps.map(bridgeWorldPoint);
  for(const p of this.lamps)this.obstacles.push({kind:'lamp',center:p,radius:.055});
  const [x,y,xx,yy]=v.bounds,material={image:v.image,pixelsToUnits:v.ppu,rectSize:[Math.round((xx-x)*v.ppu),Math.round((yy-y)*v.ppu)],pivot:[.5,.5]};
  const node=(id,p,key,enabled=true)=>({id,name:id,path:id,parent:null,position:[...p,0],rotation:[0,0,0,1],scale:[1,1,1],active:true,sprite:{key,order:-50,enabled,color:[1,1,1,1]}});
  const nodes=[node('reference-architecture',[(x+xx)/2,(y+yy)/2],'bridge-architecture')];for(const key of [...NATIVE_HOUSE_KEYS,'sharedassets2.assets:373'])nodes.push(node('resource-'+key,[0,0],key,false));
  const animation={...sim.resources.animation,sprites:{...sim.resources.animation.sprites,'bridge-architecture':material},graphs:{...sim.resources.animation.graphs,bridgeRoute:{nodes,animators:[]}}};
  this.graph=new SceneGraph(animation,'bridgeRoute');sim.graphs.push(this.graph);sim.renderGraphs=[this.graph,...sim.graphs.filter(g=>g!==sim.mapGraph&&g!==this.graph)];
  this.people=[];const examples=[...sim.mapGraph.nodes.values()].filter(n=>n.sprite&&n.path.includes('/publico/')&&!n.path.includes('/pierna')&&!n.path.includes('/mano'));let count=0;for(const key of new Set(examples.map(n=>n.sprite.key)))this.graph.nodes.set('crowd-resource-'+key,node('crowd-resource-'+key,[0,0],key,false));
  const add=(localPoint)=>{const point=bridgeWorldPoint(localPoint);const index=count++,ex=examples[index%examples.length];if(!ex||this.people.length>=v.crowd.maxPeople)return;const sp=animation.sprites[ex.sprite.key],size=sp.rectSize.map(n=>n/sp.pixelsToUnits),polygon=rect([point[0]-size[0]/2,point[1]-size[1]/2,point[0]+size[0]/2,point[1]+size[1]/2]);if(!this.validShape({points:polygon}))return;
   const near=this.nearest(...point),corner=Math.hypot(point[0]+1.65,point[1]-29.6);if(near.distance<.79+size[0]/2||corner<1.08)return;
   const id='bridge-spectator-'+index,n=structuredClone(ex);Object.assign(n,{id,name:id,path:id,parent:null,position:[...point,0],rotation:[0,0,0,1],scale:[1,1,1],active:true});n.sprite={...n.sprite,order:1,color:v.ambient.crowdTint};const baked=near.distance>1.21;if(!baked)this.graph.nodes.set(id,n);this.people.push({id,point,polygon,key:n.sprite.key,size,baked});
  };
  // Ten staggered rows beside the full bridge; no spectator colliders are made.
  for(let x=-9.8;x>=-41;x-=v.crowd.spacing)for(const sign of [-1,1])for(const [i,lane]of v.crowd.lanes.entries())add([x+(i%2)*.08,29.6+sign*(lane+Math.sin(count*1.71)*.011)]);
  // The Altozano and both bridgeheads are packed on actual pavement, never roofs/water.
  for(const r of [[-10,23.8,3.8,34.9],[-42.8,26.2,-36.1,33]])for(let y=r[1];y<r[3];y+=.205)for(let x=r[0]+(Math.round(y/.205)%2)*.1;x<r[2];x+=.205){if(pointInPolygon([x,y],this.localPlaza.polygon)||inRect([x,y],v.layout.cityHead))add([x,y]);}
  sim.setPosition(sim.stepEntity.transform,[...v.start.position,0]);sim.setAngle(sim.stepEntity.transform,v.start.angle);this.finished=false;this.checkpointReached=false;this.follow();sim.vm.invoke('cameraController.LateUpdate',sim.cameraController);
 }
 nearest(x,y){let best={distance:Infinity};for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],r=segmentDistance([x,y],a,b);if(r.distance<best.distance)best={...r,along:this.distances[i-1]+Math.hypot(r.point[0]-a[0],r.point[1]-a[1])};}return best;}
 at(d){let i=1;while(i<this.distances.length-1&&this.distances[i]<d)i++;const a=this.points[i-1],b=this.points[i],t=(d-this.distances[i-1])/(this.distances[i]-this.distances[i-1]);return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(-(b[0]-a[0]),b[1]-a[1])};}
 validPoint(p,obstacles=this.obstacles,corridor=false){const near=this.nearest(...p),width=near.along>=4&&near.along<=8?1.35:1.05;if(corridor&&near.along<13.5&&near.distance>width)return false;return this.walkable.some(poly=>pointInPolygon(p,poly))&&!obstacles.some(o=>o.rect?inRect(p,o.rect):Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius);}
 validShape(w,obstacles=this.obstacles,corridor=false){if(w.circle)return Array.from({length:16},(_,i)=>[w.center[0]+w.radius*Math.cos(i*Math.PI/8),w.center[1]+w.radius*Math.sin(i*Math.PI/8)]).every(p=>this.validPoint(p,obstacles,corridor));return w.points.every((a,i)=>{const b=w.points[(i+1)%w.points.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04));for(let j=0;j<=n;j++)if(!this.validPoint([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],obstacles,corridor))return false;return true;})&&!obstacles.some(o=>!w.edge&&(o.rect?rect(o.rect):[o.center]).some(p=>pointInPolygon(p,w.points)));}
 follow(){const s=this.sim,p=s.position(s.stepEntity.transform),a=s.angle(s.stepEntity.transform)*Math.PI/180,d=this.nearest(p.x,p.y).along;for(const [e,offset,rot]of [[s.capatazEntity,1.2,-90],[s.contraEntity,-1.3,90]]){s.setPosition(e.transform,[p.x-Math.sin(a)*offset,p.y+Math.cos(a)*offset,0]);s.setAngle(e.transform,s.angle(s.stepEntity.transform)+rot);}s.cortejos.forEach((e,i)=>{const q=this.at(d+[3.5,-3,-4.5][i]);s.setPosition(e.transform,[q.x,q.y,0]);s.setAngle(e.transform,q.angle*180/Math.PI);});}
 tick(){const s=this.sim,shapes=s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity).map(c=>({c,w:c.world()})),points=shapes.flatMap(({w})=>w.circle?[[w.center[0]-w.radius,w.center[1]-w.radius],[w.center[0]+w.radius,w.center[1]+w.radius]]:w.points),hull=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],nearby=this.obstacles.filter(o=>{const r=o.rect||[o.center[0]-o.radius,o.center[1]-o.radius,o.center[0]+o.radius,o.center[1]+o.radius];return hull[2]>=r[0]&&hull[0]<=r[2]&&hull[3]>=r[1]&&hull[1]<=r[3];});this.follow();for(const {c,w}of shapes){if(!this.validShape(w,nearby,true)){s.prefs.motivoGameOver=c.entity.name.startsWith('manigueta')?3:c.entity.name.startsWith('candelabro')?4:2;s.send(s.stepEntity,'gameOverMet');return;}}
  const cp=this.scene.checkpoint,pos=s.position(s.stepEntity.transform);if(cp&&!this.checkpointReached&&s.state.lifted&&Math.hypot(pos.x-cp.position[0],pos.y-cp.position[1])<=cp.radius){this.checkpointReached=true;s.emit('checkpoint');}
  const f=this.scene.finish,delta=Math.abs(((s.angle(s.stepEntity.transform)-f.heading+540)%360)-180);
  if(s.controller.animator.state==='pasoBajado'&&delta<=f.tolerance&&s.stepColliders.filter(c=>c.enabled&&c.entity!==s.contraEntity).every(c=>{const w=c.world();return(w.circle?Array.from({length:12},(_,i)=>[w.center[0]+w.radius*Math.cos(i*Math.PI/6),w.center[1]+w.radius*Math.sin(i*Math.PI/6)]):w.points).every(p=>pointInPolygon(p,f.polygon));})){this.finished=true;s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
 }
 snapshot(){return{finished:this.finished,checkpointReached:this.checkpointReached,geometryVersion:2};}restore(v){this.finished=!!v?.finished;this.checkpointReached=!!v?.checkpointReached;
  // Already-running 0.9.0 attempts retain elapsed time and progress. Their old
  // westward pose moves into the corresponding position on the corrected map.
  if(v?.geometryVersion!==2){const s=this.sim,p=s.position(s.stepEntity.transform),angle=-s.angle(s.stepEntity.transform);s.setPosition(s.stepEntity.transform,[...bridgeWorldPoint([p.x,p.y]),p.z]);s.setAngle(s.stepEntity.transform,angle);
   for(const [left,right]of [['izqAl','derAl'],['izqAt','derAt']]){const value=s.controller[left];s.controller[left]=s.controller[right];s.controller[right]=value;}
   const a=angle*Math.PI/180;s.setPosition(s.cameraEntity.transform,[bridgeWorldPoint([p.x,p.y])[0]+Math.sin(a)*.75,p.y-Math.cos(a)*.75,-10]);s.setAngle(s.cameraEntity.transform,angle);s.cameraController.rotacionPaso=(angle+360)%360;s.cameraController.rotacionCamara=(angle+360)%360;
  }this.follow();}
 drawFloor(){}
 drawMarkers(ctx,project){const cp=this.scene.checkpoint;drawRouteMarkers(ctx,project,cp&&!this.checkpointReached?[[cp.position[0]-1.1,cp.position[1]-.6],[cp.position[0]+1.1,cp.position[1]-.6],[cp.position[0]+1.1,cp.position[1]+.6],[cp.position[0]-1.1,cp.position[1]+.6]]:null,this.scene.finish.polygon);}

 drawArchitecture(ctx,m,im,sprite,node,images){if(!this.surface){const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(...sprite.rectSize):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(...sprite.rectSize);canvas.width=sprite.rectSize[0];canvas.height=sprite.rectSize[1];this.paint(canvas.getContext('2d'),images);this.surface=canvas;}ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#47747b';ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.setTransform(...m);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;ctx.drawImage(this.surface,0,0,...sprite.rectSize);ctx.restore();}
 paint(ctx,images){
  const scene=this.scene,v={...scene.layout,ambient:scene.ambient},b=v.modules.find(m=>m.kind==='bridge'),a=v.modules.find(m=>m.kind==='square'),p=v.ppu,[minX,minY,maxX,maxY]=v.bounds,px=x=>(x-minX)*p,py=y=>(maxY-y)*p;
  ctx.save();ctx.translate(ctx.canvas.width,0);ctx.scale(-1,1);
  // Reorient geometry while keeping each original texture and label readable.
  const blit=(im,...args)=>{const [x,y,w,h]=args.slice(-4);ctx.save();ctx.translate(2*x+w,0);ctx.scale(-1,1);ctx.drawImage(im,...args);ctx.restore();};
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};const fill=(poly,c)=>{path(poly);ctx.fillStyle=c;ctx.fill();};const box=(r,c)=>fill(rect(r),c);
  const line=(points,c,w)=>{ctx.strokeStyle=c;ctx.lineWidth=w*p;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.stroke();};
  box(v.bounds,'#706e61');box([-36,19,-10,40],v.ambient.water);box(b.river,v.ambient.water);
  // Fixed, deterministic water flecks and warm lamp reflections baked only once.
  for(let i=0;i<230;i++){const x=-35.2+(i*.618033%1)*23.6,y=19.1+(i*.414213%1)*20.6;line([[x,y],[x+.13+(i%4)*.08,y]],i%3?'#679297':'#89abac',.016);}
  if(v.ambient.lamps)for(const x of [-14,-20.4,-26.8,-33.2])for(const sign of [-1,1])for(let j=0;j<8;j++)line([[x-.17+j*.008,29.6+sign*(2.05+j*.19)],[x+.17-j*.008,29.6+sign*(2.05+j*.19)]],j%2?'#a4915e55':'#b5a27644',.025);
  for(const bank of b.banks){box([bank-.22,19,bank+.22,40],'#938d79');line([[bank,19],[bank,40]],'#c7bfa3',.06);}
  const floor=images.get('sharedassets2.assets:373')||images.get(this.graph.data.sprites['sharedassets2.assets:373'].image);
  for(const poly of [...this.localWalkable,rect([-2.95,19,-.35,27.1])]){ctx.save();path(poly);ctx.clip();if(floor)for(let y=19;y<40;y+=1.1)for(let x=-43;x<7;x+=1.1)blit(floor,322,40,110,110,px(x),py(y+1.1),p*1.1,p*1.1);ctx.restore();}
  // Raised pavement and a narrower, visible L-shaped lane constrain the turn.
  ctx.save();path(a.polygon);ctx.clip();line(v.path.slice(0,3),'#c0b79c',2.14);line(v.path.slice(0,3),'#535859',2.10);line([[-1.65,28.5],[-1.65,29.6],[-4.55,29.6]],'#c0b79c',2.74);line([[-1.65,28.5],[-1.65,29.6],[-4.55,29.6]],'#535859',2.70);ctx.beginPath();for(const r of [[-2.7,24.5,-.6,29.6],[-10,28.55,-1.65,30.65],[-3,28.5,-.3,29.6],[-4.55,28.25,-1.65,30.95]]){ctx.rect(px(r[0]),py(r[3]),(r[2]-r[0])*p,(r[3]-r[1])*p);}ctx.moveTo(px(-1.65)+1.35*p,py(29.6));ctx.arc(px(-1.65),py(29.6),1.35*p,0,Math.PI*2);ctx.clip();if(floor)for(let y=24;y<32;y+=1.1)for(let x=-10;x<0;x+=1.1)blit(floor,322,40,110,110,px(x),py(y+1.1),p*1.1,p*1.1);ctx.restore();
  box(b.deck,'#575c5d');if(floor){ctx.save();ctx.globalAlpha=.13;for(let x=-36;x<-10;x+=1.1)for(let y=28.29;y<30.91;y+=1.1)blit(floor,322,40,110,110,px(x),py(Math.min(y+1.1,30.91)),p*1.1,p*Math.min(1.1,30.91-y));ctx.restore();}box([-36,27.8,-10,28.29],'#a49e8d');box([-36,30.91,-10,31.4],'#a49e8d');line([[-36,28.29],[-10,28.29]],'#d7ccb3',.035);line([[-36,30.91],[-10,30.91]],'#d7ccb3',.035);
  // Iron ribs, repeating circular lattice and stone abutments: not a generic viaduct.
  for(const sign of [-1,1]){const y=29.6+sign*1.88;line([[-36,y],[-10,y]],'#c3c7bd',.055);line([[-36,y+sign*.2],[-10,y+sign*.2]],'#7d938e',.035);
   for(let x=-35.8;x<-10.2;x+=b.ringSpacing){ctx.strokeStyle='#c2c8bc';ctx.lineWidth=.027*p;ctx.beginPath();ctx.ellipse(px(x),py(y+sign*.1),.18*p,.13*p,0,0,Math.PI*2);ctx.stroke();}
   for(let span=0;span<b.spans;span++){const left=-36+span*26/3,right=left+26/3,curve=[];for(let i=0;i<=30;i++){const t=i/30;curve.push([left+t*(right-left),y+sign*(.20+.42*Math.sin(t*Math.PI))]);}line(curve,'#738881',.065);for(let j=1;j<8;j++){const x=left+j*(right-left)/8;line([[x,y],[x,y+sign*(.20+.42*Math.sin(j*Math.PI/8))]],'#6b827b',.035);}}
   for(const x of [-36,-36+26/3,-36+52/3,-10])box([x-.19,y-.24,x+.19,y+.24],'#bcb8a2');
  }
  const house=h=>{const r=h.rect,key=NATIVE_HOUSE_KEYS[h.material],im=images.get(key)||images.get(this.graph.data.sprites[key].image);if(im)blit(im,px(r[0]),py(r[3]),(r[2]-r[0])*p,(r[3]-r[1])*p);line([[r[0],r[1]],[r[2],r[1]]],'#ebddbe',.045);for(let x=r[0]+.3;x<r[2]-.15;x+=.65){box([x,r[1]-.02,x+.23,r[1]+.16],'#1d2425');line([[x,r[1]-.04],[x+.23,r[1]-.04]],'#ab9271',.025);}};
  // Continue Pureza behind the cortejo and fill the outside with existing house textures.
  for(const h of [{rect:[-9,19,-3,24],material:3},{rect:[-.3,19,5.8,25.6],material:4},{rect:[5.8,25.8,8,28],material:2},{rect:[5.5,35.5,8,40],material:1},{rect:[-7.3,37.5,-2.9,40],material:5}])house(h);
  for(const h of a.houses)house(h);
  house({rect:[-43,33.1,-37,39],material:3});house({rect:[-43,20,-37.8,26.05],material:5});
  // San Jacinto mouth and the same Altozano monument/trees seen at the Pureza end.
  for(const [x,y,r]of a.trees){ctx.fillStyle='#254536';ctx.beginPath();ctx.arc(px(x),py(y),r*p,0,Math.PI*2);ctx.fill();for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#43603b':'#354f35';ctx.beginPath();ctx.arc(px(x)+Math.cos(i)*r*p*.4,py(y)+Math.sin(i)*r*p*.4,r*p*.43,0,Math.PI*2);ctx.fill();}}
  box([-4.7,28.6,-4.15,29.15],'#8e8570');ctx.fillStyle='#4a514b';ctx.beginPath();ctx.arc(px(-4.42),py(28.87),.11*p,0,Math.PI*2);ctx.fill();
  // The market's ochre clock front and adjoining Carmen chapel/tower.
  house({rect:[-12,34,-7.5,37.5],material:7});box([-12,34,-7.5,34.35],'#dbb854');for(let x=-11.7;x<-7.5;x+=.42)box([x,34.06,x+.21,34.26],'#29413c');
  ctx.fillStyle='#e6dfc6';ctx.beginPath();ctx.arc(px(-10.8),py(34.22),.14*p,0,Math.PI*2);ctx.fill();line([[-10.8,34.22],[-10.8,34.33]],'#26372f',.025);line([[-10.8,34.22],[-10.72,34.17]],'#26372f',.018);
  for(const [r,c]of [[[ -9.55,32.15,-8.45,33.25],'#d2b667'],[[-9.39,32.31,-8.61,33.09],'#e8cd81'],[[-9.24,32.46,-8.76,32.94],'#b69047']])box(r,c);
  ctx.fillStyle='#b49757';ctx.beginPath();ctx.arc(px(-9),py(32.7),.28*p,0,Math.PI*2);ctx.fill();box([-9.07,32.63,-8.93,32.77],'#514631');
  // Low-cost silhouettes at the shores. No further playable centre is constructed.
  box([-41.9,24.9,-41.4,26.02],'#b59f6c');for(let y=25;y<25.9;y+=.23)box([-41.81,y,-41.49,y+.07],'#4b493b');box([-41.84,26.02,-41.47,26.25],'#cbb77d');

  // Outer crowd rows are baked at scene resolution; only the two closest
  // rows remain full-resolution native sprites with viewport culling.
  ctx.imageSmoothingEnabled=false;for(const person of this.people.filter(n=>n.baked)){const im=images.get(person.key)||images.get(this.graph.data.sprites[person.key].image);if(im){const point=bridgeWorldPoint(person.point);blit(im,px(point[0]-person.size[0]/2),py(point[1]+person.size[1]/2),person.size[0]*p,person.size[1]*p);}}
  ctx.globalAlpha=v.ambient.darkness;box(v.bounds,v.ambient.tint);ctx.globalAlpha=1;
  for(const [x,y]of this.localLamps){if(v.ambient.lamps){const g=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),p*.8);g.addColorStop(0,'rgba(255,211,131,.35)');g.addColorStop(1,'rgba(255,198,99,0)');ctx.fillStyle=g;ctx.fillRect(px(x)-p,py(y)-p,p*2,p*2);}box([x-.045,y-.045,x+.045,y+.045],'#292e2c');for(const dx of [-.075,0,.075]){ctx.fillStyle=v.ambient.lamps?'#ffe4b0':'#8b8d80';ctx.beginPath();ctx.arc(px(x+dx),py(y),.025*p,0,Math.PI*2);ctx.fill();}}
  ctx.restore();
 }
}
