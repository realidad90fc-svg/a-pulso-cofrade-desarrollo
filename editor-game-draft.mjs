// Convert editor working copies to safe, additive patches for game preview.
// Only geometry changed from the editor baseline is overlaid in gameplay.
// No reference-photo bytes or positional metadata are included.
export const GAME_PATCH_PREFIX='apulso-game-draft-v1:';
export const EDITOR_PATCH_SCHEMA='apulso-game-draft-v1';
export const MAP_KINDS=['roads','sidewalks','houses','people','trees','signs','fences','chairs'];
const stringify=x=>JSON.stringify(x);
export function makeGameDraft(data,baseline){
 const layers={},modified={};let removedCount=0;
 for(const kind of MAP_KINDS){
  const existing=new Map();
  for(const item of baseline?.[kind]||[]){
   const sig=stringify(item);existing.set(sig,(existing.get(sig)||0)+1);
  }
  const changes=[];
  for(const item of data?.[kind]||[]){
   const sig=stringify(item),count=existing.get(sig)||0;
   if(count)existing.set(sig,count-1);
   else changes.push(item);
  }
  layers[kind]=changes;
  const removed=[...existing.values()].reduce((n,v)=>n+v,0);
  if(data?.metadata?.mapKey==='RegresoArenal'&&['roads','sidewalks','houses','people'].includes(kind))removedCount+=removed;
  modified[kind]=changes.length>0||removed>0;
 }
 const total=MAP_KINDS.reduce((n,k)=>n+layers[k].length,0)+removedCount;
 return{schema:EDITOR_PATCH_SCHEMA,mapKey:data?.metadata?.mapKey,
  createdAt:new Date().toISOString(),layers,total,
  // Full road geometry supports accurate path validation on the Arenal route.
  arenalScene:data?.metadata?.mapKey==='RegresoArenal'?Object.fromEntries(
    ['roads','sidewalks','houses','people'].filter(k=>modified[k]).map(k=>[k,data[k]])
   ):null,
  note:'Solo diseño local del editor, sin fotografías. Las bajas en mapas originales requieren integrar sus gráficos y colisiones de origen.'};
}
