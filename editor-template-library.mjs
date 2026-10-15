import {captureBlock,validateBlock,portableBlock} from './editor-selection-model.mjs';
import {freshEditorId} from './editor-item-state.mjs';
import {loadDocumentAssets,validateResourceManifest} from './custom-assets.mjs';
let job=null;const records=new Map();
function database(){if(!job)job=new Promise((resolve,reject)=>{const r=indexedDB.open('apulso-editor-templates-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('templates',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo abrir el catálogo de plantillas.'));r.onblocked=()=>reject(Error('Cierra otras pestañas para abrir las plantillas.'))}).catch(e=>{job=null;throw e});return job}
function validateTemplate(t){if(!t||typeof t.id!=='string'||!/^template-[a-zA-Z0-9-]+$/.test(t.id)||t.id.length>120||typeof t.name!=='string'||!t.name.trim()||t.name.length>100)throw Error('Nombre o identificador de plantilla no válido.');validateBlock(t.block);return t}
export const listTemplates=()=>[...records.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
export const templateById=id=>records.get(id)||null;
export async function initializeTemplates(){const db=await database(),all=await new Promise((resolve,reject)=>{const r=db.transaction('templates').objectStore('templates').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudieron leer las plantillas.'))});for(const t of all)records.set(t.id,validateTemplate(t))}
async function write(items,remove=null){const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('templates','readwrite'),store=tx.objectStore('templates');for(const t of items)store.put(t);if(remove)store.delete(remove);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('No se pudieron guardar las plantillas. Exporta el catálogo antes de cerrar.'))})}
export async function saveTemplate({id=freshEditorId('template'),name,block}){
 const old=records.get(id),item=validateTemplate({id,name:String(name||'').trim(),block:structuredClone(block),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
 if(!old&&records.size>=100)throw Error('El catálogo admite hasta 100 plantillas.');
 // Only resource references live in this store; raster bytes stay in the catalogue.
 item.block.resources=(item.block.resources||[]).map(({image,...asset})=>asset);await write([item]);records.set(id,item);return item;
}
export async function removeTemplate(id){if(!records.has(id))throw Error('No se encuentra la plantilla.');await write([],id);records.delete(id)}
export function templateFromSelection(doc,items,name,id){return{id,name,block:captureBlock(doc,items)}}
export function exportTemplates(ids=null){
 const templates=listTemplates().filter(t=>!ids||ids.includes(t.id));if(!templates.length)throw Error('No hay plantillas para exportar.');const resources=new Map();
 for(const t of templates)for(const a of portableBlock(t.block).resources)resources.set(a.id,a);
 return{schema:'apulso-template-library-v1',templates:structuredClone(templates),resources:[...resources.values()]};
}
export async function importTemplates(input){
 if(input?.schema!=='apulso-template-library-v1'||!Array.isArray(input.templates)||input.templates.length<1||input.templates.length>100)throw Error('El archivo no es un catálogo de plantillas válido.');
 const resources=validateResourceManifest(input.resources||[]),staged=input.templates.map(t=>validateTemplate(structuredClone(t))),ids=new Set();
 for(const t of staged){if(ids.has(t.id))throw Error('Hay plantillas con el mismo identificador.');ids.add(t.id);const available=resources.length?resources:t.block.resources;validateBlock({...t.block,resources:available});}
 if(new Set([...records.keys(),...ids]).size>100)throw Error('El catálogo superaría 100 plantillas.');
 const used={...Object.fromEntries(['roads','sidewalks','houses','customObjects'].map(k=>[k,staged.flatMap(t=>t.block.layers[k]||[])])),resources};
 await loadDocumentAssets(used,{persist:true});for(const t of staged)t.block.resources=(t.block.resources||[]).map(({image,...a})=>a);await write(staged);for(const t of staged)records.set(t.id,t);return staged;
}
// Project restoration replaces the active catalogue in one IndexedDB transaction.
export async function replaceTemplateLibrary(items,resources=[]){
 if(!Array.isArray(items)||items.length>100)throw Error('El catálogo supera 100 plantillas.');const staged=items.map(t=>validateTemplate(structuredClone(t))),ids=new Set();
 for(const t of staged){if(ids.has(t.id))throw Error('Hay plantillas repetidas.');ids.add(t.id);validateBlock({...t.block,resources});t.block.resources=(t.block.resources||[]).map(({image,...a})=>a)}
 const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('templates','readwrite'),store=tx.objectStore('templates');store.clear();for(const t of staged)store.put(t);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('No se pudieron restaurar las plantillas.'))});records.clear();for(const t of staged)records.set(t.id,t);
}
