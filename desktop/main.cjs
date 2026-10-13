'use strict';

// Taller de Mapas de A Pulso Cofrade para Windows. El programa abre
// siempre el EDITOR; el motor de juego solo se conserva para el botón
// opcional «Probar en juego», sin crear otro programa o perfil de datos.
// La web se sirve desde el instalador mediante
// un protocolo local seguro, sin Chrome/Edge y sin depender de Vercel.
const {app,BrowserWindow,Menu,dialog,protocol,shell,session,net} = require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {Readable}=require('node:stream');

protocol.registerSchemesAsPrivileged([{
 scheme:'apulso',
 privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}
}]);

// Persistencia FUERA de la caché del navegador habitual. No se borra al
// actualizar o reinstalar la aplicación (si se conservan los datos del usuario).
const PROFILE_NAME='A Pulso Cofrade - Windows';
const PROFILE_DIR=path.join(app.getPath('appData'),PROFILE_NAME);
fs.mkdirSync(PROFILE_DIR,{recursive:true}); // Electron requires this path to exist on first install.
app.setPath('userData',PROFILE_DIR);
const profile=app.getPath('userData');
const PENDING=path.join(profile,'restaurar-al-iniciar.json');
const PERSIST=['Local Storage','IndexedDB'];
const BASE_URL='https://a-pulso-cofrade-desarrollo-qvlv.vercel.app';
let mainWindow=null,finalizing=false;

function backupDirectory(){return path.join(app.getPath('documents'),'A Pulso Cofrade','Copias de seguridad')}
function timestamp(){return new Date().toISOString().replace(/[:.]/g,'-')}
function validBackup(folder){
 try{
  const m=JSON.parse(fs.readFileSync(path.join(folder,'copia.json'),'utf8'));
  return m.format==='apulso-windows-profile-1'&&PERSIST.some(n=>fs.existsSync(path.join(folder,n)));
 }catch{return false}
}
function applyPendingRestore(){
 if(!fs.existsSync(PENDING))return;
 const pending=JSON.parse(fs.readFileSync(PENDING,'utf8'));
 if(!validBackup(pending.folder))throw Error('La copia seleccionada no es válida.');
 for(const dirname of PERSIST){
  const from=path.join(pending.folder,dirname),to=path.join(profile,dirname);
  fs.rmSync(to,{recursive:true,force:true});
  if(fs.existsSync(from))fs.cpSync(from,to,{recursive:true});
 }
 fs.rmSync(PENDING,{force:true});
}
// Se ejecuta ANTES de abrir la sesión de Chromium/IndexedDB.
try{applyPendingRestore()}catch(error){
 try{fs.rmSync(PENDING,{force:true});fs.writeFileSync(path.join(profile,'error-restauracion.txt'),String(error))}catch{}
}

async function backupNow(){
 try{await session.defaultSession.flushStorageData()}catch{/* Copy what is already persisted even if flush fails. */}
 const dir=backupDirectory();
 fs.mkdirSync(dir,{recursive:true});
 const destination=path.join(dir,timestamp());
 fs.mkdirSync(destination,{recursive:true});
 let copied=0;
 try{
  for(const name of PERSIST){
   const source=path.join(profile,name);
   if(fs.existsSync(source)){fs.cpSync(source,path.join(destination,name),{recursive:true});copied++}
  }
  if(!copied)throw Error('Todavía no hay mapas o fotografías guardados para copiar.');
  fs.writeFileSync(path.join(destination,'copia.json'),JSON.stringify({
   format:'apulso-windows-profile-1',date:new Date().toISOString(),
   description:'Mapas y fotografías originales del editor para Windows',
   included:PERSIST.filter(name=>fs.existsSync(path.join(destination,name)))
  },null,2));
  const folders=fs.readdirSync(dir,{withFileTypes:true})
   .filter(e=>e.isDirectory()&&validBackup(path.join(dir,e.name)))
   .map(e=>e.name).sort().reverse();
  for(const older of folders.slice(12))fs.rmSync(path.join(dir,older),{recursive:true,force:true});
  return destination;
 }catch(error){fs.rmSync(destination,{recursive:true,force:true});throw error}
}

