import {ARENAL_MAP,arenalScene} from './arenal-data.mjs';
import {CATHEDRAL_MAP,cathedralScene} from './cathedral-data.mjs';
import {OFFICIAL_MAP,officialScene} from './official-data.mjs';
import {drawRouteMarkers} from './route-markers.mjs';
import {CENTRE_MAP,centreScene} from './centre-data.mjs';
import {BRIDGE_MAP,bridgeScene} from './bridge-data.mjs';
import {PUREZA_SCENE} from './pureza-data.mjs';
import {paintNativeArchitecture,NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {SceneGraph} from './original-scene.mjs';
import {segmentDistance,pointInPolygon} from './engine.mjs';
export const NEW_ROUTE=Object.freeze({key:'AlemanesPlacentinesFrancos',name:'Alemanes · Placentines · Francos',image:'assets/original-animation/sprite-569.webp',pixels:1254,ppu:50,start:[697,1185],points:[[697,1235],[697,1185],[691,1000],[689,820],[687,680],[685,590],[655,533],[610,465],[565,392],[520,325],[466,250],[446,195],[438,135],[420,85],[411,50]]});
export function customMap(map,key,route){if(key===ARENAL_MAP.key)return {...map,name:ARENAL_MAP.name,variant:arenalScene(route)};if(key===CATHEDRAL_MAP.key)return {...map,name:CATHEDRAL_MAP.name,variant:cathedralScene(route)};if(key===OFFICIAL_MAP.key)return {...map,name:OFFICIAL_MAP.name,variant:officialScene(route)};if(key===CENTRE_MAP.key)return {...map,name:CENTRE_MAP.name,variant:centreScene(route)};if(key===BRIDGE_MAP.key)return {...map,name:BRIDGE_MAP.name,variant:bridgeScene(route)};if(key===PUREZA_SCENE.key)return {...map,name:PUREZA_SCENE.name,variant:PUREZA_SCENE};return key===NEW_ROUTE.key?{...map,name:NEW_ROUTE.name,variant:NEW_ROUTE}:map;}
export function installCustomRouteMenu(layouts){
 const root=Object.values(layouts.roots).find(r=>r.name==='MenuEligeMapa'),source=root.nodes.find(k=>layouts.nodes[k].name==='ButtonMapa1'),cloned=[];
 function copy(key,parent){const old=layouts.nodes[key],n=structuredClone(old),next='custom-route-'+key;n.key=next;n.parentKey=parent;n.path=old.path.replace('ButtonMapa1','ButtonMapaAlemanes');layouts.nodes[next]=n;cloned.push(next);n.childKeys=(old.childKeys||[]).map(k=>copy(k,next));return next;}
 const key=copy(source,layouts.nodes[source].parentKey),button=layouts.nodes[key];button.name='ButtonMapaAlemanes';button.anchoredPosition.y=-400;button.localPosition.y=-400;button.button.onClick=[];button.button.interactable=true;
 for(const k of cloned){const n=layouts.nodes[k];if(n.text&&n.name==='Text'){n.text.text=NEW_ROUTE.name;n.text.fontSize=26;}if(n.text&&n.name==='numeroEst')n.text.text='0/3';}
 layouts.nodes[button.parentKey].childKeys.push(key);root.nodes.push(...cloned);return {button:key,stamps:cloned.find(k=>layouts.nodes[k].name==='numeroEst')};
}
export class CustomRoute {
 constructor(sim){
  this.sim=sim;const v=NEW_ROUTE;this.points=v.points.map(([x,y])=>[(x-v.start[0])/v.ppu,(v.start[1]-y)/v.ppu]);const raw=this.points,rounded=[raw[0]];for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(.7,ab/3,bc/3),u=b.map((x,k)=>x+(a[k]-x)*r/ab),v=b.map((x,k)=>x+(c[k]-x)*r/bc);rounded.push(u);for(let j=1;j<=10;j++){const t=j/10;rounded.push(b.map((_,k)=>(1-t)**2*u[k]+2*t*(1-t)*b[k]+t*t*v[k]));}}rounded.push(raw.at(-1));this.points=rounded;this.distances=[0];
  for(let i=1;i<this.points.length;i++)this.distances.push(this.distances.at(-1)+Math.hypot(this.points[i][0]-this.points[i-1][0],this.points[i][1]-this.points[i-1][1]));
  sim.setPosition(sim.stepEntity.transform,[0,0,0]);sim.setAngle(sim.stepEntity.transform,0);
  this.initialHalfWidth=.48;for(const collider of sim.stepColliders){if(collider.entity===sim.contraEntity)continue;const w=collider.world();for(const p of w.circle?[w.center]:w.points||[])this.initialHalfWidth=Math.max(this.initialHalfWidth,Math.abs(p[0])+(w.circle?w.radius:0)+.11);}
  this.length=this.distances.at(-1);this.junctionDistance=10;this.narrowEnd=8.8;this.checkpointDistance=this.junctionDistance;this.finishDistance=this.length-1;this.arriado=false;this.passed=false;
  const node=(id,pos,sprite)=>({id,name:id,path:id,parent:null,position:[...pos,0],scale:[1,1,1],rotation:[0,0,0,1],active:true,sprite:{key:sprite,order:-50,enabled:true,color:[1,1,1,1]}});
  // Reference-based footprints receive APK materials. The visible road and
  // collisions still share the same geometry.
  const floorKey='sharedassets2.assets:373',center=[(v.pixels/2-v.start[0])/v.ppu,(v.start[1]-v.pixels/2)/v.ppu],background={image:v.image,pixelsToUnits:v.ppu,rectSize:[v.pixels,v.pixels],pivot:[.5,.5]};
  const a={...sim.resources.animation,sprites:{...sim.resources.animation.sprites,routeArchitecture:background,routeExtension:{...background,rectSize:[v.pixels,200],crop:[0,1054,v.pixels,200]}},graphs:{...sim.resources.animation.graphs,newRoute:{nodes:[{...node('floor-resource',[0,0],floorKey),sprite:{key:floorKey,order:-50,enabled:false,color:[1,1,1,1]}},node('reference-architecture',center,'routeArchitecture'),node('extension',[center[0],(v.start[1]-v.pixels-100)/v.ppu],'routeExtension')],animators:[]}}};
  this.graph=new SceneGraph(a,'newRoute');sim.graphs.push(this.graph);sim.renderGraphs=[this.graph,...sim.graphs.filter(g=>g!==sim.mapGraph&&g!==this.graph)];
  this.floorKey=floorKey;this.surroundings=[];this.trees=[];
  for(const key of NATIVE_HOUSE_KEYS){const n=node('native-material-'+key,[0,0],key);n.sprite.enabled=false;this.graph.nodes.set(n.id,n);}
  // Single file of original spectator sprites at each road edge.
  const examples=[...sim.mapGraph.nodes.values()].filter(n=>n.sprite&&n.path.includes('/publico/')&&!n.path.includes('/pierna')&&!n.path.includes('/mano'));
  this.people=[];
  for(let d=this.junctionDistance+.25;d<this.length;d+=.32)for(const side of [-1,1]){
   const p=this.at(d),example=examples[Math.floor(d/.32)%examples.length];if(!example)continue;
   const id='spectator-'+side+'-'+d,n=structuredClone(example);n.id=id;n.name=id;n.path=id;n.parent=null;const sprite=sim.resources.animation.sprites[n.sprite.key],radius=Math.hypot(...sprite.rectSize.map(x=>x/sprite.pixelsToUnits))/2,offset=this.width(d)-radius-.015;n.position=[p.x+side*Math.cos(p.angle)*offset,p.y+side*Math.sin(p.angle)*offset,0];if(this.nearest(...n.position).distance+radius>this.width(d)-.005)continue;this.people.push({along:d,point:n.position.slice(0,2),radius,id});n.rotation=[0,0,0,1];n.scale=[1,1,1];n.active=true;n.sprite.order=1;this.graph.nodes.set(id,n);
  }
  const world=([x,y])=>[(x-v.start[0])/v.ppu,(v.start[1]-y)/v.ppu];
  // The open eastern bocacalle in the approved aerial layout. Its crowd runs
  // past the camera edge, stays off the houses, and leaves the route clear.
  this.crowdAreas=[[[731,770],[950,650],[966,612],[954,596],[801,651],[731,680]].map(world),[[548,845],[645,716],[661,723],[658,765],[574,873]].map(world)];
  for(const [areaIndex,polygon]of this.crowdAreas.entries()){
   const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);let index=0;
   for(let y=Math.min(...ys);y<Math.max(...ys);y+=.27)for(let x=Math.min(...xs);x<Math.max(...xs);x+=.25){
    const point=[x+((Math.round(y/.27)%2)*.035),y],near=this.nearest(...point),example=examples[index++%examples.length];if(!example||near.distance<this.width(near.along)+.16)continue;
    const n=structuredClone(example),sprite=sim.resources.animation.sprites[n.sprite.key],radius=Math.hypot(...sprite.rectSize.map(a=>a/sprite.pixelsToUnits))/2;
    if(![[-1,-1],[-1,1],[1,-1],[1,1]].every(([a,b])=>pointInPolygon([point[0]+a*radius,point[1]+b*radius],polygon)))continue;
    const id='junction-crowd-'+areaIndex+'-'+index;n.id=id;n.name=id;n.path=id;n.parent=null;n.position=[...point,0];n.rotation=[0,0,0,1];n.scale=[1,1,1];n.active=true;n.sprite.order=1;this.graph.nodes.set(id,n);this.people.push({along:near.along,point,radius,id,area:areaIndex});
   }
  }
  sim.setPosition(sim.stepEntity.transform,[0,0,0]);sim.setAngle(sim.stepEntity.transform,0);sim.controller.limiteActual=360;sim.controller.limiteActual2=480;
  this.follow();sim.vm.invoke('cameraController.LateUpdate',sim.cameraController);
 }
 nearest(x,y){let best={distance:Infinity};for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],r=segmentDistance([x,y],a,b);if(r.distance<best.distance)best={...r,along:this.distances[i-1]+Math.hypot(r.point[0]-a[0],r.point[1]-a[1])};}return best;}
 at(distance){let i=1;while(i<this.distances.length-1&&this.distances[i]<distance)i++;const a=this.points[i-1],b=this.points[i],length=this.distances[i]-this.distances[i-1],t=(distance-this.distances[i-1])/length;return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(-(b[0]-a[0]),b[1]-a[1])};}
 follow(){const s=this.sim,p=s.position(s.stepEntity.transform),d=this.nearest(p.x,p.y).along;
  const pose=(e,offset,rotation=0)=>{const q=this.at(d+offset);s.setPosition(e.transform,[q.x,q.y,0]);s.setAngle(e.transform,q.angle*180/Math.PI+rotation);};
  pose(s.capatazEntity,1.1,-90);pose(s.contraEntity,-1.3,90);s.cortejos.forEach((e,i)=>pose(e,[3,-2.6,-4.3][i]));
 }
 width(along){const t=Math.max(0,Math.min(1,(along-this.narrowEnd)/1.2)),base=this.initialHalfWidth+(.79-this.initialHalfWidth)*t*t*(3-2*t);return base+.22*Math.exp(-(((along-12.8)/1.2)**2))+.18*Math.exp(-(((along-23.1)/1.5)**2));}
 fail(reasonId){const s=this.sim;if(s.state.status!=='playing')return;s.prefs.motivoGameOver=reasonId;s.send(s.stepEntity,'gameOverMet');}
 inside(distance){const s=this.sim,p=this.at(distance),pos=s.position(s.stepEntity.transform),local=q=>[ (q[0]-p.x)*Math.cos(p.angle)+(q[1]-p.y)*Math.sin(p.angle),-(q[0]-p.x)*Math.sin(p.angle)+(q[1]-p.y)*Math.cos(p.angle) ];if(Math.hypot(pos.x-p.x,pos.y-p.y)>.35)return false;return s.stepColliders.filter(c=>c.entity.name.startsWith('manigueta')).every(c=>c.world().points.every(q=>{const v=local(q);return Math.abs(v[0])<=.53&&Math.abs(v[1])<=1.1;}));}
 tick(){const s=this.sim;this.follow();const pos=s.position(s.stepEntity.transform),along=this.nearest(pos.x,pos.y).along,people=this.people.filter(p=>Math.abs(p.along-along)<1.4);
  for(const collider of s.stepColliders){if(collider.entity===s.contraEntity||!collider.enabled)continue;const w=collider.world(),points=w.circle?[w.center]:w.points||[];for(const p of points){const q=this.nearest(...p);if(q.distance+(w.circle?w.radius:0)>this.width(q.along)+.01){this.fail(collider.entity.name.startsWith('manigueta')?3:collider.entity.name.startsWith('candelabro')?4:2);return;}}if(people.some(({point})=>w.circle?Math.hypot(point[0]-w.center[0],point[1]-w.center[1])<w.radius+.055:(!w.edge&&pointInPolygon(point,points))||points.some((a,i)=>segmentDistance(point,a,points[(i+1)%points.length]).distance<.055))){this.fail(13);return;}}
  const lowered=s.controller.animator.state==='pasoBajado';
  if(s.state.lifted&&!s.controller.martillo&&this.inside(this.checkpointDistance)&&!this.arriado){this.arriado=true;this.passed=true;s.mapController.zonaInterPasada=true;s.prefs.checkpointGuardado=1;}
  if(this.arriado&&!s.prefs.checkpointGuardado&&s.controller.animator.state==='mecidaPasoNormal')s.prefs.checkpointGuardado=1;
  if(lowered&&this.inside(this.finishDistance)){if(!this.passed){this.fail(12);return;}s.send(s.stepEntity,'finJuegoExito');s.send(s.cameraEntity,'exitoMet');}
 }
 snapshot(){return {arriado:this.arriado,passed:this.passed};}
 restore(v){Object.assign(this,v||{});this.sim.mapController.zonaInterPasada=this.passed;this.follow();}
 roadPolygon(extra=0){const sides=[[],[]];for(let d=-9;d<this.length+9;d+=.08){const p=this.at(d),width=this.width(d)+extra;for(let i=0;i<2;i++){const sign=i?1:-1;sides[i].push([p.x+sign*Math.cos(p.angle)*width,p.y+sign*Math.sin(p.angle)*width]);}}return [...sides[0],...sides[1].reverse()];}
 drawArchitecture(ctx,m,im,sprite,node,images){
  const v=NEW_ROUTE;
  if(!this.architectureImage){
   let buffer;try{buffer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(v.pixels,v.pixels):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(v.pixels,v.pixels);}catch{}
   if(buffer?.getContext){buffer.width=v.pixels;buffer.height=v.pixels;const bc=buffer.getContext('2d');bc.imageSmoothingEnabled=false;let native;try{native=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(v.pixels,v.pixels):typeof document!=='undefined'?document.createElement('canvas'):new ctx.canvas.constructor(v.pixels,v.pixels);native.width=v.pixels;native.height=v.pixels;if(paintNativeArchitecture(native.getContext('2d'),images,this.graph.data.sprites))im=native;}catch{}
    // Rasterize once at integer texel boundaries, then project the entire
    // surface together. This avoids per-strip seams and repeated frame work.
    for(let sy=0;sy<v.pixels;sy+=2){const h=Math.min(2,v.pixels-sy),worldY=(v.start[1]-sy)/v.ppu,q=this.nearest((691-v.start[0])/v.ppu,worldY),center=Math.round(v.start[0]+q.point[0]*v.ppu),t=Math.max(0,Math.min(1,(sy-735)/60)),fade=t*t*(3-2*t),half=this.initialHalfWidth*v.ppu+3.5,left=Math.round((center-half-646)*fade),right=Math.round((center+half-742)*fade);
     bc.drawImage(im,0,sy,center,h,left,sy,center,h);bc.drawImage(im,center,sy,v.pixels-center,h,center+right,sy,v.pixels-center,h);
    }this.architectureImage=buffer;
   }
  }
  ctx.save();ctx.setTransform(...m);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;const source=this.architectureImage||im;
  if(node.name==='extension')ctx.drawImage(source,0,1054,v.pixels,200,0,0,v.pixels,200);else ctx.drawImage(source,0,0,v.pixels,v.pixels);ctx.restore();
 }
 drawFloor(ctx,project,images,canvas){
  const polygon=this.floorPolygon||(this.floorPolygon=this.roadPolygon()),outer=this.outerPolygon||(this.outerPolygon=this.roadPolygon(.07));
  const path=points=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};
  ctx.save();ctx.setTransform(...project);ctx.globalAlpha=1;ctx.fillStyle='#dcc8a1';path(outer);ctx.fill();ctx.fillStyle='#3a3a3c';path(polygon);ctx.fill();ctx.beginPath();for(const area of [polygon,...this.crowdAreas]){area.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}ctx.fill();ctx.clip();
  const im=images.get(this.floorKey)||images.get(this.graph.data.sprites[this.floorKey].image);
  if(im){
   // One native 1.1-unit pavement tile, without the crowd baked into the source map.
   const det=project[0]*project[3]-project[1]*project[2],world=([x,y])=>[(project[3]*(x-project[4])-project[2]*(y-project[5]))/det,(-project[1]*(x-project[4])+project[0]*(y-project[5]))/det],corners=[[0,0],[canvas.width,0],[0,canvas.height],[canvas.width,canvas.height]].map(world),xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
   ctx.imageSmoothingEnabled=false;
   for(let x=Math.floor(Math.min(...xs)/1.1)*1.1;x<Math.max(...xs)+1.1;x+=1.1)for(let y=Math.floor(Math.min(...ys)/1.1)*1.1;y<Math.max(...ys)+1.1;y+=1.1)ctx.drawImage(im,322,40,110,110,x,y,1.1,1.1);
  }
  ctx.restore();
 }
 drawMarkers(ctx,project){const polygon=distance=>{const p=this.at(distance);return [[-.53,-1.1],[.53,-1.1],[.53,1.1],[-.53,1.1]].map(([x,y])=>[p.x+x*Math.cos(p.angle)-y*Math.sin(p.angle),p.y+x*Math.sin(p.angle)+y*Math.cos(p.angle)]);};drawRouteMarkers(ctx,project,!this.passed?polygon(this.checkpointDistance):null,polygon(this.finishDistance));}
}
