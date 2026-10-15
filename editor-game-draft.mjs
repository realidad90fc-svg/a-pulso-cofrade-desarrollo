import {hasGameplay,cleanGameplay} from './map-gameplay.mjs';
// Convert editor working copies to game data. Arenal owns its complete scene;
// other original maps retain additive patches over their native environment.
// No reference-photo bytes or positional metadata are included.
export const GAME_PATCH_PREFIX='apulso-game-draft-v1:';
export const EDITOR_PATCH_SCHEMA='apulso-game-draft-v1';
export const MAP_KINDS=['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs','labels','urban','customObjects'];
const stringify=x=>JSON.stringify(x);
// Grouping and locking are authoring state, not extra scenery. Only resized
// collision state participates in the playable delta.
function sceneSignature(kind,item){
 const value=structuredClone(item);
 if(kind==='labels'){value[2]={radius:1,...value[2]};delete value[2].edit;return stringify(value)}
 const resized=value.edit?.resized;delete value.edit;if(resized)value.edit={resized:true};return stringify(value);
}
export function makeGameDraft(data,baseline){
 const layers={};let removedCount=0;
 for(const kind of MAP_KINDS){
  const existing=new Map();
  for(const item of baseline?.[kind]||[]){
   const sig=sceneSignature(kind,item);existing.set(sig,(existing.get(sig)||0)+1);
  }
  const changes=[];
  for(const item of data?.[kind]||[]){
   const sig=sceneSignature(kind,item),count=existing.get(sig)||0;
   if(count)existing.set(sig,count-1);
   else changes.push(item);
  }
  layers[kind]=changes;
  const removed=[...existing.values()].reduce((n,v)=>n+v,0);
  if(kind==='labels'||(data?.metadata?.mapKey==='RegresoArenal'&&['roads','sidewalks','houses','people'].includes(kind)))removedCount+=removed;
 }
 const startChanged=!!data?.startReset||JSON.stringify(data?.startPose||null)!==JSON.stringify(baseline?.startPose||null);
 const authoredNative=!!data?.metadata?.precisionGeometry&&/^native-\d+$/.test(data.metadata.mapKey);
  const gameplayChanged=JSON.stringify(data?.gameplay||null)!==JSON.stringify(baseline?.gameplay||null);
 const gameplayScene=hasGameplay(data?.gameplay)?{schema:data.schema,metadata:{mapKey:data.metadata.mapKey,map:data.metadata.map,sourceType:data.metadata.sourceType},...Object.fromEntries(MAP_KINDS.map(k=>[k,data[k]||[]])),gameplay:cleanGameplay(data.gameplay),bounds:data.bounds,paso:data.paso,startPose:data.startPose,resources:(data.resources||[]).map(({image,...a})=>a)}:null;
 const total=(gameplayChanged?1:0)+MAP_KINDS.reduce((n,k)=>n+layers[k].length,0)+removedCount+(startChanged?1:0);
 return{schema:EDITOR_PATCH_SCHEMA,mapKey:data?.metadata?.mapKey,
  createdAt:new Date().toISOString(),gameplayScene,layers,total:authoredNative?Math.max(1,total):total,resources:data?.resources||[],
  ...(authoredNative?{authoringScene:{schema:'apulso-universal-editor-v2',metadata:{mapKey:data.metadata.mapKey,map:data.metadata.map||data.metadata.mapKey,sourceType:'native',inheritNativeLimits:true,precisionGeometry:true},...Object.fromEntries(MAP_KINDS.map(k=>[k,data[k]||[]])),gameplay:cleanGameplay(data.gameplay),bounds:data.bounds,paso:data.paso,startPose:data.startPose,resources:(data.resources||[]).map(({image,...a})=>a)}}:{}),
   ...(startChanged?{startPose:data?.startPose||null}:{}),
  // Full road geometry supports accurate path validation on the Arenal route.
  labelScene:data?.labels||[],
  arenalScene:data?.metadata?.mapKey==='RegresoArenal'?Object.fromEntries(
    ['roads','sidewalks','houses','people'].map(k=>[k,data[k]||[]])
   ):null,
  note:'Solo diseño local del editor, sin fotografías. Las bajas en mapas originales requieren integrar sus gráficos y colisiones de origen.'};
}

// An explicit Arenal preview loads the saved document itself. A separately
// cached delta can be stale or omit an unchanged floor after an editor update.
export function makeArenalPreviewDraft(document){
 if(document?.metadata?.mapKey!=='RegresoArenal')return null;
 const draft=makeGameDraft(document,null);
 return{...draft,total:Math.max(1,draft.total),startPose:document.startPose||document.paso||null};
}

// Every explicit editor preview owns its street points, even when the native
// scenery has no delta. Empty points deliberately suppress native names.
export function withEditorStreetPoints(draft,document){
 return{...draft,schema:EDITOR_PATCH_SCHEMA,mapKey:document.metadata.mapKey,
  layers:draft?.layers||Object.fromEntries(MAP_KINDS.map(k=>[k,[]])),
  total:Math.max(1,draft?.total||0),labelScene:document.labels||[]};
}
