// Shared roof rendering for the editor and gameplay preview.
// Crucial: image sprites from the original APK can contain WHITE FACADES.
// Stretching their whole rectangular atlas rectangle into a skewed polygon
// creates "broken walls". Instead, roofs are drawn procedurally, oriented
// with the longest frontage and clipped to the exact existing footprint.
// The WALL INSET is a clip-constrained inner stroke; it works even for
// concave, jagged or narrow polygons, without generating invalid offset rings.
import {paintArchitecturalRoof} from './editor-roof-top-view.mjs';
import {drawRoofBorder,ROOF_BORDERS} from './editor-roof-borders.mjs';
const isPoint=p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function roofLayout(poly,requested=.2,autoSimplify=true){
 if(!Array.isArray(poly)||poly.length<3||poly.some(p=>!isPoint(p)))return null;
 const points=poly.filter((p,i)=>i===0||Math.hypot(p[0]-poly[i-1][0],p[1]-poly[i-1][1])>1e-5);
 if(points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-5)points.pop();
 if(points.length<3)return null;
 let signed=0,perimeter=0,longest=0,angle=0,longestEdgeIndex=0;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  signed+=a[0]*b[1]-b[0]*a[1];perimeter+=length;
  if(length>longest){longest=length;angle=Math.atan2(dy,dx);longestEdgeIndex=i}
 }
 const area=Math.abs(signed)/2;
 if(area<1e-7||perimeter<1e-5)return null;
 // 2A/P estimates the tight dimension in long, narrow building footprints.
 const thickness=2*area/perimeter;
 const inset=clamp(Number.isFinite(requested)?requested:.055,.035,.09);
 const safeInset=Math.min(inset,Math.max(.025,thickness*.25));
 const spanX=bounds[2]-bounds[0],spanY=bounds[3]-bounds[1];
 const aspect=Math.max(spanX,spanY)/Math.max(.001,Math.min(spanX,spanY));
 const compact=!!autoSimplify&&(thickness<.55||aspect>5.5||points.length>9);
 return{points,bounds,angle,longestEdgeIndex,area,perimeter,thickness,inset:safeInset,compact};
}
const PALETTES=[
 ['#b9684a','#dc936b','#74402f'],['#b97552','#d4a075','#704b3c'],
 ['#a85f45','#cb8568','#6d473b'],['#bc825a','#e2b28b','#85543c'],
 ['#a75843','#d18863','#744237'],['#b3734f','#d9a077','#7b513e'],
 ['#bb7056','#d7a085','#754538'],['#a56b56','#c78d76','#705042'],
 ['#c18b65','#e5bb93','#896046']
];
function nativeColors(material){
 const match=String(material.id||'').match(/^roof-(\d+)-(\d+)$/),index=match?+match[1]:0,mode=match?+match[2]:0;
 const basic=PALETTES[index%PALETTES.length];
 if(mode===2)return{base:'#d2c3a6',tile:'#e6d9bd',dark:'#998d79',mode};
 if(mode===3)return{base:'#665b55',tile:'#80746e',dark:'#443c3a',mode};
 if(mode===1)return{base:basic[0],tile:'#b19a83',dark:basic[2],mode};
 return{base:basic[0],tile:basic[1],dark:basic[2],mode};
}
function outline(ctx,poly,pixel){ctx.beginPath();for(let i=0;i<poly.length;i++){const p=pixel(...poly[i]);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])}ctx.closePath()}
function fillCleanRoof(ctx,layout,material,pixel,zoom){
 const pts=layout.points.map(p=>pixel(...p)),centre=[
  pts.reduce((s,p)=>s+p[0],0)/pts.length,
  pts.reduce((s,p)=>s+p[1],0)/pts.length
 ];
 // Pixel-space angle accounts for the inverted editor/game Y axis.
 const first=layout.longestEdgeIndex||0,a=pts[first],b=pts[(first+1)%pts.length];
 const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),c=Math.cos(angle),s=Math.sin(angle);
 const local=pts.map(p=>{const dx=p[0]-centre[0],dy=p[1]-centre[1];return[dx*c+dy*s,-dx*s+dy*c]});
 const xmin=Math.min(...local.map(p=>p[0])),xmax=Math.max(...local.map(p=>p[0])),ymin=Math.min(...local.map(p=>p[1])),ymax=Math.max(...local.map(p=>p[1]));
 const pal=nativeColors(material),spanX=xmax-xmin,spanY=ymax-ymin;
 ctx.save();ctx.translate(...centre);ctx.rotate(angle);
 ctx.fillStyle=pal.base;ctx.fillRect(xmin-.3*zoom,ymin-.3*zoom,spanX+.6*zoom,spanY+.6*zoom);
 // Uniform hatch, no stretched rectangular image and no embedded facade art.
 const gap=layout.compact?.28*zoom:.16*zoom;
 ctx.strokeStyle=pal.tile;ctx.lineWidth=Math.max(.015*zoom,.01);
 ctx.beginPath();
 for(let n=0,nmax=Math.min(340,Math.ceil(spanY/gap)+2);n<nmax;n++){
  const y=ymin+n*gap;if(y>ymax)break;
  ctx.moveTo(xmin-.15*zoom,y);ctx.lineTo(xmax+.15*zoom,y);
 }
 ctx.stroke();
 if(pal.mode===0||pal.mode===1){
  const gapX=layout.compact?.65*zoom:.34*zoom;
  ctx.strokeStyle='rgba(48,38,32,.28)';ctx.lineWidth=Math.max(.01*zoom,.007);
  ctx.beginPath();
  for(let n=0,nmax=Math.min(280,Math.ceil(spanX/gapX)+2);n<nmax;n++){
   const x=xmin+n*gapX;if(x>xmax)break;
   ctx.moveTo(x,ymin-.15*zoom);ctx.lineTo(x,ymax+.15*zoom);
  }
  ctx.stroke();
 }
 // Long narrow/concave buildings get simplified surface, avoiding false
 // gables and jagged roof silhouettes.
 if(!layout.compact&&spanY>.65*zoom){
  ctx.beginPath();ctx.moveTo(xmin,ymin+spanY*.5);ctx.lineTo(xmax,ymin+spanY*.5);
  ctx.lineWidth=Math.max(.05*zoom,.025);ctx.strokeStyle=pal.dark;ctx.stroke();
  ctx.beginPath();ctx.moveTo(xmin,ymin+spanY*.5-.035*zoom);ctx.lineTo(xmax,ymin+spanY*.5-.035*zoom);
  ctx.lineWidth=Math.max(.013*zoom,.01);ctx.strokeStyle=pal.tile;ctx.stroke();
 }
 ctx.restore();
}
export function renderInsetRoof(ctx,poly,material,pixel,zoom,options={},drawSpecial=null){
 const layout=roofLayout(poly,options.roofInset,options.roofSimplify!==false);
 if(!layout)return null;
 // Stable choices per parcel: zooming and replaying never reshuffle.
 const v=Number.isFinite(options.roofSeed)?options.roofSeed:
  Math.round(layout.points.reduce((sum,p)=>sum+p[0]*1739+p[1]*2999,0)*31+
   layout.area*4679+layout.perimeter*953);
 const seed=Math.imul(v|0,2654435761)>>>0;
 const border=options.roofBorder&&options.roofBorder!=='auto'?options.roofBorder:
  ROOF_BORDERS[seed%ROOF_BORDERS.length].id;
 const detailPool=['none','none','patio','none','castillete','claraboya',
  'none','instalaciones','terraza','none','lavadero'];
 const detail=options.roofDetail&&options.roofDetail!=='auto'?options.roofDetail:
  detailPool[Math.floor(seed/11)%detailPool.length];
 const decoration={...options,roofSeed:v,roofBorder:border,roofDetail:detail};
 const imageZoom=Math.max(.00001,zoom),b=layout.bounds;
 ctx.save();outline(ctx,layout.points,pixel);ctx.clip();
 if(drawSpecial&&(material.landmark||material.temple)){
  const top=pixel(b[0],b[3]),width=(b[2]-b[0])*imageZoom,height=(b[3]-b[1])*imageZoom;
  ctx.fillStyle='#c5ab88';ctx.fillRect(top[0],top[1],width,height);
  drawSpecial(material,top,width,height);
 }else paintArchitecturalRoof(ctx,layout,material,pixel,imageZoom,decoration);
 // Stroke is clipped to the ORIGINAL polygon, leaving a wall/parapet rim
 // of consistent width inside it, even at concave corners. Never touches
 // saved footprints, checkpoints, roads, or collision geometry.
 // Old 0.20–0.30m inset was rendered as a 0.4–0.6m cream wall.
 // That produced the absurd giant white wall in narrow Sevilla alleys.
 // Visual rim now 5–7 cm total, regardless of old saved roofInset; the
 // ORIGINAL building polygon and physical collisions are not touched.
 drawRoofBorder(ctx,layout.points,pixel,imageZoom,decoration.roofBorder,layout.inset);
 ctx.restore();
 return layout;
}
