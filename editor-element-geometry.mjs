import {itemEdit} from './editor-item-state.mjs';
import {urbanElementSize} from './editor-urban-elements.mjs';
export const elementPoint=o=>Array.isArray(o)?o[1]:o.point||o.position;
export const elementAngle=(type,o)=>type==='trees'?(o.rotation||0):o.poly?(itemEdit(o).angle||0):type==='labels'?0:(o.angle||0);
export function elementSize(type,o){
 if(o.poly){const angle=-elementAngle(type,o)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),points=o.poly.map(([x,y])=>[x*c-y*s,x*s+y*c]);return[Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))]}
 if(type==='labels'){const r=o[2]?.radius||1;return[r*2,r*2]}
 if(type==='checkpoints'){const r=o.radius||.65;return[r*2,r*2]}
 if(type==='trees'){const d=Math.max(.125,(o.radius??.35)*(o.scale??1))*2;return o.size||[d,d]}
 if(type==='fences'||type==='chairs')return[o.width||(type==='fences'?.95:.4),o.depth||(type==='fences'?.18:.43)];
 if(type==='customObjects')return[o.width,o.depth];
 if(type==='urban')return urbanElementSize(o);
 return o.size||(type==='people'?[.19,.19]:[.2,.2]);
}
export function elementCorners(type,o){
 if(o.poly)return o.poly;
 const p=elementPoint(o),[w,d]=elementSize(type,o),a=elementAngle(type,o)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,y])=>[p[0]+x*c-y*s,p[1]+x*s+y*c]);
}
export function elementBounds(type,o){const p=elementCorners(type,o);return[Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))]}
export function elementCenter(type,o){if(!o.poly)return [...elementPoint(o)];const b=elementBounds(type,o);return[(b[0]+b[2])/2,(b[1]+b[3])/2]}
