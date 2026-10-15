// Private photo guides for the A Pulso map workshop.
import {parseEarthAltitude,estimateEarthPhotoSize} from './editor-earth-scale.mjs';
// Photos never leave this browser: binary data and transforms use IndexedDB,
// outside the game model and outside exported JSON.
const DATABASE='apulso-private-map-photos-v1';
const MAX_PHOTOS=12;
const MAX_SIZE=25*1024*1024;
const round=n=>Math.round(n*1000)/1000;
const strip=photo=>({
 id:photo.id,mapKey:photo.mapKey,name:photo.name,position:photo.position.map(round),
 width:photo.width,height:photo.height,scale:photo.scale,rotation:photo.rotation,
 opacity:photo.opacity,locked:photo.locked,visible:photo.visible,order:photo.order,
  cameraHeightM:photo.cameraHeightM??null,calibration:photo.calibration||'manual',scaleVersion:photo.scaleVersion??null
});
function openDatabase(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window))return reject(Error('Este navegador no permite guardado local de imágenes.'));
  const request=indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('meta')){
    const meta=db.createObjectStore('meta',{keyPath:'id'});
    meta.createIndex('mapKey','mapKey',{unique:false});
   }
   if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs',{keyPath:'id'});
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('No se pudo abrir el almacén de imágenes.'));
  request.onblocked=()=>reject(Error('Otra pestaña está bloqueando el almacén. Cierra las otras pestañas del editor.'));
 });
}
function done(tx){
 return new Promise((resolve,reject)=>{
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||Error('Error al guardar las fotografías.'));
  tx.onabort=()=>reject(tx.error||Error('Se ha cancelado el guardado de fotografías.'));
 });
}
function read(request){
 return new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('Error leyendo fotografía.'));
 });
}
async function decode(blob){
 const url=URL.createObjectURL(blob),im=new Image();
 try{
  await new Promise((resolve,reject)=>{
   im.onload=resolve;im.onerror=()=>reject(Error('Este formato no puede abrirse como imagen.'));
   im.src=url;
  });
  return{image:im,url};
 }catch(e){URL.revokeObjectURL(url);throw e}
}
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const selectedText=p=>p?.name||'';
export function createPhotoGuides({ctx,pixel,world,requestDraw,show,getMapKey,getView,focusImage,activateReferenceTool}){
 const el=id=>document.getElementById(id);
 let photos=[],currentId=null,dbPromise=null,mapKey='',generation=0,drag=null,saveTimer=null;
 let storageAvailable=true;
 const selected=()=>photos.find(p=>p.id===currentId)||null;
 function database(){
  if(!dbPromise)dbPromise=openDatabase().catch(e=>{dbPromise=null;throw e});
  return dbPromise;
 }
 async function persist(photo,blob){
  const db=await database();
  const names=blob?['meta','blobs']:['meta'];
  const tx=db.transaction(names,'readwrite'),completion=done(tx);
  tx.objectStore('meta').put(strip(photo));
  if(blob)tx.objectStore('blobs').put({id:photo.id,blob});
  await completion;
 }
 async function erase(id){
  const db=await database();
  const tx=db.transaction(['meta','blobs'],'readwrite'),completion=done(tx);
  tx.objectStore('meta').delete(id);
  tx.objectStore('blobs').delete(id);
  await completion;
 }
 async function readMap(key){
  const db=await database();
  const metadataTx=db.transaction('meta','readonly');
  const rows=await read(metadataTx.objectStore('meta').index('mapKey').getAll(key));
  // Open a fresh transaction after the async metadata read (important on iOS Safari).
  const blobTx=db.transaction('blobs','readonly'),blobs=blobTx.objectStore('blobs');
  const records=await Promise.all(rows.map(async p=>({...p,blob:await read(blobs.get(p.id))})));
  return records.filter(p=>p.blob?.blob).sort((a,b)=>a.order-b.order);
 }
 function updateUI(){
  const chooser=el('reference-list');
  chooser.replaceChildren();
  for(const p of photos){
   const option=document.createElement('option');
   option.value=p.id;option.textContent=(p.visible?'◉ ':'○ ')+(p.locked?'🔒 ':'')+p.name;
   chooser.appendChild(option);
  }
  if(currentId)chooser.value=currentId;
  const p=selected();
  el('reference-controls').disabled=!p;
  el('reference-count').textContent=photos.length+'/'+MAX_PHOTOS+' fotografías en este mapa';
  if(p){
   el('reference-opacity').value=Math.round(p.opacity*100);
   el('reference-scale').value=Math.round(p.scale*100);
   el('reference-rotation').value=p.rotation;
   el('reference-angle').value=p.rotation;
   el('reference-locked').checked=!!p.locked;
   el('reference-visible').checked=!!p.visible;
   el('reference-opacity-value').textContent=Math.round(p.opacity*100)+'%';
   el('reference-scale-value').textContent=Math.round(p.scale*100)+'%';
   el('reference-rotation-value').textContent=Number(p.rotation).toFixed(1)+'°';
    el('reference-height').value=p.cameraHeightM??'';
    el('reference-scale-source').textContent=p.calibration==='earth'&&p.cameraHeightM?
      'Altura '+p.cameraHeightM+' m · imagen '+(p.width*p.scale).toFixed(1)+' × '+(p.height*p.scale).toFixed(1)+' unidades del juego. Escala con factor visual ×1,50 ajustado a Arfe, sin cambiar el paso ni sus colisiones; puede variar según la perspectiva de Google Earth.':
      p.calibration==='street'?'Foto con calibración antigua. Introduce su altura y pulsa Ajustar escala para aplicar el nuevo método.':
      'Introduce la altura de cámara para calcular el tamaño de la foto.';
   }
 
  el('reference-storage').textContent=storageAvailable?
   'Las fotos y su colocación se guardan solo en este navegador. No se suben ni se incluyen en el JSON.':
   'Atención: no se pueden guardar fotos de forma persistente en este navegador. Exportar el mapa NO incluye las fotografías.';
 }
 function markDirty(){
  requestDraw();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{void flush()},450);
 }
 async function flush(items=photos){
  clearTimeout(saveTimer);saveTimer=null;
  if(!storageAvailable)return;
  try{
   // Saving metadata alone does not repeatedly rewrite the original photo bytes.
   await Promise.all(items.map(p=>persist(p)));
  }catch(e){storageAvailable=false;updateUI();show('No se pudo guardar la posición de las fotos: '+e.message,'error')}
 }
 function release(items){for(const p of items)if(p.url)URL.revokeObjectURL(p.url)}
 async function switchMap(next){
  const epoch=++generation,old=photos;
  clearTimeout(saveTimer);saveTimer=null;photos=[];currentId=null;drag=null;mapKey=next;
  updateUI();requestDraw();
  await flush(old);release(old);
  if(epoch!==generation)return;
  if(!storageAvailable)return;
  try{
   const records=await readMap(next);
   const loaded=[];
    let migrated=false;
   for(const record of records){
    try{const converted=await decode(record.blob.blob);
     const photo={...record,...converted,blob:undefined};
      if(photo.calibration==='earth'&&photo.cameraHeightM&&photo.scaleVersion!==4){
       const dims=estimateEarthPhotoSize(photo.image.naturalWidth,photo.image.naturalHeight,photo.cameraHeightM);
       if(dims){photo.width=round(dims.width);photo.height=round(dims.height);photo.scaleVersion=4;migrated=true;}
      }
      loaded.push(photo);
    }catch(e){show('Una foto de referencia no se pudo abrir: '+record.name,'error')}
   }
   if(epoch!==generation){release(loaded);return}
   photos=loaded;currentId=photos.at(-1)?.id||null;updateUI();requestDraw();
    if(migrated)markDirty();
  }catch(e){
   if(epoch===generation){storageAvailable=false;updateUI();show('No se pudieron recuperar las fotos: '+e.message,'error')}
  }
 }
 async function addFiles(files){
  const startMap=mapKey,epoch=generation;
  let added=0;
  for(const file of Array.from(files)){
   if(photos.length>=MAX_PHOTOS){show('Máximo '+MAX_PHOTOS+' fotos por mapa.','error');break}
   if(!['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif','image/bmp'].includes(file.type)){show('Usa una imagen PNG, JPG, WebP, HEIC, GIF o AVIF.','error');continue}
   if(file.size>MAX_SIZE){show('La foto supera los 25 MB: '+file.name,'error');continue}
   try{
    // Ask per file before decoding, while the file-input gesture is active.
    // Empty = regular (uncalibrated) photo. Cancel = do not import this file.
    const rawHeight=window.prompt(
     '¿Qué ALTURA DE CÁMARA indica Google Earth para «'+file.name+'»?\n'+
     'Ejemplo: 106 (metros).\n'+
     'Deja vacío si no es una captura de Google Earth.\n'+
     'La escala será aproximada y podrás ajustarla después.',''
    );
    if(rawHeight===null)continue;
    let cameraHeightM=null;
    if(rawHeight.trim()){
     cameraHeightM=parseEarthAltitude(rawHeight);
     if(cameraHeightM===null){show('Altura inválida. Indica entre 5 y 3000 metros (por ejemplo, 106). No se ha añadido «'+file.name+'».','error');continue}
    }
    const converted=await decode(file);
    if(epoch!==generation){URL.revokeObjectURL(converted.url);break}
    const estimated=cameraHeightM?estimateEarthPhotoSize(converted.image.naturalWidth,converted.image.naturalHeight,cameraHeightM):null;
    const width=estimated?.width||12;
    const height=estimated?.height||12*converted.image.naturalHeight/converted.image.naturalWidth;
    const view=getView();
    const p={id:crypto.randomUUID?.()||('photo-'+Date.now()+'-'+Math.random()),mapKey:startMap,
     name:file.name,position:[round(view.cx),round(view.cy)],width:round(width),height:round(height),
     scale:1,rotation:0,opacity:.36,locked:false,visible:true,order:photos.length,
     cameraHeightM,calibration:estimated?'earth':'manual',scaleVersion:estimated?.scaleVersion??null,...converted};
    if(storageAvailable){
     try{await persist(p,file)}
     catch(e){storageAvailable=false;show('Foto cargada, pero no se pudo conservar al cerrar el navegador: '+e.message,'error')}
    }
    if(epoch!==generation){URL.revokeObjectURL(converted.url);break}
    photos.push(p);currentId=p.id;added++;updateUI();
    if(estimated&&typeof focusImage==='function')focusImage(p);
    requestDraw();
   }catch(e){show('No se pudo abrir «'+file.name+'»: '+e.message,'error')}
  }
  if(added)show(added+' foto(s) añadida(s). Se ha aplicado automáticamente una escala relativa al paso. Solo necesitas alinear la foto.','good');
 }
 function mutate(name,value){
  const p=selected();if(!p)return;
  if(p.locked&&!['locked','visible'].includes(name)){show('Desbloquea la fotografía antes de modificarla.','error');updateUI();return}
  p[name]=value;updateUI();markDirty();
 }
 async function deleteSelected(){
  const p=selected();if(!p)return;
  if(!confirm('¿Eliminar esta fotografía de referencia de este navegador? No se alterará el mapa.'))return;
  photos=photos.filter(item=>item.id!==p.id);
  currentId=photos.at(-1)?.id||null;updateUI();requestDraw();
  if(p.url)URL.revokeObjectURL(p.url);
  if(storageAvailable)try{await erase(p.id)}catch(e){show('No se pudo eliminar la foto guardada: '+e.message,'error')}
 }
 function moveOrder(dir){
  const p=selected();if(!p)return;
  const i=photos.indexOf(p),j=i+dir;
  if(j<0||j>=photos.length)return;
  [photos[i],photos[j]]=[photos[j],photos[i]];
  photos.forEach((v,k)=>v.order=k);
  updateUI();markDirty();
 }
 function drawPhoto(p){
  if(!p.visible||!p.image?.naturalWidth)return;
  const [cx,cy]=pixel(...p.position),width=p.width*p.scale*getView().zoom,height=p.height*p.scale*getView().zoom;
  if(!Number.isFinite(cx+cy+width+height))return;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-p.rotation*Math.PI/180);
  ctx.globalAlpha=p.opacity;ctx.imageSmoothingEnabled=true;
  ctx.drawImage(p.image,-width/2,-height/2,width,height);
  ctx.restore();
 }
 function draw(layer){
  const atop=el('reference-overlay').checked;
  // Material-inspection mode draws the guide behind surfaces, without
  // mutating the user's overlay checkbox, photo coordinates or image opacity.
  if((layer==='overlay'&&atop)||(layer==='background'&&!atop)||layer==='material-background')
   for(const p of photos)drawPhoto(p);
  if(layer==='handles'){
   const p=selected();
   if(!p?.visible)return;
   const [cx,cy]=pixel(...p.position),w=p.width*p.scale*getView().zoom,h=p.height*p.scale*getView().zoom;
   if(!Number.isFinite(cx+cy+w+h)||w>30000||h>30000)return;
   ctx.save();ctx.translate(cx,cy);ctx.rotate(-p.rotation*Math.PI/180);
   ctx.strokeStyle=p.locked?'#ffc18e':'#52ffdb';ctx.lineWidth=2;ctx.setLineDash([7,5]);
   ctx.strokeRect(-w/2,-h/2,w,h);ctx.setLineDash([]);
   ctx.fillStyle='#f7f2e4';ctx.fillRect(-3,-3,6,6);
   ctx.beginPath();ctx.moveTo(0,-h/2);ctx.lineTo(0,-h/2-35);ctx.strokeStyle='#ffd77c';ctx.lineWidth=2;ctx.stroke();
   ctx.fillStyle='#263541';ctx.beginPath();ctx.arc(0,-h/2-35,12,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle='#ffe5aa';ctx.font='bold 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',0,-h/2-34);
   ctx.restore();
  }
 }
 function hit(p,q){
  const angle=p.rotation*Math.PI/180,dx=q[0]-p.position[0],dy=q[1]-p.position[1];
  const a=Math.cos(angle)*dx+Math.sin(angle)*dy,b=-Math.sin(angle)*dx+Math.cos(angle)*dy;
  return Math.abs(a)<=p.width*p.scale/2&&Math.abs(b)<=p.height*p.scale/2;
 }
 function rotationHandle(p){
  const [cx,cy]=pixel(...p.position),v=getView(),h=p.height*p.scale*v.zoom,
   a=-p.rotation*Math.PI/180,d=h/2+35;
  return[cx+Math.sin(a)*d,cy-Math.cos(a)*d];
 }
 const angle=(center,p)=>Math.atan2(p[1]-center[1],p[0]-center[0])*180/Math.PI;
 const wrap=(a,b)=>((b-a+540)%360)-180;
 function pointerDown(pos){
  const q=world(...pos);
  const active=selected();
  if(active?.visible&&!active.locked&&Math.hypot(pos[0]-rotationHandle(active)[0],pos[1]-rotationHandle(active)[1])<17){
   drag={id:active.id,mode:'rotate',angle:angle(active.position,q)};
   return;
  }
  const chosen=[...photos].reverse().find(p=>p.visible&&hit(p,q));
  if(chosen){currentId=chosen.id;updateUI();requestDraw();}
  const p=chosen||selected();
  drag=p&&!p.locked&&p.visible&&chosen?{id:p.id,pos}:null;
  if(p?.locked)show('Esta foto está bloqueada. Desmarca el candado para moverla.','info');
 }
 function pointerMove(pos){
  if(!drag)return;
  const p=photos.find(x=>x.id===drag.id);
  if(!p||p.locked||!p.visible)return;
  if(drag.mode==='rotate'){
   const current=angle(p.position,world(...pos)),delta=wrap(drag.angle,current);
   drag.angle=current;p.rotation=round((((p.rotation||0)+delta+540)%360)-180);
   updateUI();requestDraw();markDirty();return;
  }
  const v=getView(),dx=(pos[0]-drag.pos[0])/v.zoom,dy=-(pos[1]-drag.pos[1])/v.zoom;
  p.position=[round(p.position[0]+dx),round(p.position[1]+dy)];
  drag.pos=pos;requestDraw();markDirty();
 }
 function pointerUp(){drag=null}
 function bind(){
  el('reference-file').addEventListener('change',async event=>{
   const input=event.currentTarget,files=Array.from(input.files||[]);
   input.value='';await addFiles(files);
  });
  el('reference-list').addEventListener('change',event=>{currentId=event.target.value;updateUI();requestDraw()});
  for(const [input,key,convert] of [
   ['reference-opacity','opacity',v=>Number(v)/100],
   ['reference-scale','scale',v=>Number(v)/100],
   ['reference-rotation','rotation',v=>Number(v)],
   ['reference-angle','rotation',v=>clamp(Number(v),-180,180)]
  ])el(input).addEventListener('input',event=>{const x=convert(event.target.value);if(Number.isFinite(x))mutate(key,x)});
  el('reference-recalculate').onclick=()=>{
    const p=selected();if(!p)return;
    if(p.locked){show('Desbloquea la imagen antes de recalcular su escala.','error');return}
    if(p.calibration==='street'&&!window.confirm('¿Recalcular esta foto utilizando únicamente la altura de cámara?'))return;
    const altitude=parseEarthAltitude(el('reference-height').value);
    if(altitude===null){show('Escribe una altura de cámara entre 5 y 3000 metros.','error');return}
    const size=estimateEarthPhotoSize(p.image.naturalWidth,p.image.naturalHeight,altitude);
    if(!size){show('No ha sido posible calcular la escala de esta fotografía.','error');return}
    p.width=round(size.width);p.height=round(size.height);p.scale=1;
    p.cameraHeightM=altitude;p.calibration='earth';p.scaleVersion=size.scaleVersion;
    updateUI();markDirty();
    if(typeof focusImage==='function')focusImage(p);
    show('Imagen escalada para '+altitude+' m. El paso original y sus colisiones no se han modificado.','good');
   };

   el('reference-locked').onchange=e=>mutate('locked',e.target.checked);
  el('reference-visible').onchange=e=>mutate('visible',e.target.checked);
  el('reference-overlay').onchange=requestDraw;
  el('reference-clear').onclick=deleteSelected;
  el('reference-up').onclick=()=>moveOrder(1);
  el('reference-down').onclick=()=>moveOrder(-1);
  el('reference-reset').onclick=()=>mutate('rotation',0);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush()});
  window.addEventListener('pagehide',()=>{void flush()});
  updateUI();
 }
 return{bind,switchMap,draw,pointerDown,pointerMove,pointerUp,flush,cancelCalibration:()=>{},
  previewItems:()=>photos.map(p=>({id:p.id,name:p.name,image:p.image,rotation:p.rotation,opacity:p.opacity,selected:p.id===currentId})),
  selectPreview:id=>{if(!photos.some(p=>p.id===id))return;currentId=id;updateUI();requestDraw()}};
}