const MIME={
 '.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.gif':'image/gif','.mp3':'audio/mpeg',
 '.wav':'audio/wav','.ogg':'audio/ogg','.ico':'image/x-icon'
};
function errorResponse(code,message){return new Response(message,{status:code,headers:{'content-type':'text/plain; charset=utf-8'}})}
async function serveLocal(request){
 try{
  const url=new URL(request.url);
  if(url.host!=='app')return errorResponse(404,'Recurso no encontrado');
  if(url.pathname==='/api/publish-map'){
   // Conserva la publicación GitHub del editor, pero requiere Internet
   // y la autorización explícita que ya pide la aplicación.
   if(request.method!=='POST')return errorResponse(405,'Método no permitido');
   const headers={'content-type':'application/json'};
   const auth=request.headers.get('authorization');
   if(auth)headers.authorization=auth;
   try{
    const response=await net.fetch(BASE_URL+'/api/publish-map',{
     method:'POST',headers,body:await request.arrayBuffer()
    });
    return new Response(await response.arrayBuffer(),{
     status:response.status,
     headers:{'content-type':response.headers.get('content-type')||'application/json'}
    });
   }catch{return errorResponse(503,'Para publicar en GitHub necesitas conexión a Internet.')}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return errorResponse(405,'Método no permitido');
  let relative=decodeURIComponent(url.pathname).replace(/^\/+/,'');
  if(!relative||relative.endsWith('/'))relative+='editor-arenal.html';
  const root=path.resolve(app.getAppPath(),'web');
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep))return errorResponse(403,'Ruta no permitida');
  const stat=await fs.promises.stat(file).catch(()=>null);
  if(!stat?.isFile())return errorResponse(404,'Archivo no encontrado');
  const headers={'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream',
   'cache-control':'no-cache','accept-ranges':'bytes'};
  if(request.method==='HEAD')return new Response(null,{status:200,headers:{...headers,'content-length':String(stat.size)}});
  const range=request.headers.get('range');
  if(range){
   const m=/^bytes=(\d+)-(\d*)$/.exec(range);
   if(m){
    const start=Number(m[1]),end=m[2]?Number(m[2]):stat.size-1;
    if(start<=end&&end<stat.size){
     headers['content-range']='bytes '+start+'-'+end+'/'+stat.size;
     headers['content-length']=String(end-start+1);
     return new Response(Readable.toWeb(fs.createReadStream(file,{start,end})),{status:206,headers});
    }
   }
   return new Response(null,{status:416,headers:{'content-range':'bytes */'+stat.size}});
  }
  headers['content-length']=String(stat.size);
  return new Response(Readable.toWeb(fs.createReadStream(file)),{status:200,headers});
 }catch(error){return errorResponse(500,'Error al abrir archivo local: '+error.message)}
}

