// Vercel Serverless Function: publish approved map data to the GitHub-connected
// repository. Requires a fine-grained GitHub token provided by the repository
// owner for this one request. No token is persisted or logged.
'use strict';
import {validateResourceManifest,validateCustomObject} from '../custom-assets.mjs';
import {validSurface,validateTextureSettings} from '../map-geometry.mjs';
import {validateMapDocument} from '../city-project.mjs';
import {itemEdit,validateItemEdit} from '../editor-item-state.mjs';
const OWNER='realidad90fc-svg';
const REPO='a-pulso-cofrade-desarrollo';
const BASE='https://api.github.com';
const KEYS=new Set(['SalidaPureza','AltozanoPuente','CaminoCentro','CarreraOficial',
 'CatedralPostigo','RegresoArenal','AlemanesPlacentinesFrancos',
 ...Array.from({length:10},(_,i)=>'native-'+(i+1))]);
const KINDS=['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs','labels','urban','customObjects'];
const MAX_BODY=3_600_000;
function fail(message,status=400){const e=new Error(message);e.status=status;throw e}
function point(v){return Array.isArray(v)&&v.length>=2&&v.slice(0,2).every(n=>Number.isFinite(n)&&Math.abs(n)<=10000)?v.slice(0,2):fail('Hay coordenadas fuera de rango.')}
function number(n,def,lo=-10000,hi=10000){if(n===undefined||n===null)return def;return Number.isFinite(n)&&n>=lo&&n<=hi?n:fail('Hay un número fuera de rango.')}
function string(v,max=100){return typeof v==='string'&&v.length<=max?v:fail('El diseño contiene un texto inválido.')}
function poly(v){
 if(!Array.isArray(v)||v.length<3||v.length>2000)fail('Hay un polígono inválido o demasiado grande.');
 return v.map(point);
}
function item(v,kind){
 const result=cleanItem(v,kind);try{validateItemEdit(v)}catch(e){fail(e.message)}
 const meta=itemEdit(v),keys=['groupId','groupName','groupAngle','angle','locked','resized'];
 if(keys.some(k=>meta[k]!==undefined))Object.assign(itemEdit(result,true),Object.fromEntries(keys.filter(k=>meta[k]!==undefined).map(k=>[k,meta[k]])));
 if(v.size!==undefined&&!Array.isArray(v)&&kind!=='customObjects'){if(!Array.isArray(v.size)||v.size.length!==2||!v.size.every(n=>Number.isFinite(n)&&n>=.01&&n<=100))fail('Medidas del objeto no válidas.');result.size=[...v.size]}
 return result;
}
function cleanItem(v,kind){
 if(kind==='labels'){
  if(!Array.isArray(v)||v.length<2||v.length>3)fail('El punto de calle tiene un formato inválido.');
  const name=string(v[0],90).trim();
  if(!name)fail('El nombre de calle no puede estar vacío.');
  const result=[name,point(v[1])];
  if(v[2]!==undefined){
   if(!v[2]||typeof v[2]!=='object'||Array.isArray(v[2]))fail('La configuración del punto de calle no es válida.');
   result.push({radius:number(v[2].radius,1,.2,5)});
  }
  return result;
 }
 if(!v||typeof v!=='object'||Array.isArray(v))fail('Elemento de mapa inválido.');
 if(['roads','sidewalks','houses'].includes(kind)){
  const result={poly:poly(v.poly)};
  if(v.holes!==undefined){if(!Array.isArray(v.holes)||v.holes.length>200)fail('Patios no válidos.');result.holes=v.holes.map(poly);if(!validSurface(result))fail('El contorno de un patio no es válido.');}
  if(v.texture!==undefined){try{result.texture=validateTextureSettings(v.texture)}catch(error){fail(error.message)}}
  if(v.material!==undefined)result.material=string(v.material,80);
   if(kind==='houses'&&v.roofInset!==undefined)result.roofInset=number(v.roofInset,.05,.025,.3);
   if(kind==='houses'&&v.roofSimplify!==undefined)result.roofSimplify=Boolean(v.roofSimplify);
   if(kind==='houses'&&v.roofSeed!==undefined)result.roofSeed=number(v.roofSeed,0,0,4294967295);
  if(kind==='houses'){
   if(v.key!==undefined)result.key=string(v.key,100);
   if(v.kind!==undefined)result.kind=string(v.kind,80);
   if(v.roofDetail!==undefined)result.roofDetail=string(v.roofDetail,40);
   if(v.roofBorder!==undefined)result.roofBorder=string(v.roofBorder,60);
   if(v.facade!==undefined){
    if(!v.facade||typeof v.facade!=='object'||Array.isArray(v.facade))fail('Fachada inválida.');
    const f=v.facade;result.facade={};
    for(const key of ['shop','awning','awningColor','awningPreset','balcony','bladeSign'])if(f[key]!==undefined)result.facade[key]=string(f[key],80);
    if(f.sign!==undefined)result.facade.sign=string(f.sign,100);
    for(const key of ['edge','awningDepth','awningStart','awningWidth'])if(f[key]!==undefined)result.facade[key]=number(f[key],0,0,key==='edge'?10000:20);
    for(const key of ['bladePosition','bladeDepth','bladeSize'])if(f[key]!==undefined)result.facade[key]=number(f[key],key==='bladePosition'?.22:key==='bladeDepth'?.65:.6,key==='bladePosition'?.05:.25,key==='bladePosition'?.95:key==='bladeDepth'?1.5:1);
   }
  }
  return result;
 }
 if(kind==='people'){
  const result={point:point(v.point),key:string(v.key,100)};
  if(v.size!==undefined)result.size=point(v.size).map(n=>Math.max(.01,n));
  if(v.angle!==undefined)result.angle=number(v.angle,0,-360,360);
  return result;
 }
 if(kind==='customObjects'){try{return validateCustomObject(v)}catch(error){fail(error.message)}}
 if(kind==='trees'){
  const result={point:point(v.point),radius:number(v.radius,.35,.05,2)};
  if(v.variant!==undefined)result.variant=string(v.variant,50);
  if(v.scale!==undefined)result.scale=number(v.scale,1,.1,4);
  if(v.rotation!==undefined)result.rotation=number(v.rotation,0,-360,360);
  return result;
 }
 if(kind==='urban'){
  const types=new Set(['crosswalk','raised-crosswalk','stop-line','lamp-sevilla','lamp-modern','traffic-light','pedestrian-light','crossing-sign','bollard','bench','bin','planter','bike-rack','bus-shelter','tree-grille']);
  const type=string(v.type,45);
  if(!types.has(type))fail('Tipo de mobiliario urbano no reconocido.');
  return{type,point:point(v.point),angle:number(v.angle,0,-360,360),
   width:number(v.width,3,1.5,12),depth:number(v.depth,2.6,1,6)};
 }
 if(kind==='signs'){
  return{point:point(v.point),type:string(v.type||'traffic',50),angle:number(v.angle,0,-360,360)};
 }
 if(kind==='checkpoints'){
  return{position:point(v.position),id:string(v.id||'custom',100),
   name:string(v.name||v.id||'Checkpoint',150),
   angle:number(v.angle,0,-360,360),radius:number(v.radius,.65,.2,3),...(v.mandatory!==undefined?{mandatory:!!v.mandatory}:{}),...(v.finish!==undefined?{finish:!!v.finish}:{})};
 }
 if(kind==='fences'||kind==='chairs'){
  return{point:point(v.point),angle:number(v.angle,0,-360,360),
   width:number(v.width,kind==='fences'?.95:.40,.02,100),...(v.depth!==undefined?{depth:number(v.depth,kind==='fences'?.18:.43,.02,100)}:{})};
 }
 fail('Tipo de elemento desconocido.');
}
function cleanArray(v,kind){
 if(!Array.isArray(v))fail('Falta la capa '+kind+'.');
 const limit=kind==='people'?12000:kind==='roads'?4000:kind==='houses'?7000:kind==='sidewalks'?9000:kind==='checkpoints'?500:kind==='labels'?600:kind==='urban'?4000:6000;
 if(v.length>limit)fail('La capa '+kind+' supera el máximo permitido.');
 return v.map(x=>item(x,kind));
}
function sanitize(body){
 const v=body?.draft;
 const key=body?.mapKey;
 if(!KEYS.has(key)||!v||v.schema!=='apulso-game-draft-v1'||v.mapKey!==key)fail('Mapa o formato de publicación no válido.',422);
 const layers={};
 for(const kind of KINDS)layers[kind]=cleanArray((kind==='labels'||kind==='urban'||kind==='customObjects')?(v.layers?.[kind]||[]):v.layers?.[kind],kind);
 let resources;try{resources=validateResourceManifest(v.resources||[])}catch(error){fail(error.message)}
 if(resources.some(a=>!a.image))fail('La publicación debe incluir las imágenes de los recursos propios.');
 const modified=KINDS.reduce((n,k)=>n+layers[k].length,0);
 const labelScene=v.labelScene===undefined||v.labelScene===null?null:cleanArray(v.labelScene,'labels');
 const hasStart=Object.hasOwn(v,'startPose');
 let startPose=null;
 if(hasStart&&v.startPose!==null){
  if(!v.startPose||typeof v.startPose!=='object'||Array.isArray(v.startPose)||!['x','y','angle'].every(k=>typeof v.startPose[k]==='number'&&Number.isFinite(v.startPose[k])))
   fail('Posición inicial inválida.',422);
  startPose={x:number(v.startPose.x,0,-2000,2000),y:number(v.startPose.y,0,-2000,2000),angle:number(v.startPose.angle,0,-360000,360000)};
 }
 const scene={};
 if(v.arenalScene!==undefined&&v.arenalScene!==null){
  if(key!=='RegresoArenal'||typeof v.arenalScene!=='object'||Array.isArray(v.arenalScene))fail('Geometría detallada no válida.',422);
  for(const kind of ['roads','sidewalks','houses','people'])
   if(Object.hasOwn(v.arenalScene,kind))scene[kind]=cleanArray(v.arenalScene[kind],kind);
 }
 const removals=labelScene!==null||Object.keys(scene).length?number(v.total,modified,0,20000)-modified:0;
 if(!modified&&removals<=0&&!hasStart&&!v.authoringScene)fail('No hay cambios para publicar. Edita un elemento o elimina alguno.',422);
 const draft={schema:'apulso-game-draft-v1',mapKey:key,createdAt:new Date().toISOString(),
  layers,resources,total:Math.max(1,modified+Math.max(0,removals)+(hasStart?1:0)),arenalScene:key==='RegresoArenal'?scene:null,labelScene,...(hasStart?{startPose}:{})};
 if(v.authoringScene!==undefined){
  if(!/^native-\d+$/.test(key)||!v.authoringScene||typeof v.authoringScene!=='object')fail('Escena completa no válida.');
  const input=v.authoringScene,authored={schema:'apulso-universal-editor-v2',metadata:{mapKey:key,map:string(input.metadata?.map||key,100),sourceType:'native',inheritNativeLimits:true,precisionGeometry:true},resources:resources.map(({image,...a})=>a)};
  for(const kind of KINDS)authored[kind]=cleanArray(input[kind]||[],kind);
  if(!authored.checkpoints.some(cp=>cp.finish))fail('Marca un checkpoint como llegada antes de publicar este mapa.');
  const pose=input.startPose||input.paso;if(!pose)fail('Falta la salida de la escena completa.');authored.paso={x:number(pose.x,0,-2000,2000),y:number(pose.y,0,-2000,2000),angle:number(pose.angle,0,-360000,360000)};
  if(input.bounds!==undefined)authored.bounds=input.bounds;
  try{validateMapDocument(authored)}catch(error){fail(error.message)}draft.authoringScene=authored;
 }
 const available=new Set(resources.map(a=>a.id));for(const group of [layers,scene])for(const kind of KINDS)for(const o of group[kind]||[]){const id=o.assetId||(o.material?.startsWith('asset-')?o.material:null);if(id&&!available.has(id))fail('Falta una imagen utilizada en el mapa.');}
 if(Buffer.byteLength(JSON.stringify(draft))>MAX_BODY)fail('El mapa supera el tamaño máximo de publicación.',413);
 return draft;
}
async function github(path,token,options={}){
 const response=await fetch(BASE+path,{...options,headers:{
  Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
  'X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})
 }});
 let body={};try{body=await response.json()}catch{}
 return{ok:response.ok,status:response.status,body};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Usa el botón Publicar mapa del editor.'})}
 try{
  const origin=req.headers.origin;
  if(origin&&new URL(origin).host!==(req.headers['x-forwarded-host']||req.headers.host))
   fail('Publicación rechazada desde otro sitio.',403);
  const authorization=String(req.headers.authorization||'');
  const token=/^Bearer\s+([a-zA-Z0-9_\-]+)$/.exec(authorization)?.[1];
  if(!token||token.length>300)fail('Introduce un token de GitHub de acceso restringido al repositorio.',401);
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||Buffer.byteLength(JSON.stringify(body))>MAX_BODY)fail('El archivo del mapa es demasiado grande.',413);
  const draft=sanitize(body);
  const profile=await github('/user',token);
  if(!profile.ok)fail('GitHub no ha aceptado la autorización.',401);
  if(profile.body.login!==OWNER)fail('Solo la cuenta propietaria de GitHub puede publicar mapas.',403);
  const pathname='published-maps/'+draft.mapKey+'.json',apiPath='/repos/'+OWNER+'/'+REPO+'/contents/'+pathname;
  const previous=await github(apiPath,token);
  if(!previous.ok&&previous.status!==404)fail('No se pudo consultar el mapa anterior en GitHub.',502);
  const payload={message:'Publicar mapa '+draft.mapKey+' desde editor A Pulso',
   content:Buffer.from(JSON.stringify(draft,null,2)+'\n','utf8').toString('base64'),branch:'main'};
  if(previous.ok)payload.sha=previous.body.sha;
  const commit=await github(apiPath,token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!commit.ok){
   if(commit.status===409)fail('Otro cambio se publicó a la vez. Vuelve a intentarlo.',409);
   if(commit.status===403||commit.status===401)fail('El token necesita permiso Contents: Read and write en este repositorio.',403);
   fail('GitHub no ha aceptado la publicación. Comprueba los permisos del token.',502);
  }
  return res.status(200).json({ok:true,mapKey:draft.mapKey,commit:commit.body.commit?.sha,
   url:commit.body.content?.html_url||'https://github.com/'+OWNER+'/'+REPO+'/blob/main/'+pathname,
   message:'Publicación enviada a GitHub. Vercel tiene que terminar el despliegue antes de que sea pública.'});
 }catch(error){
  return res.status(error.status||500).json({error:error.status?error.message:'No se pudo publicar el mapa. Comprueba la conexión e inténtalo de nuevo.'});
 }
};
