import {initializeTemplates,listTemplates,templateById,saveTemplate,removeTemplate,templateFromSelection,exportTemplates,importTemplates} from './editor-template-library.mjs';
import {placeBlock} from './editor-selection-model.mjs';
import {allSelections} from './editor-item-state.mjs';
import {selectionGeometry} from './editor-interactions.mjs';
import {paintCityScene} from './city-scene.mjs';
import {loadDocumentAssets} from './custom-assets.mjs';
export async function setupTemplatesUI({state,getData,selectionEditor,show,requestDraw,configureTool,getImage,pixel,getZoom}){
 await initializeTemplates();const panel=document.createElement('details');panel.id='templates-panel';
 panel.innerHTML=`<summary>Plantillas reutilizables</summary><div class="stack">
 <label>Nombre de plantilla<input id="template-name" type="text" maxlength="100" placeholder="Ej.: Bar con toldo y banderola"></label>
 <button id="template-save" type="button">Guardar selección como plantilla nueva</button>
 <label>Mis plantillas<select id="template-list"></select></label><div id="template-preview-host"></div><p id="template-description" class="muted"></p>
 <label>Giro al colocar (°)<input id="template-angle" type="number" min="-360" max="360" step="1" value="0"></label>
 <button id="template-place" class="primary" type="button">Colocar plantilla en el plano</button>
 <div class="actions"><button id="template-update" type="button">Actualizar con selección</button><button id="template-rename" type="button">Guardar nombre</button></div>
 <button id="template-delete" type="button">Eliminar plantilla del catálogo</button>
 <div class="actions"><button id="template-export" type="button">Exportar esta plantilla</button><button id="templates-export" type="button">Exportar catálogo completo</button></div>
 <label>Importar plantillas<input id="template-import" type="file" accept="application/json,.json"></label>
 <p class="muted">La plantilla conserva superficies, patios, comercios, toldos, banderolas y recursos propios. Cada colocación es un grupo independiente que puedes mover, girar, redimensionar o desagrupar. Actualizar el catálogo conserva las copias ya colocadas.</p>
 </div>`;document.querySelector('.sidebar').prepend(panel);
 const $=id=>document.getElementById(id),preview=document.createElement('canvas');preview.id='template-preview';preview.width=576;preview.height=320;preview.setAttribute('role','img');preview.setAttribute('aria-label','Vista previa de la plantilla');$('template-preview-host').append(preview);
 let current=null,pending=null,busy=false;
 const guard=fn=>async(...args)=>{if(busy)return;busy=true;try{return await fn(...args)}catch(e){show(e.message,'error')}finally{busy=false;refreshButtons()}};
 const get=()=>{const t=templateById(current);if(!t)throw Error('Selecciona una plantilla guardada.');return t};
 function refreshButtons(){const exists=!!templateById(current);for(const id of ['place','update','rename','delete','export'])$('template-'+id).disabled=!exists||busy;$('template-save').disabled=busy;$('templates-export').disabled=!listTemplates().length||busy}
 function render(){const c=preview.getContext('2d');c.clearRect(0,0,576,320);c.fillStyle='#677168';c.fillRect(0,0,576,320);const t=templateById(current);if(!t){c.fillStyle='#e3ece3';c.font='22px system-ui';c.textAlign='center';c.fillText('Guarda un conjunto para empezar',288,160);$('template-description').textContent='Selecciona objetos, superficies o un grupo en el plano.';return}
  const doc=t.block.layers,items=allSelections(doc),g=selectionGeometry(doc,items),z=Math.min(500/Math.max(.2,g.bounds[2]-g.bounds[0]),250/Math.max(.2,g.bounds[3]-g.bounds[1]));paintCityScene(c,doc,(x,y)=>[288+(x-g.center[0])*z,160-(y-g.center[1])*z],z,getImage,null,{labels:true});$('template-description').textContent=items.length+' elementos · '+(g.bounds[2]-g.bounds[0]).toFixed(2)+' × '+(g.bounds[3]-g.bounds[1]).toFixed(2)+' m';
 }
 function refresh(id=current){current=id;const select=$('template-list');select.replaceChildren();for(const t of listTemplates()){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;select.append(o)}if(!templateById(current))current=listTemplates()[0]?.id||null;select.value=current||'';refreshButtons();render()}
 async function select(id){pending=null;if(state.tool==='template')configureTool('select');current=id;const t=get();await loadDocumentAssets({...t.block.layers,resources:t.block.resources});$('template-name').value=t.name;refresh()}
 $('template-list').onchange=guard(()=>select($('template-list').value));
 $('template-save').onclick=guard(async()=>{const t=await saveTemplate(templateFromSelection(getData(),state.selectedItems,$('template-name').value));await select(t.id);show('Plantilla guardada con la selección actual.','good')});
 $('template-update').onclick=guard(async()=>{const old=get(),t=await saveTemplate(templateFromSelection(getData(),state.selectedItems,$('template-name').value||old.name,old.id));await select(t.id);show('Plantilla actualizada. Las colocaciones existentes se conservan.','good')});
 $('template-rename').onclick=guard(async()=>{const t=get();await saveTemplate({...t,name:$('template-name').value});refresh();show('Nombre guardado.','good')});
 $('template-delete').onclick=guard(async()=>{const t=get();await removeTemplate(t.id);if(pending?.id===t.id){pending=null;configureTool('select')}refresh();show('Plantilla eliminada del catálogo. Sus objetos en los mapas se conservan.','good')});
 $('template-place').onclick=guard(async()=>{const t=get(),angle=+$('template-angle').value;if(!Number.isFinite(angle)||Math.abs(angle)>360)throw Error('Escribe un giro entre −360 y 360°.');await loadDocumentAssets({...t.block.layers,resources:t.block.resources});pending={...structuredClone(t),angle};configureTool('template');show('Pulsa en el plano para colocar «'+t.name+'». Escape cancela.','good');requestDraw()});
 const download=input=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(input,null,2)],{type:'application/json'}));a.href=url;a.download='apulso-plantillas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('template-export').onclick=guard(()=>{download(exportTemplates([get().id]));show('Plantilla exportada con sus imágenes.','good')});$('templates-export').onclick=guard(()=>{download(exportTemplates());show('Catálogo de plantillas exportado.','good')});
 $('template-import').onchange=guard(async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>65000000)throw Error('El catálogo supera 65 MB.');const imported=await importTemplates(JSON.parse(await file.text()));await select(imported[0].id);show(imported.length+' plantillas importadas.','good')});
 refresh();if(current)await select(current);
 return{refresh,render,cancel(){pending=null},down(point){if(state.tool!=='template')return false;if(!pending){show('Elige primero una plantilla.','error');return true}const t=pending;if(selectionEditor.run(doc=>placeBlock(doc,t.block,{point,angle:t.angle,group:true,name:t.name}),'Plantilla colocada como grupo independiente.')){pending=null;configureTool('select')}return true},overlay(ctx){if(state.tool!=='template'||!pending||!state.mouseWorld)return;const z=getZoom();ctx.save();ctx.translate(...pixel(...state.mouseWorld));ctx.rotate(-pending.angle*Math.PI/180);ctx.globalAlpha=.55;paintCityScene(ctx,pending.block.layers,(x,y)=>[x*z,-y*z],z,getImage);ctx.restore()}};
}
