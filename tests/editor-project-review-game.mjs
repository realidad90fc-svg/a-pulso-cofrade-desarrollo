// DOM and Canvas integration, not a substitute for testing Safari/Chromium.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const runtime=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const require=createRequire((process.env.APULSO_DOM_TEST_MODULES||'/workspace/scratch/068044d9504c/qa-env/node_modules')+'/');
const {parseHTML}=require('linkedom'),{indexedDB}=require('fake-indexeddb');
const {createCanvas,Image:NativeImage}=runtime('@napi-rs/canvas');
const root=fileURLToPath(new URL('../',import.meta.url));
const {window}=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8')),document=window.document;
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

class Audio {constructor(){this.currentTime=0;this.listeners={}}setAttribute(){}addEventListener(type,fn){this.listeners[type]=fn}play(){queueMicrotask(()=>this.listeners.playing?.());return Promise.resolve()}pause(){}}
globalThis.Audio=Audio;Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
Object.defineProperty(window.HTMLElement.prototype,'clientWidth',{get:()=>390,configurable:true});Object.defineProperty(window.HTMLElement.prototype,'clientHeight',{get:()=>844,configurable:true});window.devicePixelRatio=1;
const {blankMapDocument}=await import('../city-project.mjs');
const {defaultGameplay}=await import('../map-gameplay.mjs');
const {makeReviewPreview}=await import('../editor-engine-review.mjs');
const {CONTENT_STEPS}=await import('../content-catalogue.mjs');
const {saveTestRequest,readEditorTest,readTestResult,validateTestRequest}=await import('../editor-test-session.mjs');
const {MapGameplayRuntime}=await import('../map-gameplay-runtime.mjs');
const doc=blankMapDocument({key:'city-test-handoff',name:'Arfe para probar'});doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.startPose={x:20,y:20,angle:0};doc.gameplay=defaultGameplay();doc.gameplay.collision.mode='replace';
const pose={x:17,y:18,angle:25},preview=makeReviewPreview(doc,null,{type:'user'},pose),request=await saveTestRequest({stepId:CONTENT_STEPS[7].id,pose,preview});
assert.equal(await readEditorTest(''),null);assert.equal((await readEditorTest('?editorTest='+request.id)).stepId,CONTENT_STEPS[7].id);
assert.throws(()=>validateTestRequest({...request,createdAt:Date.now()-86400001}),/caducado/);assert.deepEqual(doc.startPose,{x:20,y:20,angle:0});
location.search='?editorTest='+request.id;let returned;location.assign=url=>returned=url;
const progress=JSON.stringify({prefs:{recordmapa1BueMue:123.4,numEstampitas:8,pasoElegido:2,mapaElegido:3},active:{map:3,step:2,snapshot:{sentinel:true}}});storage.set('chicotaz-original-web-v2',progress);
const attached=[],attach=MapGameplayRuntime.prototype.attach;MapGameplayRuntime.prototype.attach=function(sim,snapshot){attached.push(sim);return attach.call(this,sim,snapshot)};
await import('../game.js?project-review-game');
const settle=async()=>{for(let i=0;i<35;i++)await new Promise(r=>setTimeout(r,10))};await settle();
assert(!document.getElementById('entry').hidden,document.getElementById('load-detail').textContent);document.getElementById('enter').onclick();await settle();
const $=id=>document.getElementById(id);assert(!(''+$('load-detail').textContent).includes('No se ha podido'),$('load-detail').textContent);assert($('game-review-panel'));assert.equal(attached.length,1);
const sim=attached[0];assert.equal(sim.step.variant.key,'JesusPenas');const p=sim.position(sim.stepEntity.transform);assert(Math.abs(p.x-17)<.001&&Math.abs(p.y-18)<.001);assert.equal(sim.angle(sim.stepEntity.transform),25);
assert.equal(storage.get('chicotaz-original-web-v2'),progress,'Editor tests never replace saved progress or chosen paso');
$('game-sound').onclick();assert.equal(storage.get('chicotaz-original-web-v2'),progress,'Test sound preferences remain transient');
$('review-live-overlay').checked=false;$('review-live-overlay').onchange();assert.equal(sim.review.overlay,false);
$('review-live-pause').onclick();assert.equal(sim.timeScale,0);$('review-live-frame').onclick();assert.equal(sim.timeScale,0);assert($('review-live-pause').textContent.includes('Reanudar'));
$('review-live-capture').onclick();await settle();let result=await readTestResult(request.id);assert.equal(result.event,'marked');assert(result.footprints.length>0);assert.equal(result.mapKey,doc.metadata.mapKey);
const {recordReviewEvent,drawGameReview}=await import('../game-review.mjs');
sim.review.overlay=true;drawGameReview(createCanvas(390,844).getContext('2d'),[30,0,0,-30,-300,800],sim);
sim.state.status='failed';const failure='La manigueta toca una valla de prueba';void recordReviewEvent(sim,{type:'failed',reason:failure});$('review-live-return').onclick();await settle();result=await readTestResult(request.id);assert.equal(result.reason,failure,'Returning immediately must preserve the actual failure');
assert(returned.includes('map='+doc.metadata.mapKey)&&returned.includes('editorTest='+request.id));assert.equal(storage.get('chicotaz-original-web-v2'),progress);
MapGameplayRuntime.prototype.attach=attach;
console.log('Real game entry: IDB temporary pose and eight-paso selection, expiry validation, unchanged game progress/settings, real footprints, overlay, pause/single-frame, capture and immediate failure return passed. DOM/Canvas, not browser or EXE QA.');
process.exit(0);
