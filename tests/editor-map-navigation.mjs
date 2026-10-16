import assert from 'node:assert/strict';
import {createMapNavigation,moveMapGesture} from '../editor-map-navigation.mjs';
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const world=(v,p)=>[v.cx+(p[0]-v.w/2)/v.zoom,v.cy-(p[1]-v.h/2)/v.zoom];
// The world point between the fingers follows their midpoint, including at
// zoom limits. Translation and scale are tested together and independently.
for(const zoom of [1.5,2,24,100,145])for(const ratio of [.01,.5,1,2,100]){
 const v={cx:13,cy:-7,zoom,w:900,h:650},before=[[170,240],[370,240]],mid=[340,310];
 const anchor=world(v,[270,240]);
 moveMapGesture(v,before,[[mid[0]-100*ratio,mid[1]],[mid[0]+100*ratio,mid[1]]]);
 close(v.zoom,Math.max(1.5,Math.min(145,zoom*ratio)));
 world(v,mid).forEach((n,i)=>close(n,anchor[i]));
}
const coincident={cx:0,cy:0,zoom:24,w:900,h:650};
moveMapGesture(coincident,[[50,50],[50,50]],[[60,60],[60,60]]);
assert(Object.values(coincident).every(Number.isFinite));
function fixture(){
 const events=[],moves=[],captured=new Set(),view={cx:0,cy:0,zoom:24,w:900,h:650};
 let tool='road',draggable=false;
 const canvas={style:{},setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const nav=createMapNavigation({canvas,point:e=>[e.clientX,e.clientY],getView:()=>view,getTool:()=>tool,canDrag:()=>draggable,
  down:e=>events.push(['down',e.pointerId,e.pointerType,e.clientX]),move:e=>events.push(['move',e.pointerId]),up:e=>events.push([e.type,e.pointerId]),
  pan:(x,y)=>moves.push([x,y]),redraw:()=>{},beginTouchEdit:()=>{events.push(['begin']);return 'checkpoint'},
  commitTouchEdit:c=>events.push(['commit',c]),cancelTouchEdit:c=>events.push(['cancel',c])});
 const event=(type,x=100,y=100,options={})=>({type,clientX:x,clientY:y,pointerType:'mouse',pointerId:1,button:0,buttons:type==='pointerup'?0:1,preventDefault(){this.prevented=true},...options});
 return{nav,events,moves,view,canvas,captured,event,setTool:t=>tool=t,setDraggable:d=>draggable=d};
}
{
 const f=fixture(),{nav,event,events,moves,canvas}=f;
 nav.down(event('pointerdown',100,100,{button:2,buttons:2}));
 nav.move(event('pointermove',180,130,{button:-1,buttons:2}));
 nav.up(event('pointerup',180,130,{button:2}));
 assert.deepEqual(moves,[[80,30]]);assert.deepEqual(events,[]);assert.equal(canvas.style.cursor,'');assert(!nav.isNavigating());
 const menu=event('contextmenu');nav.contextMenu(menu);assert(menu.prevented);
 // A right-button release without a matching navigation is never an edit.
 nav.up(event('pointerup',180,130,{button:2}));assert.deepEqual(events,[]);
}
{
 const {nav,event,events,moves}=fixture();
 nav.down(event('pointerdown'));nav.move(event('pointermove',110));
 nav.move(event('pointermove',110,100,{button:2,buttons:3}));
 nav.move(event('pointermove',160,120,{buttons:3}));
 nav.move(event('pointermove',160,120,{button:2,buttons:1}));
 nav.move(event('pointermove',170,120));nav.up(event('pointerup',170,120));
 assert.deepEqual(moves,[[50,20]]);
 assert.deepEqual(events,[['down',1,'mouse',100],['move',1],['move',1],['pointerup',1]]);
}
{
 const {nav,event,events}=fixture();
 nav.down(event('pointerdown'));nav.move(event('pointermove',100,100,{button:2,buttons:3}));
 nav.move(event('pointermove',120,100,{button:0,buttons:2}));
 nav.move(event('pointermove',150,100,{buttons:2}));nav.up(event('pointerup',150,100,{button:2}));
 assert.equal(events.filter(e=>e[0]==='pointerup').length,1,'Releasing left during right-pan commits the existing edit once');
}
{
 const {nav,event,events}=fixture(),touch=(type,x,id=1)=>event(type,x,100,{pointerType:'touch',pointerId:id});
 nav.down(touch('pointerdown',100));assert.deepEqual(events,[]);
 nav.up(touch('pointerup',100));assert.deepEqual(events,[['down',1,'touch',100],['pointerup',1]]);
 events.length=0;nav.down(touch('pointerdown',100));nav.down(touch('pointerdown',200,2));
 nav.move(touch('pointermove',120));nav.move(touch('pointermove',220,2));
 nav.up(touch('pointerup',220,2));nav.move(touch('pointermove',180));nav.up(touch('pointerup',180));
 assert.deepEqual(events,[],'Two fingers and the remaining finger never reach editing');assert(!nav.isNavigating());
}
{
 const f=fixture(),{nav,event,events}=f;f.setDraggable(true);
 const touch=(type,x,id=1)=>event(type,x,100,{pointerType:'touch',pointerId:id});
 nav.down(touch('pointerdown',100));nav.move(touch('pointermove',130));nav.down(touch('pointerdown',230,2));
 assert.deepEqual(events,[['begin'],['down',1,'touch',100],['move',1],['cancel','checkpoint']]);
 nav.up(touch('pointerup',230,2));nav.up(touch('pointerup',130));
 events.length=0;nav.down(touch('pointerdown',100));nav.move(touch('pointermove',130));nav.up(touch('pointerup',130));
 assert.deepEqual(events.at(-1),['commit','checkpoint']);
}
{
 const f=fixture(),{nav,event,events,canvas}=f;
 nav.down(event('pointerdown',100,100,{button:2,buttons:2}));nav.cancel();
 assert.equal(canvas.style.cursor,'');assert.equal(f.captured.size,0);assert(!nav.isNavigating());
 nav.down(event('pointerdown',100,100,{pointerType:'touch'}));f.setTool('tree');nav.up(event('pointerup',100,100,{pointerType:'touch'}));assert.deepEqual(events,[],'Changing tools cancels a pending touch');
 nav.down(event('pointerdown'));nav.lostCapture(event('lostpointercapture'));assert.deepEqual(events.at(-1),['pointercancel',1]);
}
console.log('Map navigation: 25 combined pan/zoom cases, limits, secondary clicks, mouse chords, touch taps, two-finger takeover, cancellation and capture passed.');
