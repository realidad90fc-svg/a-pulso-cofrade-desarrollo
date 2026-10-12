// Vercel Serverless Function: publish approved map data to the GitHub-connected
// repository. Requires a fine-grained GitHub token provided by the repository
// owner for this one request. No token is persisted or logged.
'use strict';
const OWNER='realidad90fc-svg';
const REPO='a-pulso-cofrade-desarrollo';
const BASE='https://api.github.com';
const KEYS=new Set(['SalidaPureza','AltozanoPuente','CaminoCentro','CarreraOficial',
 'CatedralPostigo','RegresoArenal','AlemanesPlacentinesFrancos',
 ...Array.from({length:10},(_,i)=>'native-'+(i+1))]);
const KINDS=['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs'];
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
 if(!v||typeof v!=='object'||Array.isArray(v))fail('Elemento de mapa inválido.');
 if(['roads','sidewalks','houses'].includes(kind)){
  const result={poly:poly(v.poly)};
  if(v.material!==undefined)result.material=string(v.material,80);
  if(kind==='houses'){
   if(v.key!==undefined)result.key=string(v.key,100);
   if(v.kind!==undefined)result.kind=string(v.kind,80);
  }
  return result;
 }
 if(kind==='people'){
  const result={point:point(v.point),key:string(v.key,100)};
  if(v.size!==undefined)result.size=point(v.size).map(n=>Math.max(.01,n));
  return result;
 }
 if(kind==='trees'){
  const result={point:point(v.point),radius:number(v.radius,.35,.05,2)};
  if(v.variant!==undefined)result.variant=string(v.variant,50);
  if(v.scale!==undefined)result.scale=number(v.scale,1,.1,4);
  if(v.rotation!==undefined)result.rotation=number(v.rotation,0,-360,360);
  return result;
 }
 if(kind==='signs'){
  return{point:point(v.point),type:string(v.type||'traffic',50)};
 }
 if(kind==='checkpoints'){
  return{position:point(v.position),id:string(v.id||'custom',100),
   name:string(v.name||v.id||'Checkpoint',150),
   angle:number(v.angle,0,-360,360),radius:number(v.radius,.65,.2,3)};
 }
 if(kind==='fences'||kind==='chairs'){
  return{point:point(v.point),angle:number(v.angle,0,-360,360),
   width:number(v.width,kind==='fences'?.95:.40,.1,3)};
 }
 fail('Tipo de elemento desconocido.');
}
function cleanArray(v,kind){
 if(!Array.isArray(v))fail('Falta la capa '+kind+'.');
 const limit=kind==='people'?12000:kind==='roads'?4000:kind==='houses'?7000:kind==='sidewalks'?9000:kind==='checkpoints'?500:6000;
 if(v.length>limit)fail('La capa '+kind+' supera el máximo permitido.');
 return v.map(x=>item(x,kind));
}
function sanitize(body){
 const v=body?.draft;
 const key=body?.mapKey;
 if(!KEYS.has(key)||!v||v.schema!=='apulso-game-draft-v1'||v.mapKey!==key)fail('Mapa o formato de publicación no válido.',422);
 const layers={};
 for(const kind of KINDS)layers[kind]=cleanArray(v.layers?.[kind],kind);
 const modified=KINDS.reduce((n,k)=>n+layers[k].length,0);
 const scene={};
 if(v.arenalScene!==undefined&&v.arenalScene!==null){
  if(key!=='RegresoArenal'||typeof v.arenalScene!=='object'||Array.isArray(v.arenalScene))fail('Geometría detallada no válida.',422);
  for(const kind of ['roads','sidewalks','houses','people'])
   if(Object.hasOwn(v.arenalScene,kind))scene[kind]=cleanArray(v.arenalScene[kind],kind);
 }
 const removals=key==='RegresoArenal'&&Object.keys(scene).length?number(v.total,modified,0,20000)-modified:0;
 if(!modified&&removals<=0)fail('No hay cambios para publicar. Edita un elemento o elimina alguno.',422);
 const draft={schema:'apulso-game-draft-v1',mapKey:key,createdAt:new Date().toISOString(),
  layers,total:modified+Math.max(0,removals),arenalScene:key==='RegresoArenal'?scene:null};
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