async function manualBackup(){
 try{
  const dest=await backupNow();
  await dialog.showMessageBox(mainWindow,{
   type:'info',title:'Copia de seguridad completada',
   message:'Mapas y fotografías protegidos',
   detail:'Se ha creado una copia en:\n'+dest
  });
 }catch(error){dialog.showErrorBox('No se pudo completar la copia',String(error.message||error))}
}
async function restoreBackup(){
 const result=await dialog.showOpenDialog(mainWindow,{
  title:'Seleccionar una copia de seguridad de A Pulso',
  defaultPath:backupDirectory(),properties:['openDirectory']
 });
 if(result.canceled||!result.filePaths.length)return;
 const folder=result.filePaths[0];
 if(!validBackup(folder)){dialog.showErrorBox('Copia incorrecta','Selecciona una carpeta que contenga copia.json y los datos del editor.');return}
 const approval=await dialog.showMessageBox(mainWindow,{
  type:'warning',buttons:['Cancelar','Restaurar y reiniciar'],
  defaultId:0,cancelId:0,
  message:'¿Restaurar los mapas y fotografías de esta copia?',
  detail:'Se sustituirán los datos actuales de esta aplicación. El programa se reiniciará.'
 });
 if(approval.response!==1)return;
 try{
  // La restauración se hará al iniciar, antes de abrir las bases de datos.
  fs.mkdirSync(profile,{recursive:true});
  fs.writeFileSync(PENDING,JSON.stringify({folder}));
  app.relaunch();app.exit(0);
 }catch(error){dialog.showErrorBox('No se pudo restaurar',error.message)}
}
function menu(){
 const template=[
  {label:'Archivo',submenu:[
   {label:'Guardar mapa',accelerator:'CmdOrCtrl+S',click:()=>mainWindow?.webContents.executeJavaScript("document.getElementById('save')?.click()")},
   {type:'separator'},
   {label:'Crear copia de seguridad ahora',click:manualBackup},
   {label:'Restaurar una copia de seguridad',click:restoreBackup},
   {label:'Abrir carpeta de copias',click:()=>{fs.mkdirSync(backupDirectory(),{recursive:true});shell.openPath(backupDirectory())}},
   {label:'Abrir carpeta de datos',click:()=>shell.openPath(profile)},
   {type:'separator'},{label:'Salir',accelerator:'Alt+F4',click:()=>{if(mainWindow)mainWindow.close();else app.quit()}}
  ]},
  {label:'Ver',submenu:[
   {role:'reload',label:'Recargar'},{role:'forceReload',label:'Recargar completamente'},
   {role:'togglefullscreen',label:'Pantalla completa'},{role:'zoomIn',label:'Ampliar vista'},
   {role:'zoomOut',label:'Reducir vista'},{role:'resetZoom',label:'Zoom normal'}
  ]},
  {label:'Ayuda',submenu:[
   {label:'Página del editor en Internet',click:()=>shell.openExternal(BASE_URL+'/editor-arenal.html')},
   {label:'Cómo guardar trabajos anteriores',click:()=>dialog.showMessageBox(mainWindow,{
    type:'info',message:'Importar tus mapas del navegador',
    detail:'Los datos de Chrome/Edge no se transfieren automáticamente. En el editor web, abre cada recorrido y pulsa «Exportar mapa». Después selecciona el mismo recorrido en Windows e importa su archivo JSON. Las fotografías deben añadirse desde tus imágenes originales. Una vez dentro de esta aplicación, quedan protegidas por copias de seguridad en Documentos.'
   })}
  ]}
 ];
 Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function createWindow(){
 mainWindow=new BrowserWindow({
  width:1500,height:950,minWidth:900,minHeight:640,
  title:'A Pulso Cofrade · Editor de Mapas',backgroundColor:'#15202a',
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
 });
 mainWindow.webContents.setWindowOpenHandler(({url})=>{
  if(/^https:\/\//i.test(url))void shell.openExternal(url);
  return{action:'deny'};
 });
 mainWindow.webContents.on('will-navigate',(event,url)=>{
  if(!url.startsWith('apulso://app/')){
   event.preventDefault();
   if(/^https:\/\//i.test(url))void shell.openExternal(url);
  }
 });
 mainWindow.on('closed',()=>{mainWindow=null});
 menu();
 mainWindow.loadURL('apulso://app/editor-arenal.html');
}
app.whenReady().then(async()=>{
 protocol.handle('apulso',serveLocal);
 createWindow();
}).catch(error=>dialog.showErrorBox('Error al abrir A Pulso',String(error)));
app.on('window-all-closed',()=>{
 if(finalizing)return;
 finalizing=true;
 void (async()=>{
  // Chromium ya no tiene una ventana escribiendo en IndexedDB.
  try{await backupNow()}catch(error){
   const log=path.join(profile,'ultimo-error-de-copia.txt');
   try{fs.writeFileSync(log,new Date().toISOString()+'\n'+String(error))}catch{}
  }
  app.quit();
 })();
});
