import assert from 'node:assert/strict';
import {canopyHandles,resizeCanopy,pickCanopyHandle} from '../canopy-resize.mjs';
import {newUrbanElement} from '../editor-urban-elements.mjs';
import {validateMapDocument,blankMapDocument} from '../city-project.mjs';
import {overheadObstacles} from '../overhead-elements.mjs';
import {MapGameplayRuntime} from '../map-gameplay-runtime.mjs';
import {defaultGameplay} from '../map-gameplay.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<2e-6,`${a} ≠ ${b}`),pointNear=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
let cases=0;
for(const angle of [0,30,90,135,270])for(const handle of canopyHandles(newUrbanElement('canopy-green',[10,20],{width:3,depth:1.2,angle}))){
 const original={...newUrbanElement('canopy-green',[10,20],{width:3,depth:1.2,clearance:3.43,angle}),solid:true},saved=JSON.stringify(original),a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),local=[handle.sx*.8,handle.sy*.35],target=[handle.point[0]+local[0]*c-local[1]*s,handle.point[1]+local[0]*s+local[1]*c];
 const result=resizeCanopy(original,handle,handle.point,target);near(result.size[0],3+(handle.sx?.8:0));near(result.size[1],1.2+(handle.sy?.35:0));assert.equal(result.angle,angle);assert.equal(result.clearance,3.43);assert.equal(JSON.stringify(original),saved);
 const opposite=(handle.id+4)%8;pointNear(canopyHandles(result)[opposite].point,canopyHandles(original)[opposite].point);
 const doc=blankMapDocument({key:'resize',name:'Resize'});doc.urban=[result];validateMapDocument(doc);assert.equal(overheadObstacles(result)[0].clearance,3.43);
 const pixel=(x,y)=>[x*100,1000-y*100],screen=pixel(...handle.point),offset=[screen[0]+19,screen[1]+2];assert.equal(pickCanopyHandle(original,offset,pixel,'touch')?.id,handle.id);assert.equal(pickCanopyHandle(original,offset,pixel,'mouse'),null);
 const start=[handle.point[0]+.02,handle.point[1]-.03],same=resizeCanopy(original,handle,start,start);pointNear(same.point,original.point);pointNear(same.size,original.size);
 cases++;
}
const original=newUrbanElement('canopy-cream',[0,0],{width:3,depth:1.2}),right=canopyHandles(original)[3];
const tiny=resizeCanopy(original,right,right.point,[-100,0]),huge=resizeCanopy(original,right,right.point,[500,0]);near(tiny.size[0],.05);near(huge.size[0],100);near(tiny.size[1],1.2);near(tiny.point[0]-tiny.size[0]/2,-1.5);near(huge.point[0]-huge.size[0]/2,-1.5);
assert.equal(canopyHandles(newUrbanElement('arch-postigo',[0,0])).length,0);
const grown=resizeCanopy(original,right,right.point,[3,0]),floor=blankMapDocument({key:'physics',name:'Resize physics'});floor.roads=[{poly:[[-50,-50],[50,-50],[50,50],[-50,50]]}];floor.urban=[grown];floor.gameplay=defaultGameplay();floor.gameplay.collision.mode='replace';const runtime=new MapGameplayRuntime(floor),shape={points:[[1.9,-.1],[2.1,-.1],[2.1,.1],[1.9,.1]]};assert.equal(runtime.collisionReason(shape,{controller:{flex:false}}),6,'Newly extended cloth participates in height collisions');assert.equal(runtime.collisionReason(shape,{controller:{flex:true}}),null);
console.log(`Canopy handles: ${cases} corner/side cases across five rotations; fixed opposite anchors, independent dimensions, grab offsets, touch targets, size limits, original data and height collision preserved.`);
