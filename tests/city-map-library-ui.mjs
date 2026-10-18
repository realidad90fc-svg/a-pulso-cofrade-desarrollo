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
const {createCityProject,readCityProject,addCityMap}=await import('../city-project.mjs');
const p=createCityProject(),made=addCityMap(p,{name:'Arfe',purpose:'street'}),original={key:'original',name:'Referencia antigua',type:'native'};
p.maps.push(original);p.zones.push({id:'map:original',mapKey:'original',name:original.name,whole:true,bounds:null,streets:[]});
const doc=made.document;doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.startPose={x:10,y:10,angle:0};doc.gameplay=defaultGameplay();doc.gameplay.route.enabled=true;doc.gameplay.route.events=[newRouteEvent('finish',[30,30])];
const docs={[made.meta.key]:doc,original:blankMapDocument(original)},catalog=[...p.maps];let active=made.meta.key,backups=[],openedProject=0;
localStorage.setItem(CITY_KEY,JSON.stringify(p));localStorage.setItem(MAP_STORAGE_PREFIX+active,JSON.stringify(doc));
const sidebar=document.createElement('aside');sidebar.className='sidebar';document.body.append(sidebar);
const manager=setupCityManager({catalog,getData:()=>docs[active],getMapKey:()=>active,getDocument:k=>docs[k]||JSON.parse(localStorage.getItem(MAP_STORAGE_PREFIX+k)),openMap:k=>{active=k},onRegisterMap:m=>{if(!catalog.some(x=>x.key===m.key))catalog.push(m)},onNewDocument:(k,d)=>{docs[k]=d;active=k},snapshot(){},changed(){},saveLocal(){localStorage.setItem(MAP_STORAGE_PREFIX+active,JSON.stringify(docs[active]));return true},show(){},focus(){},getSelection:()=>[],getView:()=>({bounds:[0,0,40,40]}),getImage:()=>null,openProject:()=>openedProject++,beforeActivation:async label=>backups.push({label,project:structuredClone(manager.project())})});
const click=async(host,text)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,'Missing action: '+text);await b.onclick()};
await manager.open('maps');assert.equal($('city-results').querySelectorAll('[data-map-key]').length,1,'Originals are separated from own maps');
await click($('city-results'),'Nombre y usos');let form=$('city-form').querySelector('form');form.querySelector('[name=name]').value='Arfe remasterizada';await form.onsubmit({preventDefault(){}});assert.equal(manager.project().maps[0].name,'Arfe remasterizada');
await click($('city-results'),'Asignar a hermandad');const step=CONTENT_STEPS.find(s=>s.implemented);$('city-brotherhood').value=step.brotherhoodId;$('city-brotherhood').onchange();await click($('city-form'),'Añadir al recorrido');assert.equal($('city-itinerary-state').dataset.state,'draft');await $('city-activate-itinerary').onclick();assert.equal($('city-itinerary-state').dataset.state,'live');
const visitId=manager.project().itineraries[step.brotherhoodId][0].id;await click($('city-results'),'Añadir otra pasada');assert.equal($('city-itinerary-state').dataset.state,'pending');assert.equal(manager.project().maps.length,2,'Repeating never copies a map');await click($('city-results'),'Quitar de esta hermandad');assert.equal(manager.project().campaignItineraries[step.brotherhoodId].visits[0].id,visitId,'Removing from draft leaves the active itinerary until Apply');assert.equal(manager.project().itineraries[step.brotherhoodId].length,1);await $('city-activate-itinerary').onclick();
await manager.open('maps');await click($('city-results'),'Eliminar');assert($('city-confirm-trash'));assert($('city-form').textContent.includes('Hermandades en el juego'));await $('city-confirm-trash').onclick();assert(manager.project().maps[0].trashed);assert.equal(manager.project().itineraries[step.brotherhoodId].length,0);assert(!manager.project().campaignItineraries[step.brotherhoodId]);assert(backups.at(-1).project.maps[0].trashed!==true);assert(localStorage.getItem(MAP_STORAGE_PREFIX+made.meta.key),'Geometry retained');assert.notEqual(active,made.meta.key,'Editor switches away from the deleted map');
await manager.open('trash');assert.equal($('city-results').querySelectorAll('[data-map-key]').length,1);await click($('city-results'),'Restaurar mapa');assert(!manager.project().maps[0].trashed);assert.equal(manager.project().itineraries[step.brotherhoodId].length,0);
await manager.open('help');assert.equal($('city-results').querySelectorAll('.city-help-card').length,6);await $('city-project-backup').onclick();assert.equal(openedProject,1);assert(!$('city-dialog').open);
// Dependencies are explained before the confirmation action is offered.
docs.original.zoneRefs=[{zoneId:'map:'+made.meta.key,offset:[0,0],angle:0}];await manager.open('maps');const card=$('city-results').querySelector('[data-map-key="'+made.meta.key+'"]');await click(card,'Eliminar');assert(!$('city-confirm-trash'));assert($('city-form').textContent.includes('Primero retira los vínculos'));
console.log('Map management UI: own/reference library, rename, assignments, draft/live/pending, remove versus delete, recovery checkpoint, editor fallback, trash restore, shared dependency explanation and guide/backups passed. DOM/Canvas only.');
process.exit(0);
