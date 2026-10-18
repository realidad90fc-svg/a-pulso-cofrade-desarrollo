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
setTimeout(()=>fail(Error('Timed out waiting for the desktop photo import')),120000).unref();
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
 finished=true;console.log('PASS Windows Electron: secure desktop origin, file input, HTML height dialog, real image decode, calibrated photo persistence and reload; no browser prompt.');app.exit(0);
}).catch(fail);
