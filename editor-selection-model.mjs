import {EDITABLE_KINDS,itemEdit,expandGroups,assertEditable,freshEditorId} from './editor-item-state.mjs';
import {elementAngle,elementSize,elementPoint} from './editor-element-geometry.mjs';
import {selectionGeometry,translateSelections,rotateSelections,captureSelection} from './editor-interactions.mjs';
import {validateMapDocument} from './city-project.mjs';
import {resourceManifest,embedDocumentAssets,validateResourceManifest} from './custom-assets.mjs';
import {validSurface,surfaceRings} from './map-geometry.mjs';
import {SCENE_KINDS,sceneDrawOrder} from './scene-order.mjs';
const clone=o=>structuredClone(o),round=n=>Math.round(n*1e6)/1e6;
export function selectionFrame(doc,items){
 const selected=expandGroups(doc,items,true),geometry=selectionGeometry(doc,selected);if(!geometry)return null;
 const groupIds=new Set(selected.map(s=>itemEdit(doc[s.type][s.index]).groupId)),group=groupIds.size===1&&[...groupIds][0];
 const one=selected.length===1?selected[0]:null,item=one?doc[one.type][one.index]:null;
 return{...geometry,width:one?elementSize(one.type,item)[0]:geometry.bounds[2]-geometry.bounds[0],depth:one?elementSize(one.type,item)[1]:geometry.bounds[3]-geometry.bounds[1],angle:one?elementAngle(one.type,item):group?(itemEdit(doc[selected[0].type][selected[0].index]).groupAngle||0):0,group,relative:!one&&!group,circular:one&&['labels','checkpoints'].includes(one.type)};
}
function transaction(doc,items,change){
 const selected=expandGroups(doc,items,true);if(!selected.length)throw Error('Selecciona al menos un elemento.');assertEditable(doc,selected);
 const staged={...doc,metadata:{...doc.metadata}};for(const kind of EDITABLE_KINDS)staged[kind]=[...(doc[kind]||[])];
 for(const s of selected)staged[s.type][s.index]=clone(doc[s.type][s.index]);change(staged,selected);
 validateMapDocument(staged);for(const s of selected){const item=staged[s.type][s.index];if(item?.poly&&validSurface(doc[s.type][s.index])&&!validSurface(item))throw Error('El cambio dejaría una superficie no válida.');}
 const geometry=o=>JSON.stringify([o.poly,o.holes,o.point,o.position,o.size,o.width,o.depth,o.angle,o.rotation]);
 if(selected.some(s=>!['labels','checkpoints'].includes(s.type)&&geometry(doc[s.type][s.index])!==geometry(staged[s.type][s.index])))staged.metadata.precisionGeometry=true;
 for(const kind of EDITABLE_KINDS)doc[kind]=staged[kind];doc.metadata=staged.metadata;return selected;
}
function scaleItem(type,item,center,sx,sy,angle=0){
 const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),point=p=>{const dx=p[0]-center[0],dy=p[1]-center[1],x=(dx*c+dy*s)*sx,y=(-dx*s+dy*c)*sy;return[round(center[0]+x*c-y*s),round(center[1]+x*s+y*c)]};
 if(item.poly){for(const ring of surfaceRings(item))for(let i=0;i<ring.length;i++)ring[i]=point(ring[i]);return}
 const p=elementPoint(item),next=point(p);p.splice(0,2,...next);const [w,d]=elementSize(type,item),size=[round(w*sx),round(d*sy)];
 if(type==='labels'){item[2]={radius:1,...item[2],radius:round(size[0]/2)};return}
 if(type==='checkpoints'){item.radius=round(size[0]/2);return}
 if(['customObjects','fences','chairs'].includes(type)){item.width=size[0];item.depth=size[1]}else item.size=size;
 if(type==='customObjects'&&item.collision){if(item.collision.kind==='box'){item.collision.width*=sx;item.collision.depth*=sy}if(item.collision.kind==='circle')item.collision.radius*=Math.min(sx,sy)}
}
export function transformSelection(doc,items,{x,y,width,depth,angle}){
 const frame=selectionFrame(doc,items);if(!frame)throw Error('Selecciona elementos para transformarlos.');
 if(![x,y,width,depth,angle].every(Number.isFinite)||Math.abs(x)>100000||Math.abs(y)>100000||width<.02||depth<.02||width>2000||depth>2000||Math.abs(angle)>360000)throw Error('Revisa posición, medidas y giro.');
 const sx=width/frame.width,sy=depth/frame.depth;if(items.length>1&&Math.abs(sx-sy)>1e-5)throw Error('Los conjuntos conservan sus proporciones al cambiar de tamaño.');
 if(frame.circular&&Math.abs(sx-sy)>1e-5)throw Error('Un punto de activación mantiene su forma circular.');
 return transaction(doc,items,(staged,selected)=>{
  if(Math.abs(sx-1)>1e-8||Math.abs(sy-1)>1e-8)for(const sel of selected){const o=staged[sel.type][sel.index];scaleItem(sel.type,o,frame.center,sx,sy,selected.length===1?frame.angle:0);if(!o.poly)itemEdit(o,true).resized=true}
  const degrees=angle-(frame.relative?0:frame.angle);if(degrees)rotateSelections(staged,selected,frame.center,degrees,captureSelection(staged,selected));
  const actual=selectionGeometry(staged,selected).center;translateSelections(staged,selected,x-actual[0],y-actual[1]);
 });
}
export function groupSelection(doc,items,name='Conjunto'){
 const selected=expandGroups(doc,items);if(selected.length<2)throw Error('Selecciona al menos dos elementos para agruparlos.');
 const id=freshEditorId('group');transaction(doc,selected,(staged,list)=>{for(const s of list)Object.assign(itemEdit(staged[s.type][s.index],true),{groupId:id,groupName:String(name||'Conjunto').trim().slice(0,100),groupAngle:0})});return selected;
}
export function ungroupSelection(doc,items){return transaction(doc,expandGroups(doc,items),(staged,list)=>{for(const s of list){const e=itemEdit(staged[s.type][s.index]);delete e.groupId;delete e.groupName;delete e.groupAngle}})}
export function lockSelection(doc,items,locked){const selected=expandGroups(doc,items);if(!selected.length)throw Error('Selecciona elementos para bloquearlos o desbloquearlos.');for(const s of selected)itemEdit(doc[s.type][s.index],true).locked=!!locked;return selected}
export function reorderSelection(doc,items,direction){
 const selected=expandGroups(doc,items);if(!selected.length||selected.some(s=>!SCENE_KINDS.includes(s.type)))throw Error('Elige objetos, público o edificios. El suelo y los puntos de recorrido conservan sus capas.');
 if(!['forward','backward','reset'].includes(direction))throw Error('Orden visual no válido.');
 const orders=selected.map(s=>sceneDrawOrder(s.type,doc[s.type][s.index]));
 const delta=direction==='reset'?0:Math.max(-1000-Math.min(...orders),Math.min(1000-Math.max(...orders),direction==='forward'?10:-10));
 return transaction(doc,selected,(staged,list)=>{for(const s of list){const e=itemEdit(staged[s.type][s.index],true);if(direction==='reset')delete e.drawOrder;else e.drawOrder=sceneDrawOrder(s.type,staged[s.type][s.index])+delta}staged.metadata.precisionGeometry=true});
}
function layoutUnits(doc,items){
 const units=new Map();for(const s of expandGroups(doc,items)){const id=itemEdit(doc[s.type][s.index]).groupId||s.type+':'+s.index;if(!units.has(id))units.set(id,[]);units.get(id).push(s)}return[...units.values()];
}
export function arrangeSelection(doc,items,mode){
 const units=layoutUnits(doc,items),minimum=mode.startsWith('distribute')?3:2;if(units.length<minimum)throw Error('Selecciona al menos '+minimum+' elementos o grupos independientes.');
 const selected=units.flat();return transaction(doc,selected,(staged)=>{
  const frames=units.map(items=>({items,...selectionGeometry(staged,items)})),overall=selectionGeometry(staged,selected),axis=/X|left|right/.test(mode)?0:1;
  if(mode.startsWith('distribute')){
   frames.sort((a,b)=>a.bounds[axis]-b.bounds[axis]);const end=frames.at(-1).bounds[axis+2],start=frames[0].bounds[axis],sum=frames.reduce((n,f)=>n+f.bounds[axis+2]-f.bounds[axis],0),gap=(end-start-sum)/(frames.length-1);let cursor=start;
   for(const f of frames){const delta=cursor-f.bounds[axis];translateSelections(staged,f.items,axis===0?delta:0,axis===1?delta:0);cursor+=f.bounds[axis+2]-f.bounds[axis]+gap}
  }else for(const f of frames){let delta;if(['left','bottom'].includes(mode))delta=overall.bounds[axis]-f.bounds[axis];else if(['right','top'].includes(mode))delta=overall.bounds[axis+2]-f.bounds[axis+2];else delta=overall.center[axis]-f.center[axis];translateSelections(staged,f.items,axis===0?delta:0,axis===1?delta:0)}
 });
}
export function captureBlock(doc,items,{embed=false}={}){
 const selected=expandGroups(doc,items,true),frame=selectionFrame(doc,selected);if(!frame)throw Error('Selecciona los elementos que quieres copiar o guardar.');
 const layers=Object.fromEntries(EDITABLE_KINDS.map(kind=>[kind,[]]));for(const s of selected){const item=clone(doc[s.type][s.index]);itemEdit(item,true).locked=false;layers[s.type].push(item)}
 const local={metadata:{mapKey:'clipboard'},...layers};const picks=EDITABLE_KINDS.flatMap(type=>layers[type].map((_,index)=>({type,index,vertex:-1})));translateSelections(local,picks,-frame.center[0],-frame.center[1]);
 local.resources=resourceManifest({...local,resources:doc.resources||[]},embed);
 return validateBlock({schema:'apulso-editor-block-v1',layers:Object.fromEntries(EDITABLE_KINDS.map(k=>[k,local[k]])),resources:local.resources});
}
export function validateBlock(block){
 if(block?.schema!=='apulso-editor-block-v1'||!block.layers||typeof block.layers!=='object')throw Error('El archivo no es una selección o plantilla válida.');
 const count=EDITABLE_KINDS.reduce((n,k)=>n+(block.layers[k]?.length||0),0);if(count<1||count>5000)throw Error('Una selección debe contener entre 1 y 5000 elementos.');
 validateResourceManifest(block.resources||[]);validateMapDocument({metadata:{mapKey:'clipboard'},...block.layers,resources:block.resources||[]});return block;
}
export function placeBlock(doc,input,{point=[0,0],angle=0,group=false,name='Plantilla'}={}){
 const block=clone(validateBlock(input)),groups=new Map(),temp={metadata:{mapKey:'clipboard'},...Object.fromEntries(EDITABLE_KINDS.map(k=>[k,block.layers[k]||[]])),resources:block.resources||[]};
 if(!point.every(Number.isFinite)||!Number.isFinite(angle))throw Error('Posición o giro de colocación no válido.');
 const items=EDITABLE_KINDS.flatMap(type=>temp[type].map((o,index)=>{const e=itemEdit(o,true);e.locked=false;if(e.groupId){if(!groups.has(e.groupId))groups.set(e.groupId,freshEditorId('group'));e.groupId=groups.get(e.groupId)}if(type==='checkpoints')o.id=freshEditorId('checkpoint');return{type,index,vertex:-1}}));
 if(angle)rotateSelections(temp,items,[0,0],angle,captureSelection(temp,items));translateSelections(temp,items,...point);
 if(group&&items.length>1){groupSelection(temp,items,name);for(const s of items)itemEdit(temp[s.type][s.index],true).groupAngle=angle;}
 const staged={...doc,metadata:{...doc.metadata},resources:[...(doc.resources||[])]},selected=[];
 for(const a of block.resources||[])if(!staged.resources.some(x=>x.id===a.id))staged.resources.push(a);
 for(const kind of EDITABLE_KINDS){staged[kind]=[...(doc[kind]||[])];for(const o of temp[kind]){selected.push({type:kind,index:staged[kind].length,vertex:-1});staged[kind].push(o)}}
 validateMapDocument(staged);if(items.some(s=>!['labels','checkpoints'].includes(s.type)))staged.metadata.precisionGeometry=true;
 Object.assign(doc,staged);return selected;
}
export function portableBlock(block){return{...clone(block),resources:embedDocumentAssets({...block.layers,resources:block.resources}).resources}}
