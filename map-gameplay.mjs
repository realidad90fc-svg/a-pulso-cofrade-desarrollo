import {validateHeightProfiles} from './overhead-elements.mjs';
// Optional authoring data. An absent configuration preserves the original game.
import {validPoint,validSurface} from './map-geometry.mjs';
export const EVENT_TYPES={entry:'Entrada',checkpoint:'Punto de control',presentation:'Presentación',announcement:'Anuncio de calle',exit:'Salida a otro mapa',finish:'Llegada'};
export const COLLISION_TYPES={walkable:'Suelo transitable',blocked:'Zona bloqueada',boundary:'Límite del mapa'};
export const newId=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
const number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const text=(s,max=150)=>typeof s==='string'&&s.length<=max;
export function validateGameplay(g){
 if(g===undefined)return;
 if(!g||typeof g!=='object'||Array.isArray(g))throw Error('Configuración jugable no válida.');
 validateHeightProfiles(g.heightProfiles);
 const c=g.collision;
 if(c!==undefined){
  if(!c||!['inherit','replace'].includes(c.mode)||!Array.isArray(c.zones)||c.zones.length>500)throw Error('Configuración de colisiones no válida.');
  const ids=new Set();for(const z of c.zones){
   if(!z||!text(z.id)||!z.id||ids.has(z.id)||!text(z.name)||!Object.hasOwn(COLLISION_TYPES,z.kind)||!validSurface(z)||z.poly.length>1000||typeof z.enabled!=='boolean')throw Error('Hay una zona de colisión no válida.');ids.add(z.id);
  }
 }
 const r=g.route;if(r!==undefined){
  if(!r||typeof r.enabled!=='boolean'||typeof r.ordered!=='boolean'||!Array.isArray(r.events)||r.events.length>500||!number(r.threeStars,1,86400)||!number(r.twoStars,r.threeStars,86400))throw Error('Configura tiempos válidos: dos estrellas debe ser igual o mayor que tres estrellas.');
  const ids=new Set();for(const e of r.events){
   if(!e||!text(e.id)||!e.id||ids.has(e.id)||!Object.hasOwn(EVENT_TYPES,e.type)||!text(e.name)||!validPoint(e.position)||!number(e.radius,.2,10)||!number(e.hold,0,120)||!number(e.tolerance,0,180)||(e.heading!==null&&!number(e.heading,-360000,360000))||typeof e.mandatory!=='boolean'||typeof e.lowered!=='boolean'||!text(e.targetMap)||!text(e.targetEntry))throw Error('Hay un acontecimiento con datos no válidos.');
   if(e.type==='exit'&&!e.targetMap)throw Error('Selecciona el mapa de destino de la salida.');ids.add(e.id);
  }
  if(r.events.filter(e=>e.type==='finish').length>1)throw Error('Solo puede haber una llegada por mapa.');
 }
}
export function defaultGameplay(){return{collision:{mode:'inherit',zones:[]},route:{enabled:false,ordered:true,threeStars:660,twoStars:840,events:[]}}}
export function newRouteEvent(type,position){return{id:newId('event'),type,name:EVENT_TYPES[type],position:[...position],radius:.8,hold:type==='presentation'?2:0,mandatory:['presentation','checkpoint'].includes(type),lowered:['presentation','finish'].includes(type),heading:null,tolerance:20,targetMap:'',targetEntry:''}}
export function gameplayOf(doc){return{...defaultGameplay(),...doc?.gameplay,collision:{...defaultGameplay().collision,...doc?.gameplay?.collision},route:{...defaultGameplay().route,...doc?.gameplay?.route}}}
export function hasGameplay(g){return!!g&&(g.collision?.mode==='replace'||!!g.collision?.zones?.length||!!g.route?.enabled||!!g.heightProfiles?.length)}

// Whitelist gameplay data before a public export; arbitrary imported keys are never published.
export function cleanGameplay(g){
 if(g===undefined)return undefined;validateGameplay(g);const out={};if(g.heightProfiles)out.heightProfiles=g.heightProfiles.map(p=>({id:p.id,standing:p.standing,crouched:p.crouched,lowered:p.lowered}));
 if(g.collision)out.collision={mode:g.collision.mode,zones:g.collision.zones.map(z=>({id:z.id,name:z.name,kind:z.kind,enabled:z.enabled,poly:z.poly.map(p=>p.slice(0,2)),...(z.holes?{holes:z.holes.map(r=>r.map(p=>p.slice(0,2)))}:{})}))};
 if(g.route)out.route={enabled:g.route.enabled,ordered:g.route.ordered,threeStars:g.route.threeStars,twoStars:g.route.twoStars,events:g.route.events.map(e=>Object.fromEntries(['id','type','name','position','radius','hold','mandatory','lowered','heading','tolerance','targetMap','targetEntry'].map(k=>[k,k==='position'?e.position.slice(0,2):e[k]])))};
 return out;
}
