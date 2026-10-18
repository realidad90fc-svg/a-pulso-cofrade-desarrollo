// DOM and Canvas integration, not a substitute for testing Safari/Chromium.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const runtime=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const require=createRequire((process.env.APULSO_DOM_TEST_MODULES||'/workspace/scratch/068044d9504c/qa-env/node_modules')+'/');
const {parseHTML}=require('linkedom'),{indexedDB}=require('fake-indexeddb');
const postcss=require('postcss'),{calculate:specificity}=require('specificity');
const {createCanvas,Image:NativeImage}=runtime('@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const {window}=parseHTML(fs.readFileSync(path.join(root,'editor-arenal.html'),'utf8')),document=window.document;
const canvases=new WeakMap(),frames=[],storage=new Map();
function adaptCanvas(node){
 if(node.localName!=='canvas'||canvases.has(node))return node;
 const native=createCanvas(Number(node.getAttribute('width'))||300,Number(node.getAttribute('height'))||150);canvases.set(node,native);
 for(const key of ['width','height'])Object.defineProperty(node,key,{get:()=>native[key],set:v=>{native[key]=v},configurable:true});
 const context=native.getContext('2d'),draw=context.drawImage.bind(context);context.drawImage=(image,...args)=>draw(canvases.get(image)||image,...args);
 node.setPointerCapture=()=>{};
 node.getContext=()=>context;node.toDataURL=(...args)=>native.toDataURL(...args);node.getBoundingClientRect=()=>({left:0,top:0,width:1050,height:700,right:1050,bottom:700});return node;
}
const create=document.createElement.bind(document);document.createElement=(name,...args)=>adaptCanvas(create(name,...args));for(const c of document.querySelectorAll('canvas'))adaptCanvas(c);
const inputProto=window.HTMLInputElement.prototype;
Object.defineProperty(inputProto,'checked',{get(){return this.hasAttribute('checked')},set(v){v?this.setAttribute('checked',''):this.removeAttribute('checked')},configurable:true});
Object.defineProperty(inputProto,'disabled',{get(){return this.hasAttribute('disabled')},set(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled')},configurable:true});
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.getAttribute('value')||this.querySelector('option')?.getAttribute('value')||''},set(value){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(value))},configurable:true});
for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=function(){this.open=true};dialog.close=function(){this.open=false}}
const baseCreate=document.createElement;document.createElement=(name,...args)=>{const n=baseCreate(name,...args);if(name==='dialog'){n.showModal=function(){this.open=true};n.close=function(){this.open=false}}return n};
class Image extends NativeImage{set src(v){super.src=String(v).startsWith('data:')?v:String(v).startsWith('file:')?fileURLToPath(new URL(v)):path.join(root,String(v).replace(/^\.\//,''))}get src(){return super.src}addEventListener(type,fn){if(type==='load'){const old=this.onload;this.onload=()=>{old?.();fn()}}}}
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
window.matchMedia=()=>({matches:false,addEventListener(){}});window.indexedDB=indexedDB;window.open=()=>({});window.requestAnimationFrame=fn=>frames.push(fn);
Object.assign(globalThis,{window,document,Image,Event:window.Event,localStorage,indexedDB,location:{search:'',protocol:'https:'},devicePixelRatio:1,requestAnimationFrame:window.requestAnimationFrame,confirm:()=>true});
Object.defineProperty(globalThis,'FormData',{value:class{constructor(form){this.values=new Map([...form.querySelectorAll('[name]')].map(n=>[n.name,n.value]))}get(name){return this.values.get(name)}},configurable:true});
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(new URL(String(url),pathToFileURL(root))),'utf8'))});
// Worker-native canvas fallback is exercised too; browser UI canvases remain DOM nodes.
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
const {createPhotoGuides,exportProjectPhotos}=await import('../editor-photo-guides.mjs');
const {readProjectMeta}=await import('../editor-project-session.mjs');
const {estimateEarthPhotoSize}=await import('../editor-earth-scale.mjs');
window.prompt=()=>{throw Error('prompt() is not supported.')};
// Model native asynchronous close events, including a previous photo closing
// after the next photo's dialog has opened.
const priorCreate=document.createElement;document.createElement=(name,...args)=>{const n=priorCreate(name,...args);if(name==='dialog')n.close=function(){this.open=false;setTimeout(()=>this.dispatchEvent(new window.Event('close')),0)};return n};
const sample=createCanvas(32,16);sample.getContext('2d').fillStyle='#758757';sample.getContext('2d').fillRect(0,0,32,16);URL.createObjectURL=()=>sample.toDataURL('image/png');URL.revokeObjectURL=()=>{};
const $=id=>document.getElementById(id),input=$('reference-file'),messages=[];let changes=0,map='photo-map-a';
const guides=createPhotoGuides({ctx:sample.getContext('2d'),pixel:(x,y)=>[x,y],world:(x,y)=>[x,y],requestDraw(){},show:message=>messages.push(message),getMapKey:()=>map,getView:()=>({cx:20,cy:25,zoom:10}),onChange:()=>changes++});guides.bind();await guides.switchMap(map);
const settle=async()=>{for(let i=0;i<30;i++)await new Promise(r=>setTimeout(r,10))};
const file=name=>Object.assign(new Blob([sample.toBuffer('image/png')],{type:'image/png'}),{name});
function start(...files){Object.defineProperty(input,'files',{value:files,configurable:true});input.dispatchEvent(new window.Event('change'));assert($('photo-import-dialog').open);assert(input.disabled);}
function accept(height){$('photo-import-height').value=height;$('photo-import-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));}
const saved=()=>exportProjectPhotos(readProjectMeta().id,[map]);
start(file('Arfe <img onerror=evil>.png'));assert.equal($('photo-import-name').textContent,'Arfe <img onerror=evil>.png');assert.equal($('photo-import-name').children.length,0);
accept('1');assert($('photo-import-dialog').open);assert(!$('photo-import-error').hidden);assert.equal(guides.previewItems().length,0);accept('106 m');await settle();assert(!input.disabled);assert.equal(guides.previewItems().length,1);let photos=await saved(),size=estimateEarthPhotoSize(32,16,106);assert(Math.abs(photos[0].width-size.width)<.001);assert(Math.abs(photos[0].height-size.height)<.001);assert.deepEqual(photos[0].position,[20,25]);assert.equal(photos[0].scaleVersion,4);
// Cancelling the first file continues to the next one, without a stale close
// event dismissing the second form.
start(file('Cancelar.png'),file('Foto normal.png'));$('photo-import-cancel').click();await settle();assert($('photo-import-dialog').open);assert.equal($('photo-import-name').textContent,'Foto normal.png');accept('');await settle();photos=await saved();assert.equal(photos.length,2);assert.equal(photos.find(p=>p.name==='Foto normal.png').width,12);assert.equal(photos.find(p=>p.name==='Foto normal.png').height,6);
start(file('Escape.png'));$('photo-import-dialog').dispatchEvent(new window.Event('cancel',{cancelable:true}));await settle();assert.equal((await saved()).length,2);assert(!input.disabled);
start(file('Cerrar.png'));$('photo-import-dialog').close();await settle();assert.equal((await saved()).length,2);assert(!input.disabled);
start(file('Cambio de mapa.png'));map='photo-map-b';await guides.switchMap(map);await settle();assert.equal(guides.previewItems().length,0);assert.equal((await saved()).length,0);assert(!input.disabled);
map='photo-map-a';await guides.switchMap(map);assert.equal(guides.previewItems().length,2);await guides.flush();photos=await saved();assert.equal(photos.find(p=>p.name.startsWith('Arfe')).cameraHeightM,106);assert.equal(photos.find(p=>p.name==='Foto normal.png').width,12);assert.equal(changes,2);assert(!messages.some(s=>s.includes('prompt()')||s.includes('No se pudo abrir')));
console.log('Photo import: Electron prompt throws, HTML height form succeeds, invalid-height retry, unchanged Earth scale/aspect ratio, plain import, multi-file cancellation and queued close, Escape/close, map-switch cancellation, local persistence and reopen passed. DOM/Canvas only.');
process.exit(0);
