import {gameplayOf,defaultGameplay,validateGameplay,EVENT_TYPES,COLLISION_TYPES,newRouteEvent,newId} from './map-gameplay.mjs';
import {inSurface,validSurface,traceSurface} from './map-geometry.mjs';
import {obstaclesFor} from './game-editor-bridge.mjs';
import {selectionLocked} from './editor-item-state.mjs';
export function setupGameplayEditor({state,getData,getDocument,catalog,snapshot,changed,show,requestDraw,configureTool,pixel,getZoom,focus}){
 const collision=document.createElement('details');collision.id='collision-panel';collision.open=true;
 collision.innerHTML=`<summary>Colisiones · suelo y obstáculos</summary><div class="stack">
 <label class="flag"><input id="collision-visible" type="checkbox"> Ver colisiones sobre el plano</label>
 <p class="muted">Verde: suelo transitable. Rojo: obstáculos. Azul: límites. Estas guías no aparecen en la partida.</p>
 <label>Física del mapa<select id="collision-mode"><option value="inherit">Conservar física original y añadir restricciones</option><option value="replace">Usar suelo y obstáculos del editor</option></select></label>
 <p class="muted">Para ampliar suelo o desactivar obstáculos originales, usa la física del editor. Se comprueban todas las partes del paso, incluidas las maniguetas. Un contorno de suelo sin textura solo modifica la física.</p>
 <div class="actions"><button id="collision-draw" type="button">Dibujar zona</button><button id="collision-pick" type="button">Elegir / mover zona</button></div>
 <label>Zonas<select id="collision-list" size="4" aria-label="Zonas de colisión"></select></label>
 <label>Nombre<input id="collision-name" maxlength="150"></label>
 <label>Tipo<select id="collision-kind">${Object.entries(COLLISION_TYPES).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label>
 <label class="flag"><input id="collision-enabled" type="checkbox" checked> Zona activa</label>
 <div class="actions"><button id="collision-save" type="button">Aplicar zona</button><button id="collision-delete" type="button">Eliminar zona</button></div>
 <label>Vértice<select id="collision-vertex" aria-label="Vértice de la zona"></select></label>
 <div class="precision-two"><label>X (m)<input id="collision-x" type="number" step=".01"></label><label>Y (m)<input id="collision-y" type="number" step=".01"></label></div>
 <div class="actions"><button id="collision-vertex-save" type="button">Aplicar punto</button><button id="collision-vertex-add" type="button">Insertar después</button><button id="collision-vertex-delete" type="button">Quitar punto</button></div>
 <p class="muted">En Elegir zona, arrastra un vértice para afinarlo o el interior para mover el contorno. Cierra una zona con Enter o Cerrar polígono.</p>
 <strong>Objetos seleccionados en el plano</strong><div class="actions"><button id="collision-object-on" type="button">Hacer sólidos</button><button id="collision-object-off" type="button">Hacer transitables</button></div>
 <p class="muted">Para cambiar objetos, selecciónalos con Elegir. El cambio activa la física del editor y respeta los elementos bloqueados.</p>
 <div class="precision-two"><label>Límite X mínimo<input id="collision-minx" type="number" step=".1"></label><label>Y mínimo<input id="collision-miny" type="number" step=".1"></label><label>X máximo<input id="collision-maxx" type="number" step=".1"></label><label>Y máximo<input id="collision-maxy" type="number" step=".1"></label></div>
 <button id="collision-bounds" type="button">Usar rectángulo como límite</button>
 </div>`;
 const route=document.createElement('details');route.id='route-config-panel';route.open=true;
 route.innerHTML=`<summary>Recorrido · entradas, eventos y llegada</summary><div class="stack">
 <label class="flag"><input id="route-enabled" type="checkbox"> Usar los acontecimientos de este editor</label>
 <p class="muted">Al activarlo, esta lista sustituye los controles y la llegada originales del mapa. Los nombres de calle siguen usando también sus puntos invisibles editables.</p>
 <label class="flag"><input id="route-ordered" type="checkbox" checked> Controles y presentaciones en el orden de la lista</label>
 <div class="precision-two"><label>★★★ máximo (segundos)<input id="route-three" type="number" min="1" max="86400"></label><label>★★ máximo (segundos)<input id="route-two" type="number" min="1" max="86400"></label></div>
 <button id="route-settings" type="button">Aplicar reglas y tiempos</button>
 <div class="actions"><button id="route-from-controls" type="button">Importar controles del mapa</button><button id="route-place" type="button">Colocar acontecimiento</button><button id="route-pick" type="button">Elegir / mover punto</button></div>
 <label>Acontecimientos<select id="route-events" size="5" aria-label="Acontecimientos del recorrido"></select></label>
 <div class="actions"><button id="route-up" type="button">↑ Antes</button><button id="route-down" type="button">↓ Después</button><button id="route-delete" type="button">Eliminar</button></div>
 <label>Tipo<select id="route-type">${Object.entries(EVENT_TYPES).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></label>
 <label>Nombre o texto del cartel<input id="route-name" maxlength="150"></label>
 <div class="precision-two"><label>X (m)<input id="route-x" type="number" step=".01"></label><label>Y (m)<input id="route-y" type="number" step=".01"></label><label>Radio (m)<input id="route-radius" type="number" min=".2" max="10" step=".1" value=".8"></label><label>Parada (segundos)<input id="route-hold" type="number" min="0" max="120" step=".1" value="0"></label></div>
 <label class="flag"><input id="route-mandatory" type="checkbox" checked> Obligatorio antes de la salida o llegada</label>
 <label class="flag"><input id="route-lowered" type="checkbox"> Exigir arriar</label>
 <div class="precision-two"><label>Orientación exigida (°; vacío = libre)<input id="route-heading" type="number" step=".1"></label><label>Tolerancia (°)<input id="route-tolerance" type="number" min="0" max="180" value="20"></label></div>
 <label>Mapa de destino (para salidas)<select id="route-target"></select></label>
 <label>Entrada de destino<select id="route-entry"><option value="">Inicio del mapa</option></select></label>
 <button id="route-save-event" type="button">Aplicar acontecimiento</button>
 <p id="route-validation" class="notice" role="status"></p>
 <button id="route-check" type="button">Comprobar recorrido y conexiones</button>
 <p class="muted">Las entradas son puntos de aparición. Las salidas conservan el paso elegido y llevan al mapa y entrada indicados. Guarda los mapas de destino antes de probar las conexiones. Cada mapa tiene sus tiempos de estrellas.</p>
 </div>`;
 const sidebar=document.querySelector('.sidebar');sidebar.prepend(route);sidebar.prepend(collision);
 const toolbar=document.querySelector('.toolbar');for(const [tool,label]of [['collision-select','Colisiones'],['route-select','Recorrido']]){const b=document.createElement('button');b.type='button';b.dataset.tool=tool;b.textContent=label;b.addEventListener('click',()=>{configureTool(tool);(tool==='collision-select'?collision:route).open=true;$('collision-visible').checked=true;requestDraw()});toolbar.append(b)}
 const $=id=>document.getElementById(id);let selectedZone=null,selectedEvent=null,drag=null,obstacles=null,docKey=null;
 const doc=()=>getData(),cfg=()=>gameplayOf(doc()),zone=()=>cfg().collision.zones.find(z=>z.id===selectedZone),event=()=>cfg().route.events.find(e=>e.id===selectedEvent);
 const guarded=fn=>()=>{try{fn()}catch(e){show(e.message,'error')}};
 function commit(fn,message='Configuración actualizada.'){
  const staged=structuredClone(doc());staged.gameplay=gameplayOf(staged);fn(staged.gameplay,staged);validateGameplay(staged.gameplay);snapshot();Object.assign(doc(),staged);obstacles=null;changed();refresh();show(message,'good');
 }
 const opt=(value,name)=>{const o=document.createElement('option');o.value=value;o.textContent=name;return o};
 function refresh(){
  if(!doc())return;if(docKey!==doc().metadata.mapKey){selectedZone=null;selectedEvent=null;docKey=doc().metadata.mapKey;drag=null}obstacles=null;
  const g=cfg();$('collision-mode').value=g.collision.mode;
  $('collision-list').replaceChildren(...g.collision.zones.map(z=>opt(z.id,(z.enabled?'':'○ ')+z.name+' · '+COLLISION_TYPES[z.kind])));$('collision-list').value=selectedZone||'';
  const z=zone();$('collision-name').value=z?.name||'Nueva zona';$('collision-kind').value=z?.kind||'blocked';$('collision-enabled').checked=z?.enabled!==false;
  $('collision-vertex').replaceChildren(...(z?.poly||[]).map((_,i)=>opt(String(i),'Punto '+(i+1))));updateVertex();
  const b=doc().bounds||[0,0,40,40];['minx','miny','maxx','maxy'].forEach((k,i)=>$('collision-'+k).value=b[i]);
  $('route-enabled').checked=g.route.enabled;$('route-ordered').checked=g.route.ordered;$('route-three').value=g.route.threeStars;$('route-two').value=g.route.twoStars;
  $('route-events').replaceChildren(...g.route.events.map((e,i)=>opt(e.id,(i+1)+'. '+EVENT_TYPES[e.type]+' · '+e.name)));$('route-events').value=selectedEvent||'';
  $('route-target').replaceChildren(opt('','Seleccionar mapa'),...catalog.map(m=>opt(m.key,m.name)));
  fillEvent();$('route-validation').textContent=g.route.enabled?g.route.events.some(e=>e.type==='finish'||e.type==='exit')?'Recorrido personalizado activo.':'Añade una llegada o una salida para poder terminar el recorrido.':'Se conserva el recorrido original.';
 }
 function updateVertex(){const p=zone()?.poly[Number($('collision-vertex').value)];$('collision-x').value=p?.[0]??'';$('collision-y').value=p?.[1]??''}
 function entries(){const target=$('route-target').value;let d;try{d=target&&getDocument(target)}catch{}$('route-entry').replaceChildren(opt('','Inicio del mapa'),...(d?.gameplay?.route?.events||[]).filter(e=>e.type==='entry').map(e=>opt(e.id,e.name)))}
 function fillEvent(){const e=event()||newRouteEvent('checkpoint',[0,0]);$('route-type').value=e.type;$('route-name').value=e.name;$('route-x').value=e.position[0];$('route-y').value=e.position[1];$('route-radius').value=e.radius;$('route-hold').value=e.hold;$('route-mandatory').checked=e.mandatory;$('route-lowered').checked=e.lowered;$('route-heading').value=e.heading??'';$('route-tolerance').value=e.tolerance;$('route-target').value=e.targetMap;entries();$('route-entry').value=e.targetEntry;}
 function readEvent(base){return{...base,type:$('route-type').value,name:$('route-name').value.trim()||EVENT_TYPES[$('route-type').value],position:[+$('route-x').value,+$('route-y').value],radius:+$('route-radius').value,hold:+$('route-hold').value,mandatory:$('route-mandatory').checked,lowered:$('route-lowered').checked,heading:$('route-heading').value.trim()===''?null:+$('route-heading').value,tolerance:+$('route-tolerance').value,targetMap:$('route-target').value,targetEntry:$('route-entry').value}}
 $('collision-visible').onchange=()=>requestDraw();
 $('collision-mode').onchange=guarded(()=>commit(g=>g.collision.mode=$('collision-mode').value));
 $('collision-draw').onclick=()=>{configureTool('collision-draw');$('collision-visible').checked=true;show('Marca los vértices y cierra el contorno con Enter o Cerrar polígono.');};
 $('collision-pick').onclick=()=>{configureTool('collision-select');$('collision-visible').checked=true;requestDraw()};
 $('collision-list').onchange=()=>{selectedZone=$('collision-list').value;refresh();const p=zone()?.poly[0];if(p)focus(...p);requestDraw()};
 $('collision-save').onclick=guarded(()=>{if(!zone())throw Error('Elige una zona.');commit(g=>{Object.assign(g.collision.zones.find(z=>z.id===selectedZone),{name:$('collision-name').value.trim()||'Zona',kind:$('collision-kind').value,enabled:$('collision-enabled').checked});if($('collision-kind').value==='walkable')g.collision.mode='replace';})});
 $('collision-delete').onclick=guarded(()=>commit(g=>g.collision.zones=g.collision.zones.filter(z=>z.id!==selectedZone)));
 $('collision-vertex').onchange=updateVertex;
 $('collision-vertex-save').onclick=guarded(()=>commit(g=>{const z=g.collision.zones.find(z=>z.id===selectedZone);if(!z)throw Error('Elige una zona.');z.poly[+$('collision-vertex').value]=[+$('collision-x').value,+$('collision-y').value]}));
 $('collision-vertex-add').onclick=guarded(()=>commit(g=>{const z=g.collision.zones.find(z=>z.id===selectedZone);if(!z)throw Error('Elige una zona.');const i=+$('collision-vertex').value,a=z.poly[i],b=z.poly[(i+1)%z.poly.length];z.poly.splice(i+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);}));
 $('collision-vertex-delete').onclick=guarded(()=>commit(g=>{const z=g.collision.zones.find(z=>z.id===selectedZone);if(!z||z.poly.length<=3)throw Error('Un contorno necesita al menos tres puntos.');z.poly.splice(+$('collision-vertex').value,1)}));
 for(const [suffix,solid]of [['on',true],['off',false]])$('collision-object-'+suffix).onclick=guarded(()=>{const items=state.selectedItems.filter(s=>!['labels','checkpoints','signs'].includes(s.type));if(!items.length)throw Error('Selecciona suelo u objetos con Elegir.');if(selectionLocked(doc(),items))throw Error('Desbloquea la selección antes de cambiar sus colisiones.');commit((g,d)=>{g.collision.mode='replace';for(const s of items){const o=d[s.type][s.index];if(['roads','sidewalks'].includes(s.type))o.walkable=!solid;else o.solid=solid;}})});
 $('collision-bounds').onclick=guarded(()=>commit((g,d)=>{const b=['minx','miny','maxx','maxy'].map(k=>+$('collision-'+k).value);if(!b.every(Number.isFinite)||b[2]<=b[0]||b[3]<=b[1])throw Error('El rectángulo de límites no es válido.');d.bounds=b;g.collision.zones=g.collision.zones.filter(z=>z.id!=='map-boundary');g.collision.zones.push({id:'map-boundary',name:'Límite del mapa',kind:'boundary',enabled:true,poly:[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]});}));
 $('route-settings').onclick=guarded(()=>commit(g=>Object.assign(g.route,{enabled:$('route-enabled').checked,ordered:$('route-ordered').checked,threeStars:+$('route-three').value,twoStars:+$('route-two').value})));
 $('route-from-controls').onclick=guarded(()=>commit((g,d)=>{for(const cp of d.checkpoints||[]){if(g.route.events.some(e=>e.id==='control:'+cp.id))continue;const e=newRouteEvent(cp.finish?'finish':cp.mandatory?'presentation':'checkpoint',cp.position);Object.assign(e,{id:'control:'+cp.id,name:cp.name||e.name,radius:cp.radius||.8,mandatory:!!cp.mandatory,heading:cp.angle??null});if(e.type==='finish'&&g.route.events.some(q=>q.type==='finish'))continue;g.route.events.push(e);}}));
 $('route-place').onclick=()=>{configureTool('route-event');show('Elige el tipo y las propiedades; pulsa el plano para colocar el punto.');};
 $('route-pick').onclick=()=>configureTool('route-select');
 $('route-events').onchange=()=>{selectedEvent=$('route-events').value;fillEvent();const p=event()?.position;if(p)focus(...p);requestDraw()};
 $('route-target').onchange=entries;
 $('route-type').onchange=()=>{const type=$('route-type').value;$('route-name').value=EVENT_TYPES[type];$('route-lowered').checked=['presentation','finish'].includes(type);$('route-hold').value=type==='presentation'?2:0;$('route-mandatory').checked=['checkpoint','presentation'].includes(type)};
 $('route-save-event').onclick=guarded(()=>{if(!event())throw Error('Elige un acontecimiento o colócalo en el plano.');commit(g=>Object.assign(g.route.events.find(e=>e.id===selectedEvent),readEvent(event())))});
 $('route-delete').onclick=guarded(()=>commit(g=>g.route.events=g.route.events.filter(e=>e.id!==selectedEvent)));
 for(const [suffix,delta]of [['up',-1],['down',1]])$('route-'+suffix).onclick=guarded(()=>commit(g=>{const a=g.route.events,i=a.findIndex(e=>e.id===selectedEvent),j=i+delta;if(i>=0&&j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];}));
 $('route-check').onclick=guarded(()=>{validateGameplay(doc().gameplay);const r=cfg().route;if(r.enabled&&!r.events.some(e=>['finish','exit'].includes(e.type)))throw Error('Falta una llegada o una salida.');for(const e of r.events.filter(e=>e.type==='exit')){const target=getDocument(e.targetMap);if(!target)throw Error('No se puede abrir el destino '+e.targetMap);if(e.targetEntry&&!target.gameplay?.route?.events?.some(q=>q.type==='entry'&&q.id===e.targetEntry))throw Error('La entrada de destino de '+e.name+' no existe.');}show('Recorrido y conexiones válidos. Prueba las maniobras en el juego.','good');$('route-validation').textContent='✓ Recorrido y conexiones comprobados.'});
 function finish(){if(state.tool!=='collision-draw')return false;try{const z={id:newId('collision'),name:$('collision-name').value.trim()||'Zona',kind:$('collision-kind').value,enabled:$('collision-enabled').checked,poly:structuredClone(state.working)};if(!validSurface(z))throw Error('Dibuja un contorno cerrado válido con al menos tres puntos, sin cruces.');commit(g=>{g.collision.zones.push(z);if(z.kind==='walkable')g.collision.mode='replace';selectedZone=z.id;});state.working=[];requestDraw();return true}catch(e){show(e.message,'error');return true}}
 function down(p){
  if(!['collision-draw','collision-select','route-event','route-select'].includes(state.tool))return false;
  if(state.tool==='collision-draw'){if(state.working.length>=3&&Math.hypot(p[0]-state.working[0][0],p[1]-state.working[0][1])<10/getZoom())return finish();state.working.push(p);requestDraw();return true}
  if(state.tool==='route-event'){try{const e=readEvent(newRouteEvent($('route-type').value,p));e.position=[...p];commit(g=>{g.route.events.push(e);selectedEvent=e.id;});}catch(e){show(e.message,'error')}return true}
  if(state.tool==='route-select'){const e=[...cfg().route.events].reverse().find(e=>Math.hypot(p[0]-e.position[0],p[1]-e.position[1])<=Math.max(e.radius,12/getZoom()));selectedEvent=e?.id||null;if(e){snapshot();drag={kind:'event',original:structuredClone(e),start:p}}fillEvent();requestDraw();return true}
  let z=zone(),vertex=z?.poly.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<12/getZoom());if(vertex===undefined||vertex<0){z=[...cfg().collision.zones].reverse().find(z=>inSurface(p,z));vertex=-1}selectedZone=z?.id||null;
  if(z){snapshot();drag={kind:'zone',original:structuredClone(z),start:p,vertex};}refresh();requestDraw();return true;
 }
 function move(p){if(!drag)return false;const g=cfg(),dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];if(drag.kind==='event'){const e=g.route.events.find(e=>e.id===selectedEvent);if(e)e.position=[drag.original.position[0]+dx,drag.original.position[1]+dy]}else{const z=g.collision.zones.find(z=>z.id===selectedZone);if(z){if(drag.vertex>=0)z.poly[drag.vertex]=[...p];else{z.poly=drag.original.poly.map(q=>[q[0]+dx,q[1]+dy]);if(drag.original.holes)z.holes=drag.original.holes.map(r=>r.map(q=>[q[0]+dx,q[1]+dy]))}}}doc().gameplay=g;obstacles=null;requestDraw();return true}
 function up(cancel=false){if(!drag)return;const original=drag.original;try{if(cancel)throw Error('Movimiento cancelado.');validateGameplay(doc().gameplay)}catch(e){const g=cfg(),arr=drag.kind==='event'?g.route.events:g.collision.zones,i=arr.findIndex(x=>x.id===original.id);if(i>=0)arr[i]=original;doc().gameplay=g;show(e.message,'error')}drag=null;changed();refresh()}
 function overlay(ctx){
  if(!doc())return;const g=cfg();ctx.save();
  const paint=(o,color,selected=false)=>{traceSurface(ctx,o,pixel);ctx.fillStyle=color+'25';ctx.strokeStyle=color;ctx.lineWidth=selected?3:1.2;ctx.fill('evenodd');ctx.stroke()};
  if($('collision-visible').checked){
   for(const s of [...doc().roads,...doc().sidewalks].filter(s=>s.walkable!==false))paint(s,'#55d795');
   obstacles??=obstaclesFor(doc());for(const o of obstacles){paint(o,o.clearance!==undefined?'#eab85a':'#fa7978');if(o.clearance!==undefined){const p=pixel((o.box[0]+o.box[2])/2,(o.box[1]+o.box[3])/2);ctx.fillStyle='#77501b';ctx.font='bold 12px system-ui';ctx.fillText('↕ '+o.clearance+' m',p[0],p[1])}}
   for(const z of g.collision.zones){ctx.globalAlpha=z.enabled?1:.3;paint(z,{walkable:'#55d795',blocked:'#fa7978',boundary:'#77bdff'}[z.kind],z.id===selectedZone);if(z.id===selectedZone)for(const p of z.poly){const q=pixel(...p);ctx.fillStyle='#fff';ctx.fillRect(q[0]-4,q[1]-4,8,8)}}ctx.globalAlpha=1;
  }
  if(g.route.enabled||['route-select','route-event'].includes(state.tool))for(const [i,e]of g.route.events.entries()){
   const p=pixel(...e.position);ctx.strokeStyle=e.id===selectedEvent?'#fff':{entry:'#77bdff',announcement:'#f6d57d',presentation:'#bf9cf6',finish:'#e4b35a',exit:'#e4b35a',checkpoint:'#72d9cf'}[e.type];ctx.lineWidth=e.id===selectedEvent?3:1.5;ctx.setLineDash(e.type==='announcement'?[4,4]:[]);ctx.beginPath();ctx.arc(...p,e.radius*getZoom(),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=ctx.strokeStyle;ctx.font='600 12px system-ui';ctx.fillText((i+1)+'. '+e.name,p[0]+6,p[1]-6);ctx.fillRect(p[0]-3,p[1]-3,6,6);
  }ctx.restore();
 }
 refresh();return{refresh,invalidate:()=>{obstacles=null},down,move,up,finish,overlay,uses:()=>['collision-draw','collision-select','route-event','route-select'].includes(state.tool)};
}
