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
for(let i=0;i<30&&!document.getElementById('loading').hidden;i++)await flush();

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
 document.body.classList.add('project-restoring');assert.equal(cascade(pane,{width:390,height:844,coarse:true})['pointer-events'],'none','Project recovery still blocks editing until restoration completes');document.body.classList.remove('project-restoring');
}

assert($('loading').hidden,$('loading').textContent);assert(document.body.classList.contains('workbench'));
assert($('wb-left').contains($('placement-preview-gallery')),'Visual library lives beside the map');assert($('mobile-settings-panel').contains($('selection-editor-panel')));assert.equal($('wb-modes').querySelectorAll('button').length,3);
assert.equal($('wb-library-categories').querySelectorAll('button').length,12);assert.equal($('placement-category').querySelectorAll('option').length,22);
assert($('wb-photo-transparency-input').disabled,'The global photo slider waits for an image');assert(document.querySelector('.wb-stagebar').contains($('wb-photo-transparency')),'Photo transparency is accessible above the canvas');
$('project-auto').checked=false;$('project-auto').onchange();
$('wb-category-furniture').click();assert($('wb-placement-row'));$('wb-placement-row').click();assert.equal($('editor-canvas').dataset.tool,'fence-row');$('wb-placement-single').click();assert.equal($('editor-canvas').dataset.tool,'fence');
$('wb-category-tree').click();$('wb-library-search').value='palmera';$('wb-library-search').oninput();assert.equal([...$('placement-preview-gallery').querySelectorAll('[data-preview-item]')].filter(n=>!n.hidden).length,1);
$('wb-library-search').value='no-existe-este-modelo';$('wb-library-search').oninput();assert(!$('wb-library-empty').hidden);$('wb-category-road').click();assert.equal($('wb-library-search').value,'');assert($('wb-library-empty').hidden);
$('save').click();const original=storage.get('apulso-universal-editor-v2:RegresoArenal');$('wb-nav-layers').click();$('wb-visible-roads').click();assert(!$('roads-on').checked);$('wb-visible-roads').click();assert($('roads-on').checked);assert.equal(storage.get('apulso-universal-editor-v2:RegresoArenal'),original,'Visibility does not modify serialized maps');
$('wb-mode-route').click();assert.equal(document.body.dataset.wbMode,'route');assert(!$('route-config-panel').hidden);assert($('engine-review-panel').hidden);$('wb-mode-review').click();assert(!$('engine-review-panel').hidden);$('wb-mode-build').click();
document.querySelector('[data-wb-panel="collision-panel"]').click();$('collision-draw').click();assert(!$('collision-panel').hidden,'Collision properties stay visible while drawing');assert($('engine-review-panel').hidden);$('wb-mode-build').click();
$('wb-command-open').click();assert($('wb-command-dialog').open);$('wb-command-query').value='fotograf';$('wb-command-query').oninput();assert($('wb-command-results').textContent.includes('Fotograf'));$('wb-command-results').querySelector('button').click();assert(!$('photo-guides-panel').hidden);assert(!$('wb-command-dialog').open);
$('wb-nav-settings').click();assert.equal($('wb-settings-index').querySelectorAll('button').length,document.querySelectorAll('[data-wb-section]').length,'Every original function is reachable through the index');
$('wb-pref-layout').value='mobile';$('wb-pref-layout').onchange();assert(document.body.classList.contains('wb-mobile'));assert.equal($('wb-mobile-dock')?.querySelectorAll('button').length||document.querySelector('.wb-mobile-dock').querySelectorAll('button').length,6);
assert.equal(cascade($('wb-photo-transparency'),{width:390,height:844,coarse:true})['grid-row'],'2');assert.equal(cascade($('wb-photo-transparency-input'),{width:390,height:844,coarse:true})['min-height'],'42px','The mobile slider has a usable touch target');assert.equal(cascade(document.body,{width:390,height:844,coarse:true})['grid-template-rows'],'var(--wb-header) 94px minmax(0,1fr) var(--wb-dock)','The mobile slider has its own row above the canvas');
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
const pointer=(type,x,y,options={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerType:'mouse',button:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,pointerId:1,...options});$('editor-canvas').dispatchEvent(e);return e};
document.querySelector('[data-tool="select"]').click();const scale=670/43.6,x=525+(8-20)*scale,y=350-(8-20)*scale;pointer('pointerdown',x,y);pointer('pointerup',x,y);assert(!$('selection-editor-panel').hidden,'Selecting an actual object reveals its properties');assert(!$('wb-trees-panel').hidden);assert($('facade-panel').hidden);assert($('wb-inspector-title').textContent.includes('Vegetación'));
const treeSelection=read().trees[0];assert(!$('edit-order-forward').disabled);$('edit-order-backward').click();$('save').click();assert.equal(read().trees[0].edit.drawOrder,70);assert.equal(read().trees[0].radius,treeSelection.radius);assert.equal(read().trees[0].rotation,treeSelection.rotation);$('undo').click();$('save').click();assert.equal(read().trees[0].edit.drawOrder,undefined);$('redo').click();$('save').click();assert.equal(read().trees[0].edit.drawOrder,70);pointer('pointerdown',x,y);pointer('pointerup',x,y);$('edit-order-forward').click();$('save').click();assert.equal(read().trees[0].edit.drawOrder,80);$('edit-order-reset').click();$('save').click();assert.equal(read().trees[0].edit.drawOrder,undefined);assert($('edit-order-info').textContent.includes('automático'));
$('edit-angle').value='45';$('edit-transform').click();$('save').click();assert.equal(read().trees[0].rotation,45);assert($('wb-save-state').textContent.includes('Guardado'));$('wb-category-furniture').click();assert(!$('wb-furniture-panel').hidden);assert($('selection-editor-panel').hidden,'Placement properties replace the previous selection inspector');assert($('wb-placement-row'));$('wb-placement-row').click();assert.equal($('editor-canvas').dataset.tool,'fence-row');assert.equal(read().trees[0].rotation,45,'Switching to placement never changes the previous selected object');
$('wb-category-overhead').click();$('placement-preview-gallery').querySelector('[data-preview-item="canopy-green"]').click();assert(!$('overhead-settings').hidden);$('overhead-clearance').value='3.45';$('overhead-angle').value='30';pointer('pointerdown',525,350);pointer('pointerup',525,350);$('save').click();assert.equal(read().urban.at(-1).type,'canopy-green');assert.equal(read().urban.at(-1).clearance,3.45);assert.equal(read().urban.at(-1).angle,30);assert.equal($('editor-canvas').dataset.tool,'select','Placing a canopy selects it immediately for resizing');
document.querySelector('[data-tool="select"]').click();pointer('pointerdown',525,350);pointer('pointerup',525,350);assert(!$('overhead-apply').disabled);$('overhead-clearance').value='4.15';$('overhead-apply').click();$('overhead-standing').value='4.2';$('overhead-crouched').value='3.4';$('overhead-lowered').value='3.1';$('overhead-save-profile').click();$('save').click();assert.equal(read().urban.at(-1).clearance,4.15);assert.equal(read().gameplay.heightProfiles[0].standing,4.2);assert($('overhead-fit').textContent.includes('agacharse'));

