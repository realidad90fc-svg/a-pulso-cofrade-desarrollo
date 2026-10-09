import {NATIVE_HOUSE_KEYS} from './native-route-architecture.mjs';

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
 const shades=['#b26752','#ad5c46','#b88a68','#d1b599','#9d5443','#c5a27c','#ae6d51'];
 const roofKeys=NATIVE_HOUSE_KEYS;
 ctx.fillStyle='#a98a70';ctx.fillRect(0,0,(r[2]-r[0])*p,(r[3]-r[1])*p);
 // A roof mosaic extends beyond the playable streets, rather than the same
 // solid beige painted on the entire map.
 for(let x=Math.floor(r[0]/2.8)*2.8;x<r[2];x+=2.8){
  for(let y=Math.floor(r[1]/3.4)*3.4;y<r[3];y+=3.4){
   const n=Math.floor(x/2.8)*17+Math.floor(y/3.4)*23;
   ctx.fillStyle=choose(shades,n);ctx.fillRect(px(x),py(y+3.4),2.8*p,3.4*p);
   const sprite=images.get(choose(roofKeys,n));
   if(sprite){ctx.save();ctx.globalAlpha=.47;ctx.drawImage(sprite,px(x),py(y+3.4),2.8*p,3.4*p);ctx.restore();}
   ctx.fillStyle='rgba(52,37,36,.27)';ctx.fillRect(px(x),py(y+3.4),2.8*p,.065*p);
   ctx.fillStyle='rgba(248,223,193,.19)';ctx.fillRect(px(x+.07),py(y+3.28),2.65*p,.055*p);
   // Small patios, skylights and flat-roof service cores.
   if(n%3===0){ctx.fillStyle='#7b6960';ctx.fillRect(px(x+.72),py(y+2.4),.75*p,.54*p);
    ctx.fillStyle='#c6c2aa';ctx.fillRect(px(x+.82),py(y+2.3),.55*p,.38*p);}
  }
 }
 // Real street-side housing masses: angular geometry is clipped to the
 // building footprint; texturing never spills over the kerb or crossings.
 for(const [idx,b] of route.arenalBlocks.entries()){
  if(!overlaps(b.bounds,r))continue;
  trace(b.poly);ctx.fillStyle=choose(shades,b.material);ctx.fill();
  ctx.save();trace(b.poly);ctx.clip();
  const [x,y,xx,yy]=b.bounds,sprite=images.get(choose(roofKeys,idx*3+b.material));
  if(sprite){ctx.globalAlpha=.52;ctx.drawImage(sprite,px(x),py(yy),(xx-x)*p,(yy-y)*p);ctx.globalAlpha=1;}
  // Pixel-art terracotta tile rows and masonry seams. No gradients or
  // low-resolution stretched photographs.
  for(let yy0=y+.12,row=0;yy0<yy-.08;yy0+=.18,row++){
   ctx.fillStyle=row%2?'rgba(73,41,33,.19)':'rgba(247,212,173,.22)';
   for(let xx0=x+.09+(row%2)*.07;xx0<xx-.1;xx0+=.16)
    ctx.fillRect(px(xx0),py(yy0+.04),.11*p,.031*p);
  }
  if(xx-x>.8&&yy-y>.8){
   const cx=(x+xx)/2,cy=(y+yy)/2;
   ctx.fillStyle='rgba(71,54,48,.55)';ctx.fillRect(px(cx-.18),py(cy+.14),.36*p,.28*p);
   ctx.fillStyle='#bdb5a1';ctx.fillRect(px(cx-.12),py(cy+.09),.24*p,.16*p);
  }
  ctx.restore();
  const [a,z]=b.front;
  ctx.beginPath();ctx.moveTo(px(a[0]),py(a[1]));ctx.lineTo(px(z[0]),py(z[1]));
  ctx.strokeStyle='#e8d5b6';ctx.lineWidth=.06*p;ctx.stroke();
  const length=Math.hypot(z[0]-a[0],z[1]-a[1]);
  for(let d=.3;d<length-.12;d+=.42){
   const t=d/length,pt=[a[0]+(z[0]-a[0])*t,a[1]+(z[1]-a[1])*t];
   ctx.fillStyle='#394144';ctx.fillRect(px(pt[0]-.055),py(pt[1]+.055),.11*p,.11*p);
  }
 }
}

export function paintArenalSecondaryStreets(route,ctx,images,r){
 const p=route.scene.ppu,px=x=>(x-r[0])*p,py=y=>(r[3]-y)*p;
 for(const street of route.visualSideStreets||[]){
  if(!overlaps(street.bounds,[r[0]-.5,r[1]-.5,r[2]+.5,r[3]+.5]))continue;
  const polygon=street.poly;
  const trace=()=>{ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y)));ctx.closePath();};
  ctx.save();ctx.lineJoin='miter';ctx.miterLimit=1.6;
  // Off-route streets have paving and curbs but no false navigable colliders.
  trace();ctx.strokeStyle='#c8c0b2';ctx.lineWidth=.31*p;ctx.stroke();
  trace();ctx.fillStyle='#5a5b5b';ctx.fill();
  trace();ctx.clip();
  const floor=images.get('sharedassets2.assets:373');
  if(floor){ctx.globalAlpha=.25;for(let x=Math.floor(street.bounds[0]);x<street.bounds[2]+1;x++)
    for(let y=Math.floor(street.bounds[1]);y<street.bounds[3]+1;y++)
     ctx.drawImage(floor,322,40,110,110,px(x),py(y+1),p,p);
  }
  ctx.restore();
  // End of decorative roads vanishes into the surrounding block rather than
  // abruptly showing a triangular/rounded road cap.
 }
}
