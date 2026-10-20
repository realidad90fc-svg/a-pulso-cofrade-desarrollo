import {projectSteps} from './brotherhood-content.mjs';
import {mountBrotherhoodContent} from './editor-brotherhood-content.mjs';
import {BROTHERHOODS,CONTENT_STEPS} from './content-catalogue.mjs';
import {activateCityItinerary,makePlayableCity} from './city-campaign.mjs';
import {newId} from './map-gameplay.mjs';
import {CITY_KEY,CITY_SCHEMA,MAP_STORAGE_PREFIX,KINDS,readCityProject,persistCityProject,addCityMap,addCityZone,indexMapStreets,searchCityStreets,assignCityZone,affectedBrotherhoods,selectCityZone,resolveCityMap,transformMapDocument,polygonBounds,exportCityBundle,validateCityBundle,validateMapDocument,normalizeStreet} from './city-project.mjs';
import {paintCityScene} from './city-scene.mjs';
import {mapUsage,itineraryState,renameCityMap,trashCityMap,restoreCityMap} from './city-map-library.mjs';
import {lightweightDocument,loadDocumentAssets} from './custom-assets.mjs';

const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
export function setupCityManager({catalog,getData,getBaseline,getMapKey,getDocument,openMap,onRegisterMap,onNewDocument,snapshot,changed,saveLocal,show,focus,getSelection,getView,getImage,getPreviewStart,canEdit=()=>true,canWrite=()=>true,onProjectChange=()=>{},onCatalogChange=()=>{},openProject=()=>{},beforeActivation=async()=>{},publishProject=()=>{},onPreviewStep=()=>{}}){
 let project=readCityProject(localStorage,catalog),tab='maps',selectedZone=null,searchTimer;
 for(const map of project.maps)if(!catalog.some(m=>m.key===map.key))onRegisterMap(map);
 onCatalogChange(project.maps);
 const persist=()=>{if(!canWrite())throw Error('El proyecto ha cambiado en otra ventana. Recarga el editor.');const value=persistCityProject(localStorage,project);onCatalogChange(project.maps);onProjectChange();return value};
 const transaction=fn=>{if(!canWrite())throw Error('Recarga el proyecto antes de modificarlo.');const before=structuredClone(project);try{const value=fn();persist();return value}catch(error){project=before;throw error}};
 const modal=el('dialog','city-dialog');modal.id='city-dialog';modal.setAttribute('aria-labelledby','city-title');
 modal.innerHTML=`<header class="city-head"><div><span class="city-eyebrow">TALLER DE SEVILLA · TU PROYECTO</span><h1 id="city-title">Tus mapas y hermandades</h1><p id="city-summary"></p></div><button type="button" id="city-close" aria-label="Cerrar biblioteca">Cerrar ×</button></header>
 <nav class="city-tabs" aria-label="Gestión de mapas"><button data-city-tab="maps">Mis mapas</button><button data-city-tab="brotherhoods">Hermandades</button><button data-city-tab="streets">Reutilizar calles</button><button data-city-tab="trash">Papelera</button><button data-city-tab="help">Cómo se usa</button></nav>
 <div class="city-content"><section class="city-main"><div id="city-context"></div><div id="city-results"></div></section><aside class="city-aside"><div id="city-form"></div><div class="city-backup"><h3>Una copia de todo</h3><p>El proyecto .apulso reúne mapas, recursos y asignaciones. Puedes incluir tus fotos privadas.</p><button id="city-project-backup">Copias e historial del proyecto</button><details><summary>Formato de ciudad anterior (.json)</summary><button id="city-export-project">Exportar ciudad (.json)</button><label class="city-file">Restaurar ciudad (.json)<input id="city-import-project" type="file" accept="application/json,.json"></label><p class="city-small">Formato anterior sin fotografías privadas ni historial. Para una copia completa utiliza .apulso.</p></details></div><p id="city-notice" role="status" aria-live="polite"></p></aside></div>`;
 document.body.append(modal);
 const $=id=>document.getElementById(id),notice=(message,error=false)=>{const n=$('city-notice');n.textContent=message;n.dataset.error=String(error);show(message,error?'error':'good')};
 const guard=fn=>async(...args)=>{try{if(!canWrite())throw Error('El proyecto se ha cambiado o se está restaurando. Recarga el editor.');await fn(...args)}catch(error){notice(error.message||String(error),true)}};
 const button=(text,fn,primary=false)=>{const b=el('button',primary?'city-primary':'',text);b.type='button';b.onclick=guard(fn);return b};
 const mapsName=key=>project.maps.find(m=>m.key===key)?.name||key;
 const brotherhoodName=id=>BROTHERHOODS.find(b=>b.id===id)?.name||id;
 const getDoc=key=>key===getMapKey()?getData():getDocument(key);
 function saveCanonical(key,trail=new Set()){
  if(trail.has(key))throw Error('Enlace circular entre mapas.');
  const next=new Set(trail).add(key),doc=getDoc(key);
  for(const ref of doc.zoneRefs||[]){const zone=project.zones.find(z=>z.id===ref.zoneId);if(zone)saveCanonical(zone.mapKey,next)}
  localStorage.setItem(MAP_STORAGE_PREFIX+key,JSON.stringify(lightweightDocument(doc)));
 }
 const ensureIndex=()=>{for(const m of project.maps.filter(m=>!m.trashed))indexMapStreets(project,getDoc(m.key))};
 const open=(which=tab)=>{saveLocal();ensureIndex();persist();tab=which;render();if(!modal.open)modal.showModal()};
 $('city-close').onclick=()=>modal.close();
 $('city-project-backup').onclick=()=>{modal.close();openProject()};
 modal.addEventListener('keydown',event=>event.stopPropagation());
 modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close()}});
 for(const b of modal.querySelectorAll('[data-city-tab]'))b.onclick=()=>{tab=b.dataset.cityTab;render()};
 function contextInput(placeholder,onInput){const i=el('input','city-search');i.type='search';i.placeholder=placeholder;i.setAttribute('aria-label',placeholder);i.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>onInput(i.value),120)};return i}
 function addField(form,title,name,value,type='text'){const label=el('label','city-field'),input=el('input');label.append(el('span','',title));input.name=name;input.type=type;input.value=value;if(type==='number'){input.min='8';input.max='2000'}label.append(input);form.append(label);return input}
 function render(){
  $('city-summary').textContent=project.maps.filter(m=>!m.trashed).length+' mapas guardados · '+Object.keys(project.campaignItineraries||{}).length+' hermandades con itinerario en el juego';
  modal.dataset.tab=tab;
  for(const b of modal.querySelectorAll('[data-city-tab]')){const active=b.dataset.cityTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
  $('city-context').replaceChildren();$('city-results').replaceChildren();$('city-form').replaceChildren();
  if(tab==='maps')renderMaps();else if(tab==='streets')renderStreets();else if(tab==='trash')renderTrash();else if(tab==='help')renderHelp();else renderBrotherhoods();
 }
 function thumbnail(map,canvas){
  try{const doc=getDoc(map.key),c=canvas.getContext('2d'),b=doc.bounds||polygonBounds((doc.roads||[]).flatMap(o=>o.poly));if(!b.every(Number.isFinite))return;
   const z=Math.min((canvas.width-18)/Math.max(1,b[2]-b[0]),(canvas.height-18)/Math.max(1,b[3]-b[1]));
   const px=(x,y)=>[canvas.width/2+(x-(b[0]+b[2])/2)*z,canvas.height/2-(y-(b[1]+b[3])/2)*z];
   c.fillStyle='#777b70';c.fillRect(0,0,canvas.width,canvas.height);paintCityScene(c,doc,px,z,getImage,b,{crowd:false});
  }catch{const c=canvas.getContext('2d');c.fillStyle='#817566';c.fillRect(0,0,canvas.width,canvas.height)}
 }
 function mapBadge(map){
  const use=mapUsage(project,map.key),state=use.live.length?'live':use.drafts.length?'draft':'editing';
  return el('span','city-badge',''+({live:'En el juego',draft:'Asignado · sin aplicar',editing:'En edición'})[state]);
 }
 function renderMaps(){
  $('city-context').append(el('h2','','1. Construye y guarda tus mapas'),el('p','','Cada mapa se guarda una sola vez. Después puedes usarlo en una o varias hermandades.'));
  const input=contextInput('Buscar por nombre, zona o barrio…',paint);$('city-context').append(input);
  const originals=el('label','city-check'),originalsCheck=el('input');originalsCheck.type='checkbox';originals.append(originalsCheck,document.createTextNode('Mostrar también los mapas originales de referencia'));$('city-context').append(originals);originalsCheck.onchange=()=>paint(input.value);
  $('city-context').append(button('Nuevo mapa',()=>{createForm();$('city-form').scrollIntoView?.({block:'nearest'});$('city-form').querySelector('input')?.focus()},true));
  function createForm(){
   const host=$('city-form');host.replaceChildren();const form=el('form','city-form');form.id='city-create-map';form.append(el('h3','','Crear un mapa'),el('p','city-small','Una calle independiente se puede reutilizar. Un recorrido puede reunir varias calles enlazadas.'));
   addField(form,'Nombre del mapa','name','');addField(form,'Barrio (opcional)','barrio','');
   const typeLabel=el('label','city-field'),typeSelect=el('select');typeSelect.name='purpose';typeSelect.innerHTML='<option value="street">Calle reutilizable</option><option value="route">Mapa de recorrido</option>';typeLabel.append(el('span','','Qué vas a construir'),typeSelect);form.append(typeLabel);
   const row=el('div','city-two');form.append(row);addField(row,'Ancho (m)','width',40,'number');addField(row,'Fondo (m)','height',40,'number');
   const submit=el('button','city-primary','Crear y abrir');submit.type='submit';form.append(submit);form.onsubmit=guard(event=>{
    event.preventDefault();const values=new FormData(form),newMap=transaction(()=>{const result=addCityMap(project,{name:values.get('name'),barrio:values.get('barrio'),purpose:values.get('purpose')||'street',width:+values.get('width'),height:+values.get('height')});localStorage.setItem(MAP_STORAGE_PREFIX+result.meta.key,JSON.stringify(result.document));return result});
    onRegisterMap(newMap.meta);onCatalogChange(project.maps);modal.close();onNewDocument(newMap.meta.key,newMap.document);notice('Mapa creado. Dibuja, guarda y después asígnalo desde Hermandades.');
   });
   const importLabel=el('label','city-file','Importar un mapa (.json)'),importFile=el('input');importFile.type='file';importFile.accept='.json,application/json';importLabel.append(importFile);
   importFile.onchange=guard(async()=>{const f=importFile.files?.[0];importFile.value='';if(!f)return;if(f.size>24000000)throw Error('El archivo es demasiado grande.');const doc=JSON.parse(await f.text());validateMapDocument(doc);
    const existing=project.maps.find(m=>m.key===doc.metadata.mapKey);
    if(existing){if(existing.trashed)throw Error('Ese mapa está en Papelera. Restáuralo primero.');notice('Ese mapa ya existe. Se ha abierto; usa Importar solo este mapa para cargar sus cambios.');modal.close();openMap(existing.key);return}
    await loadDocumentAssets(doc,{persist:true});const result=transaction(()=>{const x=addCityMap(project,{name:doc.metadata.map||f.name.replace(/\.json$/,''),barrio:doc.metadata.barrio},doc);localStorage.setItem(MAP_STORAGE_PREFIX+x.meta.key,JSON.stringify(lightweightDocument(x.document)));return x});onRegisterMap(result.meta);onCatalogChange(project.maps);modal.close();onNewDocument(result.meta.key,result.document);
   });
   const advanced=el('details','city-advanced');advanced.append(el('summary','','Trabajar con una parte de un mapa'),el('p','city-small','Registra una zona para asignar solo un tramo. Para calles nuevas, es más sencillo crear un mapa por calle.'),button('Registrar zona del mapa abierto',()=>openZoneForm()));
   host.append(form,importLabel,advanced);
  }
  function paint(query=''){
   const results=$('city-results');results.replaceChildren();const q=normalizeStreet(query),grid=el('div','city-grid');
   for(const map of project.maps.filter(m=>!m.trashed&&(originalsCheck.checked||m.type==='user'||localStorage.getItem(MAP_STORAGE_PREFIX+m.key))&&(!q||normalizeStreet(m.name+' '+(m.barrio||'')+' '+project.zones.filter(z=>z.mapKey===m.key).map(z=>z.name).join(' ')).includes(q)))){
    const card=el('article','city-map-card');card.dataset.mapKey=map.key;const canvas=el('canvas');canvas.width=320;canvas.height=150;canvas.setAttribute('aria-label','Plano de '+map.name);
    card.append(canvas,mapBadge(map),el('h3','',map.name),el('p','city-small',(map.barrio||'Sevilla')+' · '+(map.purpose==='street'?'Calle reutilizable':map.type==='user'?'Mapa de recorrido':'Mapa original editado / referencia')));
    const use=mapUsage(project,map.key);card.append(el('p','city-small',use.drafts.length||use.live.length?'Usado por '+new Set([...use.drafts,...use.live]).size+' hermandad(es).':'Todavía sin asignar a una hermandad.'));
    const actions=el('div','city-actions');actions.append(button('Abrir editor',()=>{modal.close();openMap(map.key)},true),button('Asignar a hermandad',()=>chooseZone('map:'+map.key)),button('Nombre y usos',()=>mapAction(map,'info')),button('Eliminar',()=>mapAction(map,'delete')));card.append(actions);
    const zones=project.zones.filter(z=>z.mapKey===map.key&&!z.whole);if(zones.length){const details=el('details','city-advanced');details.append(el('summary','',zones.length+' zonas dentro de este mapa'));for(const zone of zones){const r=el('div','city-zone-row');r.append(el('span','',zone.name),button('Asignar',()=>chooseZone(zone.id)),button('Ver',()=>{modal.close();openMap(map.key);focus((zone.bounds[0]+zone.bounds[2])/2,(zone.bounds[1]+zone.bounds[3])/2,24)}));details.append(r)}card.append(details)}
    grid.append(card);requestAnimationFrame(()=>thumbnail(map,canvas));
   }
   if(!grid.children.length)results.append(el('p','city-empty',q?'No hay coincidencias. Prueba otro nombre.':'Aquí aparecerán tus mapas. Crea una calle o importa un mapa para empezar. Los originales están disponibles con la casilla superior.'));else results.append(grid);
  }
  function mapAction(map,mode){
   const host=$('city-form'),usage=mapUsage(project,map.key,getDoc);host.replaceChildren(el('h3','',map.name));host.dataset.mapAction=mode;
   const names=ids=>ids.length?ids.map(brotherhoodName).join(', '):'Ninguna';
   host.append(el('p','','Hermandades en preparación: '+names(usage.drafts)),el('p','','Hermandades en el juego: '+names(usage.live)));
   for(const [list,label]of [[usage.links,'Enlazado dentro de'],[usage.connections,'Recibe una salida desde']])for(const m of list)host.append(button(label+' '+m.name,()=>{modal.close();openMap(m.key)}));
   if(mode==='info'){
    const form=el('form','city-form'),name=addField(form,'Nombre del mapa','name',map.name);name.maxLength=100;
    const submit=el('button','city-primary','Guardar nombre');submit.type='submit';form.append(submit);form.onsubmit=guard(event=>{event.preventDefault();transaction(()=>renameCityMap(project,map.key,name.value));paint(input.value);notice('Nombre actualizado. Sus asignaciones y récords conservan el mismo identificador.');});host.append(form);
   }else{
    host.append(el('p','city-warning','Se enviará a Papelera y se quitará de las hermandades indicadas, también de sus itinerarios activos. Los demás tramos se conservarán.'));
    if(usage.links.length||usage.connections.length)host.append(el('p','city-warning','Primero retira los vínculos o cambia las salidas de los mapas indicados arriba. Así sus recorridos seguirán funcionando.'));
    else{const remove=button('Enviar a papelera',async()=>{
     if(saveLocal()===false)throw Error('No se ha podido guardar. No se eliminará el mapa.');
     await beforeActivation('Antes de eliminar '+map.name);transaction(()=>trashCityMap(project,map.key,getDoc));
     if(getMapKey()===map.key){let next=project.maps.find(m=>!m.trashed&&m.type==='user')||project.maps.find(m=>!m.trashed);if(!next){const made=transaction(()=>{const x=addCityMap(project,{name:'Nuevo mapa'});localStorage.setItem(MAP_STORAGE_PREFIX+x.meta.key,JSON.stringify(x.document));return x});onRegisterMap(made.meta);next=made.meta}openMap(next.key)}
     render();notice('Mapa enviado a Papelera. Puedes recuperarlo desde esa pestaña.');
    });remove.id='city-confirm-trash';remove.classList.add('city-danger');host.append(remove)}
   }
   host.append(button('Volver a crear mapas',()=>{delete host.dataset.mapAction;createForm()}));host.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  createForm();paint();
 }
 function renderTrash(){
  $('city-context').append(el('h2','','Papelera'),el('p','','Los mapas eliminados conservan sus elementos y fotografías en este dispositivo. Restaurar recupera el mapa; después eliges a qué hermandad asignarlo.'));
  $('city-form').append(el('h3','','Recuperar también las asignaciones'),el('p','','En Proyecto puedes recuperar la versión guardada antes de eliminar el mapa. Esa acción restaura el proyecto completo de aquel momento.'));
  const grid=el('div','city-grid');for(const map of project.maps.filter(m=>m.trashed)){const card=el('article','city-map-card');card.dataset.mapKey=map.key;card.append(el('h3','',map.name),el('p','city-small','Eliminado: '+(map.trashedAt?new Date(map.trashedAt).toLocaleString('es-ES'):'Fecha no disponible')),button('Restaurar mapa',()=>{transaction(()=>restoreCityMap(project,map.key,getDoc));render();notice('Mapa recuperado en Mis mapas. Sus asignaciones se eligen desde Hermandades.');},true));grid.append(card)}$('city-results').append(grid.children.length?grid:el('p','city-empty','La papelera está vacía.'));
 }
 function renderHelp(){
  const main=$('city-results');$('city-context').append(el('h2','','De tu primera calle al juego'),el('p','','Construir, asignar y jugar son tres pasos distintos. El proyecto reúne todo tu trabajo.'));
  const guides=[
   ['1. Crea una calle','En Mis mapas pulsa Crear y abrir. Ponle el nombre de la calle y elige Calle reutilizable. Dibuja el suelo, los edificios y el mobiliario. Guardar conserva los cambios en este dispositivo.','Ir a Mis mapas','maps'],
   ['2. Prepara el recorrido','En el editor, Recorrido permite colocar la salida, los controles, los anuncios de calle y la Llegada. Revisa el suelo y las colisiones en Revisar y prueba con el paso real.','Abrir herramientas de recorrido','route'],
   ['3. Asigna a una hermandad','En Hermandades elige cuál, añade los mapas y ordénalos. El mismo mapa puede usarse en varias hermandades. Quitar de esta hermandad conserva el mapa y sus otros usos.','Abrir Hermandades','brotherhoods'],
   ['4. Aplica y juega','Elige un paso disponible y pulsa Aplicar al juego. Entra al juego → Semana Santa → hermandad. Si cambias el orden, las entradas o las asignaciones, vuelve a aplicar. La geometría compartida se edita en su mapa de origen.','Preparar itinerario jugable','brotherhoods'],
   ['5. Guarda una copia de todo','Proyecto → Exportar proyecto completo (.apulso) reúne mapas, texturas, plantillas y asignaciones. Marca incluir fotografías si también quieres tus referencias. El historial permite recuperar versiones anteriores.','Abrir copias e historial','project']
  ];
  for(const [title,text,label,target]of guides){const card=el('article','city-help-card');card.append(el('h3','',title),el('p','',text),button(label,()=>{if(target==='project'){modal.close();openProject()}else if(target==='route'){modal.close();document.getElementById('wb-mode-route')?.click()}else{tab=target;render()}}));main.append(card)}
  const terms=el('article','city-help-card');terms.append(el('h3','','Qué significa cada cosa'));
  for(const [title,text]of [['Mapa','El archivo de una calle o un conjunto de calles. Tiene su propio suelo y objetos.'],['Zona','Una parte delimitada de un mapa existente. Útil para usar solo un tramo.'],['Enlazar una calle','Coloca una referencia dentro del mapa abierto. Cambiar el origen actualiza sus usos.'],['Itinerario','La lista ordenada de mapas o zonas de una hermandad.'],['En preparación / Cambios pendientes / En el juego','Indican si las asignaciones están guardadas para editar o ya aplicadas al catálogo jugable.'],['Eliminar / Quitar de una hermandad','Eliminar envía el mapa a Papelera. Quitar solo retira ese uso de un itinerario.']]){terms.append(el('strong','',title),el('p','',text))}main.append(terms);
  $('city-form').append(el('h3','','Dónde se guarda'),el('p','','Guardar: en este navegador o en el programa de este ordenador. No sincroniza ambos automáticamente.'),el('p','','Exportar .apulso: copia completa para trasladar tu trabajo entre programa, navegador u otro ordenador.'),el('p','','Publicar: comparte los mapas y los itinerarios activos en el juego web. Las fotografías privadas quedan fuera.'),el('h3','','Dibujar con comodidad'),el('p','','PC: botón derecho y arrastrar para mover el plano. Deshacer o Retroceso elimina el último punto de una figura en construcción. Móvil: dos dedos para desplazar y pellizcar para ampliar.'),el('p','','Biblioteca muestra la imagen de cada pieza. Selecciona una pieza colocada para editar tamaño, giro, altura o colisión en Propiedades.'));
 }
 function openZoneForm(){
  tab='maps';render();const form=$('city-form');form.replaceChildren(el('h3','','Registrar una zona'));
  const selected=getSelection?.()||[],points=selected.flatMap(s=>{const o=getData()?.[s.type]?.[s.index];return o?.poly||o?.point&&[o.point]||o?.position&&[o.position]||s.type==='labels'&&[o[1]]||[]});
  const b=points.length>=2?polygonBounds(points):getView().bounds;
  const f=el('form','city-form'),name=addField(f,'Nombre del tramo o zona','name',''),streets=addField(f,'Calles (separadas por comas)','streets','');
  f.append(el('p','city-small',points.length>=2?'Área calculada a partir de tu selección.':'Área visible del editor. Acerca el plano al tramo que quieras registrar.'));
  const coords=[];for(const [i,label]of ['X mínima','Y mínima','X máxima','Y máxima'].entries()){const n=addField(f,label,'b'+i,+b[i].toFixed(3),'number');n.min='-100000';n.max='100000';n.step='.01';coords.push(n)}
  const start=getPreviewStart?.()||getData().startPose||getData().paso;
  const keepStart=el('label','city-check'),startCheck=el('input');startCheck.type='checkbox';startCheck.checked=!!start&&start.x>=b[0]&&start.x<=b[2]&&start.y>=b[1]&&start.y<=b[3];keepStart.append(startCheck,document.createTextNode('Usar la posición actual del paso como salida de esta zona'));f.append(keepStart);
  const submit=el('button','city-primary','Guardar zona compartida');submit.type='submit';f.append(submit);f.onsubmit=guard(event=>{event.preventDefault();transaction(()=>{
   const bounds=coords.map(n=>+n.value);if(startCheck.checked&&(!start||start.x<bounds[0]||start.x>bounds[2]||start.y<bounds[1]||start.y>bounds[3]))throw Error('Coloca el paso dentro de la zona antes de registrar su salida.');
   const zone=addCityZone(project,getMapKey(),name.value,bounds,streets.value.split(','));if(startCheck.checked)zone.startPose={...start};saveCanonical(getMapKey());
  });render();notice('Zona registrada. Ya puedes adjuntarla a una hermandad sin copiarla.');});form.append(f);
 }
 function renderStreets(){
  const input=contextInput('Escribe una calle: Arfe, Adriano, Sierpes…',paint);$('city-context').append(input);
  $('city-form').append(el('h3','','Reutilizar un tramo'),el('p','','Abre el mapa de origen para editarlo, adjunta el tramo a una hermandad o enlázalo al mapa abierto.'),el('p','city-small','Los nombres se buscan sin tildes y admiten nombres alternativos. Registrar una zona permite separar distintos tramos de la misma calle.'));
  function paint(query=''){
   const result=$('city-results');result.replaceChildren();
   const matches=searchCityStreets(project,query);
   // Explicit zone street names are searchable even without a label on canvas.
   for(const zone of project.zones.filter(z=>!z.whole&&!project.maps.find(m=>m.key===z.mapKey)?.trashed&&(!query||normalizeStreet(z.name+' '+z.streets.join(' ')).includes(normalizeStreet(query))))){
    const card=el('article','city-street-card');card.append(el('h3','',zone.name),el('p','city-small',zone.streets.join(' · ')+' · '+mapsName(zone.mapKey)),button('Abrir tramo',()=>{modal.close();openMap(zone.mapKey);focus((zone.bounds[0]+zone.bounds[2])/2,(zone.bounds[1]+zone.bounds[3])/2,24)}),button('Adjuntar a hermandad',()=>chooseZone(zone.id)),button('Enlazar al mapa abierto',()=>linkZone(zone.id)));result.append(card);
   }
   for(const street of matches){
    const card=el('article','city-street-card');card.append(el('h3','',street.name));
    for(const segment of street.segments||[]){const row=el('div','city-street-segment');row.append(el('p','city-small',mapsName(segment.mapKey)+(segment.barrio?' · '+segment.barrio:'')),button('Abrir calle',()=>{modal.close();openMap(segment.mapKey);focus(...segment.position,32)}),button('Usar mapa en hermandad',()=>chooseZone(segment.zoneId)),button('Enlazar mapa',()=>linkZone(segment.zoneId)));card.append(row)}
    const aliases=el('input');aliases.value=(street.aliases||[]).join(', ');aliases.placeholder='Nombres alternativos, separados por comas';aliases.setAttribute('aria-label','Nombres alternativos de '+street.name);card.append(aliases,button('Guardar nombres alternativos',()=>{transaction(()=>{project.streets.find(s=>s.id===street.id).aliases=aliases.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12)});notice('Nombres alternativos guardados.')}));result.append(card);
   }
   if(!result.children.length)result.append(el('p','city-empty','Esta calle todavía no está registrada. Busca también su barrio o añade un nombre de calle en el editor.'));
  }
  paint();
 }
 function chooseZone(zoneId){selectedZone=zoneId;tab='brotherhoods';render();notice('Elige la hermandad y pulsa «Añadir al recorrido».')}
 function renderBrotherhoods(){
  const context=$('city-context'),select=el('select','city-search');select.id='city-brotherhood';select.setAttribute('aria-label','Hermandad');
  for(const b of BROTHERHOODS){const o=el('option','',b.name);o.value=b.id;select.append(o)}
  select.value=modal.dataset.brotherhood||BROTHERHOODS.find(b=>/puente/i.test(b.name))?.id||BROTHERHOODS[0].id;context.append(el('h2','','2. Ordena los mapas de una hermandad'),el('p','','Añade los mapas guardados, ordénalos y aplica el recorrido al juego cuando esté preparado.'),el('label','','Hermandad'),select);
  const zoneSelect=el('select');zoneSelect.id='city-zone-choice';zoneSelect.setAttribute('aria-label','Mapa o zona para adjuntar');
  for(const z of project.zones.filter(z=>{const m=project.maps.find(m=>m.key===z.mapKey);return m&&!m.trashed&&(m.type==='user'||localStorage.getItem(MAP_STORAGE_PREFIX+m.key)||z.id===selectedZone||m.key===getMapKey())})){const o=el('option','',(z.whole?'Mapa · ':'Zona · ')+z.name+(z.whole?'':' — '+mapsName(z.mapKey)));o.value=z.id;zoneSelect.append(o)}
  zoneSelect.value=selectedZone||'map:'+getMapKey();if(!zoneSelect.value)zoneSelect.value=project.zones.find(z=>!project.maps.find(m=>m.key===z.mapKey)?.trashed)?.id||'';$('city-form').append(el('h3','','Añadir un tramo al recorrido'),zoneSelect,button('Añadir al recorrido',()=>{const r=transaction(()=>assignCityZone(project,select.value,zoneSelect.value));paint();notice(r.added?'Mapa o zona añadido. Ordénalo y pulsa Aplicar al juego cuando termines.':'La zona ya estaba en este itinerario; no se ha duplicado.');},true),el('p','city-small','La lista define el orden de juego. Se reutiliza el mapa guardado y no se copia. Puedes añadirlo también a otras hermandades.'),button('Exportar itinerario',()=>download('apulso-itinerario-'+select.value+'.json',{schema:'apulso-itinerary-v1',brotherhoodId:select.value,visits:(project.itineraries[select.value]||[]).map(v=>({...v,zone:project.zones.find(z=>z.id===v.zoneId)}))})));
  $('city-form').append(el('p','city-warning','Quitar de esta hermandad conserva el mapa. Eliminar un mapa se hace desde Mis mapas y lo envía a Papelera.'));select.onchange=()=>{modal.dataset.brotherhood=select.value;paint()};paint();
  function paint(){
   modal.dataset.brotherhood=select.value;const results=$('city-results');results.replaceChildren();const visits=project.itineraries[select.value]||[];
   results.append(el('h2','',brotherhoodName(select.value)),el('p','city-small',visits.length+' tramos en preparación. Editar la geometría de una calle compartida afecta a todos sus usos.'));
   mountBrotherhoodContent({host:results,brotherhoodId:select.value,getProject:()=>project,commit:transaction,onSaved:paint,notice,onPreview:step=>{modal.close();onPreviewStep(step);}});
   const active=project.campaignItineraries?.[select.value],steps=projectSteps(project).filter(s=>s.brotherhoodId===select.value&&s.implemented),settings=el('section','city-campaign-settings');
   const state=el('p','city-itinerary-state');state.id='city-itinerary-state';const stateLabels={empty:'Sin mapas asignados',draft:'En preparación · todavía sin aplicar al juego',pending:'Cambios pendientes · el juego conserva la última lista aplicada',live:'En el juego · asignaciones actualizadas'};const updateState=()=>{state.textContent=stateLabels[itineraryState(project,select.value)];state.dataset.state=itineraryState(project,select.value)};updateState();results.append(state);
   settings.append(el('h3','','3. Aplica el recorrido al juego'),el('p','city-small','Guardar y ordenar prepara la lista. Aplicar al juego actualiza Semana Santa; conserva los identificadores y los récords de cada tramo.'));
   const stepLabel=el('label','city-field'),stepSelect=el('select');stepSelect.id='city-campaign-step';stepSelect.setAttribute('aria-label','Paso del itinerario');for(const s of steps){const o=el('option','',s.name);o.value=s.id;stepSelect.append(o)}if(active)stepSelect.value=active.stepId;stepLabel.append(el('span','','Paso'),stepSelect);settings.append(stepLabel);
   if(!steps.length)settings.append(el('p','city-small','Esta hermandad todavía no tiene un paso disponible. Puedes preparar sus calles y su itinerario.'));
   const replace=el('label','city-check'),replaceCheck=el('input');replaceCheck.type='checkbox';replaceCheck.checked=active?.replace!==false;replace.append(replaceCheck,document.createTextNode('Sustituir los recorridos anteriores de esta hermandad (conservar sus datos)'));const advanced=el('details','city-advanced');advanced.append(el('summary','','Opciones del catálogo y publicación'),replace);
   const activate=button(active?'Aplicar cambios al juego':'Aplicar al juego',async()=>{
    if(saveLocal()===false)throw Error('No se ha podido guardar el mapa. Libera espacio antes de activar el itinerario.');for(const v of visits){const zone=project.zones.find(z=>z.id===v.zoneId);saveCanonical(zone.mapKey);}
    const candidate=structuredClone(project);activateCityItinerary(candidate,select.value,stepSelect.value,getDoc,{replace:replaceCheck.checked});
    await beforeActivation('Antes de activar '+brotherhoodName(select.value));transaction(()=>{project=candidate});paint();notice('Itinerario activado. Abre el juego → Semana Santa → '+brotherhoodName(select.value)+'.');
   },true);activate.id='city-activate-itinerary';activate.disabled=!steps.length||!visits.length;settings.append(activate);
   if(active){settings.append(button('Abrir el juego',()=>window.open('./index.html','_blank','noopener')),button('Retirar itinerario del juego',async()=>{await beforeActivation('Antes de retirar itinerario');transaction(()=>{delete project.campaignItineraries[select.value];project.disabledCampaignBrotherhoods=[...new Set([...(project.disabledCampaignBrotherhoods||[]),select.value])]});paint();notice('Itinerario retirado del juego. Los mapas y sus récords se conservan.');}));}
   const legacy=el('label','city-check'),legacyCheck=el('input');legacyCheck.type='checkbox';legacyCheck.checked=!!project.archiveLegacy;legacy.append(legacyCheck,document.createTextNode('En Semana Santa mostrar solo los itinerarios creados por mí'));legacyCheck.onchange=guard(async()=>{await beforeActivation('Antes de cambiar el catálogo jugable');transaction(()=>{project.archiveLegacy=legacyCheck.checked});notice('Catálogo actualizado. Los mapas anteriores se conservan como referencia y los guardados siguen disponibles.');});advanced.append(legacy);
   advanced.append(button('Publicar ciudad e itinerarios',()=>publishProject()),el('p','city-small','Guardar conserva el trabajo en este dispositivo. Exportar proyecto completo (.apulso) incluye calles, imágenes y asignaciones. Publicar distribuye los itinerarios activos; las fotos de referencia quedan fuera.'));
   settings.append(advanced);
   if(!visits.length)results.append(el('p','city-empty','Todavía no hay recorrido. Elige un mapa y pulsa Añadir al recorrido. En móvil, el formulario está debajo de esta lista.'));
   for(const [i,visit]of visits.entries()){
    const zone=project.zones.find(z=>z.id===visit.zoneId),card=el('article','city-visit');card.append(el('span','city-order',String(i+1)),el('h3','',zone.name),el('p','city-small',mapsName(zone.mapKey)+(zone.whole?' · mapa completo':' · zona')));
    const details=el('details','city-advanced');details.append(el('summary','','Entradas, llegada y opciones de este tramo'));
    const source=selectCityZone(project,zone.id,key=>resolveCityMap(project,key,getDoc)),events=source.gameplay?.route?.events||[];
    for(const [field,label,choices]of [['entryId','Entrada para esta hermandad',events.filter(e=>e.type==='entry')],['finishId','Llegada de este tramo',[...events.filter(e=>e.type!=='announcement'),...(source.checkpoints||[]).map((cp,i)=>({id:cp.id||'control-'+i,name:cp.name||'Control'}))]]]){
     const l=el('label','city-field'),s=el('select'),empty=el('option','',field==='entryId'?'Inicio guardado en el mapa':'Llegada / salida configurada en el mapa');empty.value='';s.append(empty);for(const e of choices){if([...s.children].some(o=>o.value===e.id))continue;const o=el('option','',e.name);o.value=e.id;s.append(o)}s.value=visit[field]||'';s.setAttribute('aria-label',label);s.onchange=guard(()=>{transaction(()=>{visit[field]=s.value});updateState()});l.append(el('span','',label),s);details.append(l);
    }
    const actions=el('div','city-actions');for(const [label,delta]of [['↑',-1],['↓',1]]){const b=button(label,()=>{transaction(()=>{const j=i+delta;if(j>=0&&j<visits.length)[visits[i],visits[j]]=[visits[j],visits[i]]});paint()});b.disabled=i+delta<0||i+delta>=visits.length;b.setAttribute('aria-label',delta<0?'Subir tramo':'Bajar tramo');actions.append(b)}
    actions.append(button('Editar mapa',()=>{modal.close();openMap(zone.mapKey)}),button('Probar zona',()=>{saveLocal();saveCanonical(zone.mapKey);window.open('./index.html?cityMap='+encodeURIComponent(zone.mapKey)+'&cityZone='+encodeURIComponent(zone.id)+'&cityBrotherhood='+encodeURIComponent(select.value),'_blank','noopener')}),button('Añadir otra pasada',()=>{transaction(()=>visits.splice(i+1,0,{...structuredClone(visit),id:newId('visit')}));paint();notice('Otra pasada añadida. Puedes elegir una entrada y llegada distintas sin copiar la calle.');}),button('Quitar de esta hermandad',async()=>{await beforeActivation('Antes de quitar un tramo de '+brotherhoodName(select.value));transaction(()=>visits.splice(i,1));paint();notice('Tramo quitado de esta lista. El mapa sigue en Mis mapas. Pulsa Aplicar al juego para actualizar el itinerario activo.');}));card.append(actions);
    const crowd=el('select');crowd.setAttribute('aria-label','Público de este tramo');for(const [v,label]of [['inherit','Público del mapa'],['none','Sin público en esta hermandad']]){const o=el('option','',label);o.value=v;crowd.append(o)}crowd.value=visit.crowd||'inherit';crowd.onchange=guard(()=>{transaction(()=>{visit.crowd=crowd.value});updateState()});details.append(crowd);
    const label=el('label','city-check'),required=el('input');required.type='checkbox';required.checked=!!visit.mandatory;required.onchange=guard(()=>{
     if(required.checked&&!selectCityZone(project,zone.id,getDoc).checkpoints.length){required.checked=false;throw Error('Añade un checkpoint dentro de esta zona para definir dónde debe hacerse la presentación.');}
     transaction(()=>{visit.mandatory=required.checked});updateState();
    });label.append(required,document.createTextNode('Presentación obligatoria en esta zona'));details.append(label);
    const name=el('input');name.placeholder='Nombre de la presentación o capilla';name.value=visit.presentation||'';name.setAttribute('aria-label','Nombre de presentación');name.onchange=guard(()=>{transaction(()=>{visit.presentation=name.value.slice(0,120)});updateState()});details.append(name);
    const note=el('input');note.placeholder='Notas del tramo';note.value=visit.note||'';note.setAttribute('aria-label','Notas del tramo');note.onchange=guard(()=>{transaction(()=>{visit.note=note.value.slice(0,300)});updateState()});details.append(note);card.append(details);results.append(card);
   }
   results.append(settings);
  }
 }
 function linkZone(zoneId){
  const zone=project.zones.find(z=>z.id===zoneId);if(!zone)throw Error('Zona inexistente.');
  if(zone.mapKey===getMapKey())throw Error('Esta zona ya forma parte del mapa abierto.');
  const doc=getData();if((doc.zoneRefs||[]).some(r=>r.zoneId===zoneId))throw Error('Esta zona ya está enlazada al mapa.');
  const source=selectCityZone(project,zoneId,getDoc),b=source.bounds||polygonBounds(source.roads.flatMap(o=>o.poly)),v=getView();
  const ref={zoneId,offset:[v.cx-(b[0]+b[2])/2,v.cy-(b[1]+b[3])/2],angle:0};
  const candidate={...doc,zoneRefs:[...(doc.zoneRefs||[]),ref]};resolveCityMap(project,getMapKey(),key=>key===getMapKey()?candidate:getDoc(key));
  saveCanonical(zone.mapKey);snapshot();doc.zoneRefs=candidate.zoneRefs;changed();modal.close();refreshLinks();notice('Zona enlazada. Ajusta su posición en «Zonas enlazadas»; la calle sigue siendo compartida.');
 }
 $('city-export-project').onclick=guard(()=>{saveLocal();ensureIndex();persist();download('apulso-ciudad-'+new Date().toISOString().slice(0,10)+'.json',exportCityBundle(project,getDoc));notice('Copia completa exportada.');});
 $('city-import-project').onchange=guard(async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>65000000)throw Error('La copia supera el tamaño permitido.');
  const bundle=validateCityBundle(JSON.parse(await file.text()));
  if(!confirm('¿Restaurar esta ciudad? Los mapas con el mismo identificador se actualizarán. Exporta antes tu ciudad si quieres conservar la versión actual.'))return;
  const before=new Map();try{
   for(const doc of Object.values(bundle.documents))await loadDocumentAssets(doc,{persist:true});
   for(const [key,doc]of Object.entries(bundle.documents)){const k=MAP_STORAGE_PREFIX+key;before.set(k,localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(lightweightDocument(doc)))}
   before.set(CITY_KEY,localStorage.getItem(CITY_KEY));localStorage.setItem(CITY_KEY,JSON.stringify(bundle.project));
  }catch(error){for(const [key,value]of [...before].reverse())value===null?localStorage.removeItem(key):localStorage.setItem(key,value);throw Error('No se ha restaurado la ciudad. Falta espacio; tus datos anteriores se han conservado.');}
  project=bundle.project;onCatalogChange(project.maps);for(const map of project.maps)if(!catalog.some(m=>m.key===map.key))onRegisterMap(map);
  modal.close();openMap(project.maps.find(m=>!m.trashed)?.key);notice('Ciudad restaurada con sus mapas, zonas e itinerarios.');
 });
 const linksPanel=el('details');linksPanel.id='city-links-panel';linksPanel.innerHTML='<summary>Zonas enlazadas <span>↗</span></summary><div id="city-linked-list"></div>';
 document.querySelector('.sidebar').prepend(linksPanel);
 const checkpointPanel=el('details');checkpointPanel.id='city-checkpoint-panel';checkpointPanel.innerHTML='<summary>Checkpoint seleccionado <span>✚</span></summary><div><p id="city-cp-help" class="city-small">Selecciona un checkpoint del plano para editarlo.</p><fieldset id="city-cp-fields" class="reference-controls" disabled><label>Nombre<input id="city-cp-name" type="text" maxlength="100"></label><label class="city-check"><input id="city-cp-mandatory" type="checkbox"> Presentación: exige arriar</label><label class="city-check"><input id="city-cp-finish" type="checkbox"> Llegada del mapa: exige arriar</label><button type="button" id="city-cp-save">Aplicar al checkpoint</button></fieldset></div>';
 document.querySelector('.sidebar').prepend(checkpointPanel);
 function refreshSelected(){
  const selected=(getSelection?.()||[]).filter(s=>s.type==='checkpoints'),cp=selected.length===1?getData()?.checkpoints[selected[0].index]:null;
  $('city-cp-fields').disabled=!cp;if(cp){$('city-cp-name').value=cp.name||cp.id;$('city-cp-mandatory').checked=!!cp.mandatory;$('city-cp-finish').checked=!!cp.finish}
 }
 $('city-cp-save').onclick=guard(()=>{const selected=(getSelection?.()||[]).find(s=>s.type==='checkpoints'),cp=selected&&getData()?.checkpoints[selected.index];if(!cp||!canEdit([selected]))return;snapshot();cp.name=$('city-cp-name').value.trim()||cp.id;cp.mandatory=$('city-cp-mandatory').checked;cp.finish=$('city-cp-finish').checked;changed();notice('Checkpoint actualizado. Las presentaciones y llegadas de los mapas propios exigen arriar.');});
 function refreshLinks(){
  const list=$('city-linked-list');list.replaceChildren();const refs=getData()?.zoneRefs||[];
  if(!refs.length)list.append(el('p','city-small','Busca una calle en Ciudad y enlázala aquí. Se editará siempre en su mapa de origen.'));
  for(const [i,ref]of refs.entries()){
   const z=project.zones.find(z=>z.id===ref.zoneId);if(!z)continue;
   const row=el('div','city-linked-item');row.append(el('strong','',z.name));const form=el('form','city-two');
   const x=addField(form,'X','x',+ref.offset[0].toFixed(3),'number'),y=addField(form,'Y','y',+ref.offset[1].toFixed(3),'number'),angle=addField(form,'Giro (°)','angle',ref.angle||0,'number');for(const n of [x,y,angle]){n.min='-100000';n.max='100000';n.step='.01'}
   const apply=el('button','','Ajustar');apply.type='submit';form.append(apply);form.onsubmit=guard(e=>{e.preventDefault();snapshot();ref.offset=[+x.value,+y.value];ref.angle=+angle.value;changed()});
   row.append(form,button('Editar origen',()=>openMap(z.mapKey)),button('Quitar vínculo',()=>{snapshot();getData().zoneRefs.splice(i,1);changed();refreshLinks()}));list.append(row);
  }
 }
 return{open:guard(open),zoneForm:guard(()=>{open('maps');openZoneForm()}),
  playable(){if(saveLocal()===false)throw Error('No se ha podido guardar el proyecto.');return makePlayableCity(project,getDoc)},
  refreshSelected,
  refresh(){const doc=getData();if(doc){indexMapStreets(project,doc);refreshLinks();refreshSelected();const ids=affectedBrotherhoods(project,getMapKey());const node=$('city-impact');if(node)node.textContent=ids.length?'Calle compartida: '+ids.map(brotherhoodName).join(' · '):'Diseño de ciudad · sin hermandades vinculadas'}},
  saveIndex(){if(!project.maps.find(m=>m.key===getMapKey())?.trashed)indexMapStreets(project,getData());persist()},
  project:()=>project,
  resolve:()=>resolveCityMap(project,getMapKey(),getDoc),
  linkedScene(){const doc=getData(),resolved=resolveCityMap(project,getMapKey(),getDoc);return{...resolved,...Object.fromEntries(KINDS.map(k=>[k,(resolved[k]||[]).slice((doc[k]||[]).length)]))}},
 };
}