// Resize a rotated canopy through the canvas pointer flow, not the numeric form.
const toCanvas=p=>[525+(p[0]-20)*scale,350-(p[1]-20)*scale],localPoint=(o,x,y)=>{const a=o.angle*Math.PI/180;return[o.point[0]+x*Math.cos(a)-y*Math.sin(a),o.point[1]+x*Math.sin(a)+y*Math.cos(a)]};
let canopy=read().urban.at(-1),before=structuredClone(canopy);const rightWorld=localPoint(canopy,canopy.size[0]/2,0),rightScreen=toCanvas(rightWorld),rightTarget=toCanvas(localPoint(canopy,canopy.size[0]/2+.8,0));
pointer('pointerdown',...rightScreen);pointer('pointermove',...rightTarget);pointer('pointerup',...rightTarget);$('save').click();canopy=read().urban.at(-1);assert(Math.abs(canopy.size[0]-before.size[0]-.8)<.001);assert.equal(canopy.size[1],before.size[1]);assert.equal(canopy.clearance,4.15);assert.equal(canopy.angle,30);$('undo').click();$('save').click();assert.deepEqual(read().urban.at(-1),before,'One undo restores the whole resize');$('redo').click();$('save').click();canopy=read().urban.at(-1);assert(Math.abs(canopy.size[0]-before.size[0]-.8)<.001);
// Undo/redo clears selection: select it before the touch interaction.
const centre=toCanvas(canopy.point);pointer('pointerdown',...centre);pointer('pointerup',...centre);
$('wb-pref-layout').value='mobile';$('wb-pref-layout').onchange();before=structuredClone(canopy);
let corner=toCanvas(localPoint(canopy,canopy.size[0]/2,canopy.size[1]/2)),target=toCanvas(localPoint(canopy,canopy.size[0]/2+.4,canopy.size[1]/2+.3));
pointer('pointerdown',...corner,{pointerType:'touch'});pointer('pointermove',...target,{pointerType:'touch'});pointer('pointerup',...target,{pointerType:'touch'});$('save').click();canopy=read().urban.at(-1);assert(Math.abs(canopy.size[0]-before.size[0]-.4)<.001);assert(Math.abs(canopy.size[1]-before.size[1]-.3)<.001);assert.equal(canopy.clearance,4.15);
before=structuredClone(canopy);corner=toCanvas(localPoint(canopy,canopy.size[0]/2,canopy.size[1]/2));target=toCanvas(localPoint(canopy,canopy.size[0]/2+.4,canopy.size[1]/2+.3));
pointer('pointerdown',...corner,{pointerType:'touch'});pointer('pointermove',...target,{pointerType:'touch'});pointer('pointercancel',...target,{pointerType:'touch'});$('save').click();assert.deepEqual(read().urban.at(-1),before,'Touch cancellation restores original geometry');
pointer('pointerdown',...corner,{pointerType:'touch'});pointer('pointermove',...target,{pointerType:'touch'});const escape=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(escape,{key:'Escape'});document.dispatchEvent(escape);pointer('pointerup',...target,{pointerType:'touch'});$('save').click();assert.deepEqual(read().urban.at(-1),before,'Escape cancels the drag');
pointer('pointerdown',...corner,{pointerType:'touch'});pointer('pointermove',...target,{pointerType:'touch'});pointer('pointerdown',700,300,{pointerType:'touch',pointerId:2});pointer('pointerup',700,300,{pointerType:'touch',pointerId:2});pointer('pointerup',...target,{pointerType:'touch'});$('save').click();assert.deepEqual(read().urban.at(-1),before,'A second finger cancels resizing before starting pinch');
$('wb-nav-layers').click();$('wb-lock-urban').click();pointer('pointerdown',...corner,{pointerType:'touch'});pointer('pointermove',...target,{pointerType:'touch'});pointer('pointerup',...target,{pointerType:'touch'});$('save').click();assert.deepEqual(read().urban.at(-1).size,before.size,'Locked canopies cannot be resized');

