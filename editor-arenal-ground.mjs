// Shared neutral city-block backdrop for the Arenal.
// It is NOT the street texture. Roads and sidewalks are painted separately,
// clipped to their true editable polygons with their chosen materials.
// Previous releases erroneously tiled large granite bricks over the entire
// Arenal map, making squares appear on roofs and out-of-street terrain.
const BACKDROP='#6c6d69';
function hash(i,j){
 let h=Math.imul(i,374761393)^Math.imul(j,668265263)^0x9e3779b9;
 h=Math.imul(h^(h>>>13),1274126177);
 return (h^(h>>>16))>>>0;
}
export function paintArenalGround(ctx,pixel,zoom,visible,sceneBounds){
 if(!Array.isArray(visible)||visible.length!==4||!(zoom>0))return false;
 const bounds=Array.isArray(sceneBounds)&&sceneBounds.length===4?sceneBounds:visible;
 const left=Math.max(visible[0],bounds[0]),bottom=Math.max(visible[1],bounds[1]);
 const right=Math.min(visible[2],bounds[2]),top=Math.min(visible[3],bounds[3]);
 if(!(right>left&&top>bottom))return false;
 const topLeft=pixel(left,top),bottomRight=pixel(right,bottom);
 const x0=Math.min(topLeft[0],bottomRight[0]),y0=Math.min(topLeft[1],bottomRight[1]);
 const w=Math.abs(bottomRight[0]-topLeft[0]),h=Math.abs(bottomRight[1]-topLeft[1]);
 if(!(w>0&&h>0))return false;
 ctx.save();ctx.beginPath();ctx.rect(x0,y0,w,h);ctx.clip();
 ctx.fillStyle=BACKDROP;ctx.fillRect(x0,y0,w,h);
 // Very subtle weathering of unfinished parcels. This must NOT resemble
 // road slabs. Dots stay fixed in metres and never grow when zooming out.
 const step=.23,nx=Math.ceil((right-left)/step),ny=Math.ceil((top-bottom)/step);
 const skip=Math.max(1,Math.ceil(Math.sqrt(Math.max(1,nx*ny)/4000)));
 for(let i=Math.floor(left/step);i<=Math.ceil(right/step);i+=skip)
  for(let j=Math.floor(bottom/step);j<=Math.ceil(top/step);j+=skip){
   const hsh=hash(i,j);
   if((hsh&3)!==0)continue;
   const x=(i+.2+(hsh%9)/15)*step,y=(j+.2+(hsh%7)/14)*step;
   const p=pixel(x,y),r=Math.max(.1,.016*zoom);
   ctx.fillStyle=(hsh&8)?'rgba(226,221,207,.095)':'rgba(55,55,52,.12)';
   ctx.fillRect(p[0],p[1],r,r);
  }
 ctx.restore();return true;
}
