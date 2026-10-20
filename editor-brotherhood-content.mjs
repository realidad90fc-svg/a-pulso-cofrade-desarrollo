import {CONTENT_STEPS} from './content-catalogue.mjs';
import {DEFAULT_UNIFORM,DEFAULT_ACOLYTE,drawProcessionFigure} from './procession-model.mjs';
import {importCustomRaster,saveCustomAsset,assetById} from './custom-assets.mjs';
import {validateBrotherhoodSettings,projectSteps} from './brotherhood-content.mjs';
export function mountBrotherhoodContent({host,brotherhoodId,getProject,commit,onSaved,notice,onPreview=()=>{}}){
 const existing=getProject().brotherhoodSettings?.[brotherhoodId]||{},root=document.createElement('details');root.className='city-advanced';root.id='brotherhood-content';root.open=true;
 root.innerHTML=`<summary>Vestimenta y paso de esta hermandad</summary><div class="stack">
 <p class="city-small">Se guarda por hermandad y se conserva en el proyecto completo. Las calles compartidas mantienen su diseño.</p>
 <div id="brotherhood-uniform-preview-slot"></div>
 <label>Modelo de ropa<select id="uniform-preset"><option value="custom">Personalizado</option><option value="white">Blanco y negro</option><option value="purple">Morado</option><option value="green">Blanco y verde</option><option value="burgundy">Blanco y burdeos</option><option value="black">Negro</option></select></label>
 <div id="brotherhood-colors" class="city-two"></div>
 <label class="city-check"><input id="uniform-cape-on" type="checkbox" checked> Lleva capa</label>
 <label>Emblema<select id="uniform-emblem"><option value="cross">Cruz</option><option value="shield">Escudo</option><option value="none">Sin emblema</option></select></label>
 <button id="brotherhood-save-uniform" type="button">Guardar ropa de esta hermandad</button>
 <div class="line"></div><strong>Importar imagen de paso · vista aérea</strong>
 <p class="city-small">PNG, WebP o JPG. Para recortar el contorno utiliza una imagen con transparencia. El ancho y largo definen también la colisión; la base conserva los controles del juego.</p>
 <label>Imagen del paso<input id="brotherhood-step-file" type="file" accept="image/png,image/webp,image/jpeg"></label>
 <label>Nombre del paso<input id="brotherhood-step-name" maxlength="100"></label>
 <label>Tipo<select id="brotherhood-step-type"><option value="cristo">Cristo</option><option value="misterio">Misterio</option><option value="palio">Palio importado</option></select></label>
 <label>Base de movimiento<select id="brotherhood-step-base"></select></label>
 <div class="city-two"><label>Ancho total, con maniguetas (m)<input id="brotherhood-step-width" type="number" min=".1" max="20" step=".01" value="1.04"></label><label>Largo total (m)<input id="brotherhood-step-length" type="number" min=".1" max="20" step=".01" value="2.15"></label></div>
 <label>Giro de la imagen (°)<input id="brotherhood-step-rotation" type="number" min="-360" max="360" step="1" value="0"></label>
 <div class="city-two"><label>Altura normal (m)<input id="brotherhood-step-standing" type="number" min=".1" max="20" step=".05" value="3.8"></label><label>Agachado (m)<input id="brotherhood-step-crouched" type="number" min=".1" max="20" step=".05" value="3.25"></label><label>Arriado (m)<input id="brotherhood-step-lowered" type="number" min=".1" max="20" step=".05" value="2.9"></label></div>
 <div id="brotherhood-step-preview-slot"></div>
 <button id="brotherhood-save-step" type="button">Guardar paso de esta hermandad</button>
 <button id="brotherhood-preview-step" type="button">Ver este paso en el plano</button>
 <button id="brotherhood-remove-step" type="button">Quitar paso importado</button>
 <p id="brotherhood-step-status" class="notice" role="status"></p></div>`;
 host.append(root);const $=id=>root.querySelector('#'+id);let raster=null;
 for(const [id,width,height,label]of [['brotherhood-uniform-preview',480,180,'Vista previa de nazareno y acólito'],['brotherhood-step-preview',320,200,'Paso importado']]){const canvas=document.createElement('canvas');canvas.id=id;canvas.width=width;canvas.height=height;canvas.setAttribute('aria-label',label);$(id+'-slot').append(canvas);}
 const colors=[['robe','Túnica'],['hood','Antifaz y capirote'],['cape','Capa'],['belt','Cíngulo'],['shoes','Calzado']];
 for(const [key,name]of colors){const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.type='color';input.id='uniform-'+key;input.value=existing.uniform?.[key]||DEFAULT_UNIFORM[key];input.oninput=paint;label.append(input);$('brotherhood-colors').append(label);}
 for(const [key,name]of [['robe','Sotana / alba del acólito'],['cape','Dalmática del acólito']]){const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.type='color';input.id='acolyte-'+key;input.value=existing.acolyteUniform?.[key]||DEFAULT_ACOLYTE[key];input.oninput=paint;label.append(input);$('brotherhood-colors').append(label);}
 function uniform(){return{...DEFAULT_UNIFORM,...Object.fromEntries(colors.map(([k])=>[k,$('uniform-'+k).value])),capeOn:$('uniform-cape-on').checked,emblem:$('uniform-emblem').value};}
 function acolyte(){return{...DEFAULT_ACOLYTE,robe:$('acolyte-robe').value,cape:$('acolyte-cape').value};}
 function paint(){const canvas=$('brotherhood-uniform-preview'),c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#d9d3c3';c.fillRect(0,0,canvas.width,canvas.height);drawProcessionFigure(c,{x:0,y:0,angle:0,role:'nazarenes',index:0,uniform:uniform()},()=>[150,90],350);drawProcessionFigure(c,{x:0,y:0,angle:0,role:'acolytes',index:0,uniform:acolyte()},()=>[330,90],350);}
 $('uniform-cape-on').checked=existing.uniform?.capeOn!==false;$('uniform-emblem').value=existing.uniform?.emblem||'cross';$('uniform-cape-on').onchange=paint;$('uniform-emblem').onchange=paint;
 $('uniform-preset').onchange=()=>{const p={white:['#f0e9dc','#202126'],purple:['#522b66','#522b66'],green:['#f0e9dc','#245744'],burgundy:['#f0e9dc','#752d43'],black:['#202126','#202126']}[$('uniform-preset').value];if(p){$('uniform-robe').value=p[0];$('uniform-hood').value=p[1];$('uniform-cape').value=p[1];paint();}};
 const guarded=fn=>async()=>{try{await fn();}catch(error){notice(error.message,'error');}};
 function save(update){commit(()=>{const p=getProject();p.brotherhoodSettings??={};p.brotherhoodSettings[brotherhoodId]={...p.brotherhoodSettings[brotherhoodId],...update};validateBrotherhoodSettings(p.brotherhoodSettings);});onSaved();}
 $('brotherhood-save-uniform').onclick=guarded(()=>{save({uniform:uniform(),acolyteUniform:acolyte()});notice('Vestimenta guardada para esta hermandad.');});
 for(const s of CONTENT_STEPS){const option=document.createElement('option');option.value=s.id;option.textContent=s.name;$('brotherhood-step-base').append(option);}
 const spec=existing.step;for(const k of ['name','type','width','length','rotation','standing','crouched','lowered'])if(spec?.[k]!==undefined)$('brotherhood-step-'+k).value=spec[k];if(spec)$('brotherhood-step-base').value=spec.baseStepId;
 async function imagePreview(src){const c=$('brotherhood-step-preview'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#d9d3c3';ctx.fillRect(0,0,c.width,c.height);if(!src)return;const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('No se pudo leer el paso.'));im.src=src;});const scale=Math.min(280/(im.naturalWidth||im.width),180/(im.naturalHeight||im.height));ctx.drawImage(im,(320-im.width*scale)/2,(200-im.height*scale)/2,im.width*scale,im.height*scale);}
 $('brotherhood-step-file').onchange=guarded(async()=>{const f=$('brotherhood-step-file').files?.[0];if(!f)return;raster=await importCustomRaster(f);await imagePreview(raster.image);$('brotherhood-step-status').textContent='Imagen preparada. Ajusta las medidas y guarda el paso.';});
 $('brotherhood-save-step').onclick=guarded(async()=>{const old=getProject().brotherhoodSettings?.[brotherhoodId]?.step;if(!raster&&!old)throw Error('Selecciona primero la imagen del paso.');const next={assetId:raster?'asset-paso-'+(crypto.randomUUID?.()||Date.now()):old.assetId,name:$('brotherhood-step-name').value.trim(),type:$('brotherhood-step-type').value,baseStepId:$('brotherhood-step-base').value,...Object.fromEntries(['width','length','rotation','standing','crouched','lowered'].map(k=>[k,Number($('brotherhood-step-'+k).value)]))};validateBrotherhoodSettings({[brotherhoodId]:{step:next}});
  if(raster)await saveCustomAsset({id:next.assetId,name:'Paso · '+next.name,category:'decor',width:next.width,depth:next.length,angle:next.rotation,collision:{kind:'none'},image:raster.image});save({step:next});notice('Paso guardado. Selecciónalo en Paso del itinerario y aplica los cambios al juego.');});
 $('brotherhood-preview-step').onclick=guarded(()=>{const choice=projectSteps(getProject()).find(s=>s.id==='imported:'+brotherhoodId);if(!choice)throw Error('Guarda primero el paso importado.');onPreview(choice);});
 $('brotherhood-remove-step').disabled=!spec;$('brotherhood-remove-step').onclick=guarded(()=>{if(getProject().campaignItineraries?.[brotherhoodId]?.stepId==='imported:'+brotherhoodId)throw Error('Aplica otro paso al itinerario antes de quitar el importado.');commit(()=>{delete getProject().brotherhoodSettings[brotherhoodId].step;});onSaved();notice('Asignación retirada; la imagen sigue en Mis recursos.');});
 $('brotherhood-step-status').textContent=spec?'Paso asignado: '+spec.name:'Sin paso importado. Puedes utilizar uno existente de esta hermandad.';imagePreview(spec&&assetById(spec.assetId)?.image).catch(e=>notice(e.message,'error'));paint();return root;
}
