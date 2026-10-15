import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {setupGameplayEditor} from '../editor-gameplay-ui.mjs';
import {blankMapDocument,validateMapDocument} from '../city-project.mjs';
const ids=new Map();
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.value='';this.checked=false;this.listeners={};this.options=[];}
 set id(v){this._id=v;ids.set(v,this)}get id(){return this._id}
 set innerHTML(html){this._html=html;for(const m of html.matchAll(/<(input|select|button|p)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);e.id=m[2];e.value=/\bvalue="([^"]*)"/.exec(m[0])?.[1]||'';e.checked=/\bchecked\b/.test(m[0]);this.children.push(e)}}
 append(...items){this.children.push(...items)}prepend(...items){this.children.unshift(...items)}
 replaceChildren(...items){this.children=items;this.options=items;if(!items.some(x=>x.value===this.value))this.value=items[0]?.value||''}
 addEventListener(k,cb){this.listeners[k]=cb}
}
const sidebar=new Element(),toolbar=new Element();globalThis.document={createElement:t=>new Element(t),getElementById:id=>ids.get(id),querySelector:s=>s==='.sidebar'?sidebar:toolbar};
let document=blankMapDocument({key:'city-ui',name:'Prueba UI'}),snapshots=0,changes=0,message='';
const state={tool:'pan',working:[],selectedItems:[]};
const ui=setupGameplayEditor({state,getData:()=>document,getDocument:()=>document,catalog:[{key:'city-ui',name:'Prueba UI'}],snapshot:()=>snapshots++,changed:()=>changes++,show:t=>message=t,requestDraw(){},configureTool:t=>{state.tool=t;state.working=[]},pixel:(x,y)=>[x,y],getZoom:()=>20,focus(){}});
const $=id=>ids.get(id),click=id=>$(id).onclick();
$('collision-kind').value='blocked';click('collision-draw');ui.down([1,1]);ui.down([4,1]);ui.down([4,4]);ui.down([1,4]);assert(ui.finish());assert.equal(document.gameplay.collision.zones.length,1);assert.equal(document.gameplay.collision.zones[0].kind,'blocked');assert.equal(changes,1);
click('collision-pick');ui.down([2,2]);ui.move([3,2]);ui.up();assert.equal(document.gameplay.collision.zones[0].poly[0][0],2);
$('collision-vertex').value='0';$('collision-x').value='2.5';$('collision-y').value='1';click('collision-vertex-save');assert.equal(document.gameplay.collision.zones[0].poly[0][0],2.5);
click('collision-vertex-add');assert.equal(document.gameplay.collision.zones[0].poly.length,5);click('collision-vertex-delete');assert.equal(document.gameplay.collision.zones[0].poly.length,4);
const before=JSON.stringify(document);$('collision-vertex').value='0';$('collision-x').value='999999999';click('collision-vertex-save');assert.equal(JSON.stringify(document),before);
$('collision-minx').value='0';$('collision-miny').value='0';$('collision-maxx').value='30';$('collision-maxy').value='30';click('collision-bounds');assert(document.gameplay.collision.zones.some(z=>z.kind==='boundary'));
document.chairs=[{point:[5,5],width:.4,depth:.4}];state.selectedItems=[{type:'chairs',index:0}];click('collision-object-off');assert.equal(document.chairs[0].collision,false);assert.equal(document.gameplay.collision.mode,'replace');
$('route-enabled').checked=true;$('route-ordered').checked=true;$('route-three').value='100';$('route-two').value='160';click('route-settings');assert(document.gameplay.route.enabled);assert.equal(document.gameplay.route.twoStars,160);
$('route-type').value='checkpoint';$('route-name').value='Control Arfe';$('route-radius').value='.8';$('route-hold').value='0';$('route-tolerance').value='20';$('route-heading').value='';click('route-place');ui.down([5,6]);assert.equal(document.gameplay.route.events[0].name,'Control Arfe');assert.deepEqual(document.gameplay.route.events[0].position,[5,6]);
$('route-type').value='presentation';$('route-type').onchange();$('route-name').value='Baratillo';click('route-place');ui.down([10,10]);assert.equal(document.gameplay.route.events[1].type,'presentation');assert(document.gameplay.route.events[1].lowered);click('route-up');assert.equal(document.gameplay.route.events[0].name,'Baratillo');
$('route-type').value='finish';$('route-type').onchange();click('route-place');ui.down([20,20]);click('route-check');assert(message.includes('válidos'));
$('route-x').value='22';$('route-y').value='21';click('route-save-event');assert.deepEqual(document.gameplay.route.events.at(-1).position,[22,21]);
click('route-pick');ui.down([22,21]);ui.move([23,22]);ui.up();assert.deepEqual(document.gameplay.route.events.at(-1).position,[23,22]);validateMapDocument(document);
const moduleRoot=process.env.APULSO_DOM_TEST_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;const {createCanvas}=createRequire(import.meta.url)(moduleRoot?moduleRoot+'/@napi-rs/canvas':'@napi-rs/canvas');const canvas=createCanvas(700,700);ui.overlay(canvas.getContext('2d'));assert(snapshots>10);
console.log('Editor gameplay UI: draw/select/drag zones, exact vertices, insert/remove points, invalid-contour rollback, boundaries, object collisions, rules, ordered events, presentation defaults, arrival, exact positions and Canvas overlay passed.');
