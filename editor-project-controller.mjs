import {CITY_KEY,MAP_STORAGE_PREFIX,validateCityBundle} from './city-project.mjs';
import {GAME_PATCH_PREFIX,makeGameDraft} from './editor-game-draft.mjs';
import {listCustomAssets,replaceCustomAssetLibrary} from './custom-assets.mjs';
import {listTemplates,replaceTemplateLibrary} from './editor-template-library.mjs';
import {exportProjectPhotos,replaceProjectPhotos} from './editor-photo-guides.mjs';
import {makeProjectPackage,validateProjectPackage} from './editor-project-package.mjs';
import {readProjectMeta,writeProjectMeta,sameProjectSession,PROJECT_META_KEY,projectId} from './editor-project-session.mjs';
import {recordProjectVersion} from './editor-project-history.mjs';
export function createProjectController({storage=localStorage,getCity,getDocument,getBaseline,getMapKey,flushPhotos=async()=>{},onApplying=()=>{},onRestored=()=>{},adapters={}}){
 let session=readProjectMeta(storage),applying=false;
 if(!storage.getItem(PROJECT_META_KEY))session=writeProjectMeta(session,storage);
 const assets=adapters.replaceAssets||replaceCustomAssetLibrary,templates=adapters.replaceTemplates||replaceTemplateLibrary,photos=adapters.replacePhotos||replaceProjectPhotos,photoExport=adapters.exportPhotos||exportProjectPhotos,record=adapters.recordVersion||recordProjectVersion;
 const canWrite=()=>!applying&&sameProjectSession(session,storage);
 const assert=()=>{if(!canWrite())throw Error('Se ha abierto o restaurado otro proyecto. Recarga el editor para continuar sin sobrescribirlo.')};
 async function capture({includePhotos=false,name}={}){
  assert();const meta={...session,...(name?{name}:{})},city=structuredClone(getCity()),documents=Object.fromEntries(city.maps.map(m=>[m.key,structuredClone(getDocument(m.key))])),resources=structuredClone(listCustomAssets()),items=structuredClone(listTemplates());
  if(includePhotos)await flushPhotos();const privatePhotos=includePhotos?await photoExport(session.id,city.maps.map(m=>m.key)):undefined;assert();
  return makeProjectPackage({meta,project:city,documents,resources,templates:items,privatePhotos});
 }
 async function checkpoint(label,options={}){const pkg=await capture(options);return record(pkg,label,{automatic:!!options.automatic,force:!!options.force})}
 function rename(name){assert();session=writeProjectMeta({...session,name:String(name).trim()},storage);return session}
 async function apply(input,{restorePhotos=false,copy=false,label='Proyecto abierto'}={}){
  assert();let pkg=structuredClone(validateProjectPackage(input));if(copy)pkg.projectMeta={...pkg.projectMeta,id:'project-'+projectId(),name:(pkg.projectMeta.name+' · copia').slice(0,100),createdAt:new Date().toISOString()};
  const before=await capture({includePhotos:restorePhotos});await record(before,'Antes de '+label.toLowerCase(),{force:true});await record(pkg,label,{force:true});
  const previousMeta=session,targetPhotoBackup=restorePhotos&&pkg.privatePhotos!==undefined?await photoExport(pkg.projectMeta.id,pkg.city.project.maps.map(m=>m.key)):null;
  const writes=new Map();for(const [key,d]of Object.entries(pkg.city.documents)){writes.set(MAP_STORAGE_PREFIX+key,JSON.stringify(d));let base;try{base=getBaseline(key)}catch{base=null}writes.set(GAME_PATCH_PREFIX+key,JSON.stringify(makeGameDraft(d,base)));}writes.set(CITY_KEY,JSON.stringify(pkg.city.project));
  const beforeStorage=new Map([...writes.keys(),PROJECT_META_KEY].map(k=>[k,storage.getItem(k)]));let assetsDone=false,templatesDone=false,photosDone=false;
  applying=true;onApplying(true);
  try{
   await assets(pkg.resources);assetsDone=true;await templates(pkg.templates.templates,pkg.resources);templatesDone=true;
   if(targetPhotoBackup!==null){await photos(pkg.projectMeta.id,pkg.privatePhotos);photosDone=true}
   for(const [key,value]of writes)storage.setItem(key,value);session=writeProjectMeta({...pkg.projectMeta,createdAt:pkg.projectMeta.createdAt||new Date().toISOString()},storage);
  }catch(error){
   const failures=[];for(const [key,value]of [...beforeStorage].reverse())try{value===null?storage.removeItem(key):storage.setItem(key,value)}catch(e){failures.push(e.message)}
   try{if(assetsDone)await assets(before.resources);if(templatesDone)await templates(before.templates.templates,before.resources);if(photosDone)await photos(pkg.projectMeta.id,targetPhotoBackup)}catch(e){failures.push(e.message)}
   session=previousMeta;applying=false;onApplying(false);throw Error(failures.length?'La restauración falló. Hay una copia «Antes de…» en el historial para recuperar el proyecto.':'No se ha aplicado el proyecto: '+error.message+' Los datos anteriores se han conservado.');
  }
  const key=pkg.city.documents[getMapKey()]?getMapKey():pkg.city.project.maps[0]?.key;onRestored({meta:session,key,package:pkg});return{meta:session,key};
 }
 return{capture,checkpoint,apply,rename,canWrite,assert,meta:()=>({...session}),isApplying:()=>applying};
}
