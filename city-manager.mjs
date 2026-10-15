import {BROTHERHOODS} from './content-catalogue.mjs';
import {CITY_KEY,CITY_SCHEMA,MAP_STORAGE_PREFIX,KINDS,readCityProject,persistCityProject,addCityMap,addCityZone,indexMapStreets,searchCityStreets,assignCityZone,affectedBrotherhoods,selectCityZone,resolveCityMap,transformMapDocument,polygonBounds,exportCityBundle,validateCityBundle,validateMapDocument,normalizeStreet} from './city-project.mjs';
import {paintCityScene} from './city-scene.mjs';
import {lightweightDocument,loadDocumentAssets} from './custom-assets.mjs';

const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n};
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
export function setupCityManager({catalog,getData,getBaseline,getMapKey,getDocument,openMap,onRegisterMap,onNewDocument,snapshot,changed,saveLocal,show,focus,getSelection,getView,getImage,getPreviewStart,canEdit=()=>true}){
 let project=readCityProject(localStorage,catalog),tab='maps',selectedZone=null,searchTimer;
 for(const map of project.maps)if(!catalog.some(m=>m.key===map.key))onRegisterMap(map);
 const persist=()=>persistCityProject(localStorage,project);
 const transaction=fn=>{const before=structuredClone(project);try{const value=fn();persist();return value}catch(error){project=before;throw error}};
 const modal=el('dialog','city-dialog');modal.id='city-dialog';modal.setAttribute('aria-labelledby','city-title');
 modal.innerHTML=`<header class="city-head"><div><span class="city-eyebrow">A PULSO · TALLER 2.0</span><h1 id="city-title">Construir Sevilla, calle a calle.</h1><p id="city-summary"></p></div><button type="button" id="city-close" aria-label="Cerrar biblioteca">Cerrar ×</button></header>
 <nav class="city-tabs" aria-label="Biblioteca de ciudad"><button data-city-tab="maps">Mapas y zonas</button><button data-city-tab="streets">Buscar calles</button><button data-city-tab="brotherhoods">Hermandades</button></nav>
 <div class="city-content"><section class="city-main"><div id="city-context"></div><div id="city-results"></div></section><aside class="city-aside"><h2>Tu ciudad compartida</h2><p>Un mapa puede servir a varias hermandades. Sus calles se mantienen en un único lugar.</p><div id="city-form"></div><hr><button id="city-export-project">Exportar ciudad completa</button><label class="city-file">Restaurar ciudad<input id="city-import-project" type="file" accept="application/json,.json"></label><p class="city-small">Incluye mapas, zonas e itinerarios. Las fotografías guía se conservan aparte.</p><p id="city-notice" role="status"></p></aside></div>`;
 document.body.append(modal);
 const $=id=>document.getElementById(id),notice=(message,error=false)=>{const n=$('city-notice');n.textContent=message;n.dataset.error=String(error);show(message,error?'error':'good')};
 const guard=fn=>async(...args)=>{try{await fn(...args)}catch(error){notice(error.message||String(error),true)}};
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
 const ensureIndex=()=>{for(const m of project.maps)indexMapStreets(project,getDoc(m.key))};
 const open=(which=tab)=>{saveLocal();ensureIndex();persist();tab=which;render();if(!modal.open)modal.showModal()};
 $('city-close').onclick=()=>modal.close();
 modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close()}});
 for(const b of modal.querySelectorAll('[data-city-tab]'))b.onclick=()=>{tab=b.dataset.cityTab;render()};
 function contextInput(placeholder,onInput){const i=el('input','city-search');i.type='search';i.placeholder=placeholder;i.setAttribute('aria-label',placeholder);i.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>onInput(i.value),120)};return i}
 function addField(form,title,name,value,type='text'){const label=el('label','city-field'),input=el('input');label.append(el('span','',title));input.name=name;input.type=type;input.value=value;if(type==='number'){input.min='8';input.max='2000'}label.append(input);form.append(label);return input}
 function render(){
  $('city-summary').textContent=project.maps.length+' mapas · '+project.zones.filter(z=>!z.whole).length+' zonas · '+project.streets.length+' calles · '+Object.values(project.itineraries).filter(v=>v.length).length+' itinerarios';
  for(const b of modal.querySelectorAll('[data-city-tab]')){const active=b.dataset.cityTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
  $('city-context').replaceChildren();$('city-results').replaceChildren();$('city-form').replaceChildren();
  if(tab==='maps')renderMaps();else if(tab==='streets')renderStreets();else renderBrotherhoods();
 }
 function thumbnail(map,canvas){
  try{const doc=getDoc(map.key),c=canvas.getContext('2d'),b=doc.bounds||polygonBounds((doc.roads||[]).flatMap(o=>o.poly));if(!b.every(Number.isFinite))return;
   const z=Math.min((canvas.width-18)/Math.max(1,b[2]-b[0]),(canvas.height-18)/Math.max(1,b[3]-b[1]));
   const px=(x,y)=>[canvas.width/2+(x-(b[0]+b[2])/2)*z,canvas.height/2-(y-(b[1]+b[3])/2)*z];
   c.fillStyle='#777b70';c.fillRect(0,0,canvas.width,canvas.height);paintCityScene(c,doc,px,z,getImage,b,{crowd:false});
  }catch{const c=canvas.getContext('2d');c.fillStyle='#817566';c.fillRect(0,0,canvas.width,canvas.height)}
 }
 function renderMaps(){
  const input=contextInput('Buscar mapa, zona o barrio…',paint);$('city-context').append(input);
  const form=el('form','city-form');form.append(el('h3','','Añadir mapa'));
  addField(form,'Nombre','name','');addField(form,'Barrio','barrio','');const row=el('div','city-two');form.append(row);addField(row,'Ancho (m)','width',40,'number');addField(row,'Fondo (m)','height',40,'number');
  const submit=el('button','city-primary','Crear mapa vacío');submit.type='submit';form.append(submit);form.onsubmit=guard(event=>{
   event.preventDefault();const values=new FormData(form),newMap=transaction(()=>{
    const result=addCityMap(project,{name:values.get('name'),barrio:values.get('barrio'),width:+values.get('width'),height:+values.get('height')});localStorage.setItem(MAP_STORAGE_PREFIX+result.meta.key,JSON.stringify(result.document));return result});
   onRegisterMap(newMap.meta);modal.close();onNewDocument(newMap.meta.key,newMap.document);notice('Mapa creado. Dibuja sus calles o enlaza una zona existente.');
  });
  const importLabel=el('label','city-file','Añadir mapa desde JSON'),importFile=el('input');importFile.type='file';importFile.accept='.json,application/json';importLabel.append(importFile);
  importFile.onchange=guard(async()=>{const f=importFile.files?.[0];if(!f)return;if(f.size>24000000)throw Error('El archivo es demasiado grande.');const doc=JSON.parse(await f.text());validateMapDocument(doc);
   const existing=project.maps.find(m=>m.key===doc.metadata.mapKey);
   if(existing){notice('Ese mapa ya existe: abierto para que puedas importar sus cambios desde el editor.');modal.close();openMap(existing.key);return}
   await loadDocumentAssets(doc,{persist:true});
   const result=transaction(()=>{const x=addCityMap(project,{name:doc.metadata.map||f.name.replace(/\.json$/,''),barrio:doc.metadata.barrio},doc);localStorage.setItem(MAP_STORAGE_PREFIX+x.meta.key,JSON.stringify(lightweightDocument(x.document)));return x});onRegisterMap(result.meta);modal.close();onNewDocument(result.meta.key,result.document);
  });
  $('city-form').append(form,importLabel,button('Registrar zona del mapa abierto',()=>openZoneForm()));
  function paint(query=''){
   const results=$('city-results');results.replaceChildren();const q=normalizeStreet(query),grid=el('div','city-grid');
   for(const map of project.maps.filter(m=>!q||normalizeStreet(m.name+' '+(m.barrio||'')+' '+project.zones.filter(z=>z.mapKey===m.key).map(z=>z.name).join(' ')).includes(q))){
    const card=el('article','city-map-card'),canvas=el('canvas');canvas.width=320;canvas.height=150;canvas.setAttribute('aria-label','Plano de '+map.name);card.append(canvas,el('h3','',map.name),el('p','city-small',(map.barrio||'Sevilla')+' · '+(map.type==='user'?'Mapa propio':'Mapa existente')));
    const impacts=affectedBrotherhoods(project,map.key);if(impacts.length)card.append(el('p','city-used','Compartido por '+impacts.length+' hermandad'+(impacts.length===1?'':'es')));
    card.append(button('Abrir editor',()=>{modal.close();openMap(map.key)},true),button('Adjuntar a hermandad',()=>chooseZone('map:'+map.key)));
    for(const zone of project.zones.filter(z=>z.mapKey===map.key&&!z.whole)){const r=el('div','city-zone-row');r.append(el('span','',zone.name),button('Adjuntar',()=>chooseZone(zone.id)),button('Ver',()=>{modal.close();openMap(map.key);focus((zone.bounds[0]+zone.bounds[2])/2,(zone.bounds[1]+zone.bounds[3])/2,Math.min(70,Math.max(8,450/Math.max(zone.bounds[2]-zone.bounds[0],zone.bounds[3]-zone.bounds[1]))))}));card.append(r)}
    grid.append(card);requestAnimationFrame(()=>thumbnail(map,canvas));
   }
   if(!grid.children.length)results.append(el('p','city-empty','No hay mapas con ese nombre. Puedes crear uno en el panel lateral.'));else results.append(grid);
  }
  paint();
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
   for(const zone of project.zones.filter(z=>!z.whole&&(!query||normalizeStreet(z.name+' '+z.streets.join(' ')).includes(normalizeStreet(query))))){
    const card=el('article','city-street-card');card.append(el('h3','',zone.name),el('p','city-small',zone.streets.join(' · ')+' · '+mapsName(zone.mapKey)),button('Abrir tramo',()=>{modal.close();openMap(zone.mapKey);focus((zone.bounds[0]+zone.bounds[2])/2,(zone.bounds[1]+zone.bounds[3])/2,24)}),button('Adjuntar a hermandad',()=>chooseZone(zone.id)),button('Enlazar al mapa abierto',()=>linkZone(zone.id)));result.append(card);
   }
   for(const street of matches){
    const card=el('article','city-street-card');card.append(el('h3','',street.name));
    for(const segment of street.segments||[]){const row=el('div','city-street-segment');row.append(el('p','city-small',mapsName(segment.mapKey)+(segment.barrio?' · '+segment.barrio:'')),button('Abrir calle',()=>{modal.close();openMap(segment.mapKey);focus(...segment.position,32)}),button('Usar mapa en hermandad',()=>chooseZone(segment.zoneId)),button('Enlazar mapa',()=>linkZone(segment.zoneId)));card.append(row)}
    const aliases=el('input');aliases.value=(street.aliases||[]).join(', ');aliases.placeholder='Nombres alternativos, separados por comas';aliases.setAttribute('aria-label','Nombres alternativos de '+street.name);card.append(aliases,button('Guardar nombres alternativos',()=>{transaction(()=>{street.aliases=aliases.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12)});notice('Nombres alternativos guardados.')}));result.append(card);
   }
   if(!result.children.length)result.append(el('p','city-empty','Esta calle todavía no está registrada. Busca también su barrio o añade un nombre de calle en el editor.'));
  }
  paint();
 }
 function chooseZone(zoneId){selectedZone=zoneId;tab='brotherhoods';render();notice('Elige la hermandad y pulsa «Añadir zona al itinerario».')}
 function renderBrotherhoods(){
  const context=$('city-context'),select=el('select','city-search');select.id='city-brotherhood';select.setAttribute('aria-label','Hermandad');
  for(const b of BROTHERHOODS){const o=el('option','',b.name);o.value=b.id;select.append(o)}
  select.value=modal.dataset.brotherhood||BROTHERHOODS.find(b=>/puente/i.test(b.name))?.id||BROTHERHOODS[0].id;context.append(select);
  const zoneSelect=el('select');zoneSelect.id='city-zone-choice';zoneSelect.setAttribute('aria-label','Mapa o zona para adjuntar');
  for(const z of project.zones){const o=el('option','',(z.whole?'Mapa · ':'Zona · ')+z.name+(z.whole?'':' — '+mapsName(z.mapKey)));o.value=z.id;zoneSelect.append(o)}
  zoneSelect.value=selectedZone||'map:'+getMapKey();$('city-form').append(el('h3','','Adjuntar mapa o zona'),zoneSelect,button('Añadir zona al itinerario',()=>{const r=transaction(()=>assignCityZone(project,select.value,zoneSelect.value));paint();notice(r.added?'Zona añadida por referencia.':'La zona ya estaba en este itinerario; no se ha duplicado.');},true),el('p','city-small','La ordenación define la secuencia. Los enlaces físicos entre mapas se preparan en el editor; no se crean calles automáticamente.'),button('Exportar itinerario',()=>download('apulso-itinerario-'+select.value+'.json',{schema:'apulso-itinerary-v1',brotherhoodId:select.value,visits:(project.itineraries[select.value]||[]).map(v=>({...v,zone:project.zones.find(z=>z.id===v.zoneId)}))})));
  select.onchange=()=>{modal.dataset.brotherhood=select.value;paint()};paint();
  function paint(){
   modal.dataset.brotherhood=select.value;const results=$('city-results');results.replaceChildren();const visits=project.itineraries[select.value]||[];
   results.append(el('h2','',brotherhoodName(select.value)),el('p','city-small',visits.length+' tramos en orden. Editar una calle compartida actualiza todos los itinerarios que la utilizan.'));
   if(!visits.length)results.append(el('p','city-empty','Todavía no hay recorrido. Adjunta un mapa o una zona desde el panel lateral.'));
   for(const [i,visit]of visits.entries()){
    const zone=project.zones.find(z=>z.id===visit.zoneId),card=el('article','city-visit');card.append(el('span','city-order',String(i+1)),el('h3','',zone.name),el('p','city-small',mapsName(zone.mapKey)+(zone.whole?' · mapa completo':' · zona')));
    const actions=el('div','city-actions');for(const [label,delta]of [['↑',-1],['↓',1]]){const b=button(label,()=>{transaction(()=>{const j=i+delta;if(j>=0&&j<visits.length)[visits[i],visits[j]]=[visits[j],visits[i]]});paint()});b.disabled=i+delta<0||i+delta>=visits.length;b.setAttribute('aria-label',delta<0?'Subir tramo':'Bajar tramo');actions.append(b)}
    actions.append(button('Editar origen',()=>{modal.close();openMap(zone.mapKey)}),button('Probar zona',()=>{saveLocal();saveCanonical(zone.mapKey);window.open('./index.html?cityMap='+encodeURIComponent(zone.mapKey)+'&cityZone='+encodeURIComponent(zone.id)+'&cityBrotherhood='+encodeURIComponent(select.value),'_blank','noopener')}),button('Desvincular',()=>{transaction(()=>visits.splice(i,1));paint()}));card.append(actions);
    const crowd=el('select');crowd.setAttribute('aria-label','Público de este tramo');for(const [v,label]of [['inherit','Público del mapa'],['none','Sin público en esta hermandad']]){const o=el('option','',label);o.value=v;crowd.append(o)}crowd.value=visit.crowd||'inherit';crowd.onchange=guard(()=>transaction(()=>{visit.crowd=crowd.value}));card.append(crowd);
    const label=el('label','city-check'),required=el('input');required.type='checkbox';required.checked=!!visit.mandatory;required.onchange=guard(()=>{
     if(required.checked&&!selectCityZone(project,zone.id,getDoc).checkpoints.length){required.checked=false;throw Error('Añade un checkpoint dentro de esta zona para definir dónde debe hacerse la presentación.');}
     transaction(()=>{visit.mandatory=required.checked});
    });label.append(required,document.createTextNode('Presentación obligatoria en esta zona'));card.append(label);
    const name=el('input');name.placeholder='Nombre de la presentación o capilla';name.value=visit.presentation||'';name.setAttribute('aria-label','Nombre de presentación');name.onchange=guard(()=>transaction(()=>{visit.presentation=name.value.slice(0,120)}));card.append(name);
    const note=el('input');note.placeholder='Notas del tramo';note.value=visit.note||'';note.setAttribute('aria-label','Notas del tramo');note.onchange=guard(()=>transaction(()=>{visit.note=note.value.slice(0,300)}));card.append(note);results.append(card);
   }
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
  project=bundle.project;for(const map of project.maps)if(!catalog.some(m=>m.key===map.key))onRegisterMap(map);
  modal.close();openMap(project.maps[0].key);notice('Ciudad restaurada con sus mapas, zonas e itinerarios.');
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
  refreshSelected,
  refresh(){const doc=getData();if(doc){indexMapStreets(project,doc);refreshLinks();refreshSelected();const ids=affectedBrotherhoods(project,getMapKey());const node=$('city-impact');if(node)node.textContent=ids.length?'Calle compartida: '+ids.map(brotherhoodName).join(' · '):'Diseño de ciudad · sin hermandades vinculadas'}},
  saveIndex(){indexMapStreets(project,getData());persist()},
  project:()=>project,
  resolve:()=>resolveCityMap(project,getMapKey(),getDoc),
  linkedScene(){const doc=getData(),resolved=resolveCityMap(project,getMapKey(),getDoc);return{...resolved,...Object.fromEntries(KINDS.map(k=>[k,(resolved[k]||[]).slice((doc[k]||[]).length)]))}},
 };
}
