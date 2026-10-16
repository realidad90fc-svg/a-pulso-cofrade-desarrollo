import {blankMapDocument} from './city-project.mjs';
// Shared map catalogue for the standalone manual editor.
// Edits are working copies exported as JSON; native gameplay assets are not mutated.
import {PUREZA_SCENE} from './pureza-data.mjs';
import {BRIDGE_MAP,BRIDGE_ROUTE} from './bridge-data.mjs';
import {CENTRE_MAP,CENTRE_ROUTE} from './centre-data.mjs';
import {OFFICIAL_MAP,OFFICIAL_ROUTE,originalOfficialPoint} from './official-data.mjs';
import {CATHEDRAL_MAP,CATHEDRAL_ROUTE,cathedralPoint,postigoPoint} from './cathedral-data.mjs';
import {ARENAL_MAP,ARENAL_ROUTE,ADRIANO_URBAN_DETAIL,adrianoPoint,MODULO_ADRIANO} from './arenal-data.mjs';
import {NEW_ROUTE} from './custom-routes.mjs';

export const NATIVE_STREET_NAMES=[
 ['Alfonso XII','Santa Vicenta María'],['G. Tassara','Amor de Dios','San Miguel'],
 ['Virgen de la Victoria','Asunción'],['Catedral','Alemanes'],['Almirantazgo','Postigo','Arfe'],
 ['Pureza','Capilla de los Marineros'],['O’Donnell','Campana','Sierpes'],
 ['Cardenal Cisneros','San Vicente'],['Odreros','Boteros','Sales y Ferré'],['Dormitorio','Alhóndiga']
];
export const EDITOR_MAPS=[
 {key:PUREZA_SCENE.key,name:'Salida por Pureza',type:'modular',scene:PUREZA_SCENE},
 {key:BRIDGE_MAP.key,name:'Altozano y Puente',type:'modular',scene:BRIDGE_MAP,route:BRIDGE_ROUTE},
 {key:CENTRE_MAP.key,name:'Camino al Centro',type:'modular',scene:CENTRE_MAP,route:CENTRE_ROUTE},
 {key:OFFICIAL_MAP.key,name:'Carrera Oficial',type:'mixed',scene:OFFICIAL_MAP,route:OFFICIAL_ROUTE},
 {key:CATHEDRAL_MAP.key,name:'Catedral y Postigo',type:'mixed',scene:CATHEDRAL_MAP,route:CATHEDRAL_ROUTE},
 {key:ARENAL_MAP.key,name:'Regreso por el Arenal',type:'arenal',scene:ARENAL_MAP,route:ARENAL_ROUTE},
 {key:NEW_ROUTE.key,name:NEW_ROUTE.name,type:'custom'},
 ...Array.from({length:10},(_,i)=>({key:'native-'+(i+1),name:'Original · '+NATIVE_STREET_NAMES[i].join(' · '),type:'native',nativeId:i+1}))
];
export const DEFAULT_MAP=ARENAL_MAP.key;
export const SCHEMA='apulso-universal-editor-v2';
const HOUSE_KEYS=[569,416,463,480,495,562,566,581,554].map(i=>'sharedassets2.assets:'+i);
const p2=p=>[Number(p[0]),Number(p[1])];
const rect=r=>{const [a,b,c,d]=r;return [[Math.min(a,c),Math.min(b,d)],[Math.max(a,c),Math.min(b,d)],[Math.max(a,c),Math.max(b,d)],[Math.min(a,c),Math.max(b,d)]]};
const middle=poly=>poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]);
const short=p=>p.map(n=>+n.toFixed(4));
const valid=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
function strip(a,b,half){
 const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);
 if(d<.00001)return null;
 const nx=-dy/d,ny=dx/d;
 return [[a[0]+nx*half,a[1]+ny*half],[b[0]+nx*half,b[1]+ny*half],
 [b[0]-nx*half,b[1]-ny*half],[a[0]-nx*half,a[1]-ny*half]].map(short);
}
function buildGeometry(scene,meta){
 const roads=[],sidewalks=[],houses=[],people=[],trees=[],signs=[],labels=[],seenRoad=new Set();
 function road(poly,source){
  if(!Array.isArray(poly)||poly.length<3||poly.some(p=>!valid(p)))return;
  roads.push({poly:poly.map(p2),source});
 }
 function building(poly,source,key){
  if(!Array.isArray(poly)||poly.length<3||poly.some(p=>!valid(p)))return;
  houses.push({poly:poly.map(p2),key:key||HOUSE_KEYS[houses.length%HOUSE_KEYS.length],kind:'native-reference',source});
 }
 function line(points,half,source){
  if(!Array.isArray(points))return;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];if(!valid(a)||!valid(b))continue;
   const id=[a,b].map(p=>p.map(n=>n.toFixed(2)).join(',')).sort().join('/');
   if(seenRoad.has(id))continue;seenRoad.add(id);
   const poly=strip(a,b,half);
   if(!poly)continue;
   road(poly,source);
   const side=(dx,sign)=>{
    const vx=b[0]-a[0],vy=b[1]-a[1],len=Math.hypot(vx,vy);
    const n=[-vy/len,vx/len],inner=half+.02,outer=half+.25;
    return [a,b].map(p=>[p[0]+n[0]*(sign>0?inner:outer),p[1]+n[1]*(sign>0?inner:outer)]).concat([b,a].map(p=>[p[0]+n[0]*(sign>0?outer:inner),p[1]+n[1]*(sign>0?outer:inner)])).map(short);
   };
   sidewalks.push({poly:side(0,1),source:'guide-sidewalk'});
   sidewalks.push({poly:side(0,-1),source:'guide-sidewalk'});
   // Reference spectators for routes whose public is created procedurally in-game.
   if(people.length<320){
    const vx=b[0]-a[0],vy=b[1]-a[1],len=Math.hypot(vx,vy),nx=-vy/len,ny=vx/len;
    for(let d=.55;d<len&&people.length<320;d+=.77){
     const t=d/len,sgn=Math.floor(d*3)%2?1:-1;
     people.push({point:short([a[0]+vx*t+nx*(half+.49)*sgn,a[1]+vy*t+ny*(half+.49)*sgn]),key:'sharedassets2.assets:379',size:[.19,.19],source:'preview-crowd'});
    }
   }
  }
 }
 for(const m of scene.modules||[]){
  const id=m.id||m.name||'module';
  if(m.points)line(m.points,m.halfWidth||1.25,id);
  if(m.polygon)road(m.polygon,id);
  if(m.deck)road(rect(m.deck),id);
  if(m.room)road(rect(m.room),id);
  if(m.door)road(rect(m.door),id);
  if(m.rect&&m.kind==='street')road(rect(m.rect),id);
  if(m.accesses)for(const access of m.accesses)if(access.rect)road(rect(access.rect),id+':access');
  if(m.houses)for(const h of m.houses)if(h.rect)building(rect(h.rect),id+':house');
  if(m.trees)for(const t of m.trees)if(valid(t))trees.push({point:p2(t),radius:t[2]||.35,source:id});
  if(m.name&&m.points?.length)labels.push([m.name,p2(m.points[Math.floor((m.points.length-1)/2)])]);
 }
 if(scene.houses)for(const h of scene.houses)if(h.rect)building(rect(h.rect),h.id||'house',HOUSE_KEYS[(h.material||0)%HOUSE_KEYS.length]);
 for(const obj of scene.landmarks||[])if(obj.polygon)building(obj.polygon,obj.id||'landmark');
 if(scene.trees)for(const t of scene.trees)if(valid(t))trees.push({point:p2(t),radius:t[2]||.35});
 if(scene.cityHead)road(rect(scene.cityHead),'city-head');
 for(const c of scene.crowdAreas||[])if(c.length>=3)sidewalks.push({poly:c.map(p2),source:'plaza'});
 // Synthetic crowd and pavement above are guides, not copies of Unity collision meshes.
 const cp=meta.route?.checkpoints?.points||scene.checkpoints||[];
 const checkpoints=(Array.isArray(cp)?cp:[]).filter(x=>valid(x.position)).map((x,i)=>({id:x.id||'control-'+(i+1),name:x.name||x.id||'Control '+(i+1),position:p2(x.position),angle:x.angle||0}));
 if(!checkpoints.length&&valid(scene.checkpoint?.position))checkpoints.push({id:scene.checkpoint.id||'control',name:scene.checkpoint.name||'Control',position:p2(scene.checkpoint.position)});
 const start=meta.route?.start||scene.start;
 const pos=valid(start?.position)?p2(start.position):valid(scene.path?.[0])?p2(scene.path[0]):middle(roads[0]?.poly||[[0,0]]);
 if(!checkpoints.length)checkpoints.push({id:'control-inicial',name:'Control inicial',position:[...pos]});
 return{roads,sidewalks,houses,people,trees,signs,labels,checkpoints,
  checkpoint:[...checkpoints[0].position],paso:{x:pos[0],y:pos[1],angle:start?.angle||90},
  bounds:scene.bounds||null};
}
function nativeGeometry(key,nativeMaps){
 const id=Number(key.split('-')[1]),map=nativeMaps?.find(m=>m.id===id);
 if(!map)throw Error('No hay geometría original para el mapa '+id);
 const roads=[],houses=[],people=[],sidewalks=[],labels=[],trees=[],signs=[];
 for(const collider of map.colliders||[]){
  const poly=collider.points;if(!Array.isArray(poly)||poly.length<3||!poly.every(valid))continue;
  const name=(collider.name||'').toLowerCase(),path=(collider.path||'').toLowerCase();
  if(/publico|público|spectator|persona/.test(name+' '+path)){
   if(people.length<2000)people.push({point:short(middle(poly)),key:'sharedassets2.assets:379',size:[.19,.19],source:collider.path});continue;
  }
  if(/caminosyvallas/.test(name)&&collider.kind==='EdgeCollider2D')roads.push({poly:poly.map(p2),source:collider.path,kind:'native-walkable-guide'});
  else if(/iglesia|muro|pared|casa|edificio/.test(name))houses.push({poly:poly.map(p2),key:HOUSE_KEYS[houses.length%HOUSE_KEYS.length],kind:'native-outline',source:collider.path});
 }
 const b=map.bounds||[-10,-10,10,10],pos=roads[0]?middle(roads[0].poly):[(b[0]+b[2])/2,(b[1]+b[3])/2];
 const start=valid(pos)?short(pos):[0,0],checkpoints=[{id:'native-preview',name:'Referencia (sin modificar checkpoint original)',position:[...start]}];
 for(const [i,name]of NATIVE_STREET_NAMES[id-1].entries())labels.push([name,[start[0],start[1]+i*.5]]);
 return{roads,sidewalks,houses,people,trees,signs,labels,checkpoints,checkpoint:[...start],paso:{x:start[0],y:start[1],angle:90},bounds:b};
}
function specialized(scene,map,geometry,nativeMaps){
 // Combine the exact original collider guide with extensions; never rebuild a duplicate native sector.
 const geometryOf=id=>nativeGeometry('native-'+id,nativeMaps);
 if(map.key===OFFICIAL_MAP.key){
  for(const r of geometryOf(7).roads)geometry.roads.unshift({poly:r.poly.map(originalOfficialPoint),kind:'native-walkable-guide',source:'mapa7:original'});
  geometry.labels.push(['O’Donnell · Campana · Sierpes',originalOfficialPoint([0,0])]);
 }
 if(map.key===CATHEDRAL_MAP.key){
  for(const r of geometryOf(4).roads)geometry.roads.unshift({poly:r.poly.map(cathedralPoint),kind:'native-walkable-guide',source:'mapa4:original'});
  for(const r of geometryOf(5).roads)geometry.roads.unshift({poly:r.poly.map(postigoPoint),kind:'native-walkable-guide',source:'mapa5:original'});
 }
 return geometry;
}
export function buildEditorMap(key,animation,nativeMaps,prepareArenal){
 const map=EDITOR_MAPS.find(x=>x.key===key);if(!map)throw Error('Mapa desconocido: '+key);
 if(map.type==='user')return blankMapDocument(map);
 let geometry;
 if(map.type==='arenal'){
  const a=prepareArenal(animation);
  geometry={...a,
   trees:[...ARENAL_MAP.modules.flatMap(m=>(m.trees||[]).map(t=>({point:p2(t),radius:t[2]||.35,source:m.id}))),
    ...ADRIANO_URBAN_DETAIL.trees.map(t=>({point:adrianoPoint(t.d,t.side*(MODULO_ADRIANO.halfWidth+.3)),radius:.28,source:'Adriano'}))],
   signs:ADRIANO_URBAN_DETAIL.signs.map(t=>({point:adrianoPoint(t.d,t.side*(MODULO_ADRIANO.halfWidth+.12)),type:t.type,source:'Adriano'})),
   checkpoints:[],bounds:map.scene.bounds};
 }else if(map.type==='native')geometry=nativeGeometry(key,nativeMaps);
 else if(map.type==='custom'){
  const pts=NEW_ROUTE.points.map(([x,y])=>[(x-NEW_ROUTE.start[0])/NEW_ROUTE.ppu,(NEW_ROUTE.start[1]-y)/NEW_ROUTE.ppu]);
  geometry=buildGeometry({modules:[{id:'Alemanes',name:NEW_ROUTE.name,points:pts,halfWidth:.79}],path:pts,bounds:null},map);
  geometry.labels=['Alemanes','Placentines','Francos'].map((name,i)=>[name,pts[Math.min(pts.length-1,Math.floor((i+.5)*pts.length/3))]]);
 }else geometry=specialized(map.scene,map,buildGeometry(map.scene,map),nativeMaps);
 // Each map receives isolated storage and an explicit origin identifier.
 return{...geometry,fences:[],chairs:[],urban:[],schema:SCHEMA,metadata:{map:map.name,mapKey:key,sourceType:map.type,
  baseVersion:'git-main',units:'game world units',exportFormat:'editor-layer-data',
  notice:'Edits are a separate manual working copy, not automatically applied to the game. Native map guides are derived from extracted collision outlines; generated sidewalks/people are approximate.'}};
}
