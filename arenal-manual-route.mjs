import {BARATILLO,ARENAL_ANCHORS} from './arenal-data.mjs';
const same=(a,b)=>Array.isArray(a)&&a.length===2&&a.every((n,i)=>Math.abs(n-b[i])<.00001);
// Retire only the shipped default points. Authored events, renamed/moved
// points and every other map remain the user's own itinerary.
export function removeArenalPreset(document,key=document?.metadata?.mapKey||document?.mapKey){
 if(!document||key!=='RegresoArenal')return document;
 const result={...document};
 if(Array.isArray(document.checkpoints))result.checkpoints=document.checkpoints.filter(p=>!(p.id==='baratillo'&&same(p.position,BARATILLO.position)&&!p.edit&&!p.source&&(!p.name||p.name==='Capilla del Baratillo')));
 if(Array.isArray(document.labels))result.labels=document.labels.filter(p=>!(p.length===2&&p[0]==='Capilla del Baratillo'&&same(p[1],[40.9,35.4])));
 if(same(document.checkpoint,BARATILLO.position))result.checkpoint=[...ARENAL_ANCHORS.start.position];
 return result;
}
