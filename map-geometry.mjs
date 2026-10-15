// Authoring geometry is shared with drawing and physics. A surface keeps its
// original outer ring (poly); optional holes are real empty regions everywhere.
import clipping from './assets/vendor/polygon-clipping.mjs';
const EPS=1e-8;
export const validPoint=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(n=>Number.isFinite(n)&&Math.abs(n)<=100000);
export const surfaceRings=o=>[Array.isArray(o)?o:o.poly,...(Array.isArray(o)?[]:o.holes||[])];
export const ringArea=p=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1]},0)/2;
export const surfaceArea=o=>Math.abs(ringArea(o.poly))-(o.holes||[]).reduce((s,r)=>s+Math.abs(ringArea(r)),0);
export function validateTextureSettings(t){
 if(t===undefined)return;
 if(!t||!Number.isFinite(t.width)||!Number.isFinite(t.depth)||t.width<.02||t.depth<.02||t.width>100||t.depth>100||!Number.isFinite(t.angle)||Math.abs(t.angle)>360000||!['repeat','stretch'].includes(t.mode))throw Error('Las medidas, el giro o la repetición de textura no son válidos.');
 return{width:t.width,depth:t.depth,angle:t.angle,mode:t.mode};
}
export function nearestOnSegment(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
 return[a[0]+t*dx,a[1]+t*dy];
}
export function inRing(p,ring,boundary=true){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i],q=nearestOnSegment(p,a,b);
  if(Math.hypot(p[0]-q[0],p[1]-q[1])<EPS)return boundary;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
