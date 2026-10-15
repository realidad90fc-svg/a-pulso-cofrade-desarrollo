// DOM and Canvas integration, not a substitute for testing Safari/Chromium.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const runtime=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const require=createRequire((process.env.APULSO_DOM_TEST_MODULES||'/workspace/scratch/068044d9504c/qa-env/node_modules')+'/');
const {parseHTML}=require('linkedom'),{indexedDB}=require('fake-indexeddb');
const {createCanvas,Image:NativeImage}=runtime('@napi-rs/canvas');
const root=new URL('../',import.meta.url).pathname;
const {window}=parseHTML(fs.readFileSync(path.join(root,'editor-arenal.html'),'utf8')),document=window.document;
const canvases=new WeakMap(),frames=[],storage=new Map();
function adaptCanvas(node){
 if(node.localName!=='canvas'||canvases.has(node))return node;
 const native=createCanvas(Number(node.getAttribute('width'))||300,Number(node.getAttribute('height'))||150);canvases.set(node,native);
 for(const key of ['width','height'])Object.defineProperty(node,key,{get:()=>native[key],set:v=>{native[key]=v},configurable:true});
 const context=native.getContext('2d'),draw=context.drawImage.bind(context);context.drawImage=(image,...args)=>draw(canvases.get(image)||image,...args);
 node.setPointerCapture=()=>{};
 node.getContext=()=>context;node.getBoundingClientRect=()=>({left:0,top:0,width:1050,height:700,right:1050,bottom:700});return node;
}
const create=document.createElement.bind(document);document.createElement=(name,...args)=>adaptCanvas(create(name,...args));for(const c of document.querySelectorAll('canvas'))adaptCanvas(c);
const inputProto=window.HTMLInputElement.prototype;
Object.defineProperty(inputProto,'checked',{get(){return this.hasAttribute('checked')},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked')},configurable:true});
Object.defineProperty(inputProto,'disabled',{get(){return this.hasAttribute('disabled')},set(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled')},configurable:true});
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.getAttribute('value')||this.querySelector('option')?.getAttribute('value')||''},set(value){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(value))},configurable:true});
for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=function(){this.open=true};dialog.close=function(){this.open=false}}
const baseCreate=document.createElement;document.createElement=(name,...args)=>{const n=baseCreate(name,...args);if(name==='dialog'){n.showModal=function(){this.open=true};n.close=function(){this.open=false}}return n};
class Image extends NativeImage{set src(v){super.src=String(v).startsWith('file:')?new URL(v).pathname:path.join(root,String(v).replace(/^\.\//,''))}get src(){return super.src}addEventListener(type,fn){if(type==='load'){const old=this.onload;this.onload=()=>{old?.();fn()}}}}
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
window.matchMedia=()=>({matches:false,addEventListener(){}});window.indexedDB=indexedDB;window.open=()=>({});window.requestAnimationFrame=fn=>frames.push(fn);
Object.assign(globalThis,{window,document,Image,localStorage,indexedDB,location:{search:'',protocol:'https:'},devicePixelRatio:1,requestAnimationFrame:window.requestAnimationFrame,confirm:()=>true});
Object.defineProperty(globalThis,'FormData',{value:class{constructor(form){this.values=new Map([...form.querySelectorAll('[name]')].map(n=>[n.name,n.value]))}get(name){return this.values.get(name)}},configurable:true});
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL(String(url),new URL('file://'+root)).pathname,'utf8'))});
// Worker-native canvas fallback is exercised too; browser UI canvases remain DOM nodes.
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
await import('../editor-arenal.mjs');
const flush=async()=>{for(let i=0;i<25;i++){await new Promise(r=>setTimeout(r,10));let n=0;while(frames.length&&n++<100)frames.shift()(performance.now())}};
await flush();
const $=id=>document.getElementById(id);
assert($('loading').hidden,'Editor initialization must complete');
assert($('map-select').querySelectorAll('option').length>=17,'Every original map must remain selectable');
$('open-city').onclick();await flush();
assert($('city-dialog').open,'City catalogue opens from the toolbar');
const form=$('city-form').querySelector('form');form.querySelector('[name=name]').value='Calle de prueba';form.querySelector('[name=barrio]').value='Triana';
await form.onsubmit({preventDefault(){}});await flush();
assert($('map-kind').textContent.includes('Mapa propio'),'New map opens in the editor');
const active=$('map-select').value;assert(active.startsWith('city-'));
const doc=JSON.parse(storage.get('apulso-universal-editor-v2:'+active));assert.equal(doc.metadata.map,'Calle de prueba');
assert.equal(doc.roads.length,0,'New map starts empty');
// Create, rename, move and reopen a real street point through editor controls.
const pointer=(type,x,y)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerType:'mouse',button:0,pointerId:1});$('editor-canvas').dispatchEvent(e)};
assert.equal($('tree-preview-gallery').querySelectorAll('[data-tree]').length,8,'Each vegetation model has an image');
const previewBefore=canvases.get($('tree-preview')).toBuffer('image/png');
$('tree-variant').value='tree-4';$('tree-variant').dispatchEvent(new window.Event('change'));
assert(!$('tree-cycle').checked,'Choosing a model must place that exact model');
assert($('tree-preview-name').textContent.includes('Palmera'));
assert.notDeepEqual(canvases.get($('tree-preview')).toBuffer('image/png'),previewBefore,'Image updates with the selected vegetation');
document.querySelector('[data-tool="tree"]').onclick();pointer('pointerdown',200,200);pointer('pointerup',200,200);$('save').onclick();
assert.equal(JSON.parse(storage.get('apulso-universal-editor-v2:'+active)).trees[0].variant,'tree-4');
document.querySelector('[data-tool="house"]').onclick();for(const [x,y]of [[650,180],[850,180],[850,300],[650,300]]){pointer('pointerdown',x,y);pointer('pointerup',x,y)}$('finish-shape').onclick();
document.querySelector('[data-tool="select"]').onclick();pointer('pointerdown',750,240);pointer('pointerup',750,240);
$('facade-shop').value='pharmacy';$('facade-shop').dispatchEvent(new window.Event('change'));$('facade-blade-depth').value='1.1';$('facade-blade-sign').value='pharmacy';
$('facade-apply').click();$('save').onclick();
assert.equal(JSON.parse(storage.get('apulso-universal-editor-v2:'+active)).houses[0].facade.bladeDepth,1.1,'Hanging sign configuration is applied and saved');
$('street-name-text').value='Arfe de prueba';$('street-trigger-radius').value='.6';
document.querySelector('[data-tool="street-name"]').onclick();pointer('pointerdown',500,350);pointer('pointerup',500,350);
$('save').onclick();let pointDoc=JSON.parse(storage.get('apulso-universal-editor-v2:'+active));
assert.equal(pointDoc.labels[0][0],'Arfe de prueba');assert.equal(pointDoc.labels[0][2].radius,.6);
$('street-name-text').value='Calle corregida';$('street-trigger-radius').value='1.4';$('rename-street').onclick();$('save').onclick();
pointDoc=JSON.parse(storage.get('apulso-universal-editor-v2:'+active));assert.equal(pointDoc.labels[0][0],'Calle corregida');assert.equal(pointDoc.labels[0][2].radius,1.4);
const anchor=[...pointDoc.labels[0][1]];document.querySelector('[data-tool="select"]').onclick();
pointer('pointerdown',500,350);pointer('pointermove',540,370);pointer('pointerup',540,370);$('save').onclick();
pointDoc=JSON.parse(storage.get('apulso-universal-editor-v2:'+active));assert.notDeepEqual(pointDoc.labels[0][1],anchor,'Point can be moved by dragging');
$('open-city').onclick();await flush();
const streetTab=[...document.querySelectorAll('[data-city-tab]')].find(n=>n.dataset.cityTab==='streets');streetTab.onclick();await flush();
const search=$('city-context').querySelector('input');search.value='adriano';search.oninput();await new Promise(r=>setTimeout(r,180));await flush();
assert($('city-results').textContent.includes('Adriano'),'A street from an existing map is found');
const attach=[...$('city-results').querySelectorAll('button')].find(b=>b.textContent.includes('Usar mapa en hermandad'));assert(attach);await attach.onclick();await flush();
const add=[...$('city-form').querySelectorAll('button')].find(b=>b.textContent==='Añadir zona al itinerario');assert(add);await add.onclick();await flush();
assert($('city-results').querySelector('.city-visit'),'Map is attached to a brotherhood');
await add.onclick();await flush();assert.equal($('city-results').querySelectorAll('.city-visit').length,1,'Repeated attachment does not duplicate the zone');
const p=JSON.parse(storage.get('apulso-city-project-v1'));assert.equal(p.maps.length,18);assert(Object.values(p.itineraries).some(v=>v.length===1));
// Reuse actual geometry by reference and verify that its canonical source is saved.
streetTab.onclick();await flush();
const searchAgain=$('city-context').querySelector('input');searchAgain.value='Adriano';searchAgain.oninput();await new Promise(r=>setTimeout(r,180));await flush();
const link=[...$('city-results').querySelectorAll('button')].find(b=>b.textContent==='Enlazar mapa');assert(link);await link.onclick();await flush();$('save').onclick();
const linked=JSON.parse(storage.get('apulso-universal-editor-v2:'+active));assert.equal(linked.zoneRefs.length,1);assert.equal(linked.roads.length,0,'Linked roads must not be copied into the local layer');
assert(storage.has('apulso-universal-editor-v2:RegresoArenal'),'Shared source is available to the game preview');
const savedBefore=storage.get('apulso-universal-editor-v2:'+active);const openAgain=$('map-select');openAgain.value='RegresoArenal';openAgain.onchange();await flush();openAgain.value=active;openAgain.onchange();await flush();
assert.equal(JSON.parse(storage.get('apulso-universal-editor-v2:'+active)).zoneRefs.length,1,'Map/zone link survives switching and reopening');
assert.deepEqual(JSON.parse(storage.get('apulso-universal-editor-v2:'+active)).labels[0],pointDoc.labels[0],'Name, activation radius and position survive reopen');
assert.equal(JSON.parse(storage.get('apulso-universal-editor-v2:'+active)).houses[0].facade.bladeSign,'pharmacy','Shop symbol survives reopen');

const out=new URL('../../qa-renders/',import.meta.url);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(new URL('editor-canvas.png',out),canvases.get($('editor-canvas')).toBuffer('image/png'));
clearTimeout();
console.log('PASS editor UI: all 17 maps, catalogue, create/open/save new map, existing-street search, attach to brotherhood, duplicate prevention, reference-only linking and reopen. DOM/Canvas only; browser QA remains separate.');
process.exit(0);
