import {overheadType,overheadSize} from './overhead-elements.mjs';
import {drawFacadeDecor} from './editor-facades.mjs';
export function drawOverhead(ctx,o,pixel,zoom,selected=false){
 const spec=overheadType(o.type);if(!spec)return;const [w,d]=overheadSize(o),a=(o.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),at=(x,y)=>pixel(o.point[0]+x*c-y*s,o.point[1]+x*s+y*c);
 if(spec.kind==='canopy'){
  // Reuse the detailed cloth, seams, scallops and shadows of façade awnings.
  const project=(x,y)=>at(x*w,d/2+y*d/1.355);
  drawFacadeDecor(ctx,{poly:[[-.5,0],[.5,0],[.5,.2],[-.5,.2]],facade:{shop:'none',edge:0,awning:'plain',awningPreset:spec.fabric,awningStart:0,awningWidth:1,awningDepth:1.2}},project,zoom*Math.min(w,d/1.355));
 }else{
  const rect=(x,y,b,h,fill,stroke='#766c5a')=>{const p=[[x,y],[x+b,y],[x+b,y+h],[x,y+h]].map(q=>at(...q));ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.55,zoom*.012);ctx.stroke()};
  ctx.save();const pier=o.pier??.3,brick=o.type==='lintel-chapel',postigo=spec.kind==='arch',base=brick?'#b2805e':postigo?'#dbc9a4':'#c9c2ae';
  rect(-w/2+.08,-d/2-.12,w,d,'#34352f38','#34352f15');
  rect(-w/2,-d/2,w,d,base);rect(-w/2,-d/2,pier,d,'#a99a7d');rect(w/2-pier,-d/2,pier,d,'#a99a7d');
  const count=Math.max(4,Math.ceil(w/.28));for(let i=0;i<count;i++){const x=-w/2+i*w/count;rect(x+.008,-d/2+.025,w/count-.016,d-.05,i%3?'#d9cfb9':base,'#95866d88')}
  rect(-w/2,-d/2,w,Math.min(.07,d*.15),'#81745d');rect(-w/2,d/2-Math.min(.07,d*.15),w,Math.min(.07,d*.15),'#f2e8cb');
  if(postigo){rect(-.20,-d/2-.035,.4,d+.07,'#eee1c2');for(const x of [-w/2+.05,w/2-pier-.05]){rect(x,-d/2-.08,pier+.05,d+.16,'#c3ad87')}}
  ctx.restore();
 }
 if(selected){ctx.save();ctx.strokeStyle='#d3a449';ctx.lineWidth=2;const p=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(q=>at(...q));ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(...q):ctx.moveTo(...q));ctx.closePath();ctx.stroke();ctx.restore()}
}
