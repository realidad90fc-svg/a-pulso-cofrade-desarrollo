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
const {setupCityManager}=await import('../city-manager.mjs');
const {CITY_KEY,MAP_STORAGE_PREFIX,blankMapDocument}=await import('../city-project.mjs');
const {defaultGameplay,newRouteEvent}=await import('../map-gameplay.mjs');
const {CONTENT_STEPS,BROTHERHOODS}=await import('../content-catalogue.mjs');
const {MapGameplayRuntime}=await import('../map-gameplay-runtime.mjs');
const {makeProjectPackage,validateProjectPackage}=await import('../editor-project-package.mjs');
const $=id=>document.getElementById(id),settle=async()=>{for(let i=0;i<40;i++)await new Promise(r=>setTimeout(r,10))};
const chosen=CONTENT_STEPS.find(s=>s.implemented),brotherhood=BROTHERHOODS.find(b=>b.id===chosen.brotherhoodId);
const doc=blankMapDocument({key:'city-arfe-web',name:'Arfe nueva'});doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.startPose={x:10,y:10,angle:25};doc.gameplay=defaultGameplay();doc.gameplay.collision.mode='replace';doc.gameplay.route.enabled=true;doc.gameplay.route.threeStars=50;doc.gameplay.route.twoStars=80;doc.gameplay.route.events=[{...newRouteEvent('entry',[10,10]),id:'entry-a',heading:25},{...newRouteEvent('entry',[30,30]),id:'entry-b',heading:205},{...newRouteEvent('checkpoint',[20,20]),id:'cp-a'},{...newRouteEvent('finish',[30,30]),id:'finish-a'}];
const {saveCustomAsset}=await import('../custom-assets.mjs');const tile=createCanvas(16,16);tile.getContext('2d').fillStyle='#8b7955';tile.getContext('2d').fillRect(0,0,16,16);const asset=await saveCustomAsset({id:'asset-arfe-tile',name:'Mi pavimento',category:'roads',width:1,depth:1,angle:0,collision:{kind:'none'},image:tile.toDataURL()});const {image,...assetMeta}=asset;doc.resources=[assetMeta];doc.roads[0].material=asset.id;
const sidebar=document.createElement('aside');sidebar.className='sidebar';document.body.append(sidebar);let before=0;
const manager=setupCityManager({catalog:[{key:doc.metadata.mapKey,name:doc.metadata.map,type:'user'}],getData:()=>doc,getMapKey:()=>doc.metadata.mapKey,getDocument:()=>doc,openMap(){},onRegisterMap(){},onNewDocument(){},snapshot(){},changed(){},saveLocal(){localStorage.setItem(MAP_STORAGE_PREFIX+doc.metadata.mapKey,JSON.stringify(doc));return true},show(){},focus(){},getSelection:()=>[],getView:()=>({bounds:[0,0,40,40]}),getImage:()=>null,beforeActivation:async()=>before++});
manager.open('brotherhoods');$('city-brotherhood').value=chosen.brotherhoodId;$('city-brotherhood').onchange();
await [...$('city-form').querySelectorAll('button')].find(b=>b.textContent==='Añadir al recorrido').onclick();await settle();assert($('city-activate-itinerary'));assert(!$('city-activate-itinerary').disabled);
await $('city-activate-itinerary').onclick();await settle();assert.equal(before,1);assert(JSON.parse(storage.get(CITY_KEY)).campaignItineraries[chosen.brotherhoodId]);
const visit=manager.project().itineraries[chosen.brotherhoodId][0],id='city-route:'+visit.id+':'+chosen.id;
const pkg=makeProjectPackage({meta:{id:'project-ui',name:'Sevilla nueva'},project:manager.project(),documents:{[doc.metadata.mapKey]:doc},resources:[asset]});assert(validateProjectPackage(JSON.parse(JSON.stringify(pkg))).city.project.campaignItineraries[chosen.brotherhoodId]);
// Explicit repeat reuses the same canonical map, with opposite direction.
await [...$('city-results').querySelectorAll('button')].find(b=>b.textContent==='Añadir otra pasada').onclick();await settle();assert.equal(manager.project().itineraries[chosen.brotherhoodId].length,2);assert.equal(manager.project().maps.length,1);
const entries=$('city-results').querySelectorAll('select[aria-label="Entrada para esta hermandad"]'),finishes=$('city-results').querySelectorAll('select[aria-label="Llegada de este tramo"]');entries[1].value='entry-b';await entries[1].onchange();finishes[1].value='entry-a';await finishes[1].onchange();await $('city-activate-itinerary').onclick();await settle();assert.equal(before,2);$('city-dialog').close();
const oldRecord={bestTimeMs:123,stars:3,completed:true};storage.set('chicotaz-original-web-v2',JSON.stringify({prefs:{numEstampitas:12},campaign:{records:{'prior-map-record':oldRecord}}}));
const attached=[],attach=MapGameplayRuntime.prototype.attach;MapGameplayRuntime.prototype.attach=function(sim,snapshot){attached.push(sim);return attach.call(this,sim,snapshot)};
await import('../game.js?city-campaign-web');await settle();assert(!$('entry').hidden,$('load-detail').textContent);$('enter').onclick();await settle();$('mode-week').onclick();
[...$('day-list').children].find(c=>c.querySelector('strong').textContent===({ 'domingo-ramos':'Domingo de Ramos','jueves-santo':'Jueves Santo','lunes-santo':'Lunes Santo'}[brotherhood.dayId]||brotherhood.dayId)).onclick();
[...$('campaign-brotherhood-list').children].find(c=>c.querySelector('strong').textContent===brotherhood.name).onclick();assert.equal($('campaign-route-list').children.length,2);assert($('campaign-route-list').textContent.includes('Arfe nueva'));
$('campaign-route-list').children[0].onclick();assert($('campaign-targets').textContent.includes('00:50'));$('campaign-start').onclick();await settle();assert.equal(attached.length,1,$('load-detail').textContent);let sim=attached.at(-1);assert.equal(sim.map.variant.kind,'city');assert.equal(sim.angle(sim.stepEntity.transform),25);assert.equal(sim.step.id,chosen.engineId);assert.equal(sim.mapContext.key,doc.metadata.mapKey);
// Restart from the campaign result retains its authored source and arrival.
for(let n=0;n<420;n++)sim.tick(1/60);assert.equal(sim.state.status,'playing');sim.gameplay.completed.add('cp-a');sim.setPosition(sim.stepEntity.transform,[30,30,0]);sim.controller.animator.play('pasoBajado');sim.controller.martillo=false;sim.gameplay.tick(sim);
frames.shift()(performance.now());assert(!$('campaign-result-screen').hidden,$('toast').textContent);const saved=JSON.parse(storage.get('chicotaz-original-web-v2'));assert(saved.campaign.records[id].completed);assert.equal(saved.campaign.records['prior-map-record'].bestTimeMs,123);assert.equal(saved.prefs.numEstampitas,12);
$('campaign-repeat').onclick();await settle();assert.equal(attached.length,2);assert.equal(attached.at(-1).mapContext.key,doc.metadata.mapKey);
console.log('Editor → attach/repeat street → independent entry/arrival → activate with recovery point → project backup → Semana Santa menu → correct authored map/paso → real arrival/result/save → retry, preserving prior records and stamps passed. DOM/Canvas only.');
process.exit(0);
