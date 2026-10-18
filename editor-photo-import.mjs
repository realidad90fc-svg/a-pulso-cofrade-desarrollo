import {parseEarthAltitude} from './editor-earth-scale.mjs';

// HTML dialogs work in Electron as well as browsers. Electron's window.prompt
// throws before an image can be decoded, so photo imports must never use it.
export function createPhotoHeightDialog(){
 let dialog=null,pending=null,previousFocus=null;
 const $=id=>dialog.querySelector('#'+id);
 function finish(value){
  if(!pending)return;
  const resolve=pending;pending=null;
  if(dialog.open)dialog.close();
  if(previousFocus?.isConnected)previousFocus.focus?.();
  previousFocus=null;resolve(value);
 }
 function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='photo-import-dialog';dialog.className='photo-import-dialog';
  dialog.setAttribute('aria-labelledby','photo-import-title');dialog.setAttribute('aria-describedby','photo-import-help');
  dialog.innerHTML=`<form id="photo-import-form" novalidate>
   <p class="photo-import-eyebrow">FOTOGRAFÍA DE REFERENCIA</p>
   <h2 id="photo-import-title">Añadir fotografía</h2>
   <p id="photo-import-name" class="photo-import-name"></p>
   <label for="photo-import-height">Altura de cámara de Google Earth <span>(opcional)</span></label>
   <div class="photo-import-height"><input id="photo-import-height" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej.: 106" aria-describedby="photo-import-help photo-import-error"><span>metros</span></div>
   <p id="photo-import-help">Si es una captura de Google Earth, escribe su altura para calcular la escala. Puedes dejarlo vacío y ajustar el tamaño después.</p>
   <p id="photo-import-error" role="alert" hidden></p>
   <div class="photo-import-actions"><button id="photo-import-cancel" type="button">Cancelar</button><button id="photo-import-add" type="submit">Añadir foto</button></div>
  </form>`;
  document.body.append(dialog);
  $('photo-import-form').addEventListener('submit',event=>{
   event.preventDefault();const value=$('photo-import-height').value.trim();
   if(value&&parseEarthAltitude(value)===null){$('photo-import-error').textContent='Escribe una altura entre 5 y 3000 metros, por ejemplo 106.';$('photo-import-error').hidden=false;$('photo-import-height').setAttribute('aria-invalid','true');$('photo-import-height').focus?.();return;}
   finish(value);
  });
  $('photo-import-cancel').addEventListener('click',()=>finish(null));
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null)});
  // A queued close event from the previous photo must not cancel the next one.
  dialog.addEventListener('close',()=>{if(!dialog.open)finish(null)});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
 }
 return{
  ask(name){
   mount();finish(null);previousFocus=document.activeElement;
   $('photo-import-name').textContent=name;$('photo-import-height').value='';$('photo-import-height').removeAttribute('aria-invalid');$('photo-import-error').textContent='';$('photo-import-error').hidden=true;
   return new Promise((resolve,reject)=>{pending=resolve;try{dialog.showModal();$('photo-import-height').focus?.()}catch(error){pending=null;reject(error)}});
  },
  cancel(){finish(null)}
 };
}
