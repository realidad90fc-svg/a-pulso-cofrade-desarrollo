// Navigation owns its pointer sequence; editing never receives a secondary
// mouse click or the leftover finger of a two-finger gesture.
const gap=points=>Math.hypot(points[1][0]-points[0][0],points[1][1]-points[0][1]);
const midpoint=points=>[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2];
export function moveMapGesture(view,before,after){
 const a=midpoint(before),b=midpoint(after),distance=gap(before);
 const anchor=[view.cx+(a[0]-view.w/2)/view.zoom,view.cy-(a[1]-view.h/2)/view.zoom];
 if(distance>=1)view.zoom=Math.max(1.5,Math.min(145,view.zoom*Math.max(1,gap(after))/distance));
 view.cx=anchor[0]-(b[0]-view.w/2)/view.zoom;
 view.cy=anchor[1]+(b[1]-view.h/2)/view.zoom;
}
const editingEvent=(e,type=e.type)=>({
 type,pointerId:e.pointerId,pointerType:e.pointerType,clientX:e.clientX,clientY:e.clientY,
 button:0,buttons:e.buttons,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey,altKey:e.altKey,
 preventDefault:()=>e.preventDefault()
});
export function createMapNavigation({canvas,point,getView,getTool,canDrag,down,move,up,pan,redraw,
 beginTouchEdit=()=>{},commitTouchEdit=()=>{},cancelTouchEdit=()=>{},enabled=()=>true}){
 const touches=new Map();
 let pending=null,touchEdit=null,gesture=false,pair=null,mousePan=null,edit=null,lastMouse=null,dispatching=false;
 const call=(fn,e)=>{dispatching=true;try{return fn(e)}finally{dispatching=false}};
 const capture=id=>canvas.setPointerCapture?.(id);
 const release=id=>{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id)};
 const cursor=()=>{canvas.style.cursor=mousePan||gesture?'grabbing':''};
 const currentPair=()=>[...touches.values()].slice(0,2).map(t=>t.pos);
 function stopTouchEdit(cancel){
  if(!touchEdit)return;
  const active=touchEdit;touchEdit=null;
  if(cancel)cancelTouchEdit(active.checkpoint);
  else{call(up,editingEvent(active.event,'pointerup'));commitTouchEdit(active.checkpoint)}
 }
 function startTouchEdit(event){
  const start=pending;pending=null;
  if(!start||start.tool!==getTool())return false;
  touchEdit={checkpoint:beginTouchEdit(),event};
  call(down,editingEvent(start.event,'pointerdown'));
  return true;
 }
 function panMouse(pos){
  const dx=pos[0]-mousePan.pos[0],dy=pos[1]-mousePan.pos[1];
  mousePan.pos=pos;if(dx||dy)pan(dx,dy);
 }
 function onDown(e){
  if(!enabled())return;
  if(e.pointerType==='mouse'&&e.button===2){
   e.preventDefault();capture(e.pointerId);mousePan={id:e.pointerId,pos:point(e)};lastMouse=mousePan.pos;cursor();return;
  }
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();capture(e.pointerId);
  if(e.pointerType==='touch'){
   touches.set(e.pointerId,{pos:point(e),event:e});
   if(touches.size>=2){pending=null;stopTouchEdit(true);gesture=true;pair=currentPair();cursor();return}
   if(!gesture)pending={event:e,pos:point(e),tool:getTool()};
   return;
  }
  if(mousePan)return;
  edit={id:e.pointerId,type:e.pointerType,event:e};lastMouse=point(e);call(down,e);
 }
 function onMove(e){
  const pos=point(e);
  if(e.pointerType==='touch'){
   const touch=touches.get(e.pointerId);if(!touch)return;
   e.preventDefault();touch.pos=pos;touch.event=e;
   if(gesture){if(touches.size>=2){const next=currentPair();moveMapGesture(getView(),pair,next);pair=next;redraw()}return}
   if(pending&&canDrag()&&Math.hypot(pos[0]-pending.pos[0],pos[1]-pending.pos[1])>=4)startTouchEdit(e);
   if(touchEdit){touchEdit.event=e;call(move,e)}
   return;
  }
  if(e.pointerType==='mouse'){
   const right=typeof e.buttons==='number'&&(e.buttons&2)!==0;
   // Pointer Events report mouse-button chords as pointermove, not down/up.
   if(!mousePan&&right){capture(e.pointerId);mousePan={id:e.pointerId,pos:lastMouse||pos};cursor()}
   if(mousePan){
    e.preventDefault();panMouse(pos);lastMouse=pos;
    if(edit&&typeof e.buttons==='number'&&(e.buttons&1)===0){call(up,editingEvent(e,'pointerup'));edit=null}
    if(typeof e.buttons==='number'&&!right){mousePan=null;cursor()}
    return;
   }
   lastMouse=pos;
  }
  if(edit?.id===e.pointerId){edit.event=e;call(move,e)}
  else if(!edit)call(move,e);
 }
 function onUp(e){
  if(e.pointerType==='touch'){
   if(!touches.has(e.pointerId))return;
   e.preventDefault();
   if(gesture){
    touches.delete(e.pointerId);pair=touches.size>=2?currentPair():null;
    if(!touches.size){gesture=false;cursor()}
   }else{
    if(e.type!=='pointercancel'&&pending&&pending.tool===getTool()){
     pending=null;
     call(down,editingEvent(e,'pointerdown'));
     call(up,editingEvent(e,'pointerup'));
    }else if(touchEdit){touchEdit.event=e;stopTouchEdit(e.type==='pointercancel')}
    pending=null;touches.delete(e.pointerId);
   }
   release(e.pointerId);return;
  }
  if(mousePan?.id===e.pointerId){
   e.preventDefault();if(e.type!=='pointercancel')panMouse(point(e));mousePan=null;lastMouse=point(e);cursor();
   if(edit&&(e.type==='pointercancel'||e.buttons===undefined||(e.buttons&1)===0)){call(up,editingEvent(e,e.type));edit=null}
   if(!edit)release(e.pointerId);return;
  }
  if(edit?.id!==e.pointerId||e.pointerType==='mouse'&&e.button!==0&&e.type!=='pointercancel')return;
  call(up,e);edit=null;release(e.pointerId);
 }
 function cancel(){
  const ids=[...touches.keys(),mousePan?.id,edit?.id].filter(id=>id!==undefined);
  pending=null;stopTouchEdit(true);touches.clear();gesture=false;pair=null;mousePan=null;
  if(edit){const active=edit;edit=null;call(up,editingEvent(active.event,'pointercancel'))}
  lastMouse=null;cursor();for(const id of ids)release(id);
 }
 return{down:onDown,move:onMove,up:onUp,cancel,
  lostCapture:e=>onUp(editingEvent(e,'pointercancel')),
  contextMenu:e=>e.preventDefault(),
  isNavigating:()=>!!mousePan||gesture,
  toolChanged:()=>{if(!dispatching)cancel()}
 };
}