export const inSurface=(p,o)=>!!o&&inRing(p,Array.isArray(o)?o:o.poly)&&!(o.holes||[]).some(r=>inRing(p,r));
export function traceSurface(ctx,o,pixel){
 ctx.beginPath();for(const ring of surfaceRings(o)){ring.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath()}
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function edgesCross(a,b,c,d){
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 return x*y< -EPS&&z*w< -EPS;
}
function edgesTouch(a,b,c,d){
 if(edgesCross(a,b,c,d))return true;
 return [[a,c,d],[b,c,d],[c,a,b],[d,a,b]].some(([p,x,y])=>{const q=nearestOnSegment(p,x,y);return Math.hypot(p[0]-q[0],p[1]-q[1])<EPS});
}
export function validRing(ring){
 if(!Array.isArray(ring)||ring.length<3||ring.length>10000||!ring.every(validPoint)||Math.abs(ringArea(ring))<.00001)return false;
 for(let i=0;i<ring.length;i++){
  if(Math.hypot(ring[i][0]-ring[(i+1)%ring.length][0],ring[i][1]-ring[(i+1)%ring.length][1])<EPS)return false;
  for(let j=i+2;j<ring.length;j++)if(!(i===0&&j===ring.length-1)&&edgesTouch(ring[i],ring[(i+1)%ring.length],ring[j],ring[(j+1)%ring.length]))return false;
 }
 return true;
}
export function validSurface(o){
 if(!o||!validRing(o.poly)||!Array.isArray(o.holes||[]))return false;
 const holes=o.holes||[];
 for(let i=0;i<holes.length;i++){
  const ring=holes[i];if(!validRing(ring)||!ring.every(p=>inRing(p,o.poly,false)))return false;
  for(const other of [o.poly,...holes.slice(0,i)]){
   if(other!==o.poly&&(ring.some(p=>inRing(p,other))||other.some(p=>inRing(p,ring))))return false;
   for(let a=0;a<ring.length;a++)for(let b=0;b<other.length;b++)if(edgesTouch(ring[a],ring[(a+1)%ring.length],other[b],other[(b+1)%other.length]))return false;
  }
 }
 return surfaceArea(o)>.00001;
}
const cleanRing=r=>{const out=r.map(p=>p.slice(0,2));if(out.length>3&&Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])<EPS)out.pop();return out};
const toGeometry=o=>surfaceRings(o).map(r=>r.map(p=>p.slice(0,2)));
function fromGeometry(result,template){
 return result.map(rings=>{const o={...structuredClone(template),poly:cleanRing(rings[0])};delete o.holes;if(rings.length>1)o.holes=rings.slice(1).map(cleanRing);return o}).filter(o=>surfaceArea(o)>.00001);
}
export function mergeSurfaces(items){
 if(items.length<2)throw Error('Selecciona al menos dos superficies de la misma capa.');
 if(!items.every(validSurface))throw Error('Corrige los contornos antes de unirlos.');
 return fromGeometry(clipping.union(...items.map(toGeometry)),items[0]);
}
export function subtractSurface(surface,cutter){
 if(!validSurface(surface)||!validRing(cutter))throw Error('El contorno del recorte no es válido.');
 return fromGeometry(clipping.difference(toGeometry(surface),[cutter]),surface);
}
export function splitSurface(surface,a,b){
 if(!validSurface(surface)||Math.hypot(b[0]-a[0],b[1]-a[1])<.001)throw Error('Marca dos puntos distintos para el corte.');
 const xs=surface.poly.map(p=>p[0]),ys=surface.poly.map(p=>p[1]),margin=1;
 const bounds=[[Math.min(...xs)-margin,Math.min(...ys)-margin],[Math.max(...xs)+margin,Math.min(...ys)-margin],[Math.max(...xs)+margin,Math.max(...ys)+margin],[Math.min(...xs)-margin,Math.max(...ys)+margin]];
 const half=side=>{
  const ring=[];for(let i=0;i<bounds.length;i++){
   const p=bounds[i],q=bounds[(i+1)%bounds.length],dp=cross(a,b,p)*side,dq=cross(a,b,q)*side;
   if(dp>=-EPS)ring.push(p);
   if((dp>EPS&&dq< -EPS)||(dp< -EPS&&dq>EPS)){const t=dp/(dp-dq);ring.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}
  }
  return ring.length>=3?fromGeometry(clipping.intersection(toGeometry(surface),[ring]),surface):[];
 };
 const first=half(1),second=half(-1);
 if(!first.length||!second.length)throw Error('La línea debe atravesar la superficie seleccionada.');
 return[...first,...second];
}
export function surfacesOverlapPolygon(poly,surface){
 if(!surface.holes?.length){
  if(poly.some(p=>inRing(p,surface.poly))||surface.poly.some(p=>inRing(p,poly)))return true;
 }else if(poly.some(p=>inSurface(p,surface))||surface.poly.some(p=>inRing(p,poly)))return true;
 for(const ring of surfaceRings(surface))for(let i=0;i<poly.length;i++)for(let j=0;j<ring.length;j++)if(edgesCross(poly[i],poly[(i+1)%poly.length],ring[j],ring[(j+1)%ring.length]))return true;
 return false;
}
// Sampling alone misses a small courtyard entirely enclosed by a collider.
export function shapeOnSurfaces(poly,surfaces,step=.08){
 const covered=p=>surfaces.some(o=>o.walkable!==false&&inSurface(p,o));
 if(!poly.length)return false;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
  for(let j=0;j<=n;j++)if(!covered([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]))return false;
 }
 for(const o of surfaces)for(const hole of o.holes||[])for(const p of hole)if(inRing(p,poly,false)&&!covered(p))return false;
 return true;
}
export function snapPoint(p,doc,{grid=false,step=.1,edges=false,tolerance=.15,exclude=null}={}){
 let best=null,minimum=tolerance;
 if(edges)for(const kind of ['roads','sidewalks','houses'])for(const [index,o]of (doc[kind]||[]).entries()){
  if(exclude?.type===kind&&exclude.index===index)continue;
  for(const [ringIndex,ring]of surfaceRings(o).entries())for(let i=0;i<ring.length;i++){
   const v=ring[i],d=Math.hypot(p[0]-v[0],p[1]-v[1]);if(d<minimum){minimum=d;best={point:[...v],kind:'vertex',type:kind,index,ring:ringIndex,vertex:i}}
  }
 }
 if(best)return best;
 if(edges)for(const kind of ['roads','sidewalks','houses'])for(const [index,o]of (doc[kind]||[]).entries()){
  if(exclude?.type===kind&&exclude.index===index)continue;
  for(const [ringIndex,ring]of surfaceRings(o).entries())for(let i=0;i<ring.length;i++){
   const q=nearestOnSegment(p,ring[i],ring[(i+1)%ring.length]),d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<minimum){minimum=d;best={point:q,kind:'edge',type:kind,index,ring:ringIndex,vertex:i}}
  }
 }
 if(best)return best;
 const size=Number.isFinite(step)&&step>=.01?step:.1;
 return{point:grid?p.map(n=>Math.round(n/size)*size):[...p],kind:grid?'grid':null};
}
export function nearestSurfaceEdge(surface,p){
 let best=null;
 for(const [ringIndex,ring]of surfaceRings(surface).entries())for(let i=0;i<ring.length;i++){
  const point=nearestOnSegment(p,ring[i],ring[(i+1)%ring.length]),distance=Math.hypot(p[0]-point[0],p[1]-point[1]);
  if(!best||distance<best.distance)best={point,distance,ring:ringIndex,vertex:i};
 }
 return best;
}
