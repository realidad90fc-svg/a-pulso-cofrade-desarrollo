// Authoring-only state. Labels keep metadata in their serializable third slot.
export const EDITABLE_KINDS=['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs','labels','urban','customObjects'];
export const freshEditorId=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
export function itemEdit(item,create=false){
 if(Array.isArray(item)){if(create)item[2]={radius:1,...item[2]};if(create)item[2].edit??={};return item[2]?.edit||{}}
 if(create)item.edit??={};return item?.edit||{};
}
export function allSelections(doc){return EDITABLE_KINDS.flatMap(type=>(doc?.[type]||[]).map((_,index)=>({type,index,vertex:-1})))}
export function expandGroups(doc,selections,separate=false){
 const seen=new Set(),result=[],groups=new Set();
 for(const s of selections){if(!EDITABLE_KINDS.includes(s.type)||!doc?.[s.type]?.[s.index])continue;const key=s.type+':'+s.index;if(!seen.has(key)){seen.add(key);result.push({...s})}const group=itemEdit(doc[s.type][s.index]).groupId;if(group&&!separate)groups.add(group)}
 if(groups.size)for(const s of allSelections(doc))if(groups.has(itemEdit(doc[s.type][s.index]).groupId)&&!seen.has(s.type+':'+s.index))result.push(s);
 return result;
}
export function selectionLocked(doc,selections){return expandGroups(doc,selections).some(s=>itemEdit(doc[s.type][s.index]).locked)}
export function assertEditable(doc,selections){if(selectionLocked(doc,selections))throw Error('La selección contiene elementos bloqueados. Desbloquéalos antes de modificarlos.');}
export function validateItemEdit(item){
 const e=itemEdit(item);if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Datos de edición no válidos.');
 for(const key of ['groupId','groupName'])if(e[key]!==undefined&&(typeof e[key]!=='string'||e[key].length>120))throw Error('Grupo no válido.');
 for(const key of ['angle','groupAngle'])if(e[key]!==undefined&&(!Number.isFinite(e[key])||Math.abs(e[key])>360000))throw Error('Giro de edición no válido.');
 if(e.locked!==undefined&&typeof e.locked!=='boolean')throw Error('Bloqueo no válido.');
 if(e.resized!==undefined&&typeof e.resized!=='boolean')throw Error('Datos de tamaño no válidos.');
}
