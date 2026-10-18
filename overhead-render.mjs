import {overheadType,overheadSize} from './overhead-elements.mjs';
import {drawFacadeDecor} from './editor-facades.mjs';
export function drawOverhead(ctx,o,pixel,zoom,selected=false){
 const spec=overheadType(o.type);if(!spec)return;
 // Façade detail renderers use screen-pixel minima. Normalize game/world
 // rendering before reusing them, just as we do for furniture.
 if(zoom<8){ctx.save();ctx.scale(1/96,1/96);drawOverhead(ctx,o,(x,y)=>pixel(x,y).map(v=>v*96),zoom*96,selected);ctx.restore();return;}
 const [w,d]=overheadSize(o),a=(o.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),at=(x,y)=>pixel(o.point[0]+x*c-y*s,o.point[1]+x*s+y*c);
 if(spec.kind==='canopy'){
  const project=(x,y)=>at(x*w,d/2+y*d/1.355);
  drawFacadeDecor(ctx,{poly:[[-.5,0],[.5,0],[.5,.2],[-.5,.2]],facade:{shop:'none',edge:0,awning:'plain',awningPreset:spec.fabric,awningStart:0,awningWidth:1,awningDepth:1.2}},project,zoom*Math.min(w,d/1.355));
 }else{
  const origin=pixel(...o.point),brick=o.type==='lintel-chapel',arch=spec.kind==='arch',pier=Math.min(o.pier??.3,w/2);
  ctx.save();ctx.translate(...origin);ctx.rotate(-a);ctx.scale(zoom,zoom);
  // The entire masonry stays INSIDE the saved width and depth, including
  // mouldings and joints. No half-metre minimum stroke in the game.
  ctx.beginPath();ctx.rect(-w/2,-d/2,w,d);ctx.clip();
  const stone=ctx.createLinearGradient(0,-d/2,0,d/2);
  stone.addColorStop(0,brick?'#c08b6d':'#e4dcc8');
  stone.addColorStop(.18,brick?'#b17352':'#d6cbb4');
  stone.addColorStop(.78,brick?'#a16548':arch?'#c8b58c':'#c3b69b');
  stone.addColorStop(1,brick?'#81523e':'#958b73');
  ctx.fillStyle=stone;ctx.fillRect(-w/2,-d/2,w,d);
  const rows=brick?Math.max(1,Math.ceil(d/.085)):1,unit=brick?.235:arch?.42:.48;
  ctx.lineWidth=brick?.005:.008;ctx.strokeStyle=brick?'#dcc4a2aa':'#8f846b77';
  for(let row=0;row<rows;row++){
   const y=-d/2+row*d/rows;
   if(row){ctx.beginPath();ctx.moveTo(-w/2,y);ctx.lineTo(w/2,y);ctx.stroke();}
   for(let x=-w/2+(row%2?unit/2:unit);x<w/2;x+=unit){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+d/rows);ctx.stroke();}
  }
  // Fine, deterministic pores: natural stone/brick rather than outlined blocks.
  let seed=617;const noise=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const specks=Math.min(1500,Math.ceil(w*d*650));
  for(let i=0;i<specks;i++){
   const x=-w/2+noise()*w,y=-d/2+noise()*d,r=.002+noise()*.005;
   ctx.fillStyle=i%3?'#655c4824':'#fff5d83d';ctx.fillRect(x,y,r*1.6,r);
  }
  const bead=Math.min(.022,d*.10);
  ctx.fillStyle=brick?'#e3b494':'#f4ecda';ctx.fillRect(-w/2,-d/2,w,bead);
  ctx.fillStyle=brick?'#724c39':'#897e66';ctx.fillRect(-w/2,d/2-bead,w,bead);
  // Quiet end stones indicate the two supporting piers without fat end caps.
  ctx.fillStyle=brick?'#8c553929':'#7d735b25';
  for(const x of [-w/2,w/2-pier])ctx.fillRect(x,-d/2,pier,d);
  ctx.strokeStyle=brick?'#d0a07b':'#afa183';ctx.lineWidth=.008;
  for(const x of [-w/2+pier,w/2-pier]){ctx.beginPath();ctx.moveTo(x,-d/2);ctx.lineTo(x,d/2);ctx.stroke();}
  if(arch){
   const key=Math.min(.22,w*.12);ctx.fillStyle='#e8dcc2';ctx.fillRect(-key/2,-d/2,key,d);
   ctx.fillStyle='#fff0d0';ctx.fillRect(-key/2,-d/2,key,bead);
  }
  ctx.restore();
 }
 if(selected){ctx.save();ctx.strokeStyle='#d3a449';ctx.lineWidth=2;const p=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(q=>at(...q));ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.stroke();ctx.restore();}
}
