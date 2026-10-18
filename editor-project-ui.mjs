import {createProjectController} from './editor-project-controller.mjs';
import {listProjectVersions,listSavedProjects,readProjectVersion,renameProjectVersion,removeProjectVersion} from './editor-project-history.mjs';
import {projectSummary,validateProjectPackage,MAX_PACKAGE_BYTES} from './editor-project-package.mjs';
import {projectId} from './editor-project-session.mjs';
const SETTINGS='apulso-project-history-settings-v1';
export async function setupProjectUI({getCity,getDocument,getBaseline,getMapKey,flushPhotos,show,saveLocal,reload=key=>location.assign('./editor-arenal.html?map='+encodeURIComponent(key||''))}){
 const panel=document.createElement('details');panel.id='project-history-panel';panel.open=true;panel.innerHTML=`<summary>Proyecto completo e historial</summary><div class="stack">
 <label>Nombre del proyecto<input id="project-name" maxlength="100"></label><div class="actions"><button id="project-rename" type="button">Guardar nombre</button><button id="project-copy" type="button">Crear copia independiente</button></div>
 <label class="flag"><input id="project-export-photos" type="checkbox"> Incluir fotografías privadas en el archivo exportado</label>
 <button id="project-export" type="button">Exportar proyecto completo (.apulso)</button>
 <label>Abrir proyecto completo (.apulso)<input id="project-import" type="file" accept=".apulso,.json,application/json"></label>
 <p class="muted">Para añadir un único mapa .json: Mis mapas → Importar un mapa. Abrir un proyecto completo se prepara aquí para que puedas revisarlo antes de restaurar.</p>
 <p class="muted">Incluye mapas, calles compartidas, hermandades, recorridos, recursos y plantillas. Las fotografías solo se incluyen si marcas la casilla.</p>
 <label class="flag"><input id="project-auto" type="checkbox" checked> Guardar versiones automáticas (cada 2 minutos de cambios)</label>
 <label class="flag"><input id="project-history-photos" type="checkbox" checked> Conservar fotos privadas en las versiones locales</label>
 <label>Nombre de la versión<input id="project-version-name" maxlength="100" placeholder="Ej.: Antes de cambiar Adriano"></label><button id="project-checkpoint" type="button">Crear versión ahora</button>
 <label>Historial del proyecto<select id="project-versions" size="5"></select></label>
 <div class="actions"><button id="project-version-rename" type="button">Renombrar versión</button><button id="project-version-delete" type="button">Eliminar versión</button></div>
 <label>Proyectos guardados en este dispositivo<select id="project-saved"></select></label><button id="project-load-saved" type="button">Revisar proyecto guardado</button>
 <p id="project-preview" class="notice" role="status">Selecciona una versión o un archivo para revisarlo.</p>
 <label class="flag"><input id="project-import-copy" type="checkbox"> Abrir como proyecto independiente</label>
 <label class="flag"><input id="project-restore-photos" type="checkbox"> Restaurar también las fotografías incluidas</label>
 <button id="project-restore" type="button" disabled>Restaurar lo que estoy revisando</button>
 <p id="project-history-status" role="status"></p>
 <p class="muted">Se conserva una versión anterior antes de abrir o restaurar. Hay hasta 30 versiones automáticas y 60 manuales por proyecto. Exporta copias para llevar el trabajo a otro dispositivo.</p>
 </div>`;document.querySelector('.sidebar').prepend(panel);const $=id=>document.getElementById(id);let busy=false,dirty=false,timer=null,lastAutomatic=0,preview=null,serial=0;
 let preferences={automatic:true,photos:true};try{preferences={...preferences,...JSON.parse(localStorage.getItem(SETTINGS)||'{}')}}catch{}
 const status=(text,error=false)=>{$('project-history-status').textContent=text;$('project-history-status').dataset.error=String(error)};
 const controller=createProjectController({getCity,getDocument,getBaseline,getMapKey,flushPhotos,onApplying:value=>{document.body.classList.toggle('project-restoring',value);status(value?'Restaurando proyecto…':'')},onRestored:({key})=>reload(key)});
 $('project-name').value=controller.meta().name;$('project-auto').checked=preferences.automatic;$('project-history-photos').checked=preferences.photos;
 const guard=fn=>async()=>{if(busy)return;busy=true;try{await fn()}catch(e){status(e.message,true);show(e.message,'error')}finally{busy=false;if(dirty)schedule()}};
 const option=(id,name)=>{const o=document.createElement('option');o.value=id;o.textContent=name;return o};
 async function refresh(){const versions=await listProjectVersions(controller.meta().id),projects=await listSavedProjects(),selected=$('project-versions').value;$('project-versions').replaceChildren(...versions.map(v=>option(v.id,(v.automatic?'Auto · ':'')+new Date(v.createdAt).toLocaleString('es-ES')+' · '+v.label)));if(versions.some(v=>v.id===selected))$('project-versions').value=selected;$('project-saved').replaceChildren(option('','Seleccionar proyecto'),...projects.map(p=>option(p.head,p.name+' · '+new Date(p.updatedAt).toLocaleDateString('es-ES'))));}
 function showPackage(pkg,label){preview=pkg;const s=projectSummary(pkg),names=pkg.city.project.maps.slice(-4).map(m=>m.name).join(', ');$('project-preview').textContent=label+' · '+pkg.projectMeta.name+' · '+s.maps+' mapas, '+s.zones+' zonas, '+s.resources+' recursos, '+s.templates+' plantillas y '+s.photos+' fotos. '+names;$('project-restore').disabled=false;$('project-restore-photos').checked=false;$('project-import-copy').checked=false;}
 async function checkpoint(label='Versión manual',options={}){saveLocal();const capturedSerial=serial;status('Guardando versión…');const row=await controller.checkpoint(label,{includePhotos:preferences.photos,...options});dirty=serial!==capturedSerial;lastAutomatic=Date.now();status('Versión guardada: '+row.label);await refresh();return row}
 function schedule(){if(!preferences.automatic||timer||busy||controller.isApplying())return;timer=setTimeout(async()=>{timer=null;if(!dirty)return;if(busy){schedule();return}busy=true;try{await checkpoint('Guardado automático',{automatic:true})}catch(e){status('No se pudo guardar la versión automática: '+e.message,true);lastAutomatic=Date.now()}finally{busy=false;if(dirty)schedule()}},Math.max(5000,lastAutomatic+120000-Date.now()));timer.unref?.()}
 function notifyChange(){dirty=true;serial++;schedule()}
 for(const id of ['project-auto','project-history-photos'])$(id).onchange=()=>{preferences={automatic:$('project-auto').checked,photos:$('project-history-photos').checked};localStorage.setItem(SETTINGS,JSON.stringify(preferences));if(!preferences.automatic){clearTimeout(timer);timer=null}else schedule()};
 $('project-checkpoint').onclick=guard(()=>checkpoint($('project-version-name').value.trim()||'Versión manual',{force:true}));
 $('project-rename').onclick=guard(async()=>{controller.rename($('project-name').value);await checkpoint('Nombre del proyecto actualizado',{force:true});status('Proyecto renombrado.');});
 $('project-copy').onclick=guard(async()=>{saveLocal();const pkg=await controller.capture({includePhotos:true,name:$('project-name').value.trim()||controller.meta().name});await controller.apply(pkg,{copy:true,restorePhotos:true,label:'Copia independiente'});});
 $('project-export').onclick=guard(async()=>{saveLocal();const pkg=await controller.capture({includePhotos:$('project-export-photos').checked}),json=JSON.stringify(pkg);if(new Blob([json]).size>MAX_PACKAGE_BYTES)throw Error('El proyecto supera 192 MB. Exporta sin fotografías privadas.');const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='apulso-'+pkg.projectMeta.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]+/g,'-').slice(0,60)+'-'+new Date().toISOString().slice(0,10)+'.apulso';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);status('Proyecto exportado'+(pkg.privatePhotos!==undefined?' con fotografías privadas.':' sin fotografías privadas.'));});
 $('project-import').onchange=guard(async()=>{const file=$('project-import').files?.[0];$('project-import').value='';if(!file)return;if(file.size>MAX_PACKAGE_BYTES)throw Error('El archivo supera 192 MB.');const pkg=validateProjectPackage(JSON.parse(await file.text()));showPackage(pkg,'Archivo preparado');status('Revisa el contenido y pulsa Restaurar para abrirlo.');});
 $('project-versions').onchange=guard(async()=>{const row=await readProjectVersion($('project-versions').value);showPackage(row.package,'Versión: '+row.version.label+' · '+new Date(row.version.createdAt).toLocaleString('es-ES'));});
 $('project-load-saved').onclick=guard(async()=>{if(!$('project-saved').value)throw Error('Selecciona un proyecto guardado.');const row=await readProjectVersion($('project-saved').value);showPackage(row.package,'Proyecto guardado');});
 $('project-restore').onclick=guard(async()=>{if(!preview)throw Error('Selecciona una versión o un archivo.');saveLocal();await flushPhotos();await controller.apply(preview,{copy:$('project-import-copy').checked,restorePhotos:$('project-restore-photos').checked,label:'Restauración de '+preview.projectMeta.name});});
 $('project-version-rename').onclick=guard(async()=>{if(!$('project-versions').value)throw Error('Selecciona una versión.');await renameProjectVersion($('project-versions').value,$('project-version-name').value);await refresh();status('Versión renombrada.');});
 $('project-version-delete').onclick=guard(async()=>{const id=$('project-versions').value;if(!id)throw Error('Selecciona una versión.');if(!confirm('¿Eliminar esta versión del historial? El mapa abierto no cambia.'))return;await removeProjectVersion(id);preview=null;$('project-restore').disabled=true;await refresh();status('Versión eliminada; el proyecto abierto se conserva.');});
 window.addEventListener('storage',e=>{if(!controller.canWrite()&&!controller.isApplying())status('Se ha cambiado el proyecto en otra ventana. Recarga este editor antes de seguir.',true)});
 try{await refresh()}catch(e){status('Historial no disponible: '+e.message,true)}
 return{notifyChange,refresh,canWrite:controller.canWrite,isApplying:controller.isApplying,controller};
}
