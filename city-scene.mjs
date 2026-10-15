import {drawSurface,drawRoof,drawTree,drawFurniture} from './editor-materials.mjs';
import {drawFacadeDecor,facadeVisualBounds} from './editor-facades.mjs';
import {drawUrbanElement,urbanIsMarking} from './editor-urban-elements.mjs';
import {polygonBounds} from './city-project.mjs';
import {drawStreetTriggerGuide} from './street-identifiers.mjs';
const hits=(a,b)=>!b||a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
// Shared scenery painter for map cards, linked zones and new playable maps.
// Guides/selection handles are intentionally owned by the editor only.
export function paintCityScene(ctx,doc,pixel,zoom,getImage=()=>null,visible=null,{crowd=true,labels=false}={}){
 const floor=getImage('sharedassets2.assets:373');
 for(const kind of ['roads','sidewalks'])for(const o of doc[kind]||[])if(o.poly&&hits(polygonBounds(o.poly),visible))drawSurface(ctx,o.poly,kind,o.material||(kind==='roads'?'road-art-granite':'sidewalk-art-caliza'),pixel,zoom,floor,visible);
 for(const o of doc.urban||[])if(urbanIsMarking(o.type))drawUrbanElement(ctx,o,pixel,zoom);
 for(const o of doc.houses||[])if(o.poly&&hits(polygonBounds(o.poly),visible))drawRoof(ctx,o.poly,o.material||o.key||'realista-mixta-tradicional',pixel,getImage,zoom,o);
 for(const o of doc.houses||[])if(o.poly&&o.facade&&hits(facadeVisualBounds(o),visible))drawFacadeDecor(ctx,o,pixel,zoom);
 for(const o of doc.trees||[])drawTree(ctx,o,pixel,zoom,getImage);
 for(const kind of ['fences','chairs'])for(const o of doc[kind]||[])drawFurniture(ctx,o,kind==='fences'?'fence':'chair',pixel,zoom);
 for(const o of doc.urban||[])if(!urbanIsMarking(o.type))drawUrbanElement(ctx,o,pixel,zoom);
 if(crowd)for(const o of doc.people||[]){
  const image=getImage(o.key),[x,y]=pixel(...o.point),w=(o.size?.[0]||.19)*zoom,h=(o.size?.[1]||.19)*zoom;
  ctx.save();ctx.translate(x,y);ctx.rotate(-(o.angle||0)*Math.PI/180);
  if(image)ctx.drawImage(image,-w/2,-h/2,w,h);else{ctx.fillStyle='#b9a18a';ctx.beginPath();ctx.arc(0,0,w*.42,0,2*Math.PI);ctx.fill()}
  ctx.restore();
 }
 if(labels)for(const label of doc.labels||[])drawStreetTriggerGuide(ctx,label,pixel,zoom);
}