// Correct a live path without undoing any saved map element.
$('mobile-backdrop').click();$('wb-mode-build').click();$('wb-category-road').click();$('placement-preview-gallery').querySelector('[data-preview-item="road-art-granite"]').click();
const keyEvent=(key,options={})=>{const e=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(e,{key,...options});document.dispatchEvent(e);return e};
const put=p=>{const screen=toCanvas(p);pointer('pointerdown',...screen);pointer('pointerup',...screen)},pointCount=()=>Number($('wb-point-count').textContent.split(' ')[0]);
$('save').click();const savedBeforePath=storage.get(docKey),oldRoadCount=read().roads.length;
assert.equal(cascade(document.querySelector('.wb-mobile-dock'),{width:390,height:844,coarse:true}).display,'grid');assert.equal(cascade(document.querySelector('.wb-mobile-dock'),{width:390,height:844,coarse:true})['grid-template-columns'],'repeat(6,minmax(0,1fr))');
put([10,25]);put([14,25]);put([14,28]);assert.equal(pointCount(),3);const activeDescriptor=Object.getOwnPropertyDescriptor(document,'activeElement');Object.defineProperty(document,'activeElement',{value:$('street-name-text'),configurable:true});keyEvent('Backspace');keyEvent('z',{ctrlKey:true});assert.equal(pointCount(),3,'Writing in a form never removes drawing vertices');if(activeDescriptor)Object.defineProperty(document,'activeElement',activeDescriptor);else delete document.activeElement;assert(!$('wb-mobile-redo').hidden);assert($('wb-mobile-redo').disabled);
$('wb-mobile-undo').click();assert.equal(pointCount(),2);assert(!$('wb-mobile-redo').disabled);$('wb-mobile-redo').click();assert.equal(pointCount(),3);
keyEvent('Backspace');assert.equal(pointCount(),2);keyEvent('y',{ctrlKey:true});assert.equal(pointCount(),3);keyEvent('z',{ctrlKey:true});assert.equal(pointCount(),2);keyEvent('z',{ctrlKey:true,shiftKey:true});assert.equal(pointCount(),3);
$('wb-remove-point').click();$('wb-remove-point').click();$('wb-remove-point').click();assert.equal(pointCount(),0);assert($('wb-remove-point').disabled);keyEvent('z',{ctrlKey:true});assert.equal(storage.get(docKey),savedBeforePath,'Undo at zero draft vertices leaves saved objects intact');
$('wb-restore-point').click();$('wb-restore-point').click();assert.equal(pointCount(),2);put([12,30]);assert.equal(pointCount(),3);assert($('wb-restore-point').disabled,'A replacement point starts a new draft branch');$('finish-shape').click();$('save').click();assert.equal(read().roads.length,oldRoadCount+1);assert.deepEqual(read().roads.at(-1).poly,[[10,25],[14,25],[12,30]]);$('wb-mobile-undo').click();$('save').click();assert.equal(read().roads.length,oldRoadCount);$('wb-mobile-redo').click();$('save').click();assert.equal(read().roads.length,oldRoadCount+1);
$('wb-category-sidewalk').click();$('placement-preview-gallery').querySelector('[data-preview-item]').click();put([22,28]);put([25,28]);keyEvent('Delete');assert.equal(pointCount(),1);$('cancel-shape').click();assert.equal(pointCount(),0);assert($('wb-restore-point').disabled);
$('wb-category-roof').click();$('placement-preview-gallery').querySelector('[data-preview-item]').click();for(const p of [[28,5],[32,5],[32,9],[28,9]])put(p);assert.equal(pointCount(),4);keyEvent('Backspace');assert.equal(pointCount(),3);$('wb-restore-point').click();$('finish-shape').click();$('save').click();assert(read().houses.some(h=>h.poly.length===4));
// Balcony placement/length controls retain their precise values after applying.
document.querySelector('[data-tool="select"]').click();put([30,7]);$('wb-category-balcony').click();$('placement-preview-gallery').querySelector('[data-preview-item="continuous"]').click();
for(const [id,value]of [['facade-balcony-start','20'],['facade-balcony-width','35'],['facade-balcony-count','3']]){$(id).value=value;$(id).dispatchEvent(new window.Event('input',{bubbles:true}))}
$('facade-flowers').checked=true;$('facade-hangings').checked=true;assert($('facade-balcony-span').textContent.includes('20 % al 55 %'));$('facade-apply').click();$('save').click();const editedBalcony=read().houses.find(h=>h.facade?.balcony==='continuous').facade;assert.equal(editedBalcony.balconyStart,.2);assert.equal(editedBalcony.balconyWidth,.35);assert.equal(editedBalcony.balconyCount,3);assert(editedBalcony.flowers&&editedBalcony.hangings);
// The same point buttons also work for collision contours and courtyard cuts.
$('wb-mode-build').click();document.querySelector('[data-wb-panel="collision-panel"]').click();$('collision-draw').click();$('wb-properties-close').click();const zonesBefore=read().gameplay.collision.zones.length;for(const p of [[3,32],[5,32],[5,34]])put(p);$('wb-remove-point').click();assert.equal(pointCount(),2);$('wb-restore-point').click();$('finish-shape').click();$('save').click();assert.equal(read().gameplay.collision.zones.length,zonesBefore+1);assert.equal(pointCount(),0);
$('wb-mode-build').click();document.querySelector('[data-tool="select"]').click();put([2,2]);$('precision-hole').click();for(const p of [[3,3],[5,3],[5,5]])put(p);$('wb-remove-point').click();assert.equal(pointCount(),2);$('wb-restore-point').click();$('finish-shape').click();$('save').click();assert(read().roads.some(r=>r.holes?.length),'Corrected courtyard contour commits normally');
// Secondary-button navigation bypasses every original placement/drawing tool.
const mapCanvas=$('editor-canvas'),rightPan=(dx=80,dy=30)=>{
 pointer('pointerdown',420,300,{button:2,buttons:2});pointer('pointermove',420+dx,300+dy,{buttons:2});pointer('pointerup',420+dx,300+dy,{button:2});
};
const samePoint=(a,b,tolerance=.001)=>a.forEach((n,i)=>assert(Math.abs(n-b[i])<tolerance,`${a} != ${b}`));
const checkCamera=expected=>{pointer('pointermove',525,350,{buttons:0});samePoint($('coords').textContent.split(' · ').map(Number),expected,.011)};
for(const button of document.querySelectorAll('[data-tool]')){
 button.click();$('goto-all').click();$('save').click();const before=storage.get(docKey),tool=mapCanvas.dataset.tool;
 rightPan();assert.equal(mapCanvas.dataset.tool,tool);assert.equal(mapCanvas.style.cursor,'');
 $('save').click();assert.equal(storage.get(docKey),before,`Right drag must not edit with ${tool}`);
 checkCamera([20-80/scale,20+30/scale]);
 pointer('pointerdown',450,350,{pointerType:'touch'});pointer('pointerdown',600,350,{pointerType:'touch',pointerId:2});pointer('pointerup',600,350,{pointerType:'touch',pointerId:2});pointer('pointerup',450,350,{pointerType:'touch'});$('save').click();assert.equal(storage.get(docKey),before,`Two fingers must not edit with ${tool}`);
}
for(const activate of [()=>$('precision-measure').click(),()=>$('collision-draw').click(),()=>$('route-place').click(),()=>$('engine-review-pick').click()]){
 activate();$('goto-all').click();$('save').click();const before=storage.get(docKey),tool=mapCanvas.dataset.tool;rightPan();$('save').click();assert.equal(storage.get(docKey),before);assert.equal(mapCanvas.dataset.tool,tool);
}
assert(pointer('contextmenu',420,300,{button:2}).defaultPrevented,'Only the map replaces the browser context menu');
// A temporary pan keeps both live vertices and the vertex redo branch.
document.querySelector('[data-tool="road"]').click();$('goto-all').click();for(const p of [[10,25],[14,25],[14,28]])put(p);$('undo').click();assert.equal(pointCount(),2);
rightPan(100,40);assert.equal(pointCount(),2);assert(!$('wb-restore-point').disabled);$('redo').click();assert.equal(pointCount(),3);
const doubleRight=new window.Event('dblclick',{bubbles:true,cancelable:true});Object.assign(doubleRight,{button:2});mapCanvas.dispatchEvent(doubleRight);assert.equal(pointCount(),3,'Double right-click never closes the contour');
const fourth=toCanvas([10,28]);pointer('pointerdown',fourth[0]+100,fourth[1]+40);pointer('pointerup',fourth[0]+100,fourth[1]+40);$('finish-shape').click();$('save').click();assert.deepEqual(read().roads.at(-1).poly,[[10,25],[14,25],[14,28],[10,28]]);
// Mouse-button chords pause and resume an active left-button object drag.
document.querySelector('[data-tool="select"]').click();$('goto-all').click();let tree=read().trees[0],treeScreen=toCanvas(tree.point);
pointer('pointerdown',...treeScreen);pointer('pointermove',treeScreen[0]+10,treeScreen[1]);$('save').click();const afterLeft=read().trees[0].point;
pointer('pointermove',treeScreen[0]+10,treeScreen[1],{button:2,buttons:3});pointer('pointermove',treeScreen[0]+100,treeScreen[1]+50,{buttons:3});$('save').click();assert.deepEqual(read().trees[0].point,afterLeft,'Panning suspends object editing');
pointer('pointermove',treeScreen[0]+100,treeScreen[1]+50,{button:2,buttons:1});pointer('pointermove',treeScreen[0]+110,treeScreen[1]+50);pointer('pointerup',treeScreen[0]+110,treeScreen[1]+50);$('save').click();samePoint(read().trees[0].point,[tree.point[0]+20/scale,tree.point[1]]);
// Two fingers pan together. Neither their first touch nor the remaining
// finger may place a fence, append a point, or finish a row.
document.querySelector('[data-tool="fence"]').click();$('goto-all').click();$('save').click();let beforeGesture=storage.get(docKey);
const touch=(type,x,y,id=1)=>pointer(type,x,y,{pointerType:'touch',pointerId:id});
touch('pointerdown',450,350);touch('pointerdown',600,350,2);touch('pointermove',510,380);touch('pointermove',660,380,2);touch('pointerup',660,380,2);touch('pointermove',700,400);touch('pointerup',700,400);$('save').click();assert.equal(storage.get(docKey),beforeGesture);
checkCamera([20-60/scale,20+30/scale]);
const fenceCount=read().fences.length;touch('pointerdown',525,350);touch('pointerup',525,350);$('save').click();assert.equal(read().fences.length,fenceCount+1,'A normal single-finger tap still places the chosen piece');samePoint(read().fences.at(-1).point,[20-60/scale,20+30/scale]);
document.querySelector('[data-tool="road"]').click();$('goto-all').click();put([10,25]);put([14,25]);const draftCount=pointCount();touch('pointerdown',450,350);touch('pointerdown',600,350,2);touch('pointermove',470,360);touch('pointermove',620,360,2);touch('pointerup',620,360,2);touch('pointerup',470,360);assert.equal(pointCount(),draftCount);$('cancel-shape').click();
// Pinch scales about the moving midpoint and does not place a tree.
document.querySelector('[data-tool="tree"]').click();$('goto-all').click();const treeCount=read().trees.length;
touch('pointerdown',425,350);touch('pointerdown',625,350,2);touch('pointermove',325,350);touch('pointermove',725,350,2);touch('pointerup',325,350);touch('pointerup',725,350,2);$('save').click();assert.equal(read().trees.length,treeCount);
touch('pointerdown',525+4*scale,350);touch('pointerup',525+4*scale,350);$('save').click();samePoint(read().trees.at(-1).point,[22,20]);
// Taking over after the first finger has already moved an object rolls
// back that tentative edit, including its history entry.
document.querySelector('[data-tool="select"]').click();$('goto-all').click();$('save').click();beforeGesture=storage.get(docKey);tree=read().trees[0];treeScreen=toCanvas(tree.point);
touch('pointerdown',...treeScreen);touch('pointermove',treeScreen[0]+20,treeScreen[1]);touch('pointerdown',750,300,2);touch('pointerup',750,300,2);touch('pointermove',treeScreen[0]+60,treeScreen[1]);touch('pointerup',treeScreen[0]+60,treeScreen[1]);$('save').click();assert.equal(storage.get(docKey),beforeGesture,'Two-finger takeover restores document and selection drag');
$('undo').click();$('save').click();assert.equal(read().trees.length,treeCount,'The cancelled touch drag adds no undo entry');$('redo').click();$('save').click();assert.equal(storage.get(docKey),beforeGesture,'Gesture cancellation preserves the saved edit history');
document.querySelector('[data-tool="fence-row"]').click();$('goto-all').click();const rowCount=read().fences.length;
touch('pointerdown',400,450);touch('pointermove',550,450);touch('pointerdown',700,350,2);touch('pointerup',700,350,2);touch('pointerup',550,450);$('save').click();assert.equal(read().fences.length,rowCount,'Navigation takeover never finishes a partial row');
// Escape, focus loss and lost capture cannot leave navigation stuck.
document.querySelector('[data-tool="road"]').click();put([10,25]);pointer('pointerdown',420,300,{button:2,buttons:2});keyEvent('Escape');assert.equal(pointCount(),1);assert.equal(mapCanvas.style.cursor,'');pointer('pointerup',420,300,{button:2});
pointer('pointerdown',420,300,{button:2,buttons:2});window.dispatchEvent(new window.Event('blur'));assert.equal(mapCanvas.style.cursor,'');assert.equal(pointCount(),1);
pointer('pointerdown',420,300,{button:2,buttons:2});pointer('lostpointercapture',420,300);assert.equal(mapCanvas.style.cursor,'');assert.equal(pointCount(),1);
// Private reference images have their own drag state and IndexedDB storage.
// Load an actual PNG through the file-input flow, then verify camera panning
// and two-finger takeover do not alter the stored image transform.
const {exportProjectPhotos}=await import('../editor-photo-guides.mjs'),{readProjectMeta}=await import('../editor-project-session.mjs');
document.querySelector('[data-tool="reference"]').click();$('goto-all').click();const sample=createCanvas(32,32);sample.getContext('2d').fillRect(0,0,32,32);const photoFile=new Blob([sample.toBuffer('image/png')],{type:'image/png'});photoFile.name='Plano privado de prueba.png';
const photoInput=$('reference-file');Object.defineProperty(photoInput,'files',{value:[photoFile],configurable:true});window.prompt=()=>{throw Error('prompt() is not supported.')} ;
const acceptPhotoHeight=()=>{assert($('photo-import-dialog').open);$('photo-import-height').value='';$('photo-import-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));};
const originalObjectURL=URL.createObjectURL;URL.createObjectURL=()=>sample.toDataURL('image/png');photoInput.dispatchEvent(new window.Event('change'));acceptPhotoHeight();await flush();URL.createObjectURL=originalObjectURL;
assert($('reference-count').textContent.startsWith('1/'),'Reference photo imports through its normal control');
const photos=()=>exportProjectPhotos(readProjectMeta().id,[key]),photoBefore=(await photos())[0];rightPan(90,40);$('save').click();await flush();let photoAfter=(await photos())[0];assert.deepEqual(photoAfter.position,photoBefore.position);assert.equal(photoAfter.rotation,photoBefore.rotation);
let photoScreen=[...toCanvas(photoBefore.position)];photoScreen=[photoScreen[0]+90,photoScreen[1]+40];pointer('pointerdown',...photoScreen);pointer('pointermove',photoScreen[0]+10,photoScreen[1]);pointer('pointermove',photoScreen[0]+10,photoScreen[1],{button:2,buttons:3});pointer('pointermove',photoScreen[0]+70,photoScreen[1]+30,{buttons:3});pointer('pointermove',photoScreen[0]+70,photoScreen[1]+30,{button:2,buttons:1});pointer('pointermove',photoScreen[0]+80,photoScreen[1]+30);pointer('pointerup',photoScreen[0]+80,photoScreen[1]+30);$('save').click();await flush();photoAfter=(await photos())[0];samePoint(photoAfter.position,[photoBefore.position[0]+20/scale,photoBefore.position[1]]);
$('goto-all').click();photoScreen=toCanvas(photoAfter.position);touch('pointerdown',...photoScreen);touch('pointermove',photoScreen[0]+20,photoScreen[1]);touch('pointerdown',750,300,2);touch('pointerup',750,300,2);touch('pointerup',photoScreen[0]+20,photoScreen[1]);$('save').click();await flush();assert.deepEqual((await photos())[0].position,photoAfter.position,'Two-finger takeover restores the private photo transform');
// One accessible slider affects every reference, including locked images,
// without changing calibration, positions, map geometry or image bytes.
assert(!$('wb-photo-transparency-input').disabled);assert.equal($('wb-photo-transparency-value').textContent,'64%');
const importPhoto=async name=>{const file=new Blob([sample.toBuffer('image/png')],{type:'image/png'});file.name=name;Object.defineProperty(photoInput,'files',{value:[file],configurable:true});URL.createObjectURL=()=>sample.toDataURL('image/png');try{photoInput.dispatchEvent(new window.Event('change'));acceptPhotoHeight();await flush()}finally{URL.createObjectURL=originalObjectURL}};
await importPhoto('Segunda referencia.png');$('reference-locked').checked=true;$('reference-locked').onchange({target:$('reference-locked')});$('save').click();await flush();
const guidesBefore=await photos(),withoutOpacity=items=>items.map(({opacity,...item})=>item);assert.equal(guidesBefore.length,2);assert(guidesBefore.some(p=>p.locked));$('save').click();const mapBeforeOpacity=storage.get(docKey);
const setTransparency=async(value,id='wb-photo-transparency-input')=>{$(id).value=String(value);$(id).dispatchEvent(new window.Event('input',{bubbles:true}));await flush();$('save').click();await flush()};
await setTransparency(72);let editedPhotos=await photos();assert(editedPhotos.every(p=>p.opacity===.28));assert.deepEqual(withoutOpacity(editedPhotos),withoutOpacity(guidesBefore));assert.equal($('reference-opacity').value,'72');assert.equal($('wb-photo-transparency-value').textContent,'72%');assert.equal(storage.get('apulso-editor-photo-transparency-v1'),'72');assert.equal(storage.get(docKey),mapBeforeOpacity);
// The inspector is the same shared control, not a competing per-photo value.
await setTransparency(50,'reference-opacity');assert((await photos()).every(p=>p.opacity===.5));assert.equal($('wb-photo-transparency-input').value,'50');
document.querySelector('[data-tool="pan"]').click();await setTransparency(100);const hiddenPhotosCanvas=canvases.get(mapCanvas).toBuffer('image/png');assert((await photos()).every(p=>p.opacity===0));
await setTransparency(0);assert((await photos()).every(p=>p.opacity===1));assert.notDeepEqual(canvases.get(mapCanvas).toBuffer('image/png'),hiddenPhotosCanvas,'The global control changes the actual canvas rendering');
await importPhoto('Referencia nueva.png');assert.equal((await photos()).at(-1).opacity,1,'New photos inherit the chosen opacity, including zero transparency');
await setTransparency(100);await importPhoto('Referencia oculta nueva.png');assert.equal((await photos()).at(-1).opacity,0,'A saved zero opacity must not fall back to 36%');
const {createPhotoGuides}=await import('../editor-photo-guides.mjs');const reopened=createPhotoGuides({ctx:sample.getContext('2d'),pixel:(x,y)=>[x,y],world:(x,y)=>[x,y],requestDraw(){},show(){},getMapKey:()=>key,getView:()=>({cx:20,cy:20,zoom:scale})});
URL.createObjectURL=()=>sample.toDataURL('image/png');try{await reopened.switchMap(key)}finally{URL.createObjectURL=originalObjectURL}assert.equal(reopened.viewSettings().transparency,100);assert.equal(reopened.viewSettings().count,4);await reopened.flush();assert((await photos()).every(p=>p.opacity===0),'The shared transparency survives reopening');
// Six requested editor flows through their actual controls.
$('open-city').click();document.querySelector('[data-city-tab="maps"]').click();const cofradiaForm=$('city-create-map');cofradiaForm.querySelector('[name=name]').value='Cortejo y paso importado';await cofradiaForm.onsubmit({preventDefault(){}});await flush();
const cofradiaMap=$('map-select').value,cofradiaStorage='apulso-universal-editor-v2:'+cofradiaMap,readCofradia=()=>JSON.parse(storage.get(cofradiaStorage));let cofradiaDoc=readCofradia();
const {defaultGameplay:newCofradiaGameplay,newRouteEvent:cofradiaEvent}=await import('../map-gameplay.mjs');cofradiaDoc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]],material:'road-art-granite'}];cofradiaDoc.startPose={x:20,y:20,angle:0};cofradiaDoc.gameplay=newCofradiaGameplay();cofradiaDoc.gameplay.route.enabled=true;cofradiaDoc.gameplay.route.events=[cofradiaEvent('finish',[30,30])];
Object.defineProperty($('import'),'files',{value:[{text:async()=>JSON.stringify(cofradiaDoc)}],configurable:true});await $('import').onchange({target:$('import')});$('save').click();await flush();
$('wb-mode-route').click();document.querySelector('[data-wb-panel="procession-panel"]').click();$('procession-draw').click();
for(const p of [[10,10],[10,25],[25,25]]){const q=toCanvas(p);pointer('pointerdown',...q);pointer('pointerup',...q);}assert($('procession-count-points').textContent.includes('3 puntos'));$('undo').click();assert($('procession-count-points').textContent.includes('2 puntos'));$('redo').click();assert($('procession-count-points').textContent.includes('3 puntos'));$('procession-finish').click();$('save').click();assert.deepEqual(readCofradia().procession.nazarenes.points,[[10,10],[10,25],[25,25]]);
$('procession-role').value='acolytes';$('procession-role').onchange();$('procession-draw').click();for(const p of [[12,10],[12,25]]){const q=toCanvas(p);pointer('pointerdown',...q);pointer('pointerup',...q);}$('procession-finish').click();$('save').click();assert.deepEqual(readCofradia().procession.acolytes.points,[[12,10],[12,25]]);assert.equal(readCofradia().procession.nazarenes.points.length,3);
$('procession-point-list').value='1';$('procession-point-list').onchange();$('procession-x').value='13';$('procession-y').value='26';$('procession-point-save').click();$('save').click();assert.deepEqual(readCofradia().procession.acolytes.points[1],[13,26]);
$('open-city').click();document.querySelector('[data-city-tab="brotherhoods"]').click();const cofradiaCatalogue=await import('../content-catalogue.mjs'),cofradiaChoice=cofradiaCatalogue.BROTHERHOODS.find(b=>!cofradiaCatalogue.CONTENT_STEPS.some(s=>s.brotherhoodId===b.id));$('city-brotherhood').value=cofradiaChoice.id;$('city-brotherhood').onchange();$('uniform-robe').value='#7b184b';$('uniform-hood').value='#30152e';await $('brotherhood-save-uniform').onclick();assert.equal(JSON.parse(storage.get('apulso-city-project-v1')).brotherhoodSettings[cofradiaChoice.id].uniform.robe,'#7b184b');
const cofradiaRaster=createCanvas(40,80);cofradiaRaster.getContext('2d').fillStyle='#bf3565';cofradiaRaster.getContext('2d').fillRect(5,5,30,70);const cofradiaFile=new Blob([cofradiaRaster.toBuffer('image/png')],{type:'image/png'});cofradiaFile.name='Paso aéreo.png';Object.defineProperty($('brotherhood-step-file'),'files',{value:[cofradiaFile],configurable:true});await $('brotherhood-step-file').onchange();$('brotherhood-step-name').value='Paso de prueba propio';$('brotherhood-step-width').value='1.3';$('brotherhood-step-length').value='2.9';$('brotherhood-step-standing').value='4.2';$('brotherhood-step-crouched').value='3.5';$('brotherhood-step-lowered').value='3.1';await $('brotherhood-save-step').onclick();
let savedCofradia=JSON.parse(storage.get('apulso-city-project-v1'));assert.equal(savedCofradia.brotherhoodSettings[cofradiaChoice.id].step.width,1.3);assert([...$('city-campaign-step').options].some(o=>o.value==='imported:'+cofradiaChoice.id));await $('brotherhood-preview-step').onclick();await flush();assert(!$('city-dialog').open);assert.equal($('pinned-paso-choice').value,'imported:'+cofradiaChoice.id);assert($('pinned-paso-on').checked);assert.equal($('paso-on').checked,true);
$('wb-mode-build').click();$('wb-category-urban').click();$('placement-preview-gallery').querySelector('[data-preview-item="bike-rack"]').click();assert(!$('urban-item-size').hidden);$('urban-item-width').value='.22';$('urban-item-depth').value='.12';const cofradiaBikeScreen=toCanvas([27,18]);pointer('pointerdown',...cofradiaBikeScreen);pointer('pointerup',...cofradiaBikeScreen);$('save').click();await flush();assert.deepEqual(readCofradia().urban.at(-1).size,[.22,.12]);assert($('pinned-paso-on').checked,'Placement keeps the real paso pinned');assert.equal($('paso-test').dataset.ok,'yes',$('pinned-paso-status').textContent);
// A newly added obstacle immediately invalidates and recomputes the fit.
document.querySelector('[data-tool="house"]').click();for(const p of [[19.5,19],[20.5,19],[20.5,21],[19.5,21]]){const q=toCanvas(p);pointer('pointerdown',...q);pointer('pointerup',...q);}$('finish-shape').click();await flush();assert.equal($('paso-test').dataset.ok,'no',$('pinned-paso-status').textContent);$('undo').click();await flush();assert.equal($('paso-test').dataset.ok,'yes');
await $('pinned-paso-play').onclick();assert(!$('pinned-paso-play-link').hidden);assert($('pinned-paso-play-link').href.includes('editorTest='));
// The same photograph remains over the geometry even if old preference
// values request a background/material-preview layer.
const blueReference=createCanvas(32,32);blueReference.getContext('2d').fillStyle='#0044ff';blueReference.getContext('2d').fillRect(0,0,32,32);const cofradiaPhoto=new Blob([blueReference.toBuffer('image/png')],{type:'image/png'});cofradiaPhoto.name='Referencia siempre encima.png';Object.defineProperty(photoInput,'files',{value:[cofradiaPhoto],configurable:true});document.querySelector('[data-tool="reference"]').click();URL.createObjectURL=()=>blueReference.toDataURL('image/png');try{photoInput.dispatchEvent(new window.Event('change'));acceptPhotoHeight();await flush();}finally{URL.createObjectURL=originalObjectURL;}
if($('pinned-paso-on').checked)$('wb-paso-pin').click();document.querySelector('[data-tool="pan"]').click();$('reference-overlay').checked=false;$('surface-clear-preview').checked=true;await setTransparency(0);await flush();const cofradiaPhotoPixel=[...canvases.get(mapCanvas).getContext('2d').getImageData(545,370,1,1).data];assert(cofradiaPhotoPixel[2]>200&&cofradiaPhotoPixel[0]<30,'Opaque reference photo must cover the map in every old layer mode');assert($('reference-overlay').disabled);$('surface-clear-preview').checked=false;
$('open-city').click();document.querySelector('[data-city-tab="brotherhoods"]').click();$('city-brotherhood').value=cofradiaChoice.id;$('city-brotherhood').onchange();$('city-zone-choice').value='map:'+cofradiaMap;await [...$('city-form').querySelectorAll('button')].find(b=>b.textContent==='Añadir al recorrido').onclick();$('city-campaign-step').value='imported:'+cofradiaChoice.id;await $('city-activate-itinerary').onclick();savedCofradia=JSON.parse(storage.get('apulso-city-project-v1'));assert.equal(savedCofradia.campaignItineraries[cofradiaChoice.id].stepId,'imported:'+cofradiaChoice.id);$('city-dialog').close();
console.log('Six editor flows passed: editable acolyte/nazarene paths and point history; per-brotherhood uniforms; import/assign/pin/play a custom paso; resize bike rack; always-overlay photos; persistent real-engine fit updated by new buildings.');

console.log('Workbench integration: legacy panels, 22 visual families, mobile sheets, persistent visual order with undo/redo/reset, exact edits, canopy handles, point history, balcony spans; right-pan with every original tool plus precision/collisions/routes, mouse chords, two-finger pan/pinch/takeover and navigation cancellation; shared photo transparency, real rendering, locked/new images and reopening passed. DOM/Canvas only; browser and physical-device QA remain separate.');
process.exit(0);
