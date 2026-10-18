import {validateProject,normalizeStreet} from './city-project.mjs';

export function mapUsage(project,key,getDocument=()=>({})){
 const zones=new Set(project.zones.filter(z=>z.mapKey===key).map(z=>z.id));
 const drafts=Object.entries(project.itineraries).filter(([,v])=>v.some(x=>zones.has(x.zoneId))).map(([id])=>id);
 const live=Object.entries(project.campaignItineraries||{}).filter(([,c])=>c.visits.some(x=>zones.has(x.zoneId))).map(([id])=>id);
 const links=[],connections=[];
 for(const m of project.maps.filter(m=>m.key!==key&&!m.trashed)){
  const doc=getDocument(m.key);
  if((doc.zoneRefs||[]).some(r=>zones.has(r.zoneId)))links.push(m);
  if((doc.gameplay?.route?.events||[]).some(e=>e.type==='exit'&&e.targetMap===key))connections.push(m);
 }
 return{drafts,live,links,connections};
}
export function itineraryState(project,id){
 const draft=project.itineraries[id]||[],active=project.campaignItineraries?.[id];
 if(!active)return draft.length?'draft':'empty';
 return JSON.stringify(draft)===JSON.stringify(active.visits)?'live':'pending';
}
export function renameCityMap(project,key,name){
 const map=project.maps.find(m=>m.key===key);name=String(name).trim();
 if(!map||map.trashed)throw Error('El mapa ya no está disponible.');
 if(!name||name.length>100)throw Error('Escribe un nombre de hasta 100 caracteres.');
 if(project.maps.some(m=>m.key!==key&&!m.trashed&&normalizeStreet(m.name)===normalizeStreet(name)))throw Error('Ya hay otro mapa con ese nombre.');
 map.name=name;const zone=project.zones.find(z=>z.whole&&z.mapKey===key);if(zone)zone.name=name;return map;
}
export function trashCityMap(project,key,getDocument){
 const map=project.maps.find(m=>m.key===key);if(!map||map.trashed)throw Error('El mapa ya está en la papelera.');
 const usage=mapUsage(project,key,getDocument);
 if(usage.links.length)throw Error('Esta calle está enlazada dentro de '+usage.links.map(m=>m.name).join(', ')+'. Retira esos vínculos antes de eliminarla.');
 if(usage.connections.length)throw Error('Hay salidas hacia este mapa desde '+usage.connections.map(m=>m.name).join(', ')+'. Cambia esas salidas antes de eliminarlo.');
 const zoneIds=new Set(project.zones.filter(z=>z.mapKey===key).map(z=>z.id));
 for(const [id,visits]of Object.entries(project.itineraries))project.itineraries[id]=visits.filter(v=>!zoneIds.has(v.zoneId));
 for(const [id,config]of Object.entries(project.campaignItineraries||{})){
  config.visits=config.visits.filter(v=>!zoneIds.has(v.zoneId));
  if(!config.visits.length){delete project.campaignItineraries[id];project.disabledCampaignBrotherhoods=[...new Set([...(project.disabledCampaignBrotherhoods||[]),id])];}
 }
 map.trashed=true;map.trashedAt=new Date().toISOString();validateProject(project);return usage;
}
export function restoreCityMap(project,key,getDocument=()=>({})){
 const map=project.maps.find(m=>m.key===key&&m.trashed);if(!map)throw Error('El mapa no está en la papelera.');
 if(project.maps.some(m=>m.key!==key&&!m.trashed&&normalizeStreet(m.name)===normalizeStreet(map.name)))throw Error('Ya hay otro mapa con ese nombre. Renombra el mapa activo antes de restaurar este.');
 const doc=getDocument(key),dependencies=[...(doc.zoneRefs||[]).map(r=>project.zones.find(z=>z.id===r.zoneId)?.mapKey),...(doc.gameplay?.route?.events||[]).filter(e=>e.type==='exit').map(e=>e.targetMap)];
 const missing=dependencies.filter(k=>!project.maps.some(m=>m.key===k&&!m.trashed));
 if(missing.length)throw Error('Restaura primero las calles o mapas enlazados: '+missing.map(k=>project.maps.find(m=>m.key===k)?.name||k||'zona desconocida').join(', ')+'.');
 delete map.trashed;delete map.trashedAt;return map;
}
