// Canonical maps and zones are referenced by stable IDs. A procession owns
// its visit order and crowd settings; it never owns a copied street.
export const CITY_SCHEMA='apulso-city-project-v1';
export const CITY_KEY='apulso-city-project-v1';
export const MAP_STORAGE_PREFIX='apulso-universal-editor-v2:';
import {validateResourceManifest,validateCustomObject,embedDocumentAssets} from './custom-assets.mjs';
import {validSurface,validateTextureSettings} from './map-geometry.mjs';
export const KINDS=['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs','labels','urban','customObjects'];
const clone=v=>structuredClone(v);
export const normalizeStreet=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘´'`]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/^(calle|c)\s+/,'').replace(/^avda\s+/,'avenida ');
const id=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
const point=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(n=>Number.isFinite(n)&&Math.abs(n)<=100000);
const poly=p=>Array.isArray(p)&&p.length>=3&&p.length<=10000&&p.every(point);
export function polygonBounds(p){const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
export function validateMapDocument(doc){
 if(!doc||typeof doc!=='object'||typeof doc.metadata?.mapKey!=='string'||!doc.metadata.mapKey||doc.metadata.mapKey.length>150)throw Error('El mapa necesita un identificador válido.');
 const resources=validateResourceManifest(doc.resources||[]),resourceIds=new Set(resources.map(a=>a.id));
 for(const kind of KINDS){
  if(doc[kind]!==undefined&&!Array.isArray(doc[kind]))throw Error('Capa no válida: '+kind);
  const list=doc[kind]||[];if(list.length>20000)throw Error('La capa '+kind+' supera el límite de elementos.');
  for(const o of list){
   if(['roads','sidewalks','houses'].includes(kind)&&!poly(o?.poly))throw Error('Hay polígonos no válidos en '+kind);
   if(o?.poly){if(o.holes!==undefined&&!validSurface(o))throw Error('Hay un patio o contorno no válido en '+kind);validateTextureSettings(o.texture)}
   if(kind==='customObjects'){validateCustomObject(o);if(!resourceIds.has(o.assetId))throw Error('Falta la definición de un recurso importado.')}
   if(o?.material?.startsWith('asset-')&&!resourceIds.has(o.material))throw Error('Falta una textura importada en el catálogo del mapa.');
   if(['people','trees','signs','fences','chairs','urban'].includes(kind)&&!point(o?.point))throw Error('Hay posiciones no válidas en '+kind);
   if(kind==='checkpoints'&&!point(o?.position))throw Error('Hay un checkpoint sin posición válida.');
   if(kind==='labels'&&(!Array.isArray(o)||typeof o[0]!=='string'||!point(o[1])))throw Error('Hay nombres de calle no válidos.');
   if(kind==='labels'&&o[2]!==undefined&&(!o[2]||typeof o[2]!=='object'||Array.isArray(o[2])||!Number.isFinite(o[2].radius)||o[2].radius<.2||o[2].radius>5))throw Error('El radio de un punto de calle debe estar entre 0,2 y 5 metros.');
  }
 }
 if(doc.bounds&&(!Array.isArray(doc.bounds)||doc.bounds.length!==4||!doc.bounds.every(Number.isFinite)||doc.bounds[2]<=doc.bounds[0]||doc.bounds[3]<=doc.bounds[1]))throw Error('Los límites del mapa no son válidos.');
 if(doc.paso&&![doc.paso.x,doc.paso.y,doc.paso.angle].every(Number.isFinite))throw Error('La posición del paso no es válida.');
 if(doc.startPose&&![doc.startPose.x,doc.startPose.y,doc.startPose.angle].every(Number.isFinite))throw Error('La salida no es válida.');
 if((doc.zoneRefs||[]).length>100)throw Error('Demasiadas zonas enlazadas.');
 for(const ref of doc.zoneRefs||[])if(typeof ref.zoneId!=='string'||!point(ref.offset||[0,0])||!Number.isFinite(ref.angle||0))throw Error('Vínculo de zona no válido.');
 return doc;
}
export function blankMapDocument(meta){
 const width=Math.max(8,Math.min(2000,Number(meta.width)||40)),height=Math.max(8,Math.min(2000,Number(meta.height)||40));
 return{schema:'apulso-universal-editor-v2',metadata:{map:meta.name,mapKey:meta.key,sourceType:'user',barrio:meta.barrio||'',units:'game world units',exportFormat:'editor-layer-data'},...Object.fromEntries(KINDS.map(k=>[k,[]])),bounds:[0,0,width,height],paso:{x:width/2,y:height/2,angle:0},checkpoint:[width/2,height/2],zoneRefs:[]};
}
export function createCityProject(catalog=[]){
 const project={schema:CITY_SCHEMA,revision:1,maps:catalog.map(({key,name,type})=>({key,name,type})),zones:[],streets:[],itineraries:{}};
 for(const map of project.maps)project.zones.push({id:'map:'+map.key,mapKey:map.key,name:map.name,bounds:null,streets:[],whole:true});
 return project;
}
export function readCityProject(storage,catalog=[]){
 const initial=createCityProject(catalog),raw=storage?.getItem(CITY_KEY);if(!raw)return initial;
 let p;try{p=JSON.parse(raw)}catch{throw Error('El catálogo guardado no se puede leer. Exporta tus datos antes de restaurarlo.');}
 validateProject(p);
 for(const map of initial.maps)if(!p.maps.some(m=>m.key===map.key)){p.maps.push(map);p.zones.push(initial.zones.find(z=>z.mapKey===map.key))}
 return p;
}
export function validateProject(p){
 if(p?.schema!==CITY_SCHEMA||!Array.isArray(p.maps)||!Array.isArray(p.zones)||!Array.isArray(p.streets)||!p.itineraries||typeof p.itineraries!=='object')throw Error('El archivo no es un proyecto de ciudad compatible.');
 if(p.maps.length>500||p.zones.length>3000||p.streets.length>15000)throw Error('El proyecto supera el tamaño permitido.');
 for(const [items,field]of [[p.maps,'key'],[p.zones,'id'],[p.streets,'id']]){const ids=items.map(x=>x?.[field]);if(ids.some(x=>typeof x!=='string'||!x||x.length>180)||new Set(ids).size!==ids.length)throw Error('Hay identificadores de mapa, calle o zona repetidos o no válidos.');}
 for(const z of p.zones){if(!p.maps.some(m=>m.key===z.mapKey)||!Array.isArray(z.streets))throw Error('Una zona apunta a un mapa inexistente.');if(z.bounds&&(!Array.isArray(z.bounds)||z.bounds.length!==4||!z.bounds.every(Number.isFinite)||z.bounds[2]<=z.bounds[0]||z.bounds[3]<=z.bounds[1]))throw Error('Límites de zona no válidos.');}
 for(const visits of Object.values(p.itineraries)){if(!Array.isArray(visits)||visits.length>300)throw Error('Itinerario no válido.');for(const v of visits){if(!p.zones.some(z=>z.id===v.zoneId)||typeof v.id!=='string')throw Error('Un itinerario utiliza una zona inexistente.');}}
 return p;
}
export function persistCityProject(storage,p){validateProject(p);p.revision=(p.revision||0)+1;storage.setItem(CITY_KEY,JSON.stringify(p));}
export function addCityMap(p,{name,barrio='',width=40,height=40},document=null){
 name=String(name||'').trim().slice(0,100);if(!name)throw Error('Escribe un nombre para el mapa.');
 if(p.maps.some(m=>normalizeStreet(m.name)===normalizeStreet(name)))throw Error('Ya existe un mapa con ese nombre. Puedes abrirlo desde el buscador.');
 if(document)validateMapDocument(document);
 const key=document?.metadata.mapKey||id('city');if(p.maps.some(m=>m.key===key))throw Error('Este mapa ya está en el catálogo. Ábrelo para actualizarlo.');
 const meta={key,name,barrio:String(barrio).slice(0,80),width,height,type:'user'};
 const doc=document?{...clone(document),schema:'apulso-universal-editor-v2',metadata:{...document.metadata,mapKey:key,map:name,sourceType:'user',barrio:meta.barrio}}:blankMapDocument(meta);
 for(const k of KINDS)doc[k]??=[];
 p.maps.push(meta);p.zones.push({id:'map:'+key,mapKey:key,name,bounds:null,streets:[],whole:true});indexMapStreets(p,doc);
 return{meta,document:doc};
}
export function addCityZone(p,mapKey,name,bounds,streets=[]){
 if(!p.maps.some(m=>m.key===mapKey))throw Error('El mapa de origen no existe.');
 name=String(name).trim().slice(0,100);if(!name)throw Error('Escribe un nombre para la zona.');
 if(!bounds||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[2]<=bounds[0]||bounds[3]<=bounds[1])throw Error('Selecciona un área válida para la zona.');
 if(p.zones.some(z=>z.mapKey===mapKey&&normalizeStreet(z.name)===normalizeStreet(name)))throw Error('Esta zona ya está registrada en el mapa.');
 const z={id:id('zone'),mapKey,name,bounds:[...bounds],streets:[...new Set(streets.map(s=>String(s).trim()).filter(Boolean))],whole:false};p.zones.push(z);return z;
}
export function indexMapStreets(p,doc){
 const mapKey=doc.metadata.mapKey,labels=(doc.labels||[]).filter(l=>Array.isArray(l)&&typeof l[0]==='string'&&point(l[1]));
 const names=new Set(labels.map(l=>normalizeStreet(l[0])));
 const meta=p.maps.find(m=>m.key===mapKey);if(meta)meta.zoneRefs=(doc.zoneRefs||[]).map(r=>r.zoneId);
 for(const street of p.streets)if(!names.has(street.id))street.segments=(street.segments||[]).filter(s=>s.mapKey!==mapKey);
 p.streets=p.streets.filter(s=>(s.segments||[]).length);
 // Update anchors without multiplying the same named street on every save.
 for(const [name,position]of labels){
  const normal=normalizeStreet(name);if(!normal||/^mapa original /.test(normal))continue;
  let street=p.streets.find(s=>s.id===normal);
  if(!street){street={id:normal,name:name.trim(),aliases:[],segments:[]};p.streets.push(street)}
  street.segments??=[];const segment=street.segments.find(s=>s.mapKey===mapKey);
  if(segment)segment.position=[...position];else street.segments.push({mapKey,zoneId:'map:'+mapKey,position:[...position],barrio:doc.metadata.barrio||''});
 }
 const zone=p.zones.find(z=>z.id==='map:'+mapKey);if(zone)zone.streets=[...new Set(labels.map(l=>l[0]))];
}
export function searchCityStreets(p,query=''){
 const q=normalizeStreet(query);return p.streets.filter(s=>!q||[s.name,...(s.aliases||[]),...(s.segments||[]).map(t=>t.barrio)].some(n=>normalizeStreet(n).includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
}
export function assignCityZone(p,brotherhoodId,zoneId){
 if(!p.zones.some(z=>z.id===zoneId))throw Error('La zona ya no está disponible.');
 const visits=p.itineraries[brotherhoodId]??=[];
 const existing=visits.find(v=>v.zoneId===zoneId);if(existing)return{visit:existing,added:false};
 const visit={id:id('visit'),zoneId,crowd:'inherit',mandatory:false,presentation:'',note:''};visits.push(visit);return{visit,added:true};
}
export function affectedBrotherhoods(p,mapKey){
 const affectedMaps=new Set([mapKey]);let expanded=true;
 while(expanded){expanded=false;for(const map of p.maps)if(!affectedMaps.has(map.key)&&(map.zoneRefs||[]).some(id=>affectedMaps.has(p.zones.find(z=>z.id===id)?.mapKey))){affectedMaps.add(map.key);expanded=true;}}
 const zoneIds=new Set(p.zones.filter(z=>affectedMaps.has(z.mapKey)).map(z=>z.id));
 return Object.entries(p.itineraries).filter(([,visits])=>visits.some(v=>zoneIds.has(v.zoneId))).map(([id])=>id);
}
export function selectCityZone(p,zoneId,getDocument){
 const zone=p.zones.find(z=>z.id===zoneId);if(!zone)throw Error('Zona desconocida.');
 const doc=getDocument(zone.mapKey);if(!doc)throw Error('El mapa de origen no está disponible.');
 const selected=clone(doc);
 if(zone.bounds)for(const k of KINDS)selected[k]=(doc[k]||[]).filter(o=>{
  if(o.poly)return intersects(polygonBounds(o.poly),zone.bounds);
  const pt=k==='labels'?o[1]:o.position||o.point;return pt&&pt[0]>=zone.bounds[0]&&pt[0]<=zone.bounds[2]&&pt[1]>=zone.bounds[1]&&pt[1]<=zone.bounds[3];
 }).map(clone);
 if(zone.bounds)selected.bounds=[...zone.bounds];
 if(zone.startPose)selected.startPose={...zone.startPose};
 selected.metadata={...selected.metadata,zoneId:zone.id,zoneName:zone.name};return selected;
}
export function transformMapDocument(doc,offset=[0,0],angle=0){
 const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180),move=([x,y])=>[x*c-y*s+offset[0],x*s+y*c+offset[1]];
 const out=clone(doc);for(const k of KINDS)out[k]=(doc[k]||[]).map(o=>{
  if(k==='labels')return[o[0],move(o[1]),...o.slice(2).map(clone)];
  const v=clone(o);if(v.poly)v.poly=v.poly.map(move);if(v.holes)v.holes=v.holes.map(r=>r.map(move));if(v.point)v.point=move(v.point);if(v.position)v.position=move(v.position);if(Number.isFinite(v.angle))v.angle+=angle;return v;
 });
 if(doc.bounds)out.bounds=polygonBounds([[doc.bounds[0],doc.bounds[1]],[doc.bounds[2],doc.bounds[1]],[doc.bounds[2],doc.bounds[3]],[doc.bounds[0],doc.bounds[3]]].map(move));
 for(const key of ['paso','startPose'])if(doc[key]){const q=move([doc[key].x,doc[key].y]);out[key]={...doc[key],x:q[0],y:q[1],angle:doc[key].angle+angle};}
 return out;
}
export function resolveCityMap(p,mapKey,getDocument,trail=new Set()){
 if(trail.has(mapKey))throw Error('Hay un enlace circular entre mapas. Retira el último vínculo.');
 const doc=clone(getDocument(mapKey));if(!doc)throw Error('No se puede abrir el mapa '+mapKey);
 const visited=new Set(trail).add(mapKey),seen=new Set();
 for(const ref of doc.zoneRefs||[]){
  if(seen.has(ref.zoneId))continue;seen.add(ref.zoneId);
  const zone=p.zones.find(z=>z.id===ref.zoneId);if(!zone)continue;
  const linked=selectCityZone(p,ref.zoneId,key=>resolveCityMap(p,key,getDocument,visited));
  const moved=transformMapDocument(linked,ref.offset||[0,0],ref.angle||0);
  for(const k of KINDS)doc[k]=[...(doc[k]||[]),...(moved[k]||[]).map(o=>k==='labels'?o:{...o,sharedZone:ref.zoneId})];
  doc.resources=[...new Map([...(doc.resources||[]),...(moved.resources||[])].map(a=>[a.id,a])).values()];
 }
 return doc;
}
export function exportCityBundle(p,getDocument){
 validateProject(p);return{schema:CITY_SCHEMA,project:clone(p),documents:Object.fromEntries(p.maps.map(m=>[m.key,embedDocumentAssets(getDocument(m.key))])),exportedAt:new Date().toISOString(),note:'Mapas, recursos propios y referencias compartidas; sin fotografías privadas.'};
}
export function validateCityBundle(bundle){
 if(bundle?.schema!==CITY_SCHEMA||!bundle.project||!bundle.documents)throw Error('Este archivo no es una copia completa de la ciudad.');
 validateProject(bundle.project);
 for(const m of bundle.project.maps){const doc=bundle.documents[m.key];validateMapDocument(doc);if(doc.metadata.mapKey!==m.key)throw Error('El identificador de un mapa no coincide con el catálogo.');}
 for(const m of bundle.project.maps)resolveCityMap(bundle.project,m.key,key=>bundle.documents[key]);
 return bundle;
}
