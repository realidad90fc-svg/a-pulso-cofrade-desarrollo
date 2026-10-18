import {drawSurface,drawRoof,drawTree,drawFurniture} from './editor-materials.mjs';
import {drawFacadeDecor,facadeVisualBounds} from './editor-facades.mjs';
import {drawUrbanElement,urbanIsMarking} from './editor-urban-elements.mjs';
import {polygonBounds} from './city-project.mjs';
import {drawStreetTriggerGuide} from './street-identifiers.mjs';
import {drawTrafficSign} from './editor-object-render.mjs';
import {drawCustomObject} from './custom-assets.mjs';
import {orderedSceneItems,scenePhaseIncludes} from './scene-order.mjs';
const hits=(a,b)=>!b||a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
// The editor, map cards and both game render paths share this painter and order.
export function paintCityObjects(ctx,doc,pixel,zoom,getImage=()=>null,visible=null,{crowd=true,phase='all',filter=()=>true,personSize=()=>[.19,.19],roofPainter=null}={}){
 for(const {type,item:o,index,order} of orderedSceneItems(doc)){
  if(!scenePhaseIncludes(order,phase)||!filter(type,o,index))continue;
  if(type==='houses'){
   if(!o.poly)continue;
   if(hits(polygonBounds(o.poly),visible)){
    if(roofPainter)roofPainter(o,index);else drawRoof(ctx,o.poly,o.material||o.key||'realista-mixta-tradicional',pixel,getImage,zoom,o);
   }
   if(o.facade&&hits(facadeVisualBounds(o),visible))drawFacadeDecor(ctx,o,pixel,zoom);
  }else if(type==='trees')drawTree(ctx,o,pixel,zoom,getImage);
  else if(type==='fences'||type==='chairs')drawFurniture(ctx,o,type==='fences'?'fence':'chair',pixel,zoom);
  else if(type==='urban'){if(!urbanIsMarking(o.type))drawUrbanElement(ctx,o,pixel,zoom);}
  else if(type==='signs')drawTrafficSign(ctx,o,pixel,zoom);
  else if(type==='customObjects')drawCustomObject(ctx,o,pixel,zoom);
  else if(type==='people'&&crowd){
   const size=o.size||personSize(o),[x,y]=o.point,w=size[0]*zoom,h=size[1]*zoom;
   if(!hits([x-size[0]/2,y-size[1]/2,x+size[0]/2,y+size[1]/2],visible))continue;
   const image=getImage(o.key)||getImage(o.key?.split(':').at(-1)),p=pixel(x,y);
   ctx.save();ctx.translate(...p);ctx.rotate(-(o.angle||0)*Math.PI/180);
   if(image)ctx.drawImage(image,-w/2,-h/2,w,h);else{ctx.fillStyle='#b99976';ctx.beginPath();ctx.arc(0,0,w*.42,0,2*Math.PI);ctx.fill()}
   ctx.restore();
  }
 }
}
// Guides/selection handles are intentionally owned by the editor only.
export function paintCityScene(ctx,doc,pixel,zoom,getImage=()=>null,visible=null,options={}){
 const {labels=false,phase='all',onlyFloor=false}=options;
 if(phase!=='above'){
  const floor=getImage('sharedassets2.assets:373');
  for(const kind of ['roads','sidewalks'])for(const o of doc[kind]||[])if(o.poly&&hits(polygonBounds(o.poly),visible))drawSurface(ctx,o.poly,kind,o.material||(kind==='roads'?'road-art-granite':'sidewalk-art-caliza'),pixel,zoom,floor,visible,o);
  for(const o of doc.urban||[])if(urbanIsMarking(o.type))drawUrbanElement(ctx,o,pixel,zoom);
 }
 if(!onlyFloor)paintCityObjects(ctx,doc,pixel,zoom,getImage,visible,options);
 if(labels)for(const label of doc.labels||[])drawStreetTriggerGuide(ctx,label,pixel,zoom);
}
