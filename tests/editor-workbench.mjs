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
await import('../editor-arenal.mjs');
const flush=async()=>{for(let i=0;i<25;i++){await new Promise(r=>setTimeout(r,10));let n=0;while(frames.length&&n++<100)frames.shift()(performance.now())}};
await flush();

const $=id=>document.getElementById(id);

// Evaluate the actual loaded CSS cascade, including the retired mobile sheet.
// This catches invisible/touch-disabled panels that DOM-only checks cannot see;
// it does not simulate browser layout or hit-testing.
const sheets=[...document.head.querySelectorAll('style,link[rel=stylesheet]')].map(el=>postcss.parse(el.localName==='style'?el.textContent:fs.readFileSync(path.join(root,el.getAttribute('href').split('?')[0]),'utf8')));
function mediaMatches(query,viewport){return query.split(',').some(part=>{
 let valid=true;
 const rest=part.replace(/\(\s*(max|min)-(width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*\)/g,(_,bound,axis,n)=>{valid&&=bound==='max'?viewport[axis]<=+n:viewport[axis]>=+n;return ''}).replace(/\(\s*pointer\s*:\s*(coarse|fine)\s*\)/g,(_,pointer)=>{valid&&=viewport.coarse===(pointer==='coarse');return ''}).replace(/\b(and|screen|all)\b/g,'').trim();
 return valid&&!rest;
})}
function cascade(element,viewport,skipLegacyFix=false){
 const values=new Map();let order=0;
 for(const css of sheets)css.walkRules(rule=>{
  for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule'&&p.name==='media'&&!mediaMatches(p.params,viewport))return;
  // Removing these declarations reproduces the shipped legacy-drawer bug.
  if(skipLegacyFix&&rule.nodes.some(d=>d.prop==='transition'&&d.value==='none')&&rule.selector==='.workbench.wb-mobile .wb-pane')return;
  for(const selector of rule.selectors){let matches=false;try{matches=element.matches(selector)}catch{continue}if(!matches)continue;
   const {A,B,C}=specificity(selector);
   rule.walkDecls(d=>{const rank=[Number(!!d.important),A,B,C,++order],old=values.get(d.prop);if(!old||rank.some((n,i)=>n!==old.rank[i]&&rank.slice(0,i).every((v,j)=>v===old.rank[j])&&n>old.rank[i]))values.set(d.prop,{rank,value:d.value})});
  }
 });return Object.fromEntries([...values].map(([k,v])=>[k,v.value]));
}
function assertTouchSheet(){
 const pane=$('mobile-settings-panel'),backdrop=$('mobile-backdrop');
 for(const viewport of [{width:390,height:844,coarse:true},{width:844,height:390,coarse:true},{width:900,height:700,coarse:true},{width:1280,height:800,coarse:false}]){
  const style=cascade(pane,viewport),shade=cascade(backdrop,viewport);
  assert.equal(style.display,'block');assert.equal(style.opacity,'1');assert.equal(style.visibility,'visible');assert.equal(style['pointer-events'],'auto');assert.equal(style.transform,'none');
  assert(+style['z-index']>+shade['z-index'],'The touch panel must be above its backdrop');
  assert(style['max-height'].includes('72dvh'),'Legacy !important must not remove the scrollable sheet height');
 }
 const legacy=cascade(pane,{width:390,height:844,coarse:true},true);
 assert.equal(legacy.opacity,'0','The regression fixture reproduces the invisible legacy drawer');assert.equal(legacy['pointer-events'],'none');
 assert.equal(cascade($('wb-left'),{width:390,height:844,coarse:true}).display,'none','Only one sheet is visible');
}

assert($('loading').hidden,$('loading').textContent);assert(document.body.classList.contains('workbench'));
assert($('wb-left').contains($('placement-preview-gallery')),'Visual library lives beside the map');assert($('mobile-settings-panel').contains($('selection-editor-panel')));assert.equal($('wb-modes').querySelectorAll('button').length,3);
assert.equal($('wb-library-categories').querySelectorAll('button').length,10);assert.equal($('placement-category').querySelectorAll('option').length,21);
$('project-auto').checked=false;$('project-auto').onchange();
$('wb-category-furniture').click();assert($('wb-placement-row'));$('wb-placement-row').click();assert.equal($('editor-canvas').dataset.tool,'fence-row');$('wb-placement-single').click();assert.equal($('editor-canvas').dataset.tool,'fence');
$('wb-category-tree').click();$('wb-library-search').value='palmera';$('wb-library-search').oninput();assert.equal([...$('placement-preview-gallery').querySelectorAll('[data-preview-item]')].filter(n=>!n.hidden).length,1);
$('wb-library-search').value='no-existe-este-modelo';$('wb-library-search').oninput();assert(!$('wb-library-empty').hidden);$('wb-category-road').click();assert.equal($('wb-library-search').value,'');assert($('wb-library-empty').hidden);
$('save').click();const original=storage.get('apulso-universal-editor-v2:RegresoArenal');$('wb-nav-layers').click();$('wb-visible-roads').click();assert(!$('roads-on').checked);$('wb-visible-roads').click();assert($('roads-on').checked);assert.equal(storage.get('apulso-universal-editor-v2:RegresoArenal'),original,'Visibility does not modify serialized maps');
$('wb-mode-route').click();assert.equal(document.body.dataset.wbMode,'route');assert(!$('route-config-panel').hidden);assert($('engine-review-panel').hidden);$('wb-mode-review').click();assert(!$('engine-review-panel').hidden);$('wb-mode-build').click();
document.querySelector('[data-wb-panel="collision-panel"]').click();$('collision-draw').click();assert(!$('collision-panel').hidden,'Collision properties stay visible while drawing');assert($('engine-review-panel').hidden);$('wb-mode-build').click();
$('wb-command-open').click();assert($('wb-command-dialog').open);$('wb-command-query').value='fotograf';$('wb-command-query').oninput();assert($('wb-command-results').textContent.includes('Fotograf'));$('wb-command-results').querySelector('button').click();assert(!$('photo-guides-panel').hidden);assert(!$('wb-command-dialog').open);
$('wb-nav-settings').click();assert.equal($('wb-settings-index').querySelectorAll('button').length,document.querySelectorAll('[data-wb-section]').length,'Every original function is reachable through the index');
$('wb-pref-layout').value='mobile';$('wb-pref-layout').onchange();assert(document.body.classList.contains('wb-mobile'));assert.equal($('wb-mobile-dock')?.querySelectorAll('button').length||document.querySelector('.wb-mobile-dock').querySelectorAll('button').length,5);
$('wb-mobile-add').click();assert.equal(document.body.dataset.wbSheet,'library');assert.equal($('wb-left').getAttribute('aria-modal'),'true');assert(!$('mobile-backdrop').hidden);$('wb-category-tree').click();$('placement-preview-gallery').querySelector('[data-preview-item="tree-4"]').click();assert(!document.body.dataset.wbSheet,'Choosing a visual model returns the touch user to the map');
$('wb-mobile-add').click();const sheetHead=$('wb-left').querySelector('.wb-pane-head');for(const [type,y]of [['pointerdown',100],['pointerup',180]]){const e=new window.Event(type,{bubbles:true});Object.assign(e,{clientX:150,clientY:y,pointerId:9});sheetHead.dispatchEvent(e)}assert(!document.body.dataset.wbSheet,'Dragging the sheet header down closes the touch panel');
$('wb-mode-route').click();assert.equal(document.body.dataset.wbSheet,'properties');assert(!$('route-config-panel').hidden);assertTouchSheet();$('wb-mode-review').click();assert.equal(document.body.dataset.wbSheet,'properties');assert(!$('engine-review-panel').hidden);assertTouchSheet();$('wb-mode-build').click();assert(!document.body.dataset.wbSheet);assert($('mobile-backdrop').hidden);
$('wb-mobile-properties').click();assert.equal(document.body.dataset.wbSheet,'properties');assert.equal($('mobile-settings-panel').getAttribute('aria-modal'),'true');assert.equal($('wb-left').getAttribute('aria-modal'),null);$('wb-properties-close').click();assert(!document.body.dataset.wbSheet);assert($('mobile-backdrop').hidden);
$('wb-pref-closeOnPlace').checked=false;$('wb-pref-closeOnPlace').onchange();$('wb-mobile-add').click();$('placement-preview-gallery').querySelector('[data-preview-item="tree-4"]').click();assert.equal(document.body.dataset.wbSheet,'library');$('mobile-backdrop').click();assert(!document.body.dataset.wbSheet);
$('wb-pref-hand').value='left';$('wb-pref-hand').onchange();$('wb-pref-touchSize').value='large';$('wb-pref-touchSize').onchange();$('wb-pref-sheetSize').value='compact';$('wb-pref-sheetSize').onchange();assert.equal(document.body.dataset.wbHand,'left');assert.equal(document.body.dataset.wbTouch,'large');assert.equal(document.body.dataset.wbSheetSize,'compact');assert.equal(JSON.parse(storage.get('apulso-workbench-preferences-v1')).hand,'left');
$('wb-reset-preferences').click();assert(!document.body.classList.contains('wb-mobile'));assert.equal(document.body.dataset.wbTouch,'normal');assert.equal(document.body.dataset.wbHand,'right');
$('open-city').click();await flush();const form=$('city-form').querySelector('form');form.querySelector('[name=name]').value='Taller visual';await form.onsubmit({preventDefault(){}});await flush();
const key=$('map-select').value,docKey='apulso-universal-editor-v2:'+key,read=()=>JSON.parse(storage.get(docKey));let doc=read();doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.trees=[{point:[8,8],radius:.35,variant:'tree-4'}];doc.startPose={x:20,y:20,angle:0};const input=$('import');Object.defineProperty(input,'files',{value:[{text:async()=>JSON.stringify(doc)}],configurable:true});await input.onchange({target:input});$('save').click();await flush();
$('wb-nav-layers').click();$('wb-lock-trees').click();$('save').click();assert.equal(read().trees[0].edit.locked,true);$('wb-lock-trees').click();$('save').click();assert.equal(read().trees[0].edit.locked,false);
const pointer=(type,x,y)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerType:'mouse',button:0,pointerId:1});$('editor-canvas').dispatchEvent(e)};
document.querySelector('[data-tool="select"]').click();const scale=670/43.6,x=525+(8-20)*scale,y=350-(8-20)*scale;pointer('pointerdown',x,y);pointer('pointerup',x,y);assert(!$('selection-editor-panel').hidden,'Selecting an actual object reveals its properties');assert(!$('wb-trees-panel').hidden);assert($('facade-panel').hidden);assert($('wb-inspector-title').textContent.includes('Vegetación'));
$('edit-angle').value='45';$('edit-transform').click();$('save').click();assert.equal(read().trees[0].rotation,45);assert($('wb-save-state').textContent.includes('Guardado'));$('wb-category-furniture').click();assert(!$('wb-furniture-panel').hidden);assert($('selection-editor-panel').hidden,'Placement properties replace the previous selection inspector');assert($('wb-placement-row'));$('wb-placement-row').click();assert.equal($('editor-canvas').dataset.tool,'fence-row');assert.equal(read().trees[0].rotation,45,'Switching to placement never changes the previous selected object');
console.log('Workbench integration: all legacy panels reachable; 21 visual families, search, contextual properties, three workspaces, real layer visibility/locks, document integrity, mobile sheets/backdrop/close, touch preferences and exact edits passed. DOM/Canvas only; browser and physical-device QA remain separate.');
process.exit(0);
