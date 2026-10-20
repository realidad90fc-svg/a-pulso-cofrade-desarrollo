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
const {createCityProject,addCityMap,assignCityZone,CITY_KEY,MAP_STORAGE_PREFIX}=await import('../city-project.mjs');
const {BROTHERHOODS,CONTENT_STEPS}=await import('../content-catalogue.mjs');
const {CAMPAIGN_DATA}=await import('../campaign-data.mjs');
const {saveCustomAsset}=await import('../custom-assets.mjs');
const {activateCityItinerary}=await import('../city-campaign.mjs');
const {defaultGameplay,newRouteEvent}=await import('../map-gameplay.mjs');
const {defaultProcession,DEFAULT_UNIFORM}=await import('../procession-model.mjs');
const {MapGameplayRuntime}=await import('../map-gameplay-runtime.mjs');
const $=id=>document.getElementById(id),settle=async()=>{for(let i=0;i<45;i++)await new Promise(r=>setTimeout(r,10))};
const image=createCanvas(50,100),c=image.getContext('2d');c.fillStyle='#bf3565';c.fillRect(5,5,40,90);const asset=await saveCustomAsset({id:'asset-runtime-paso',name:'Paso aéreo',category:'decor',width:1.4,depth:3,angle:0,collision:{kind:'none'},image:image.toDataURL('image/png')});
const project=createCityProject([]),added=addCityMap(project,{name:'Calle nueva con paso importado'}),doc=added.document,b=BROTHERHOODS.find(b=>!CONTENT_STEPS.some(s=>s.brotherhoodId===b.id)),id='imported:'+b.id;
doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.startPose={x:20,y:20,angle:0};doc.gameplay=defaultGameplay();doc.gameplay.collision.mode='replace';doc.gameplay.route.enabled=true;doc.gameplay.route.events=[newRouteEvent('finish',[30,30])];doc.procession=defaultProcession();doc.procession.nazarenes.points=[[20,0],[20,40]];doc.procession.acolytes.points=[[19.6,0],[19.6,40]];
const nextMap=addCityMap(project,{name:'Segundo mapa del mismo cortejo'}),nextDoc=nextMap.document;nextDoc.roads=structuredClone(doc.roads);nextDoc.startPose={x:20,y:20,angle:0};nextDoc.gameplay=defaultGameplay();nextDoc.gameplay.collision.mode='replace';nextDoc.gameplay.route.enabled=true;nextDoc.gameplay.route.events=[newRouteEvent('finish',[30,30])];nextDoc.procession=defaultProcession();nextDoc.procession.nazarenes.points=[[0,20],[40,20]];const exit=newRouteEvent('exit',[25,25]);exit.targetMap=nextMap.meta.key;exit.targetEntry='';doc.gameplay.route.events.push(exit);
project.brotherhoodSettings={[b.id]:{uniform:{...DEFAULT_UNIFORM,robe:'#78114c'},step:{assetId:asset.id,name:'Paso personalizado jugable',baseStepId:'BueMue',type:'palio',width:1.4,length:3,rotation:0,standing:4.2,crouched:3.5,lowered:3.1}}};assignCityZone(project,b.id,'map:'+added.meta.key);activateCityItinerary(project,b.id,id,()=>doc);
storage.set(MAP_STORAGE_PREFIX+nextMap.meta.key,JSON.stringify(nextDoc));storage.set(CITY_KEY,JSON.stringify(project));storage.set(MAP_STORAGE_PREFIX+added.meta.key,JSON.stringify(doc));storage.set('chicotaz-original-web-v2',JSON.stringify({prefs:{numEstampitas:9},campaign:{records:{prior:{bestTimeMs:123,stars:3,completed:true}}}}));
const sims=[],attach=MapGameplayRuntime.prototype.attach;MapGameplayRuntime.prototype.attach=function(sim,snapshot){sims.push(sim);return attach.call(this,sim,snapshot);};
await import('../game.js?imported-paso-e2e');await settle();assert(!$('entry').hidden,$('load-detail').textContent);$('enter').onclick();await settle();$('mode-week').onclick();
const day=CAMPAIGN_DATA.days.find(d=>d.id===b.dayId);assert(day);[...$('day-list').children].find(n=>n.querySelector('strong').textContent===day.name).onclick();[...$('campaign-brotherhood-list').children].find(n=>n.querySelector('strong').textContent===b.name).onclick();assert($('campaign-step-list').textContent.includes('Palio'));$('campaign-step-list').children[0].onclick();$('campaign-step-routes').children[0].onclick();$('campaign-start').onclick();await settle();
assert(sims.length,$('load-detail').textContent);const sim=sims.at(-1);assert.equal(sim.step.imported.assetId,asset.id);assert.equal(sim.step.variant.key,id);assert.equal(sim.step.imported.width,1.4);assert.equal(sim.map.variant.kind,'city');assert(sim.processionActors.some(a=>a.uniform.robe==='#78114c'));assert(sim.processionActors.some(a=>a.role==='acolytes'));for(let i=0;i<180;i++)sim.tick(1/60);assert.equal(sim.state.status,'playing');
frames.shift()(performance.now());sim.setPosition(sim.stepEntity.transform,[25,25,0]);sim.gameplay.tick(sim);frames.shift()(performance.now());await settle();const transitioned=sims.at(-1);assert.notEqual(transitioned,sim,'Map exit creates the next authored map');assert.equal(transitioned.step.imported.assetId,asset.id);assert.equal(transitioned.map.variant.document.procession.uniform.robe,'#78114c');assert.deepEqual(transitioned.map.variant.document.procession.nazarenes.points,nextDoc.procession.nazarenes.points);
transitioned.setPosition(transitioned.stepEntity.transform,[30,30,0]);transitioned.controller.animator.play('pasoBajado');transitioned.controller.martillo=false;transitioned.gameplay.tick(transitioned);frames.shift()(performance.now());assert(!$('campaign-result-screen').hidden);const saved=JSON.parse(storage.get('chicotaz-original-web-v2'));assert(saved.campaign.records[sim.mapContext?.key]||Object.keys(saved.campaign.records).some(k=>k.includes('imported:')));assert.equal(saved.campaign.records.prior.bestTimeMs,123);assert.equal(saved.prefs.numEstampitas,9);$('campaign-repeat').onclick();await settle();assert.equal(sims.at(-1).step.imported.assetId,asset.id);
console.log('Imported paso game E2E: real image in persistent asset store → new brotherhood/palio in Semana Santa → correct base controller and calibrated paso → clothed cortejo on independent paths → playable arrival/result/retry, preserving existing records and stamps. DOM/Canvas only.');process.exit(0);
