// User-owned raster resources. Images live once in IndexedDB; map storage holds
// small manifests. Portable exports/publication explicitly embed the used bytes.
import {registerTexture,textureImage} from './seville-textures.mjs';
export const ASSET_CATEGORIES=[['roads','Textura de calzada'],['sidewalks','Textura de acera'],['houses','Textura de tejado'],['trees','Árbol o vegetación'],['fences','Valla'],['chairs','Silla'],['urban','Mobiliario urbano'],['decor','Otro objeto o decoración']];
const categories=new Set(ASSET_CATEGORIES.map(([id])=>id)),records=new Map(),imageJobs=new Map();
let dbJob=null,catalogueJob=null;
const clone=o=>structuredClone(o),finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
export const isAssetId=id=>typeof id==='string'&&/^asset-[a-zA-Z0-9-]{1,100}$/.test(id);
export const isSurfaceAsset=a=>['roads','sidewalks','houses'].includes(a?.category);
export const assetById=id=>records.get(id)||null;
export const listCustomAssets=()=>[...records.values()].sort((a,b)=>a.name.localeCompare(b.name,'es'));
export function validateCustomAsset(input,{imageRequired=false}={}){
 if(!input||!isAssetId(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||!categories.has(input.category))throw Error('El recurso necesita nombre y categoría válidos.');
 if(!finite(input.width,.02,100)||!finite(input.depth,.02,100)||!finite(input.angle??0,-360,360))throw Error('Las medidas deben estar entre 0,02 y 100 metros y el giro entre −360 y 360°.');
 const c=input.collision||{kind:'none'};if(!['none','box','circle'].includes(c.kind))throw Error('Tipo de colisión no válido.');
 const collision={kind:c.kind};
 if(c.kind==='box'){
  if(!finite(c.width,.02,100)||!finite(c.depth,.02,100))throw Error('Define el ancho y el fondo de la colisión.');
  collision.width=c.width;collision.depth=c.depth;
 }
 if(c.kind==='circle'){if(!finite(c.radius,.01,50))throw Error('Define un radio de colisión válido.');collision.radius=c.radius}
 const result={id:input.id,name:input.name.trim(),category:input.category,width:input.width,depth:input.depth,angle:input.angle||0,collision};
 if(input.image!==undefined){
  if(typeof input.image!=='string'||input.image.length>1600000||!/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(input.image))throw Error('La imagen del recurso no es válida o es demasiado grande.');
  result.image=input.image;
 }else if(imageRequired)throw Error('Selecciona una imagen PNG, WebP o JPEG.');
 return result;
}
export function validateResourceManifest(resources=[]){
 if(!Array.isArray(resources)||resources.length>500)throw Error('El catálogo del mapa no es válido o supera 500 recursos.');
 const seen=new Set();return resources.map(input=>{const a=validateCustomAsset(input);if(seen.has(a.id))throw Error('Hay recursos con el mismo identificador.');seen.add(a.id);return a});
}
function database(){
 if(dbJob)return dbJob;
 if(!globalThis.indexedDB)return Promise.reject(Error('Este dispositivo no permite guardar imágenes del catálogo.'));
 dbJob=new Promise((resolve,reject)=>{
  const request=indexedDB.open('apulso-custom-assets-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('resources',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('No se pudo abrir el catálogo de imágenes.'));
  request.onblocked=()=>reject(Error('Cierra otras pestañas del editor para abrir el catálogo.'));
 }).catch(error=>{dbJob=null;throw error});return dbJob;
}
async function storeRecords(items){
 if(!items.length)return;
 const db=await database();await new Promise((resolve,reject)=>{
  const tx=db.transaction('resources','readwrite');for(const item of items)tx.objectStore('resources').put(item);
  tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('No se pudo guardar la imagen. Exporta los recursos antes de cerrar.'));
 });
}
function decodeImage(src,{resource=false}={}){
 return new Promise((resolve,reject)=>{
  const image=new Image(),timer=setTimeout(()=>reject(Error('La imagen ha tardado demasiado en cargar.')),15000);
  image.onload=()=>{clearTimeout(timer);if(resource&&Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height)>1024){reject(Error('La imagen del catálogo supera 1024 píxeles. Impórtala con Seleccionar imagen para adaptarla.'));return}resolve(image)};image.onerror=()=>{clearTimeout(timer);reject(Error('No se pudo leer la imagen del recurso.'))};image.src=src;
 });
}
async function loadResourceImage(asset){
 if(!asset.image||typeof Image==='undefined')return;
 const previous=imageJobs.get(asset.id);if(previous?.source===asset.image)return previous.promise;
 const promise=decodeImage(asset.image,{resource:true}).then(image=>registerTexture(asset.id,image));
 imageJobs.set(asset.id,{source:asset.image,promise});return promise;
}
export async function initializeCustomAssets(){
 if(catalogueJob)return catalogueJob;
 if(!globalThis.indexedDB)return;
 catalogueJob=(async()=>{
  const db=await database(),all=await new Promise((resolve,reject)=>{const r=db.transaction('resources').objectStore('resources').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('No se pudo leer el catálogo.'))});
  for(const item of all){const a=validateCustomAsset(item,{imageRequired:true});records.set(a.id,a)}
  await Promise.all([...records.values()].map(loadResourceImage));
 })().catch(error=>{catalogueJob=null;throw error});return catalogueJob;
}
// Registration is synchronous; callers can immediately export an imported map.
export function registerCustomAssets(resources=[]){
 for(const input of validateResourceManifest(resources)){
  const old=records.get(input.id);records.set(input.id,{...input,...(!input.image&&old?.image?{image:old.image}:{})});
 }
}
export async function loadDocumentAssets(doc,{persist=false}={}){
 await initializeCustomAssets();
 const staged=new Map(records);
 for(const a of validateResourceManifest(doc.resources||[])){const old=staged.get(a.id);staged.set(a.id,{...a,...(!a.image&&old?.image?{image:old.image}:{})})}
 const selected=manifestFrom(doc,true,staged),decoded=new Array(selected.length);let next=0;
 await Promise.all(Array.from({length:Math.min(4,selected.length)},async()=>{while(next<selected.length){const index=next++,a=selected[index];decoded[index]=imageJobs.get(a.id)?.source===a.image?null:await decodeImage(a.image,{resource:true})}}));
 if(persist)await storeRecords(selected);
 // A corrupt image or a full disk leaves the existing catalogue untouched.
 for(const [index,a]of selected.entries()){records.set(a.id,a);if(decoded[index]){registerTexture(a.id,decoded[index]);imageJobs.set(a.id,{source:a.image,promise:Promise.resolve()})}}
}
export async function saveCustomAsset(input){
 return(await saveCustomAssets([input]))[0];
}
export async function saveCustomAssets(inputs){
 const normalized=validateResourceManifest(inputs).map(a=>validateCustomAsset(a,{imageRequired:true}));
 // Decode the batch before one transaction. An invalid file cannot partially
 // replace an existing catalogue, including when resource IDs are reused.
 const decoded=new Array(normalized.length);let next=0;
 await Promise.all(Array.from({length:Math.min(4,normalized.length)},async()=>{while(next<normalized.length){const index=next++;decoded[index]=await decodeImage(normalized[index].image,{resource:true})}}));
 await storeRecords(normalized);
 for(const [index,asset]of normalized.entries()){records.set(asset.id,asset);imageJobs.delete(asset.id);registerTexture(asset.id,decoded[index])}return normalized;
}
export async function importCustomRaster(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20000000)throw Error('Selecciona PNG, WebP o JPEG de hasta 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const image=await decodeImage('data:'+file.type+';base64,'+btoa(raw));
 const ratio=Math.min(1,1024/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round((image.naturalWidth||image.width)*ratio));c.height=Math.max(1,Math.round((image.naturalHeight||image.height)*ratio));
 const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,c.width,c.height);
 const source=c.toDataURL('image/webp',.90);if(source.length>1600000)throw Error('La imagen sigue siendo demasiado grande. Reduce su resolución antes de importarla.');
 return{image:source,aspect:c.width/c.height};
}
export function resourceManifest(doc,embed=false){
 return manifestFrom(doc,embed,records);
}
function manifestFrom(doc,embed,catalogue){
 const ids=new Set((doc.customObjects||[]).map(o=>o.assetId));
 for(const kind of ['roads','sidewalks','houses'])for(const o of doc[kind]||[])if(isAssetId(o.material))ids.add(o.material);
 return[...ids].map(id=>{
  const stored=catalogue.get(id),supplied=(doc.resources||[]).find(a=>a.id===id),source=stored?.image?stored:supplied?.image?supplied:stored||supplied;
  if(!source)throw Error('No se encuentra el recurso '+id+'. Importa el mapa con sus imágenes.');
  const asset=validateCustomAsset(source,{imageRequired:embed});if(!embed)delete asset.image;return asset;
 });
}
export function lightweightDocument(doc){return{...doc,resources:resourceManifest(doc,false)}}
export function embedDocumentAssets(doc){return{...clone(doc),resources:resourceManifest(doc,true)}}
export function customAssetMaterial(id){
 const a=assetById(id);return a?{id:a.id,name:a.name,assetId:a.id,pattern:'custom',base:'#b7b0a1',light:'#d7d0c1',width:a.width,depth:a.depth,angle:a.angle}:null;
}
export function newCustomObject(asset,point){
 return{assetId:asset.id,point:[...point],width:asset.width,depth:asset.depth,angle:asset.angle||0,collision:clone(asset.collision||{kind:'none'})};
}
export function customObjectBounds(item){
 const a=assetById(item.assetId),w=item.width||a?.width||1,d=item.depth||a?.depth||1,r=(item.angle||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,y])=>[item.point[0]+x*c-y*s,item.point[1]+x*s+y*c]);
}
export function customObjectContains(item,p,tolerance=0){
 const a=assetById(item.assetId),r=(item.angle||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),dx=p[0]-item.point[0],dy=p[1]-item.point[1];
 return Math.abs(dx*c+dy*s)<=(item.width||a?.width||1)/2+tolerance&&Math.abs(-dx*s+dy*c)<=(item.depth||a?.depth||1)/2+tolerance;
}
export function customObjectCollider(item){
 const a=assetById(item.assetId),collision=item.collision||a?.collision||{kind:'none'};if(collision.kind==='none')return null;
 if(collision.kind==='circle')return Array.from({length:24},(_,i)=>[item.point[0]+Math.cos(i*Math.PI/12)*collision.radius,item.point[1]+Math.sin(i*Math.PI/12)*collision.radius]);
 return customObjectBounds({...item,width:collision.width,depth:collision.depth});
}
export function validateCustomObject(o){
 if(!o||!isAssetId(o.assetId)||!Array.isArray(o.point)||!o.point.slice(0,2).every(n=>finite(n,-100000,100000))||o.point.length<2||!finite(o.width,.02,100)||!finite(o.depth,.02,100)||!finite(o.angle??0,-360000,360000))throw Error('Objeto importado no válido.');
 const collision=validateCustomAsset({id:o.assetId,name:'Objeto',category:'decor',width:o.width,depth:o.depth,angle:0,collision:o.collision}).collision;
 return{assetId:o.assetId,point:o.point.slice(0,2),width:o.width,depth:o.depth,angle:o.angle||0,collision};
}
export function drawCustomObject(ctx,item,pixel,zoom,selected=false){
 const a=assetById(item.assetId),image=textureImage(item.assetId),p=pixel(...item.point),w=(item.width||a?.width||1)*zoom,d=(item.depth||a?.depth||1)*zoom;
 ctx.save();ctx.translate(...p);ctx.rotate(-(item.angle||0)*Math.PI/180);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 if(image)ctx.drawImage(image,-w/2,-d/2,w,d);
 else{ctx.fillStyle='rgba(153,64,122,.55)';ctx.fillRect(-w/2,-d/2,w,d);ctx.strokeStyle='#f4afcf';ctx.lineWidth=.025*zoom;ctx.strokeRect(-w/2,-d/2,w,d)}
 if(selected){ctx.strokeStyle='#51ebef';ctx.lineWidth=2;ctx.strokeRect(-w/2-3,-d/2-3,w+6,d+6)}ctx.restore();
}
