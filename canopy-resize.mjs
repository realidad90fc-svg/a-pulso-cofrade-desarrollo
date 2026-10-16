// Oriented rectangle handles in world coordinates. Opposite edges stay fixed.
import {overheadType,overheadSize,validateOverhead} from './overhead-elements.mjs';
export const isCanopy=o=>overheadType(o?.type)?.kind==='canopy';
const directions=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
const round=n=>Math.round(n*1e6)/1e6;
const clamp=n=>Math.max(.05,Math.min(100,n));
export function canopyHandles(item){
 if(!isCanopy(item))return[];
 const [w,d]=overheadSize(item),a=(item.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return directions.map(([sx,sy],i)=>{
  const x=sx*w/2,y=sy*d/2,dx=sx*c-sy*s,dy=-(sx*s+sy*c),turn=((Math.atan2(dy,dx)*180/Math.PI)%180+180)%180;
  return{id:i,sx,sy,corner:!!(sx&&sy),point:[item.point[0]+x*c-y*s,item.point[1]+x*s+y*c],cursor:['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(turn/45)%4]};
 });
}
export function pickCanopyHandle(item,position,pixel,pointerType='mouse'){
 const radius=pointerType==='touch'?24:pointerType==='pen'?17:11;
 const hits=canopyHandles(item).map(h=>({...h,distance:Math.hypot(...pixel(...h.point).map((v,i)=>v-position[i]))})).filter(h=>h.distance<=radius);
 return hits.sort((a,b)=>a.distance-b.distance)[0]||null;
}
export function resizeCanopy(original,handle,start,current){
 if(!isCanopy(original)||!directions[handle?.id]||![...start,...current].every(Number.isFinite))return null;
 const [sx,sy]=directions[handle.id],[w,d]=overheadSize(original),a=(original.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=current[0]-start[0],dy=current[1]-start[1],localX=dx*c+dy*s,localY=-dx*s+dy*c;
 const width=sx?clamp(w+sx*localX):w,depth=sy?clamp(d+sy*localY):d,cx=sx*(width-w)/2,cy=sy*(depth-d)/2;
 const item={...original,point:[round(original.point[0]+cx*c-cy*s),round(original.point[1]+cx*s+cy*c)],size:[round(width),round(depth)],width:round(width),depth:round(depth),edit:{...original.edit,resized:true}};
 validateOverhead(item);return item;
}
export function drawCanopyHandles(ctx,item,pixel,{touch=false,active=null}={}){
 const handles=canopyHandles(item);if(!handles.length)return;
 ctx.save();ctx.strokeStyle='#117763';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.beginPath();
 for(const [i,h]of handles.filter(h=>h.corner).entries()){const p=pixel(...h.point);i?ctx.lineTo(...p):ctx.moveTo(...p)}ctx.closePath();ctx.stroke();ctx.setLineDash([]);
 for(const h of handles){const p=pixel(...h.point),r=touch?(h.corner?8:6):(h.corner?5:4);ctx.fillStyle=h.id===active?'#cba65f':'#fff';ctx.strokeStyle='#075344';ctx.lineWidth=2;ctx.fillRect(p[0]-r,p[1]-r,r*2,r*2);ctx.strokeRect(p[0]-r,p[1]-r,r*2,r*2)}
 ctx.restore();
}
