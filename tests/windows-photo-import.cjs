'use strict';
// Exercise the real desktop entry point and its secure apulso:// origin.
// Run with desktop/node_modules/.bin/electron tests/windows-photo-import.cjs.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'apulso-photo-smoke-'));
app.setPath('appData',sandbox);app.setPath('documents',sandbox);
const desktop=path.resolve(__dirname,'../desktop');
// The test runner is the entry file, but the product's assets remain in desktop.
app.getAppPath=()=>desktop;
let finished=false;
function fail(error){if(finished)return;finished=true;console.error('FAIL Windows photo import:',error?.stack||error);app.exit(1)}
process.on('unhandledRejection',fail);
setTimeout(()=>fail(Error('Timed out waiting for the desktop photo import')),180000).unref();
require('../desktop/main.cjs');
const delay=()=>new Promise(resolve=>setTimeout(resolve,100));
async function waitFor(window,expression){
 for(let i=0;i<900;i++){try{if(await window.webContents.executeJavaScript(expression))return}catch{}await delay()}
 let detail;try{detail=await window.webContents.executeJavaScript("document.getElementById('status')?.textContent+' / '+document.getElementById('loading')?.textContent")}catch{}
 throw Error('Condition not reached: '+expression+' / '+detail);
}
app.whenReady().then(async()=>{
 if(!app.getPath('userData').startsWith(sandbox))throw Error('Smoke test must use an isolated profile');
 const window=BrowserWindow.getAllWindows()[0];if(!window)throw Error('Desktop window not created');
 await waitFor(window,"document.getElementById('loading')?.hidden === true");
 const animation=JSON.parse(fs.readFileSync(path.join(desktop,'web/assets/original-animation.json'),'utf8'));
 const filename=animation.sprites['sharedassets2.assets:563'].image;
 const bytes=fs.readFileSync(path.join(desktop,'web',filename)).toString('base64');
 await window.webContents.executeJavaScript(`(()=>{
  window.prompt=()=>{throw Error('prompt() is not supported.')};
  const binary=atob(${JSON.stringify(bytes)}),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const transfer=new DataTransfer();transfer.items.add(new File([bytes],'Foto de prueba Windows.png',{type:'image/png'}));
  const input=document.getElementById('reference-file');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 })()`);
 await waitFor(window,"document.getElementById('photo-import-dialog')?.open === true");
 await window.webContents.executeJavaScript("document.getElementById('photo-import-height').value='106';document.getElementById('photo-import-form').requestSubmit()");
 await waitFor(window,"document.getElementById('reference-count')?.textContent.startsWith('1/') && !document.getElementById('reference-file').disabled");
 const metadata=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
  const request=indexedDB.open('apulso-private-map-photos-v1');request.onerror=()=>reject(Error('Cannot open photo database'));request.onsuccess=()=>{const db=request.result,read=db.transaction('meta').objectStore('meta').getAll();read.onsuccess=()=>{resolve(read.result);db.close()};read.onerror=()=>reject(read.error)};
 })`);
 if(metadata.length!==1||metadata[0].cameraHeightM!==106||metadata[0].width<=0||metadata[0].height<=0)throw Error('Photo or Earth calibration not persisted');
 window.webContents.reload();
 await waitFor(window,"document.getElementById('loading')?.hidden === true && document.getElementById('reference-count')?.textContent.startsWith('1/')");
 // Verify the redesigned map library in Chromium, including its real CSS.
 await window.webContents.executeJavaScript(`(async()=>{
  const $=id=>document.getElementById(id),assert=(value,message)=>{if(!value)throw Error(message)};
  const click=async(host,label)=>{const b=[...host.querySelectorAll('button')].find(n=>n.textContent===label);assert(b,'Missing '+label);await b.onclick()};
  const contrast=node=>{const style=getComputedStyle(node),rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);let bg=node;while(getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)')bg=bg.parentElement;const a=lum(style.color),b=lum(getComputedStyle(bg).backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  await $('wb-help').onclick();assert($('city-dialog').open,'Guide opens');assert(document.querySelectorAll('.city-help-card').length===6,'Guide content');
  document.querySelector('[data-city-tab=maps]').click();const form=$('city-create-map');assert(contrast(form.querySelector('input'))>=4.5,'Readable map name input');assert(contrast(document.querySelector('.city-search'))>=4.5,'Readable search input');assert(contrast(form.querySelector('.city-primary'))>=4.5,'Readable primary button');
  form.querySelector('[name=name]').value='Arfe Windows';await form.onsubmit({preventDefault(){}});assert(!$('city-dialog').open,'New map opens editor');
  window.__testMapKey=$('map-select').value;const raw=JSON.parse(localStorage.getItem('apulso-universal-editor-v2:'+window.__testMapKey));
  const {defaultGameplay,newRouteEvent}=await import('./map-gameplay.mjs');raw.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];raw.startPose={x:20,y:20,angle:0};raw.gameplay=defaultGameplay();raw.gameplay.route.enabled=true;raw.gameplay.route.events=[newRouteEvent('finish',[30,30])];
  const files=new DataTransfer();files.items.add(new File([JSON.stringify(raw)],'Arfe.json',{type:'application/json'}));$('import').files=files.files;await $('import').onchange({target:$('import')});$('save').click();
  // Actual Chromium selection and controls, not just a model import.
  raw.trees=[{point:[8,8],radius:.35}];
  const layeredFiles=new DataTransfer();layeredFiles.items.add(new File([JSON.stringify(raw)],'Capas.json',{type:'application/json'}));$('import').files=layeredFiles.files;await $('import').onchange({target:$('import')});
  document.querySelector('[data-tool=select]').click();$('goto-all').click();
  const canvas=$('editor-canvas'),rect=canvas.getBoundingClientRect(),scale=Math.min(80,Math.max(1.5,Math.min((rect.width-30)/43.6,(rect.height-30)/43.6))),x=rect.left+rect.width/2-12*scale,y=rect.top+rect.height/2+12*scale;
  const pickTree=()=>{for(const type of ['pointerdown','pointerup'])canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:type==='pointerdown'?1:0}));};
  pickTree();assert(!$('edit-order-backward').disabled,'Visual order available on selected tree');$('edit-order-backward').click();$('save').click();
  const read=()=>JSON.parse(localStorage.getItem('apulso-universal-editor-v2:'+window.__testMapKey));assert(read().trees[0].edit.drawOrder===70,'Manual order persists');assert(read().trees[0].radius===.35,'Drawing order preserves dimensions');
  $('undo').click();$('save').click();assert(read().trees[0].edit?.drawOrder===undefined,'Undo visual order');$('redo').click();$('save').click();assert(read().trees[0].edit.drawOrder===70,'Redo visual order');pickTree();$('edit-order-reset').click();$('save').click();assert(read().trees[0].edit.drawOrder===undefined,'Automatic order restored');
  await $('wb-help').onclick();document.querySelector('[data-city-tab=maps]').click();const card=document.querySelector('[data-map-key="'+window.__testMapKey+'"]');await click(card,'Asignar a hermandad');
  const {CONTENT_STEPS}=await import('./content-catalogue.mjs');$('city-brotherhood').value=CONTENT_STEPS.find(s=>s.implemented).brotherhoodId;$('city-brotherhood').onchange();
  assert(contrast($('city-brotherhood'))>=4.5,'Readable brotherhood selector');assert(contrast(document.querySelector('.city-campaign-settings h3'))>=4.5,'Readable campaign settings');
  await click($('city-form'),'Añadir al recorrido');assert($('city-itinerary-state').dataset.state==='draft','Draft state');await $('city-activate-itinerary').onclick();assert($('city-itinerary-state').dataset.state==='live','Applied to real game catalogue');
  document.querySelector('[data-city-tab=maps]').click();await click(document.querySelector('[data-map-key="'+window.__testMapKey+'"]'),'Nombre y usos');const rename=$('city-form').querySelector('form');rename.querySelector('input').value='Arfe renombrada';await rename.onsubmit({preventDefault(){}});assert($('map-select').selectedOptions[0].textContent==='Arfe renombrada','Map picker rename');
  await click(document.querySelector('[data-map-key="'+window.__testMapKey+'"]'),'Eliminar');await $('city-confirm-trash').onclick();assert($('map-select').value!==window.__testMapKey,'Deleted active map changes editor');document.querySelector('[data-city-tab=trash]').click();await click($('city-results'),'Restaurar mapa');assert(!JSON.parse(localStorage.getItem('apulso-city-project-v1')).maps.find(m=>m.key===window.__testMapKey).trashed,'Restored map');
 })()`);
 window.setMinimumSize(320,400);window.setSize(390,844);await delay();
 await window.webContents.executeJavaScript(`(()=>{
  const modal=document.getElementById('city-dialog'),content=modal.querySelector('.city-content'),tabs=modal.querySelector('.city-tabs');
  if(!document.body.classList.contains('wb-mobile'))throw Error('Mobile controls did not adapt');
  if(content.clientHeight<150||content.scrollWidth>content.clientWidth+2)throw Error('Mobile map dialog overflow');
  if(tabs.scrollWidth<=tabs.clientWidth)throw Error('Mobile map tabs must scroll to every action');
  const rect=modal.getBoundingClientRect();if(rect.left<0||rect.right>innerWidth+1||rect.bottom>innerHeight+1)throw Error('Map dialog must fit mobile viewport');
  modal.close();
 })()`);
 window.setSize(1500,950);await delay();
 const bikeAt=await window.webContents.executeJavaScript(`(async()=>{
  const $=id=>document.getElementById(id),assert=(value,message)=>{if(!value)throw Error(message)};
  await $('wb-help').onclick();document.querySelector('[data-city-tab=maps]').click();const create=$('city-create-map');create.querySelector('[name=name]').value='Cortejo Windows';await create.onsubmit({preventDefault(){}});window.__cofradiaMap=$('map-select').value;
  const key='apulso-universal-editor-v2:'+window.__cofradiaMap,doc=JSON.parse(localStorage.getItem(key)),{defaultGameplay,newRouteEvent}=await import('./map-gameplay.mjs');doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.startPose={x:20,y:20,angle:0};doc.gameplay=defaultGameplay();doc.gameplay.route.enabled=true;doc.gameplay.route.events=[newRouteEvent('finish',[30,30])];
  const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(doc)],'Cortejo.json',{type:'application/json'}));$('import').files=transfer.files;await $('import').onchange({target:$('import')});$('save').click();
  $('wb-mode-route').click();document.querySelector('[data-wb-panel=procession-panel]').click();$('procession-enabled').checked=true;$('procession-count').value='8';$('procession-columns').value='2';$('procession-apply').click();$('save').click();assert(JSON.parse(localStorage.getItem(key)).procession.nazarenes.count===8,'Cortejo formation persisted');
  await $('wb-help').onclick();document.querySelector('[data-city-tab=brotherhoods]').click();const {BROTHERHOODS,CONTENT_STEPS}=await import('./content-catalogue.mjs'),b=BROTHERHOODS.find(b=>!CONTENT_STEPS.some(s=>s.brotherhoodId===b.id));$('city-brotherhood').value=b.id;$('city-brotherhood').onchange();$('uniform-robe').value='#7b184b';await $('brotherhood-save-uniform').onclick();assert(JSON.parse(localStorage.getItem('apulso-city-project-v1')).brotherhoodSettings[b.id].uniform.robe==='#7b184b','Clothing saved by brotherhood');
  const binary=atob(${JSON.stringify(bytes)}),png=Uint8Array.from(binary,c=>c.charCodeAt(0)),files=new DataTransfer();files.items.add(new File([png],'Paso-aereo.png',{type:'image/png'}));$('brotherhood-step-file').files=files.files;await $('brotherhood-step-file').onchange();$('brotherhood-step-name').value='Paso Windows';$('brotherhood-step-width').value='1.1';$('brotherhood-step-length').value='2.4';await $('brotherhood-save-step').onclick();assert(JSON.parse(localStorage.getItem('apulso-city-project-v1')).brotherhoodSettings[b.id].step.width===1.1,'Real image imported and assigned');await $('brotherhood-preview-step').onclick();assert(!$('city-dialog').open&&$('pinned-paso-on').checked,'Imported paso stays pinned');
  $('wb-mode-build').click();$('wb-category-urban').click();$('placement-preview-gallery').querySelector('[data-preview-item=bike-rack]').click();$('urban-item-width').value='.22';$('urban-item-depth').value='.12';assert($('pinned-paso-on').checked,'Another tool keeps paso visible');assert($('reference-overlay').disabled,'Reference layering is fixed above map');await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=$('editor-canvas').getBoundingClientRect();return {x:Math.round(r.left+r.width*.75),y:Math.round(r.top+r.height*.5)};
 })()`);
 const realClick=async point=>{window.webContents.sendInputEvent({type:'mouseMove',...point});window.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});window.webContents.sendInputEvent({type:'mouseUp',...point,button:'left',clickCount:1});await delay()};
 await realClick(bikeAt);
 await window.webContents.executeJavaScript(`(()=>{const $=id=>document.getElementById(id);$('save').click();const rack=JSON.parse(localStorage.getItem('apulso-universal-editor-v2:'+window.__cofradiaMap)).urban.at(-1);if(rack?.size?.[0]!==.22)throw Error('Bike rack uses requested size: '+JSON.stringify(rack)+' / '+$('status').textContent)})()`);
 await waitFor(window,"document.getElementById('paso-test')?.dataset.ok === 'yes'");
 const housePoints=await window.webContents.executeJavaScript(`(()=>{const $=id=>document.getElementById(id);document.querySelector('[data-tool=house]').click();const r=$('editor-canvas').getBoundingClientRect();return [[-.06,-.06],[.06,-.06],[.06,.06],[-.06,.06]].map(([x,y])=>({x:Math.round(r.left+r.width*(.5+x)),y:Math.round(r.top+r.height*(.5+y))}));})()`);
 for(const p of housePoints)await realClick(p);
 await window.webContents.executeJavaScript("document.getElementById('finish-shape').click()");
 await waitFor(window,"document.getElementById('paso-test')?.dataset.ok === 'no'");
 await window.webContents.executeJavaScript("document.getElementById('undo').click()");
 await waitFor(window,"document.getElementById('paso-test')?.dataset.ok === 'yes'");
 finished=true;console.log('PASS Windows Electron: secure desktop origin, file input, HTML height dialog, real image decode, calibrated photo persistence and reload; map library create/assign/apply/rename/delete/restore, readable contrast and mobile layout; native selection, visual order, undo/redo/reset; clothed cortejo, actual paso image import, resized bike rack, always-overlay photos and persistent real-engine fit; no browser prompt.');app.exit(0);
}).catch(fail);
