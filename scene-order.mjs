import {itemEdit} from './editor-item-state.mjs';
import {overheadType} from './overhead-elements.mjs';

// Drawing levels are independent of the clearance used by the physics engine.
// Floors and editor guides have their own passes and cannot cover the scenery.
export const SCENE_KINDS=['houses','fences','chairs','people','signs','urban','customObjects','trees'];
export const ACTOR_DRAW_ORDER=40;
export function automaticDrawOrder(type,item){
 if(type==='trees')return 80;
 if(type==='houses')return 60;
 if(type==='urban'){
  if(overheadType(item?.type))return 70;
  if(item?.type==='tree-grille')return 5;
  if(item?.type==='bollard')return 10;
  if(['lamp-sevilla','lamp-modern','bus-shelter'].includes(item?.type))return 65;
  return 25;
 }
 return{fences:20,chairs:20,people:30,signs:50,customObjects:35}[type]??0;
}
export const sceneDrawOrder=(type,item)=>itemEdit(item).drawOrder??automaticDrawOrder(type,item);
export function orderedSceneItems(doc){
 return SCENE_KINDS.flatMap(type=>(doc?.[type]||[]).map((item,index)=>({type,item,index,order:sceneDrawOrder(type,item)}))).sort((a,b)=>a.order-b.order);
}
export const scenePhaseIncludes=(order,phase)=>phase==='below'?order<ACTOR_DRAW_ORDER:phase==='above'?order>=ACTOR_DRAW_ORDER:true;
