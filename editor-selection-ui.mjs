import {selectionFrame,transformSelection,groupSelection,ungroupSelection,lockSelection,arrangeSelection,captureBlock,placeBlock,validateBlock} from './editor-selection-model.mjs';
import {allSelections,itemEdit,expandGroups,selectionLocked} from './editor-item-state.mjs';
export function setupSelectionEditor({state,getData,snapshot,changed,show,setSelection,configureTool,getCenter,visible}){
 const panel=document.createElement('details');panel.id='selection-editor-panel';panel.open=true;
 panel.innerHTML=`<summary>Editar selección · objetos y grupos</summary><div class="stack">
 <p id="edit-selection-info" class="notice">Selecciona elementos en el plano.</p>
 <div class="actions"><button id="edit-copy" type="button">Copiar</button><button id="edit-paste" type="button">Pegar</button><button id="edit-duplicate" type="button">Duplicar</button></div>
 <p class="muted">Portapapeles del editor: copia entre mapas. Pegar coloca en el centro de la vista; Duplicar desplaza 30 cm. Se incluyen superficies, decoraciones y recursos propios.</p>
 <div class="precision-two"><label>Centro X (m)<input id="edit-x" type="number" step=".01"></label><label>Centro Y (m)<input id="edit-y" type="number" step=".01"></label></div>
 <div class="precision-two"><label>Ancho (m)<input id="edit-width" type="number" min=".02" max="2000" step=".01"></label><label>Fondo (m)<input id="edit-depth" type="number" min=".02" max="2000" step=".01"></label></div>
 <label class="flag"><input id="edit-aspect" type="checkbox" checked> Conservar proporciones</label>
 <label><span id="edit-angle-title">Giro absoluto (°)</span><input id="edit-angle" type="number" step=".1"></label>
 <button id="edit-transform" type="button">Aplicar posición, medidas y giro</button>
 <p id="edit-size-help" class="muted"></p>
 <div class="line"></div><strong>Alinear y repartir</strong><div class="edit-align-grid">
 <button data-arrange="left" type="button">Izquierda</button><button data-arrange="centerX" type="button">Centro X</button><button data-arrange="right" type="button">Derecha</button>
 <button data-arrange="top" type="button">Arriba</button><button data-arrange="centerY" type="button">Centro Y</button><button data-arrange="bottom" type="button">Abajo</button></div>
 <div class="actions"><button data-arrange="distributeX" type="button">Repartir huecos ↔</button><button data-arrange="distributeY" type="button">Repartir huecos ↕</button></div>
 <label>Nombre del conjunto<input id="edit-group-name" type="text" maxlength="100" value="Conjunto"></label>
 <div class="actions"><button id="edit-group" type="button">Agrupar</button><button id="edit-ungroup" type="button">Desagrupar</button></div>
 <label class="flag"><input id="edit-members" type="checkbox"> Seleccionar miembros por separado</label>
 <div class="actions"><button id="edit-lock" type="button">Bloquear</button><button id="edit-unlock" type="button">Desbloquear</button></div>
 <p class="muted">Un clic selecciona el grupo completo. Los elementos bloqueados se pueden seleccionar y copiar; para moverlos, modificarlos o borrarlos hay que desbloquearlos.</p>
 <p class="hotkeys">Ctrl+C / V / D: copiar, pegar, duplicar · Ctrl+A: seleccionar visibles · Ctrl+G / Ctrl+Mayús+G: agrupar / desagrupar · Flechas: 10 cm; Mayús: 1 m; Alt: 1 cm.</p>
 </div>`;document.querySelector('.sidebar').prepend(panel);
 const $=id=>document.getElementById(id);let clipboard=null,pastes=0;
 try{const stored=JSON.parse(localStorage.getItem('apulso-editor-clipboard-v1')||'null');if(stored)clipboard=validateBlock(stored)}catch{}
 const run=(fn,message)=>{try{const staged=structuredClone(getData()),items=fn(staged);snapshot();Object.assign(getData(),staged);if(items)setSelection(items);changed();refresh();show(message,'good');return true}catch(error){show(error.message,'error');return false}};
 function copy(){try{clipboard=captureBlock(getData(),state.selectedItems);pastes=0;try{localStorage.setItem('apulso-editor-clipboard-v1',JSON.stringify(clipboard))}catch{}refresh();show('Selección copiada. Puedes pegarla en este mapa o en otro.','good');return true}catch(e){show(e.message,'error');return false}}
 function duplicate(){try{const block=captureBlock(getData(),state.selectedItems),center=selectionFrame(getData(),state.selectedItems).center;return run(doc=>placeBlock(doc,block,{point:center.map(x=>x+.3)}),'Selección duplicada con copias independientes.')}catch(e){show(e.message,'error');return false}}
 function paste(){try{const stored=JSON.parse(localStorage.getItem('apulso-editor-clipboard-v1')||'null');if(stored)clipboard=validateBlock(stored)}catch{}if(!clipboard){show('Copia primero una selección en el editor.','error');return false}pastes++;const p=getCenter().map(x=>x+.3*pastes);return run(doc=>placeBlock(doc,clipboard,{point:p}),'Selección pegada. Puedes moverla o ajustar sus medidas.');}
 function refresh(){
  const doc=getData(),items=state.selectedItems,frame=selectionFrame(doc,items),locked=selectionLocked(doc,items),first=items[0]&&doc?.[items[0].type]?.[items[0].index],meta=itemEdit(first);
  $('edit-selection-info').textContent=!frame?'Selecciona uno o varios elementos en el plano.':items.length+' elemento(s)'+(frame.group?' · '+(meta.groupName||'Conjunto'):'')+(locked?' · BLOQUEADO':'');
  for(const name of ['x','y','width','depth','angle']){const input=$('edit-'+name);input.disabled=!frame||locked;if(frame)input.value=String(Math.round((name==='x'?frame.center[0]:name==='y'?frame.center[1]:frame[name])*1000000)/1000000);else input.value=''}
  if(items.length===1&&items[0].type==='labels')$('edit-angle').disabled=true;
  if(frame?.group)$('edit-group-name').value=meta.groupName||'Conjunto';
  $('edit-aspect').disabled=!frame||items.length>1||frame.circular||locked;if(items.length>1||frame?.circular)$('edit-aspect').checked=true;
  $('edit-size-help').textContent=frame?.circular?'Ancho y fondo representan el diámetro de activación.':items.length>1?'Las medidas del conjunto siguen los ejes del plano y conservan su proporción. Los grupos se alinean como una unidad.':'Las medidas siguen los ejes propios del elemento. La escala del pavimento y las fotografías guía se conserva.';
  $('edit-angle').setAttribute('aria-label',frame?.relative?'Girar selección en grados':'Giro absoluto en grados');$('edit-angle').title=frame?.relative?'Giro relativo del conjunto seleccionado':'Giro absoluto';
  $('edit-angle-title').textContent=frame?.relative?'Girar selección (°)':'Giro absoluto (°)';
  for(const id of ['copy','duplicate'])$('edit-'+id).disabled=!frame;$('edit-paste').disabled=!clipboard;
  for(const id of ['transform','group','ungroup','lock'])$('edit-'+id).disabled=!frame||locked;$('edit-unlock').disabled=!frame||!locked;
  for(const b of panel.querySelectorAll('[data-arrange]'))b.disabled=!frame||locked;
 }
 $('edit-copy').onclick=copy;$('edit-paste').onclick=paste;$('edit-duplicate').onclick=duplicate;
 $('edit-transform').onclick=()=>run(doc=>transformSelection(doc,state.selectedItems,Object.fromEntries(['x','y','width','depth','angle'].map(k=>[k,+$('edit-'+k).value]))),'Posición, medidas y giro aplicados.');
 for(const name of ['width','depth'])$('edit-'+name).addEventListener('input',()=>{const frame=selectionFrame(getData(),state.selectedItems);if(frame&&$('edit-aspect').checked){const other=name==='width'?'depth':'width';$('edit-'+other).value=(+$('edit-'+name).value*frame[other]/frame[name]).toFixed(6)}});
 for(const b of panel.querySelectorAll('[data-arrange]'))b.onclick=()=>run(doc=>arrangeSelection(doc,state.selectedItems,b.dataset.arrange),'Selección alineada o repartida.');
 $('edit-group').onclick=()=>run(doc=>groupSelection(doc,state.selectedItems,$('edit-group-name').value),'Elementos agrupados.');
 $('edit-ungroup').onclick=()=>run(doc=>ungroupSelection(doc,state.selectedItems),'Grupo deshecho; sus elementos se conservan.');
 for(const [id,locked]of [['lock',true],['unlock',false]])$('edit-'+id).onclick=()=>run(doc=>lockSelection(doc,state.selectedItems,locked),locked?'Selección bloqueada.':'Selección desbloqueada.');
 $('edit-members').onchange=()=>{state.separateMembers=$('edit-members').checked;if(!state.separateMembers)setSelection(expandGroups(getData(),state.selectedItems));refresh()};
 window.addEventListener('storage',event=>{if(event.key==='apulso-editor-clipboard-v1'){try{clipboard=event.newValue?validateBlock(JSON.parse(event.newValue)):null}catch{}refresh()}});
 window.addEventListener('keydown',event=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable||document.querySelector('dialog[open]'))return;
  const key=event.key.toLowerCase(),ctrl=event.ctrlKey||event.metaKey;
  if(ctrl&&['c','v','d','a','g'].includes(key)){event.preventDefault();if(key==='c')copy();if(key==='v')paste();if(key==='d')duplicate();if(key==='a'){configureTool('select');setSelection(allSelections(getData()).filter(s=>visible(s.type)))}if(key==='g')$('edit-'+(event.shiftKey?'ungroup':'group')).onclick();return}
  if(state.tool==='select'&&state.selectedItems.length&&['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
   event.preventDefault();const f=selectionFrame(getData(),state.selectedItems),amount=event.altKey?.01:event.shiftKey?1:.1;
   run(doc=>transformSelection(doc,state.selectedItems,{x:f.center[0]+(key==='arrowleft'?-amount:key==='arrowright'?amount:0),y:f.center[1]+(key==='arrowdown'?-amount:key==='arrowup'?amount:0),width:f.width,depth:f.depth,angle:f.angle}),'Selección desplazada.');
  }
 });
 refresh();return{refresh,copy,paste,duplicate,run};
}
