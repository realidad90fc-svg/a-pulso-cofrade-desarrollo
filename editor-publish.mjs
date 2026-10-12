// Publicación explícita de mapas desde el editor. La autorización se usa
// una sola vez y nunca se guarda en localStorage, IndexedDB ni en el JSON.
import {makeGameDraft} from './editor-game-draft.mjs';

export function setupMapPublishing({getMapKey,getData,getBaseline,saveLocal,show}){
 const el=id=>document.getElementById(id);
 const dialog=el('publish-dialog'),button=el('publish'),confirm=el('publish-confirm');
 const send=el('publish-now'),close=el('publish-close'),token=el('publish-token');
 const notice=el('publish-notice'),summary=el('publish-summary');
 let pending=null,busy=false;
 function result(message,success=false,link=null){
  notice.replaceChildren();
  const p=document.createElement('p');p.textContent=message;notice.appendChild(p);
  notice.dataset.type=success?'success':'error';
  if(link){
   const a=document.createElement('a');a.href=link;a.textContent='Ver versión publicada en GitHub ↗';
   a.target='_blank';a.rel='noopener noreferrer';notice.appendChild(a);
  }
 }
 function toggle(){
  send.disabled=busy||!confirm.checked||!token.value.trim()||!pending;
 }
 button.onclick=()=>{
  try{
   const data=getData(),base=getBaseline(),key=getMapKey();
   if(!data||!base||data.metadata?.mapKey!==key)throw Error('No hay un mapa válido seleccionado.');
   const draft=makeGameDraft(data,base);
   if(draft.total<1)throw Error('Este mapa todavía no tiene modificaciones para publicar.');
   pending={mapKey:key,draft};
   confirm.checked=false;token.value='';
   summary.textContent='Mapa: '+key+' · '+draft.total+' modificaciones (altas, ediciones y bajas). Se publicarán los cambios del plano, nunca las fotografías guía.';
   notice.replaceChildren();notice.dataset.type='';
   send.textContent='Confirmar publicación';busy=false;toggle();
   dialog.showModal();
  }catch(error){show(error.message,'error')}
 };
 token.addEventListener('input',toggle);
 confirm.addEventListener('change',toggle);
 close.onclick=()=>{if(!busy)dialog.close()};
 dialog.addEventListener('close',()=>{token.value='';pending=null;confirm.checked=false;toggle()});
 send.onclick=async()=>{
  if(busy||!pending||!confirm.checked||!token.value.trim())return;
  const payload=pending,authorization=token.value.trim();
  // Authorization is not persisted or added to URLs.
  busy=true;toggle();send.textContent='Publicando…';
  result('Enviando la versión aprobada a GitHub…',true);
  try{
   const response=await fetch('./api/publish-map',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authorization},
    body:JSON.stringify(payload),cache:'no-store',credentials:'omit'
   });
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||'No se pudo realizar la publicación.');
   saveLocal();
   result('Versión confirmada en GitHub. El despliegue de Vercel puede tardar; después aparecerá automáticamente a todos los jugadores.',true,body.url);
   show('Mapa enviado a GitHub. Pendiente del despliegue de Vercel.','good');
   pending=null;
  }catch(error){
   result(error.message||'Error de publicación.','false');
   show('No se ha publicado: '+error.message,'error');
  }finally{
   token.value='';busy=false;send.textContent='Confirmar publicación';toggle();
  }
 };
 return{open:()=>button.click()};
}
