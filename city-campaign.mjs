import {CITY_SCHEMA,CITY_KEY,MAP_STORAGE_PREFIX,KINDS,validateMapDocument,validateProject,validateCityBundle,resolveCityMap,selectCityZone} from './city-project.mjs';
import {CONTENT_STEPS} from './content-catalogue.mjs';
import {CAMPAIGN_DATA} from './campaign-data.mjs';
import {gameplayOf,newRouteEvent,cleanGameplay} from './map-gameplay.mjs';
import {inSurface} from './map-geometry.mjs';
import {validateResourceManifest,listCustomAssets,initializeCustomAssets,loadDocumentAssets} from './custom-assets.mjs';
import {makeArenalPreviewDraft} from './editor-game-draft.mjs';

export const PLAYABLE_CITY_SCHEMA='apulso-playable-city-v1';
const clone=value=>structuredClone(value);
let gameSources=[];
export function cityVisitDocument(project,visit,getDocument){
 const zone=project.zones.find(z=>z.id===visit.zoneId);if(!zone)throw Error('El tramo ya no existe.');
 if(project.maps.find(m=>m.key===zone.mapKey)?.trashed)throw Error('El mapa «'+zone.name+'» está en la papelera.');
 const document=selectCityZone(project,zone.id,key=>resolveCityMap(project,key,getDocument));
 const g=gameplayOf(document);g.collision.mode='replace';document.gameplay=g;
 if(!g.route.enabled){
  g.route.enabled=true;
  g.route.events=(document.checkpoints||[]).map((cp,i)=>({...newRouteEvent(cp.finish?'finish':cp.mandatory?'presentation':'checkpoint',cp.position),id:cp.id||'control-'+i,name:cp.name||'Punto de control',radius:cp.radius||.65,heading:Number.isFinite(cp.angle)?cp.angle:null,mandatory:!!cp.mandatory}));
 }
 if(visit.entryId){const entry=g.route.events.find(e=>e.type==='entry'&&e.id===visit.entryId);if(!entry)throw Error('La entrada elegida de «'+zone.name+'» ya no existe.');document.startPose={x:entry.position[0],y:entry.position[1],angle:entry.heading??0};}
 if(visit.finishId){
  const terminal=g.route.events.find(e=>e.id===visit.finishId);if(!terminal||terminal.type==='announcement')throw Error('La llegada elegida de «'+zone.name+'» ya no existe.');
  g.route.events=g.route.events.filter(e=>e.id===terminal.id||!['finish','exit'].includes(e.type)).map(e=>e.id===terminal.id?{...e,type:'finish',lowered:true,mandatory:false,targetMap:'',targetEntry:''}:e);
 }
 if(visit.crowd==='none')document.people=[];
 if(visit.mandatory){const e=g.route.events.find(e=>!['entry','announcement','finish','exit'].includes(e.type));if(!e)throw Error('Añade un control para la presentación de «'+zone.name+'».');Object.assign(e,{type:'presentation',mandatory:true,lowered:true,name:visit.presentation||e.name});}
 const pose=document.startPose||document.paso;
 if(!pose)throw Error('Falta la salida de «'+zone.name+'».');
 if(![...(document.roads||[]),...(document.sidewalks||[])].some(s=>s.walkable!==false&&inSurface([pose.x,pose.y],s)))throw Error('El inicio de «'+zone.name+'» debe estar sobre una calle o acera.');
 if(!g.route.events.some(e=>['finish','exit'].includes(e.type)))throw Error('Falta una llegada o salida en «'+zone.name+'».');
 document.metadata={...document.metadata,inheritNativeLimits:false};validateMapDocument(document);return document;
}
function validateConnections(document,project,getDocument,seen=new Set()){
 const events=document.gameplay?.route?.events||[],key=document.metadata.mapKey;
 if(events.some(e=>e.type==='finish'))return;
 if(seen.has(key))throw Error('Las salidas forman un circuito sin llegada.');
 const next=new Set(seen).add(key),exits=events.filter(e=>e.type==='exit');
 if(!exits.length)throw Error('El mapa de destino necesita una llegada o salida.');
 for(const exit of exits){
  if(!project.maps.some(m=>m.key===exit.targetMap))throw Error('El destino de «'+exit.name+'» no está en el proyecto.');
  const target=cityVisitDocument(project,{zoneId:'map:'+exit.targetMap,entryId:exit.targetEntry},getDocument);validateConnections(target,project,getDocument,next);
 }
}
export function activateCityItinerary(project,brotherhoodId,stepId,getDocument,{replace=true}={}){
 const step=CONTENT_STEPS.find(s=>s.id===stepId&&s.implemented&&s.brotherhoodId===brotherhoodId);
 if(!step)throw Error('Elige un paso disponible de esta hermandad.');
 const visits=clone(project.itineraries[brotherhoodId]||[]);if(!visits.length)throw Error('Añade primero un mapa o zona al itinerario.');
 for(const visit of visits){const d=cityVisitDocument(project,visit,getDocument);validateConnections(d,project,getDocument);}
 project.disabledCampaignBrotherhoods=(project.disabledCampaignBrotherhoods||[]).filter(b=>b!==brotherhoodId);project.campaignItineraries??={};project.campaignItineraries[brotherhoodId]={stepId,replace:!!replace,visits,activatedAt:new Date().toISOString()};return visits.length;
}
export function compileCityCampaign(base,project,getDocument){
 validateProject(project);const routes=[],replaced=new Set();
 for(const [brotherhoodId,configuration]of Object.entries(project.campaignItineraries||{})){
  const step=CONTENT_STEPS.find(s=>s.id===configuration.stepId&&s.brotherhoodId===brotherhoodId&&s.implemented);
  if(!step)throw Error('El itinerario usa un paso que todavía no está disponible.');
  if(configuration.replace)replaced.add(brotherhoodId);
  let previous=null;
  for(const [i,visit]of configuration.visits.entries()){
   const document=cityVisitDocument(project,visit,getDocument);validateConnections(document,project,getDocument);const g=document.gameplay.route;
   const id='city-route:'+visit.id+':'+step.id;
   routes.push({id,name:visit.name||document.metadata.zoneName||document.metadata.map,brotherhoodId,stepRef:step.id,stepId:step.engineId,stepKey:step.engineVariant,mapId:1,mapKey:document.metadata.mapKey,order:i+1,playable:true,threeStars:g.threeStars,twoStars:g.twoStars,unlock:previous?{scope:'brotherhood',stars:0,completedRoute:previous}:{scope:'brotherhood',stars:0},checkpoints:{policy:'time',points:[]},presentations:g.events.filter(e=>e.type==='presentation'),cityDocument:document,cityVisitId:visit.id,instructions:'Recorrido creado en el editor. Los controles, la llegada y los tiempos son los configurados para este tramo.'});previous=id;
  }
 }
 const disabled=new Set(project.disabledCampaignBrotherhoods||[]);
 const retained=base.routes.filter(r=>(!project.archiveLegacy||r.cityDocument)&&!replaced.has(r.brotherhoodId)&&!(disabled.has(r.brotherhoodId)&&r.cityDocument)&&!routes.some(n=>n.id===r.id));
 const restored=project.archiveLegacy?[]:CAMPAIGN_DATA.routes.filter(r=>disabled.has(r.brotherhoodId)&&!retained.some(n=>n.id===r.id));
 return{...base,routes:[...retained,...restored,...routes]};
}
export function campaignCityPreview(route){
 if(!route?.cityDocument)return null;const document=clone(route.cityDocument);
 return{key:document.metadata.mapKey,name:route.name,document,draft:makeArenalPreviewDraft(document),isolated:true,nativeId:1};
}
function publicDocument(input){
 const d={schema:input.schema,metadata:{mapKey:input.metadata.mapKey,map:input.metadata.map||input.metadata.mapKey,sourceType:'user'},...Object.fromEntries(KINDS.map(k=>[k,clone(input[k]||[])]))};
 for(const key of ['paso','startPose','bounds','zoneRefs'])if(input[key]!==undefined)d[key]=clone(input[key]);
 if(input.gameplay)d.gameplay=cleanGameplay(input.gameplay);d.resources=clone(input.resources||[]);return d;
}
export function makePlayableCity(project,getDocument,resources=listCustomAssets()){
 validateProject(project);if(!Object.keys(project.campaignItineraries||{}).length&&!project.archiveLegacy&&!project.disabledCampaignBrotherhoods?.length)throw Error('Activa al menos un itinerario en Semana Santa.');
 const keys=new Set(),zones=new Set(),documents={};
 function include(key){
  if(keys.has(key))return;const raw=getDocument(key);if(!raw)throw Error('Falta un mapa utilizado.');keys.add(key);documents[key]=publicDocument(raw);
  for(const ref of raw.zoneRefs||[]){const z=project.zones.find(z=>z.id===ref.zoneId);if(!z)throw Error('Falta una calle enlazada.');zones.add(z.id);include(z.mapKey);}
  for(const e of raw.gameplay?.route?.events||[])if(e.type==='exit')include(e.targetMap);
 }
 for(const c of Object.values(project.campaignItineraries||{}))for(const v of c.visits){const z=project.zones.find(z=>z.id===v.zoneId);if(!z)throw Error('Falta una zona del itinerario.');zones.add(z.id);include(z.mapKey);}
 const byId=new Map(validateResourceManifest(resources).map(a=>[a.id,a]));for(const d of Object.values(documents))for(const a of validateResourceManifest(d.resources||[]))if(a.image)byId.set(a.id,a);
 const used=new Map();for(const d of Object.values(documents))d.resources=(d.resources||[]).map(a=>{const asset=byId.get(a.id);if(!asset?.image)throw Error('Falta la imagen de «'+a.name+'».');used.set(a.id,asset);const {image,...meta}=asset;return meta});
 const configurations=Object.fromEntries(Object.entries(project.campaignItineraries||{}).map(([b,c])=>[b,{stepId:c.stepId,replace:c.replace,activatedAt:c.activatedAt,visits:c.visits.map(v=>Object.fromEntries(['id','zoneId','crowd','mandatory','presentation','note','entryId','finishId','name'].filter(k=>v[k]!==undefined).map(k=>[k,clone(v[k])]))) }]));
 const p={schema:CITY_SCHEMA,revision:project.revision||1,maps:project.maps.filter(m=>keys.has(m.key)).map(({key,name,type,barrio})=>({key,name,type,barrio})),zones:project.zones.filter(z=>zones.has(z.id)||(z.whole&&keys.has(z.mapKey))).map(z=>Object.fromEntries(['id','mapKey','name','bounds','streets','whole','startPose'].filter(k=>z[k]!==undefined).map(k=>[k,clone(z[k])]))),streets:[],itineraries:{},campaignItineraries:configurations,disabledCampaignBrotherhoods:clone(project.disabledCampaignBrotherhoods||[]),archiveLegacy:!!project.archiveLegacy};
 for(const [b,c]of Object.entries(p.campaignItineraries))p.itineraries[b]=clone(c.visits);
 const bundle={schema:PLAYABLE_CITY_SCHEMA,formatVersion:1,publishedAt:new Date().toISOString(),project:p,documents,resources:[...used.values()].map(clone)};validatePlayableCity(bundle);return bundle;
}
export function validatePlayableCity(bundle){
 if(bundle?.schema!==PLAYABLE_CITY_SCHEMA||bundle.formatVersion!==1)throw Error('El archivo no es un proyecto jugable compatible.');
 const assets=validateResourceManifest(bundle.resources||[]);if(assets.some(a=>!a.image))throw Error('El proyecto jugable necesita todas sus imágenes.');
 const byId=new Map(assets.map(a=>[a.id,a]));for(const d of Object.values(bundle.documents||{}))for(const a of d.resources||[])if(!byId.has(a.id))throw Error('Falta un recurso del proyecto jugable.');
 validateCityBundle({schema:CITY_SCHEMA,project:bundle.project,documents:bundle.documents});compileCityCampaign(CAMPAIGN_DATA,bundle.project,key=>bundle.documents[key]);return bundle;
}
export function installCampaignSources(sources){gameSources=sources;}
export function campaignMapPreview(key){
 for(const source of gameSources){if(!source.documents[key])continue;const document=cityVisitDocument(source.project,{zoneId:'map:'+key},k=>source.documents[k]);return{key,name:document.metadata.map,document,draft:makeArenalPreviewDraft(document),isolated:true,nativeId:1};}return null;
}
export async function loadPlayableCampaign(base,storage,fetcher=fetch){
 const sources=[],warnings=[],loaded=[];let data=base;
 try{const response=await fetcher('./published-city.json',{cache:'no-store'});if(response.ok)sources.push(validatePlayableCity(await response.json()));}catch(error){warnings.push('No se pudo abrir la ciudad publicada: '+error.message);}
 try{
  const raw=storage.getItem(CITY_KEY),project=raw&&JSON.parse(raw);
  if(project&&(Object.keys(project.campaignItineraries||{}).length||project.archiveLegacy||project.disabledCampaignBrotherhoods?.length)){
   await initializeCustomAssets();
   const get=key=>{const text=storage.getItem(MAP_STORAGE_PREFIX+key);if(!text)throw Error('Guarda el mapa «'+key+'» en el editor.');return JSON.parse(text)};
   const local=makePlayableCity(project,get);sources.push(local);
  }
 }catch(error){warnings.push('El itinerario local no se ha activado: '+error.message);}
 for(const source of sources){
  try{for(const d of Object.values(source.documents))await loadDocumentAssets({...d,resources:(d.resources||[]).map(a=>source.resources.find(r=>r.id===a.id)||a)});data=compileCityCampaign(data,source.project,k=>source.documents[k]);loaded.push(source);}catch(error){warnings.push('No se pudo cargar un itinerario: '+error.message);}
 }
 installCampaignSources([...loaded].reverse());return{data,warnings};
}
