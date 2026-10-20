import {CITY_SCHEMA,validateCityBundle,validateMapDocument} from './city-project.mjs';
import {validateResourceManifest,validateCustomAsset} from './custom-assets.mjs';
import {validateBlock} from './editor-selection-model.mjs';
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
const stable=v=>JSON.stringify(ordered(v));
export const PROJECT_PACKAGE_SCHEMA='apulso-editor-project-v1';
export const MAX_PACKAGE_BYTES=192*1024*1024;
export const PHOTO_PACKAGE_LIMIT=96*1024*1024;
export function validatePrivatePhoto(p){
 if(!p||typeof p.mapKey!=='string'||typeof p.name!=='string'||p.name.length>300||!Array.isArray(p.position)||p.position.length!==2||!p.position.every(Number.isFinite)||!['width','height','scale','rotation','opacity','order'].every(k=>Number.isFinite(p[k]))||p.width<=0||p.height<=0||p.scale<=0||p.opacity<0||p.opacity>1||typeof p.image!=='string'||p.image.length>36*1024*1024||!/^data:image\/[a-z0-9.+-]+;base64,[a-zA-Z0-9+/]+=*$/i.test(p.image))throw Error('Hay una fotografía privada no válida.');return p;
}
export function validateProjectPackage(input){
 if(input?.schema!==PROJECT_PACKAGE_SCHEMA||input.formatVersion!==1||typeof input.projectMeta?.id!=='string'||input.projectMeta.id.length>150||!input.projectMeta.id||typeof input.projectMeta.name!=='string'||!input.projectMeta.name.trim()||input.projectMeta.name.length>100)throw Error('El archivo no es un proyecto completo compatible.');
 const resources=validateResourceManifest(input.resources||[]);for(const a of resources)validateCustomAsset(a,{imageRequired:true});const byId=new Map(resources.map(a=>[a.id,a]));
 validateCityBundle(input.city);
 for(const s of Object.values(input.city.project.brotherhoodSettings||{}))if(s.step&&!byId.has(s.step.assetId))throw Error('Falta la imagen de un paso de hermandad.');
 for(const d of Object.values(input.city.documents))for(const a of d.resources||[]){const top=byId.get(a.id);if(!top)throw Error('Falta una imagen utilizada por el mapa '+d.metadata.map);const {image,...meta}=top;const {image:_,...local}=a;if(stable(meta)!==stable(local))throw Error('Un recurso tiene definiciones distintas en el proyecto: '+a.name);}
 const templates=input.templates;if(!templates||templates.schema!=='apulso-template-library-v1'||!Array.isArray(templates.templates)||templates.templates.length>100)throw Error('El catálogo de plantillas no es válido.');
 const ids=new Set();for(const t of templates.templates){if(typeof t.id!=='string'||!/^template-[a-zA-Z0-9-]+$/.test(t.id)||t.id.length>120||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>100)throw Error('Hay plantillas repetidas o no válidas.');ids.add(t.id);validateBlock({...t.block,resources});}
 if(input.privatePhotos!==undefined){if(!Array.isArray(input.privatePhotos)||input.privatePhotos.length>6000)throw Error('Hay demasiadas fotografías en el proyecto.');let bytes=0;const perMap=new Map();for(const p of input.privatePhotos){validatePrivatePhoto(p);if(!input.city.documents[p.mapKey])throw Error('Una fotografía apunta a un mapa que no existe.');bytes+=p.image.length;perMap.set(p.mapKey,(perMap.get(p.mapKey)||0)+1);}if(bytes>PHOTO_PACKAGE_LIMIT*1.4||[...perMap.values()].some(n=>n>12))throw Error('Las fotografías superan el tamaño permitido para un proyecto.');}
 return input;
}
export function makeProjectPackage({meta,project,documents,templates=[],resources=[],privatePhotos}){
 const used=new Map(resources.map(a=>[a.id,a]));for(const d of Object.values(documents)){validateMapDocument(d);for(const a of d.resources||[])used.set(a.id,a)}for(const t of templates)for(const a of t.block.resources||[])used.set(a.id,a);
 const available=new Map(resources.map(a=>[a.id,a]));for(const id of used.keys()){const a=available.get(id);if(!a?.image)throw Error('Falta la imagen de un recurso del proyecto: '+id);used.set(id,a)}
 const docs=Object.fromEntries(Object.entries(documents).map(([key,doc])=>{const d=structuredClone(doc);delete d.reference;delete d.photos;delete d.photoGuides;d.resources=(doc.resources||[]).map(a=>{const {image,...metadata}=used.get(a.id)||a;return metadata});return[key,d]}));
 const packaged={schema:PROJECT_PACKAGE_SCHEMA,formatVersion:1,applicationVersion:'3.3.0',exportedAt:new Date().toISOString(),projectMeta:{id:meta.id,name:meta.name,createdAt:meta.createdAt},city:{schema:CITY_SCHEMA,project:structuredClone(project),documents:docs},resources:[...used.values()].map(a=>structuredClone(a)),templates:{schema:'apulso-template-library-v1',templates:structuredClone(templates).map(t=>({...t,block:{...t.block,resources:(t.block.resources||[]).map(({image,...a})=>a)}}))},...(privatePhotos!==undefined?{privatePhotos:structuredClone(privatePhotos)}:{})};
 return validateProjectPackage(packaged);
}
export function projectSummary(pkg){return{maps:pkg.city.project.maps.length,zones:pkg.city.project.zones.filter(z=>!z.whole).length,resources:pkg.resources.length,templates:pkg.templates.templates.length,photos:pkg.privatePhotos?.length||0}}
