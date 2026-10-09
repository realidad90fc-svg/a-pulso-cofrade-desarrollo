import {CentreRoute} from './centre-route.mjs';
import {originalOfficialPoint,ORIGINAL_OFFICIAL_MAP,OFFICIAL_SEATING,SIERPES_JOIN} from './official-data.mjs';
import {paintAyuntamiento,paintAyuntamientoSanFrancisco} from './city-landmarks.mjs';
import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {segmentDistance,pointInPolygon} from './engine.mjs';
const rect=r=>[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]];
const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const inRect=(p,r)=>p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];
export class OfficialRoute extends CentreRoute{
 constructor(sim){
  // Read the actual existing contact polygon before placing its scene.
  const road=sim.mapColliders.find(c=>c.entity.name==='caminosYVallas').world().points.map(originalOfficialPoint);
  sim.map.variant.originalWalkable=[road,rect([52.75,37.65,58.4,40.85])];
  super(sim);
  this.originalRoad=road;this.originalColliderCount=sim.mapColliders.length;
  // Native events remain untouched in resources/Juego Libre. In this campaign
  // instance contacts are evaluated against the same placed architecture,
  // excluding spectator limbs and the old route's checkpoint/final barrier.
  for(const c of sim.mapColliders){const w=c.world();if(c.entity.tag==='Untagged'&&!['limiteZonaInter'].includes(c.entity.name)){
    const shift=c.entity.name==='edif4final'?.45:c.entity.name==='tejado1final (2)'?-.45:0,poly=(w.points||[]).map(p=>{const q=originalOfficialPoint(p);return [q[0],q[1]+shift];});if(poly.length)this.obstacles.push({kind:'original-architecture',bodyOnly:c.path.includes('/caminosYVallas/'),heightOnly:c.path.includes('/arbolesYBalcones/'),poly,rect:bounds(poly)});
   }c.enabled=false;
  }
  const root=sim.mapGraph.root,position=originalOfficialPoint(root.position);root.position=[...position,root.position[2]||0];const radians=ORIGINAL_OFFICIAL_MAP.rotation*Math.PI/180;root.rotation=[0,0,Math.sin(radians/2),Math.cos(radians/2)];
  for(const node of sim.mapGraph.nodes.values()){const shift=node.name==='edif4final'||node.name==='edif3final (2)'?.45:node.name==='tejado1final (2)'?-.45:0;if(shift)node.position[0]-=shift;}
  for(const node of sim.mapGraph.nodes.values())if(node.path.includes('/caminosYVallas/publico/')&&node.sprite){const p=sim.mapGraph.worldMatrix(node.id).slice(4);if(p[0]>=52.45&&p[0]<=58.55&&Math.abs(p[1]-39.25)<1.10)sim.mapGraph.setWorldPosition(node.id,[p[0],39.25+Math.sign(p[1]-39.25)*1.15,0]);}
  for(const node of sim.mapGraph.nodes.values())if(node.path.includes('/zonaInter')||node.path.includes('/zonaParada'))node.active=false;
  const stage=originalOfficialPoint([10.13,3.85]);
  this.graph.data.sprites['official-palquillo']={image:'assets/official/palquillo.svg',pixelsToUnits:100,rectSize:[120,100],pivot:[.5,.5]};
  this.graph.nodes.set('palquillo-campana',{id:'palquillo-campana',name:'palquillo-campana',path:'palquillo-campana',parent:null,position:[...stage,0],rotation:[0,0,Math.sin(-Math.PI/4),Math.cos(-Math.PI/4)],scale:[.8,.8,1],active:true,sprite:{key:'official-palquillo',order:6,enabled:true,color:[1,1,1,1]}});
  this.obstacles.push({kind:'palquillo',rect:[stage[0]-.4,stage[1]-.48,stage[0]+.4,stage[1]+.48]});
  this.seating=OFFICIAL_SEATING;this.palcos=[];this.seats=[];
  this.graph.data.sprites['official-chair']=sim.resources.animation.sprites['sharedassets2.assets:374'];
  this.graph.nodes.set('official-chair-resource',{id:'official-chair-resource',name:'official-chair-resource',parent:null,path:'official-chair-resource',position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1],active:false,sprite:{key:'official-chair',enabled:true,order:0,color:[1,1,1,1]}});
  const join={a:SIERPES_JOIN.start,b:SIERPES_JOIN.end,t:[-1,0],n:[0,-1],length:5.5,module:{style:'join'}};
  this.seatingSegments=[join,...this.segments.filter(s=>s.module.style!=='historic')];
  for(const segment of this.seatingSegments){const {a,t,n,length,module}=segment;
   for(const sign of [-1,1]){
    // One continuous rail per side. Visual and physical inner edges coincide.
    // The small open joins admit the unchanged paso during direction changes.
    const p=(d,off)=>[a[0]+t[0]*d+n[0]*off*sign,a[1]+t[1]*d+n[1]*off*sign];
    const first=module.style==='join'?0:.25,last=module.style==='join'?length:length-.65,inner=this.seating.laneHalfWidth;
    const poly=[p(first,inner),p(last,inner),p(last,inner+.06),p(first,inner+.06)];
    this.obstacles.push({kind:'seating-boundary',poly,rect:bounds(poly)});
    this.palcos.push({segment,sign,poly,tribune:module.style==='square',first,last});
    const rows=module.style==='join'?2:module.style==='square'?5:4;
    for(let d=first+.15;d<last-.05;d+=this.seating.seatAlongPitch)for(let row=0;row<rows;row++){
     const centre=p(d,this.seating.seatFirstOffset+row*this.seating.seatRowPitch);
     if(this.nearest(...centre).distance>=this.seating.laneHalfWidth+.13)this.seats.push({centre,t,n,sign,row,segment});
    }
   }
  }
  // Replace scattered spectators in the new sectors with occupied seat rows.
  // The reused map's original crowd stays untouched outside the short join.
  for(const person of this.people)if(!person.baked)this.graph.nodes.delete(person.id);
  this.people=[];const examples=[...sim.mapGraph.nodes.values()].filter(n=>n.sprite&&n.path.includes('/publico/')&&!n.path.includes('/pierna')&&!n.path.includes('/mano'));
  const addPerson=(point,seat=null)=>{const ex=examples[this.people.length%examples.length];if(!ex)return;const sp=this.graph.data.sprites[ex.sprite.key],size=sp.rectSize.map(x=>x/sp.pixelsToUnits);if(this.nearest(...point).distance<size[0]/2+this.seating.laneHalfWidth+.03)return;if(this.obstacles.some(o=>o.kind==='original-architecture'&&pointInPolygon(point,o.poly)))return;const id='official-seated-'+this.people.length;this.people.push({id,point,size,key:ex.sprite.key,baked:true,seat});};
  for(const seat of this.seats)addPerson(seat.centre,seat);
  for(const seg of this.segments){const {a,t,n,length,module}=seg;for(let d=.12;d<length-.25;d+=.21)for(const sign of [-1,1])for(let row=0;row<(module.style==='square'?5:4);row++){
   const off=module.style==='historic'?1.14+row*.19:2.15+row*.19,point=[a[0]+t[0]*d+n[0]*off*sign,a[1]+t[1]*d+n[1]*off*sign];
   if(this.nearest(...point).distance>=this.seating.laneHalfWidth+.15&&!this.obstacles.some(o=>o.center?Math.hypot(point[0]-o.center[0],point[1]-o.center[1])<o.radius+.12:inRect(point,o.rect)))addPerson(point);
  }}
  this.obstacles.push({kind:'cathedral',rect:this.scene.modules[1].cathedral.rect},{kind:'cathedral-wing',rect:this.scene.modules[1].cathedral.wing});
  const tower=this.scene.modules[1].cathedral.giralda;this.obstacles.push({kind:'giralda-base',center:tower,radius:.2,rect:[tower[0]-.2,tower[1]-.2,tower[0]+.2,tower[1]+.2]});this.graph.data.sprites['official-giralda']={image:'assets/official/giralda.svg',pixelsToUnits:100,rectSize:[100,250],pivot:[.5,.5]};
  this.graph.nodes.set('giralda-exterior',{id:'giralda-exterior',name:'giralda-exterior',path:'giralda-exterior',parent:null,position:[...tower,0],rotation:[0,0,Math.sin(Math.PI/4),Math.cos(Math.PI/4)],scale:[1,1,1],active:true,sprite:{key:'official-giralda',order:9,enabled:true,color:[1,1,1,1]}});
  this.finished=false;this.checkpointReached=false;this.follow();sim.vm.invoke('cameraController.LateUpdate',sim.cameraController);
 }
 validPoint(p,obstacles=this.obstacles){return (this.walkable.some(poly=>pointInPolygon(p,poly))||this.originalRoad?.some((a,i)=>segmentDistance(p,a,this.originalRoad[(i+1)%this.originalRoad.length]).distance<=ORIGINAL_OFFICIAL_MAP.contactSeamTolerance))&&!obstacles.some(o=>o.poly?pointInPolygon(p,o.poly):o.center?Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius:inRect(p,o.rect));}
 // The parent checks edges at 5 cm intervals and complete shape containment.
 // Polygon obstacles use their actual contour rather than a bounding-box wall.
 validShape(w,obstacles=this.obstacles){
  const s=this.sim,pos=s.position(s.stepEntity.transform),along=this.nearest(pos.x,pos.y).along;
  // ColisionesMapa1.Update constrains the PARIHUELA to caminosYVallas;
  // maniguetas/candelabros collide with architecture, not spectator lane edges.
  // Preserve that native distinction throughout the reused original portion.
  const body=s.stepColliders.find(c=>c.entity.name==='parihuela'),part=s.stepColliders.find(c=>c.world()===w),image=['romano','señor'].includes(part?.entity.name);
  obstacles=obstacles.filter(o=>!o.heightOnly||image&&!s.controller.flex);
  if(along<28.3&&body?.world()!==w){
   obstacles=obstacles.filter(o=>!o.bodyOnly);
   const poly=w.points||[],blocked=p=>obstacles.some(o=>o.poly?pointInPolygon(p,o.poly):o.center?Math.hypot(p[0]-o.center[0],p[1]-o.center[1])<=o.radius:inRect(p,o.rect));
   return poly.every((a,i)=>{const b=poly[(i+1)%poly.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.04));for(let j=0;j<=n;j++)if(blocked([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]))return false;return true;})&&!obstacles.some(o=>!w.edge&&(o.poly||o.center?[...(o.poly||[o.center])]:rect(o.rect)).some(p=>pointInPolygon(p,poly)));
  }
  const poly=w.circle?Array.from({length:24},(_,i)=>[w.center[0]+w.radius*Math.cos(i*Math.PI/12),w.center[1]+w.radius*Math.sin(i*Math.PI/12)]):w.points;
  return poly.every((a,i)=>{const b=poly[(i+1)%poly.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05));for(let j=0;j<=n;j++)if(!this.validPoint([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],obstacles))return false;return true;})&&!obstacles.some(o=>!w.edge&&(o.poly||(o.center?[o.center]:rect(o.rect))).some(p=>pointInPolygon(p,poly)));

 }
 updateStreet(){const s=this.sim;if(!this.streetNotice&&!s.buttons?.[0]?.interactable)return;const p=s.position(s.stepEntity.transform),d=this.nearest(p.x,p.y).along;let sector;
  if(d<5.4)sector={id:'original-odonnell',name:'O’Donnell'};
  else if(d<15.3)sector={id:'original-campana',name:'Campana'};
  else if(d<28.3)sector={id:'original-sierpes',name:'Sierpes'};
  else sector=this.segments.map(segment=>({segment,...segmentDistance([p.x,p.y],segment.a,segment.b)})).sort((a,b)=>a.distance-b.distance)[0].segment.module;
  if(this.streetNotice?.id!==sector.id)this.streetNotice={id:sector.id,name:sector.name,since:s.levelTime};
 }
 spriteFilter(graph){return graph===this.sim.mapGraph?'brightness('+(1-this.scene.ambient.darkness*.55)+')':'none';}
 paintSeating(ctx,images,r,px,py,p,joinOnly=false){
  const chair=images.get('official-chair'),line=(poly,color,width)=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.strokeStyle=color;ctx.lineWidth=width*p;ctx.stroke();};
  for(const palco of this.palcos){if(joinOnly!==(palco.segment.module.style==='join'))continue;const {poly,tribune}=palco;if(!intersects(bounds(poly),r))continue;
   if(tribune){const {a,t,n}=palco.segment,sign=palco.sign,off=this.seating.laneHalfWidth,q=(d,o)=>[a[0]+t[0]*d+n[0]*o*sign,a[1]+t[1]*d+n[1]*o*sign];
    ctx.beginPath();[q(palco.first,off),q(palco.last,off),q(palco.last,off+1.25),q(palco.first,off+1.25)].forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();ctx.fillStyle='#aa9571';ctx.fill();
    for(let d=palco.first;d<palco.last;d+=1.15)line([q(d,off),q(d,off+1.25)],'#7a3432',.025);
   }
   line([poly[0],poly[1]],'#79252a',.06);line([poly[0],poly[1]],'#dfb456',.016);
  }
  for(const seat of this.seats){if(joinOnly!==(seat.segment.module.style==='join')||!inRect(seat.centre,[r[0]-.2,r[1]-.2,r[2]+.2,r[3]+.2]))continue;const {centre,t,n,sign}=seat;
   if(chair){ctx.save();ctx.translate(px(centre[0]),py(centre[1]));ctx.transform(t[0],-t[1],-n[0]*sign,n[1]*sign,0,0);ctx.drawImage(chair,0,0,17,18,-.085*p,-.09*p,.17*p,.18*p);ctx.restore();}
  }
  for(const person of this.people){if(joinOnly!==!!(person.seat?.segment.module.style==='join')||!inRect(person.point,[r[0]-.2,r[1]-.2,r[2]+.2,r[3]+.2]))continue;const im=images.get(person.key);if(im)ctx.drawImage(im,px(person.point[0]-person.size[0]/2),py(person.point[1]+person.size[1]/2),person.size[0]*p,person.size[1]*p);}
 }
 drawFloor(ctx,project,images){
  // Cover only the reused floor's obsolete end seating in this campaign
  // instance. The original texture/map remains unchanged in Juego Libre.
  const r=[52.45,37.65,58.55,40.85],p=100;
  if(!this.joinSurface){const surface=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(610,320):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(610,320);surface.width=610;surface.height=320;const c=surface.getContext('2d'),px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
   c.fillStyle='#9e9584';c.fillRect(0,0,610,320);c.fillStyle='#807c72';c.fillRect(0,py(40.21),610,1.92*p);c.strokeStyle='#9a9588';c.lineWidth=1;for(let y=38.29;y<40.22;y+=.22){c.beginPath();c.moveTo(0,py(y));c.lineTo(610,py(y));c.stroke();}
   this.paintSeating(c,images,r,px,py,p,true);c.globalAlpha=this.scene.ambient.darkness;c.fillStyle=this.scene.ambient.tint;c.fillRect(0,0,610,320);this.joinSurface=surface;
  }
  ctx.save();ctx.setTransform(...project);ctx.imageSmoothingEnabled=false;ctx.translate(r[0],r[3]);ctx.scale(1/p,-1/p);ctx.drawImage(this.joinSurface,0,0);ctx.restore();
 }
 paintTile(ctx,images,r){
  const v=this.scene,p=v.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
  const path=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  const fill=(poly,c)=>{path(poly);ctx.fillStyle=c;ctx.fill();},box=(r,c)=>fill(rect(r),c);
  const line=(a,c,width)=>{ctx.strokeStyle=c;ctx.lineWidth=width*p;ctx.beginPath();a.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.stroke();};
  const image=key=>images.get(key)||images.get(this.graph.data.sprites[key]?.image),floor=image('sharedassets2.assets:373');ctx.imageSmoothingEnabled=false;
  // Native mapa7 is drawn intact above this background; it is not rerasterized
  // or copied into a second Campana/Sierpes. Surrounding blocks hide map edges.
  box(r,'#70675b');for(let y=Math.floor(r[1]/3)*3;y<r[3];y+=3)for(let x=Math.floor(r[0]/3)*3;x<r[2];x+=3){const im=image(NATIVE_HOUSE_KEYS[Math.abs(Math.floor(x*7+y*3))%NATIVE_HOUSE_KEYS.length]);if(im)ctx.drawImage(im,px(x),py(y+3),3*p,3*p);}
  for(const poly of this.walkable){if(!intersects(bounds(poly),r))continue;ctx.save();path(poly);ctx.clip();box(r,'#73716b');if(floor)for(let y=Math.floor(r[1]/1.1)*1.1;y<r[3];y+=1.1)for(let x=Math.floor(r[0]/1.1)*1.1;x<r[2];x+=1.1)ctx.drawImage(floor,322,40,110,110,px(x),py(y+1.1),1.1*p,1.1*p);ctx.restore();}
  const plaza=v.modules[0],hall=plaza.townHall;
  if(intersects(plaza.visual.footprint,r)){box(plaza.visual.footprint,plaza.visual.paving);for(let y=36.6;y<40.5;y+=.65)line([[44,y],[53.2,y]],'rgba(222,211,182,.32)',.025);}
  for(const h of this.houses){if(!intersects(h.bounds,r))continue;const im=image(NATIVE_HOUSE_KEYS[h.material]);ctx.save();path(h.poly);ctx.clip();if(im)ctx.drawImage(im,px(h.bounds[0]),py(h.bounds[3]),(h.bounds[2]-h.bounds[0])*p,(h.bounds[3]-h.bounds[1])*p);ctx.restore();line(h.front,'#d5c0a0',.06);const [a,b]=h.front;for(let i=.13;i<.98;i+=.25){const q=[a[0]+(b[0]-a[0])*i,a[1]+(b[1]-a[1])*i];box([q[0]-.11,q[1]-.11,q[0]+.11,q[1]+.11],'#263739');line([[q[0]-.15,q[1]-.1],[q[0]+.15,q[1]-.1]],'#b5955c',.025);}}
  if(intersects(hall.rect,r)){
   paintAyuntamiento({ctx,box,line,fill,hall});
   paintAyuntamientoSanFrancisco({ctx,box,line,fill,hall});
  }
  const cathedral=v.modules[1].cathedral,[cx,cy,cxx,cyy]=cathedral.rect;
  if(intersects(cathedral.rect,r)){
   box(cathedral.rect,'#aa987e');box([cx+.35,cy+.35,cxx-.35,cyy-.35],'#756c60');
   for(let x=cx+.5;x<cxx;x+=.8){box([x,cyy-.5,x+.22,cyy+.10],'#c4b092');fill([[x,cyy+.1],[x+.11,cyy+.36],[x+.22,cyy+.1]],'#d3c09c');}
   for(let y=cy+.35;y<cyy-.5;y+=.55)line([[cx+.6,y],[cxx-.6,y]],'#b4a183',.08);
   const gx=cathedral.gate[0],gy=cathedral.gate[1];box([gx-.62,gy-.13,gx+.62,gy+.27],'#d1bd9b');
   // Repeated pointed archivolts and pinnacles, not a photograph texture.
   for(let i=0;i<5;i++){const w=.56-i*.065,h=.70-i*.06;line([[gx-w,gy-.08],[gx-w,gy+.12],[gx,gy+h],[gx+w,gy+.12],[gx+w,gy-.08]],i%2?'#dec9a5':'#9b8263',.038);}box([gx-.24,gy-.10,gx+.24,gy+.23],'#29443e');line([[gx,gy-.10],[gx,gy+.23]],'#141e21',.023);
   for(const sign of [-1,1]){const x=gx+sign*.7;box([x-.055,gy-.03,x+.055,gy+.56],'#c2aa84');fill([[x-.12,gy+.56],[x,gy+.90],[x+.12,gy+.56]],'#d8c19b');}
  }
  box(cathedral.wing,'#bfa884');line([[cathedral.wing[0],cathedral.wing[3]],[cathedral.wing[2],cathedral.wing[3]]],'#d4c19f',.09);
  const [gx,gy]=cathedral.giralda;if(inRect([gx,gy],[r[0]-1,r[1]-1,r[2]+1,r[3]+1])){box([gx-.43,gy-.43,gx+.43,gy+.43],'#ccb187');box([gx-.32,gy-.32,gx+.32,gy+.32],'#e1c99c');for(const sign of [-1,1])box([gx+sign*.26-.05,gy-.17,gx+sign*.26+.05,gy+.17],'#344238');box([gx-.2,gy-.2,gx+.2,gy+.2],'#9d815a');ctx.fillStyle='#e1bf6a';ctx.beginPath();ctx.arc(px(gx),py(gy),.1*p,0,Math.PI*2);ctx.fill();line([[gx,gy],[gx+.16,gy+.21]],'#b99445',.026);}
  for(const [x,y,radius]of v.modules.flatMap(m=>m.trees)){ctx.fillStyle='#33503d';ctx.beginPath();ctx.arc(px(x),py(y),radius*p,0,Math.PI*2);ctx.fill();}
  this.paintSeating(ctx,images,r,px,py,p);
  ctx.globalAlpha=v.ambient.darkness;box(r,v.ambient.tint);ctx.globalAlpha=1;
  for(const [x,y]of this.lamps)if(inRect([x,y],[r[0]-1,r[1]-1,r[2]+1,r[3]+1])){if(v.ambient.lamps){const g=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),p);g.addColorStop(0,'rgba(255,218,148,.48)');g.addColorStop(1,'rgba(255,207,116,0)');ctx.fillStyle=g;ctx.fillRect(px(x)-p,py(y)-p,2*p,2*p);}box([x-.035,y-.035,x+.035,y+.035],'#ffe4ac');}
 }
}
