import {ASSET_CATEGORIES,listCustomAssets,assetById,isSurfaceAsset,saveCustomAsset,saveCustomAssets,importCustomRaster,validateResourceManifest} from './custom-assets.mjs';
export function setupCustomAssetUI({choose,changed,show,refresh}){
 const panel=document.createElement('details');panel.id='custom-assets-panel';
 panel.innerHTML=`<summary>Mis recursos · importar imágenes</summary><div class="stack">
 <p class="muted">Añade imágenes como contenido del juego. Sus medidas son metros reales. Las fotografías guía siguen siendo privadas y se gestionan aparte.</p>
 <label>Recurso guardado<select id="custom-asset-list"><option value="">Nuevo recurso…</option></select></label>
 <label>Imagen PNG, WebP o JPEG<input id="custom-asset-file" type="file" accept="image/png,image/webp,image/jpeg"></label>
 <label>Nombre<input id="custom-asset-name" type="text" maxlength="100" placeholder="Ej.: Valla verde de madera"></label>
 <label>Categoría<select id="custom-asset-category"></select></label>
 <div class="precision-two"><label>Ancho (m)<input id="custom-asset-width" type="number" min=".02" max="100" step=".01" value="1"></label><label>Fondo (m)<input id="custom-asset-depth" type="number" min=".02" max="100" step=".01" value="1"></label></div>
 <label class="flag"><input id="custom-asset-aspect" type="checkbox" checked> Conservar proporción de la imagen</label>
 <label>Giro inicial (°)<input id="custom-asset-angle" type="number" min="-360" max="360" step="1" value="0"></label>
 <label>Colisión<select id="custom-asset-collision"><option value="none">Sin colisión</option><option value="box">Rectángulo</option><option value="circle">Círculo · tronco o poste</option></select></label>
 <div id="custom-collision-box" class="precision-two" hidden><label>Ancho colisión (m)<input id="custom-collision-width" type="number" min=".02" max="100" step=".01" value="1"></label><label>Fondo colisión (m)<input id="custom-collision-depth" type="number" min=".02" max="100" step=".01" value="1"></label></div>
 <label id="custom-collision-circle" hidden>Radio colisión (m)<input id="custom-collision-radius" type="number" min=".01" max="50" step=".01" value=".15"></label>
 <p id="custom-asset-help" class="muted"></p><canvas id="custom-asset-preview" width="576" height="320" role="img" aria-label="Imagen y colisión del recurso propio"></canvas>
 <div class="actions"><button id="custom-asset-save" type="button" class="primary">Guardar recurso</button><button id="custom-asset-place" type="button">Elegir para colocar</button><button id="custom-asset-row" type="button">Colocar en fila</button></div>
 <p id="custom-asset-status" class="muted" role="status"></p>
 <button id="custom-asset-new" type="button">Crear otro recurso</button>
 <button id="custom-asset-export" type="button">Exportar catálogo de imágenes</button>
 <label>Importar catálogo propio<input id="custom-asset-import" type="file" accept="application/json,.json"></label>
 </div>`;
 document.querySelector('.sidebar').prepend(panel);
 const preview=document.createElement('canvas');preview.id='custom-asset-preview';preview.width=576;preview.height=320;preview.setAttribute('role','img');preview.setAttribute('aria-label','Imagen y colisión del recurso propio');panel.querySelector('#custom-asset-preview').replaceWith(preview);
 const $=id=>document.getElementById(id),status=message=>{$('custom-asset-status').textContent=message;show(message,'good')};
 let id=null,source=null,previewImage=null,aspect=1,busy=false;
 for(const [value,name]of ASSET_CATEGORIES){const o=document.createElement('option');o.value=value;o.textContent=name;$('custom-asset-category').append(o)}
 $('custom-asset-category').value='decor';
 function catalogue(selected=id){
  const select=$('custom-asset-list');select.replaceChildren();const option=document.createElement('option');option.value='';option.textContent='Nuevo recurso…';select.append(option);
  for(const a of listCustomAssets()){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;select.append(o)}select.value=selected||'';
 }
 function read(){
  const collision={kind:$('custom-asset-collision').value};
  if(collision.kind==='box')Object.assign(collision,{width:+$('custom-collision-width').value,depth:+$('custom-collision-depth').value});
  if(collision.kind==='circle')collision.radius=+$('custom-collision-radius').value;
  return{id:id||'asset-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name:$('custom-asset-name').value,category:$('custom-asset-category').value,width:+$('custom-asset-width').value,depth:+$('custom-asset-depth').value,angle:+$('custom-asset-angle').value,collision,image:source};
 }
 function paint(){
  const a=read(),canvas=$('custom-asset-preview'),c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);c.fillStyle='#bfc0af';c.fillRect(0,0,w,h);c.strokeStyle='#a8ab9d';c.lineWidth=1;
  for(let x=0;x<w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}for(let y=0;y<h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  if(!previewImage){c.fillStyle='#334b50';c.font='24px system-ui';c.textAlign='center';c.fillText('Selecciona una imagen',w/2,h/2);return}
  const span=Math.max(a.width||1,a.depth||1,a.collision.width||0,a.collision.depth||0,(a.collision.radius||0)*2),z=Math.min(w,h)*.70/span;
  c.save();c.translate(w/2,h/2);c.rotate(-a.angle*Math.PI/180);c.imageSmoothingEnabled=true;c.drawImage(previewImage,-a.width*z/2,-a.depth*z/2,a.width*z,a.depth*z);
  c.strokeStyle='#e06548';c.fillStyle='rgba(227,83,51,.15)';c.lineWidth=3;c.setLineDash([8,5]);c.beginPath();
  if(a.collision.kind==='box')c.rect(-a.collision.width*z/2,-a.collision.depth*z/2,a.collision.width*z,a.collision.depth*z);
  if(a.collision.kind==='circle')c.arc(0,0,a.collision.radius*z,0,Math.PI*2);
  if(a.collision.kind!=='none'){c.fill();c.stroke()}c.restore();
 }
 function update(){
  const surface=isSurfaceAsset({category:$('custom-asset-category').value});
  if(surface)$('custom-asset-collision').value='none';$('custom-asset-collision').disabled=surface;
  $('custom-collision-box').hidden=$('custom-asset-collision').value!=='box';$('custom-collision-circle').hidden=$('custom-asset-collision').value!=='circle';
  $('custom-asset-help').textContent=surface?($('custom-asset-category').value==='houses'?'Las medidas indican cuánto ocupa una repetición de la imagen. La colisión sigue el contorno del edificio, incluidos sus patios.':'Las medidas indican cuánto ocupa una repetición de la imagen. Esta superficie será suelo transitable.'):'El rectángulo o círculo naranja muestra la colisión. El tamaño de la imagen puede ser mayor que el tronco o el poste.';
  $('custom-asset-place').disabled=!id||busy;$('custom-asset-row').disabled=!id||busy||surface;paint();
 }
 const guard=fn=>async(...args)=>{try{await fn(...args)}catch(error){$('custom-asset-status').textContent=error.message;show(error.message,'error')}};
 async function loadPreview(image){source=image;previewImage=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('No se pudo mostrar la imagen.'));i.src=image});aspect=(previewImage.naturalWidth||previewImage.width)/(previewImage.naturalHeight||previewImage.height);update()}
 $('custom-asset-file').onchange=guard(async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const imported=await importCustomRaster(file);if(!$('custom-asset-name').value.trim())$('custom-asset-name').value=file.name.replace(/\.[^.]+$/,'');await loadPreview(imported.image);if($('custom-asset-aspect').checked)$('custom-asset-depth').value=(+$('custom-asset-width').value/aspect).toFixed(3);update();status('Imagen preparada. Revisa medidas y colisión y pulsa Guardar recurso.');});
 async function select(saved){
  id=saved.id;$('custom-asset-name').value=saved.name;$('custom-asset-category').value=saved.category;$('custom-asset-width').value=saved.width;$('custom-asset-depth').value=saved.depth;$('custom-asset-angle').value=saved.angle;$('custom-asset-collision').value=saved.collision.kind;
  if(saved.collision.kind==='box'){$('custom-collision-width').value=saved.collision.width;$('custom-collision-depth').value=saved.collision.depth}if(saved.collision.kind==='circle')$('custom-collision-radius').value=saved.collision.radius;
  catalogue();await loadPreview(saved.image);
 }
 $('custom-asset-list').onchange=guard(async()=>{const a=assetById($('custom-asset-list').value);if(a)await select(a);else reset()});
 function reset(){id=null;source=null;previewImage=null;aspect=1;$('custom-asset-name').value='';$('custom-asset-file').value='';catalogue();update()}
 $('custom-asset-new').onclick=reset;
 $('custom-asset-save').onclick=guard(async()=>{
  if(busy)return;busy=true;$('custom-asset-save').disabled=true;
  try{const a=await saveCustomAsset(read());await select(a);choose(a);changed();refresh();status('Recurso guardado en tu catálogo. Ya aparece en el visor y está elegido para colocar.');}
  finally{busy=false;$('custom-asset-save').disabled=false;update()}
 });
 $('custom-asset-place').onclick=guard(async()=>{const a=assetById(id);if(!a)throw Error('Guarda primero el recurso.');choose(a);refresh();status(a.name+' elegido para colocar.');});
 $('custom-asset-row').onclick=guard(()=>{const a=assetById(id);if(!a||isSurfaceAsset(a))throw Error('Elige un objeto guardado para crear una fila.');choose(a,true);refresh();status('Arrastra para crear la fila. La separación se ajusta en Vallas y sillas.');});
 for(const field of ['category','collision','angle','name'])$('custom-asset-'+field).addEventListener('input',update);
 for(const field of ['width','depth'])$('custom-asset-'+field).addEventListener('input',()=>{
  if($('custom-asset-aspect').checked&&aspect>0){const other=field==='width'?'depth':'width';$('custom-asset-'+other).value=(field==='width'?+$('custom-asset-width').value/aspect:+$('custom-asset-depth').value*aspect).toFixed(3)}update();
 });
 for(const field of ['width','depth','radius'])$('custom-collision-'+field).addEventListener('input',update);
 $('custom-asset-export').onclick=guard(()=>{
  const resources=listCustomAssets();if(!resources.length)throw Error('El catálogo está vacío.');
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({schema:'apulso-resources-v1',resources},null,2)],{type:'application/json'}));a.href=url;a.download='apulso-mis-recursos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Catálogo exportado con sus imágenes.');
 });
 $('custom-asset-import').onchange=guard(async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>65000000)throw Error('El catálogo supera 65 MB.');
  const input=JSON.parse(await file.text());if(input.schema!=='apulso-resources-v1')throw Error('Este archivo no es un catálogo de recursos.');const resources=validateResourceManifest(input.resources);
  if(resources.some(a=>!a.image))throw Error('El catálogo debe incluir las imágenes.');
  // Decode and persist every entry before exposing the imported catalogue.
  await saveCustomAssets(resources);
  catalogue();refresh();status(resources.length+' recursos importados.');
 });
 catalogue();update();return{refresh:catalogue,async selectById(key){if(id!==key){const a=assetById(key);if(a)await select(a)}},open(){panel.open=true;panel.scrollIntoView?.({block:'start',behavior:'smooth'})}};
}
