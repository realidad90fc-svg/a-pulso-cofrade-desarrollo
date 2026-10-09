import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';
import {CathedralRoute} from './cathedral-route.mjs';

// Decorative streets keep the surrounding Arenal believable. They do not
// change the procesional itinerary, the native step, or its street colliders.
const at=(s,d,o)=>[s.a[0]+s.t[0]*d+s.n[0]*o,s.a[1]+s.t[1]*d+s.n[1]*o];
const limits=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
const overlaps=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const frac=n=>n-Math.floor(n);
const choose=(a,i)=>a[((i%a.length)+a.length)%a.length];

export function buildArenalSurroundings(route){
 route.visualSideStreets=[];
 // Reference-aligned secondary openings in Arfe, Adriano and Pastor y Landero.
 // Their mouths touch existing road edges, but the original travel route is
 // unchanged. The locations are stylized and can be refined with photos.
 const openings=[
  ['MODULO_ENLACE_ARFE_ADRIANO',1.32,-1,1.04,5.2],
  ['MODULO_ADRIANO',2.55,-1,1.25,5.9],
  ['MODULO_ADRIANO',9.02,1,1.28,6.8],
  ['MODULO_ADRIANO',10.98,-1,1.04,5.3],
  ['MODULO_PASTOR_LANDERO',2.05,1,1.13,6.3],
  ['MODULO_PASTOR_LANDERO',6.30,-1,1.20,5.6]
 ];
 for(const [moduleId,d,side,w,length] of openings){
  const s=route.arenalSections.find(x=>x.module.id===moduleId);
  if(!s||d<.5||d>s.length-.5)continue;
  const outer=s.module.halfWidth+length;
  // Straight parallel boundaries, not arbitrary diagonal triangular roofs.
  const polygon=[
   at(s,d-w/2,side*(s.module.halfWidth-.03)),
   at(s,d+w/2,side*(s.module.halfWidth-.03)),
   at(s,d+w/2,side*outer),
   at(s,d-w/2,side*outer)
  ];
  route.visualSideStreets.push({poly:polygon,bounds:limits(polygon),width:w,moduleId,d,side});
 }
}

export function paintArenalPixelArchitecture(route,ctx,images,r){
 const p=route.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
 const trace=poly=>{ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
 const roofImage=key=>images.get(key)||images.get(route.graph.data.sprites[key]?.image);
 ctx.imageSmoothingEnabled=false;
 // Original Chicotaz exterior blocks use 3-world-unit APK house sprites.
 // The same materials, world-aligned grid and scaling are used up to Arfe's
 // native seam; don't paint a separate flat-color, gradient or roof mosaic.
 ctx.fillStyle='#65605a';ctx.fillRect(0,0,(r[2]-r[0])*p,(r[3]-r[1])*p);
 for(let x=Math.floor(r[0]/3)*3;x<r[2];x+=3){
  for(let y=Math.floor(r[1]/3)*3;y<r[3];y+=3){
   const index=Math.abs(Math.round(x*7+y*3))%NATIVE_HOUSE_KEYS.length;
   const im=roofImage(NATIVE_HOUSE_KEYS[index]);
   if(im)ctx.drawImage(im,px(x),py(y+3),3*p,3*p);
  }
 }
 // Building footprints use those SAME Chicotaz materials, not separate
 // synthetic roofs. World-scale sprites and pixelated filtering stay fixed.
 for(const b of route.arenalBlocks){
  if(!overlaps(b.bounds,r))continue;
  const [x,y,xx,yy]=b.bounds;
  const im=roofImage(NATIVE_HOUSE_KEYS[b.material%NATIVE_HOUSE_KEYS.length]);
  if(!im)continue;
  ctx.save();trace(b.poly);ctx.clip();
  ctx.drawImage(im,px(x),py(yy),(xx-x)*p,(yy-y)*p);
  ctx.restore();
  const [a,z]=b.front;
  ctx.strokeStyle='#cdbca2';ctx.lineWidth=.045*p;
  ctx.beginPath();ctx.moveTo(px(a[0]),py(a[1]));ctx.lineTo(px(z[0]),py(z[1]));ctx.stroke();
 }
}

export function paintArenalSecondaryStreets(route,ctx,images,r){
 const p=route.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
 const patch=(poly)=>CathedralRoute.prototype.paintNativePatch.call(route,ctx,images,r,poly,[1610,1050,96,96]);
 for(const street of route.visualSideStreets||[]){
  if(!overlaps(street.bounds,[r[0]-.5,r[1]-.5,r[2]+.5,r[3]+.5]))continue;
  const ps=street.poly;
  ctx.beginPath();ps.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();
  ctx.lineJoin='miter';ctx.strokeStyle='#c5bcae';ctx.lineWidth=.27*p;ctx.stroke();
  // Same APK pavement/stone texture as native Arfe and the main roads.
  // Side streets are visual only; their colliders aren't added to walkable.
  patch(ps);
 }
}
