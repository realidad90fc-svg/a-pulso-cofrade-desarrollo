import {overheadType,overheadSize,overheadDefaultSize,validateOverhead,DEFAULT_HEIGHTS,validateHeightProfiles} from './overhead-elements.mjs';
import {gameplayOf} from './map-gameplay.mjs';
import {selectionLocked} from './editor-item-state.mjs';
import {CONTENT_STEPS} from './content-catalogue.mjs';
export function setupOverheadUI({state,getData,snapshot,changed,show,canWrite}){
 const $=id=>document.getElementById(id),host=document.createElement('fieldset');host.id='overhead-settings';host.hidden=true;
 host.innerHTML=`<legend>Toldo, dintel o arco independiente</legend><p id="overhead-context" class="notice"></p><p class="muted">Los toldos muestran cuatro esquinas y cuatro tiradores laterales en el plano. Arrastra para cambiar su ancho y fondo; arrastra el interior para moverlos. La altura libre se ajusta aquí.</p>
 <div class="precision-two"><label>Ancho total (m)<input id="overhead-width" type="number" min=".1" max="100" step=".05" value="3"></label><label>Fondo (m)<input id="overhead-depth" type="number" min=".05" max="100" step=".05" value="1.2"></label></div>
 <label>Altura libre bajo la pieza (m)<input id="overhead-clearance" type="number" min=".1" max="20" step=".05" value="3.5"></label>
 <label>Giro (°)<input id="overhead-angle" type="number" min="-360" max="360" step="1" value="0"></label>
 <label id="overhead-pier-label">Grosor de cada lateral (m)<input id="overhead-pier" type="number" min=".05" max="50" step=".05" value=".3"></label>
 <button id="overhead-apply" type="button">Aplicar a la pieza seleccionada</button>
 <p class="muted">La anchura de paso útil de un portal es el ancho total menos sus dos laterales. Agacharse permite pasar solo si queda altura suficiente. Un hueco demasiado bajo sigue bloqueando el paso. Deja libre la puerta en el contorno del edificio y añade suelo transitable bajo ella.</p>
 <fieldset><legend>Altura del paso · calibración del juego</legend><label>Paso<select id="overhead-step"></select></label>
 <div class="precision-two"><label>Normal (m)<input id="overhead-standing" type="number" min=".1" max="20" step=".05"></label><label>Agachado (m)<input id="overhead-crouched" type="number" min=".1" max="20" step=".05"></label><label>Arriado (m)<input id="overhead-lowered" type="number" min=".1" max="20" step=".05"></label></div>
 <button id="overhead-save-profile" type="button">Guardar alturas de este paso</button><p class="muted">Valores de simulación editables, no medidas históricas. Se guardan en este mapa y se usan al probarlo y jugarlo.</p></fieldset>
 <p id="overhead-fit" class="notice" role="status"></p>`;
 $('urban-panel').querySelector('.stack').append(host);
 for(const step of CONTENT_STEPS){const option=document.createElement('option');option.value=step.id;option.textContent=step.name;$('overhead-step').append(option)}
 let stamp='',mapKey='',placementType='';const selected=()=>state.tool==='select'&&state.selectedItems?.length===1&&state.selectedItems[0].type==='urban'?getData().urban[state.selectedItems[0].index]:null;
 const profile=()=>getData()?.gameplay?.heightProfiles?.find(p=>p.id===$('overhead-step').value)||DEFAULT_HEIGHTS;
 function loadProfile(){const p=profile();for(const k of ['standing','crouched','lowered'])$('overhead-'+k).value=p[k];fit()}
 function options(){return Object.fromEntries(['width','depth','clearance','angle','pier'].map(k=>[k,Number($('overhead-'+k).value)]))}
 function fit(){const h=Number($('overhead-clearance').value),p=profile();$('overhead-fit').textContent=!Number.isFinite(h)?'Escribe una altura libre.':h>=p.standing?'Altura suficiente en posición normal.':h>=p.crouched?'Necesita agacharse para pasar.':h>=p.lowered?'Solo cabe arriado: no puede atravesarlo andando.':'No cabe ni arriado: aumenta la altura libre o cambia de paso.'}
 function refresh(){if(!getData())return;const item=selected(),type=state.tool==='select'?item?.type:$('urban-type').value,active=overheadType(type);host.hidden=!active;if(!active)return;
  $('overhead-pier-label').hidden=active.kind==='canopy';$('overhead-apply').disabled=!overheadType(item?.type);
  $('overhead-context').textContent=overheadType(item?.type)?'Editando: '+active.name:'Siguiente pieza: '+active.name+' · toca el mapa para colocarla';
  if(!item&&type!==placementType){const previous=overheadType(placementType);if(previous?.kind!==active.kind||active.kind!=='canopy'){const [w,d]=overheadDefaultSize(type);$('overhead-width').value=w;$('overhead-depth').value=d}placementType=type;}
  if(mapKey!==getData().metadata.mapKey){mapKey=getData().metadata.mapKey;stamp='';loadProfile()}
  const next=JSON.stringify([state.tool,state.selectedItems,item&&[item.type,overheadSize(item),item.angle,item.clearance,item.pier]]);
  if(next!==stamp){stamp=next;if(overheadType(item?.type)){const [w,d]=overheadSize(item);for(const [k,v]of Object.entries({width:w,depth:d,clearance:item.clearance,angle:item.angle,pier:item.pier??.3}))$('overhead-'+k).value=v}}
  fit();
 }
 const guarded=fn=>()=>{try{if(!canWrite())throw Error('Recarga el proyecto antes de editarlo.');fn()}catch(e){show(e.message,'error')}};
 $('overhead-apply').onclick=guarded(()=>{const item=selected();if(!overheadType(item?.type))throw Error('Selecciona un toldo, dintel o arco.');if(selectionLocked(getData(),state.selectedItems))throw Error('Desbloquea la pieza antes de editarla.');const v=options(),next={...item,size:[v.width,v.depth],angle:v.angle,clearance:v.clearance,pier:v.pier};validateOverhead(next);snapshot();Object.assign(item,next);changed();refresh();show('Medidas y altura libre aplicadas.','good')});
 $('overhead-save-profile').onclick=guarded(()=>{const p={id:$('overhead-step').value,...Object.fromEntries(['standing','crouched','lowered'].map(k=>[k,Number($('overhead-'+k).value)]))};validateHeightProfiles([p]);const g=gameplayOf(getData());g.heightProfiles=[...(g.heightProfiles||[]).filter(q=>q.id!==p.id),p];snapshot();getData().gameplay=g;changed();fit();show('Alturas guardadas para este paso en el mapa.','good')});
 $('overhead-step').onchange=loadProfile;$('overhead-clearance').addEventListener('input',fit);$('urban-type').addEventListener('change',refresh);refresh();return{refresh,options};
}
