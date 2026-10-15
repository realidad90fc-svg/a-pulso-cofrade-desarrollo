// UI-only controller for the existing map editor. It owns NO map state,
// geometry, photo scale or serialization; all edits use snapshot()/changed().
import {ROAD_MATERIALS,SIDEWALK_MATERIALS,drawSurface,drawRoof} from './editor-materials.mjs';
import {FACADE_PRESETS,AWNING_COLORS,AWNING_PRESETS,getFacadePreset,cleanFacade,drawFacadePresetPreview,drawFacadeDecor} from './editor-facades.mjs';
import {PROJECTING_SIGNS} from './editor-projecting-signs.mjs';

export function setupVisualPanels({state,getData,snapshot,changed,show,getFloorImage,applySurface}){
 const $=id=>document.getElementById(id);
 const galleries={roads:$('road-preview-gallery'),sidewalks:$('sidewalk-preview-gallery')};
 const materials={roads:ROAD_MATERIALS,sidewalks:SIDEWALK_MATERIALS};
 const cached=new Map();
 let previewKind='roads';
 const redrawSurface=(canvas,kind,id,large=false)=>{
  const c=canvas.getContext('2d');
  if(!c)return;
  const w=canvas.width,h=canvas.height,scale=large?63:41;
  const worldW=w/scale,worldH=h/scale;
  c.clearRect(0,0,w,h);
  const poly=[[0,0],[worldW,0],[worldW,worldH],[0,worldH]];
  drawSurface(c,poly,kind,id,(x,y)=>[x*scale,h-y*scale],scale,getFloorImage?.()||null);
 };
 const chosen=(kind)=>kind==='roads'?state.roadMaterial:state.sidewalkMaterial;
 const syncSurface=()=>{
  for(const kind of ['roads','sidewalks']){
   for(const button of galleries[kind].querySelectorAll('button[data-material]')){
    const active=button.dataset.material===chosen(kind);
    button.classList.toggle('chosen',active);
    button.setAttribute('aria-pressed',String(active));
   }
  }
  const id=chosen(previewKind);
  const material=materials[previewKind].find(x=>x.id===id)||materials[previewKind][0];
  redrawSurface($('surface-preview-large'),previewKind,material.id,true);
  $('surface-preview-name').textContent=(previewKind==='roads'?'Calzada':'Acera')+' · '+material.name;
 };
 function setSurface(kind,id){
  if(!materials[kind].some(x=>x.id===id))return;
  if(kind==='roads'){state.roadMaterial=id;$('road-material').value=id}
  else{state.sidewalkMaterial=id;$('sidewalk-material').value=id}
  previewKind=kind;
  syncSurface();
  // A single click on a thumbnail applies it to objects of the same layer
  // already selected. With no selection it remains a harmless preview.
  if(state.selectedItems.some(o=>o.type===kind))applySurface?.(kind);
 }
 function makeSurfaceGalleries(){
  for(const kind of ['roads','sidewalks']){
   const parent=galleries[kind];parent.replaceChildren();
   for(const item of materials[kind]){
    const button=document.createElement('button');button.type='button';
    button.className='decor-card';button.dataset.material=item.id;
    button.title=item.name;button.setAttribute('aria-label','Elegir textura '+item.name);
    const canvas=document.createElement('canvas');canvas.width=164;canvas.height=92;
    redrawSurface(canvas,kind,item.id);
    const label=document.createElement('span');label.textContent=item.name;
    button.append(canvas,label);
    button.onclick=()=>setSurface(kind,item.id);
    parent.append(button);
    cached.set(kind+':'+item.id,canvas);
   }
   const select=$(kind==='roads'?'road-material':'sidewalk-material');
   select.addEventListener('change',()=>{previewKind=kind;syncSurface()});
  }
  syncSurface();
 }
 const facadeSelect=$('facade-shop');
 for(const preset of FACADE_PRESETS){
  const option=document.createElement('option');option.value=preset.id;option.textContent=preset.name;facadeSelect.append(option);
 }
 const colorSelect=$('facade-awning-color');
 for(const color of AWNING_COLORS){
  const option=document.createElement('option');option.value=color.id;option.textContent=color.name;colorSelect.append(option);
 }
 const awningPresetSelect=$('facade-awning-preset');
 for(const preset of AWNING_PRESETS){
  const option=document.createElement('option');option.value=preset.id;option.textContent=preset.name;awningPresetSelect.append(option);
 }
 const presetGallery=$('facade-preset-gallery');
 for(const item of PROJECTING_SIGNS){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;$('facade-blade-sign').append(option)}
 const previewAwning=()=>{
  for(const id of ['facade-awning-preview','facade-shop-preview']){
  const canvas=$(id);if(!canvas)continue;
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);c.fillStyle='#737673';c.fillRect(0,0,w,h);
  const zoom=Math.min(29,(h-16)/5.5),offset=(w-9.35*zoom)/2,px=(x,y)=>[offset+x*zoom,h-6-y*zoom];
  const house={poly:[[.65,2.1],[8.7,2.1],[8.7,5.2],[.65,5.2]]};
  drawRoof(c,house.poly,state.material,px,()=>null,zoom,{roofDetail:'none',roofInset:.05});
  drawFacadeDecor(c,{...house,facade:{
   edge:0,shop:facadeSelect.value,sign:$('facade-sign').value,
   awning:$('facade-awning').value,awningColor:colorSelect.value,
   awningPreset:awningPresetSelect.value,
   awningDepth:Number($('facade-awning-depth').value)||.55,
   awningStart:Number($('facade-awning-start').value)/100,
   awningWidth:Number($('facade-awning-width').value)/100,
   balcony:$('facade-balcony').value,balconyCount:Number($('facade-balcony-count').value),
   balconyStart:Number($('facade-balcony-start').value)/100,balconyWidth:Number($('facade-balcony-width').value)/100,
   flowers:$('facade-flowers').checked,hangings:$('facade-hangings').checked,
   bladeSign:$('facade-blade-sign').value,bladePosition:Number($('facade-blade-position').value)/100,bladeDepth:Number($('facade-blade-depth').value),bladeSize:Number($('facade-blade-size').value)
  }},px,zoom);
  c.fillStyle='#ffffff';c.font='600 11px system-ui';
  c.fillText('CALLE · VISTA CENITAL',12,h-8);
  }
 };
 const selectPreset=id=>{
  facadeSelect.value=id;
  const p=getFacadePreset(id);
  $('facade-sign').value=id==='none'?'':p.sign;
  for(const button of presetGallery.querySelectorAll('button[data-preset]')){
   const active=button.dataset.preset===id;
   button.classList.toggle('chosen',active);
   button.setAttribute('aria-pressed',String(active));
  }
  previewAwning();
 };
 for(const preset of FACADE_PRESETS){
  const button=document.createElement('button');button.type='button';
  button.className='decor-card';button.dataset.preset=preset.id;
  button.title=preset.name;button.setAttribute('aria-label','Elegir '+preset.name);
  const canvas=document.createElement('canvas');canvas.width=190;canvas.height=96;
  drawFacadePresetPreview(canvas.getContext('2d'),preset);
  const title=document.createElement('span');title.textContent=preset.name;
  button.append(canvas,title);
  button.addEventListener('click',()=>selectPreset(preset.id));
  presetGallery.append(button);
 }
 facadeSelect.addEventListener('change',()=>selectPreset(facadeSelect.value));
 const fields={
  edge:$('facade-edge'),balcony:$('facade-balcony'),count:$('facade-balcony-count'),
  flowers:$('facade-flowers'),hangings:$('facade-hangings'),awning:$('facade-awning'),
  awningColor:colorSelect,awningPreset:awningPresetSelect,awningDepth:$('facade-awning-depth'),
  awningStart:$('facade-awning-start'),awningWidth:$('facade-awning-width'),
  balconyStart:$('facade-balcony-start'),balconyWidth:$('facade-balcony-width'),
  sign:$('facade-sign'),bladeSign:$('facade-blade-sign'),bladePosition:$('facade-blade-position'),bladeDepth:$('facade-blade-depth'),bladeSize:$('facade-blade-size')
 };
 const updateCount=()=>{$('facade-balcony-count-value').textContent=fields.count.value};
 const updateDepth=()=>{$('facade-awning-depth-value').textContent=Number(fields.awningDepth.value).toFixed(2).replace('.',',')+' m'};
 const updateSpans=()=>{
  for(const name of ['awningStart','awningWidth','balconyStart','balconyWidth']){
   const id='facade-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
   $(id+'-value').textContent=fields[name].value+' %';
  }
 };
 fields.count.addEventListener('input',updateCount);
 for(const name of ['balcony','count','flowers','hangings'])for(const event of ['input','change'])fields[name].addEventListener(event,previewAwning);
 fields.awningDepth.addEventListener('input',()=>{updateDepth();previewAwning()});
 for(const field of ['awningStart','awningWidth','balconyStart','balconyWidth'])
  fields[field].addEventListener('input',()=>{updateSpans();previewAwning()});
 for(const id of ['facade-awning','facade-awning-color','facade-awning-preset','facade-sign'])$(id).addEventListener('input',previewAwning);
 const syncBlade=()=>{
  $('facade-blade-position-value').textContent=fields.bladePosition.value+' %';
  for(const name of ['depth','size'])$('facade-blade-'+name+'-value').textContent=Number($('facade-blade-'+name).value).toFixed(2).replace('.',',')+' m';
  previewAwning();
 };
 fields.bladeSign.addEventListener('change',syncBlade);
 for(const field of ['bladePosition','bladeDepth','bladeSize'])fields[field].addEventListener('input',syncBlade);
 const selectedHouses=()=>state.selectedItems.filter(x=>x.type==='houses'&&getData()?.houses?.[x.index]);
 function refreshSelected(){
  // On selection, reflect the surface's CURRENT saved material in the gallery.
  // Do not mistake a highlighted thumbnail for an applied one.
  const surfaceSelection=state.selectedItems.find(o=>
   (o.type==='roads'||o.type==='sidewalks')&&getData()?.[o.type]?.[o.index]);
  if(surfaceSelection){
   const kind=surfaceSelection.type,obj=getData()[kind][surfaceSelection.index];
   const oldDefault=materials[kind][surfaceSelection.index%12]?.id||materials[kind][0].id;
   const value=obj.material||oldDefault;
   if(materials[kind].some(x=>x.id===value)){
    if(kind==='roads'){state.roadMaterial=value;$('road-material').value=value}
    else{state.sidewalkMaterial=value;$('sidewalk-material').value=value}
    previewKind=kind;
    const name=materials[kind].find(x=>x.id===value)?.name||value;
    $('surface-apply-status').textContent=(kind==='roads'?'Calzada':'Acera')+' '+(surfaceSelection.index+1)+' · Material actual: '+name;
    syncSurface();
   }
  }else{
   $('surface-apply-status').textContent='Selecciona una calzada o acera para ver su textura actual y cambiarla.';
  }
  const selected=selectedHouses();
  $('facade-selected').textContent=selected.length
   ?selected.length+' edificio(s) seleccionados. Elige el tramo de fachada y aplica los detalles.'
   :'Selecciona un edificio con «▧ Seleccionar» antes de aplicar la decoración.';
  const house=selected.length?getData().houses[selected[0].index]:null;
  const facade=cleanFacade(house?.facade||{},Math.max(0,(house?.poly?.length||4)-1));
  fields.edge.replaceChildren();
  for(let i=0;i<(house?.poly?.length||4);i++){
   const option=document.createElement('option');option.value=String(i);
   const a=house?.poly?.[i],b=house?.poly?.[(i+1)%house.poly.length];
   const len=a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;
   option.textContent='Lado '+(i+1)+(len?' · '+len.toFixed(1)+' m':'');
   fields.edge.append(option);
  }
  fields.edge.value=String(facade.edge);
  fields.balcony.value=facade.balcony;
  fields.count.value=String(facade.balconyCount);
  fields.flowers.checked=facade.flowers;
  fields.hangings.checked=facade.hangings;
  fields.awning.value=facade.awning;
  fields.awningColor.value=facade.awningColor;
  fields.awningPreset.value=facade.awningPreset;
  fields.awningDepth.value=String(facade.awningDepth);
  fields.awningStart.value=String(Math.round(facade.awningStart*100));
  fields.awningWidth.value=String(Math.round(facade.awningWidth*100));
  fields.balconyStart.value=String(Math.round(facade.balconyStart*100));
  fields.balconyWidth.value=String(Math.round(facade.balconyWidth*100));
  selectPreset(facade.shop);
  fields.sign.value=facade.sign;
  fields.bladeSign.value=facade.bladeSign;fields.bladePosition.value=String(Math.round(facade.bladePosition*100));fields.bladeDepth.value=String(facade.bladeDepth);fields.bladeSize.value=String(facade.bladeSize);
  updateCount();updateDepth();updateSpans();syncBlade();
 }
 function readInputs(){
  return{
   edge:Number(fields.edge.value),balcony:fields.balcony.value,
   balconyCount:Number(fields.count.value),flowers:fields.flowers.checked,
   hangings:fields.hangings.checked,awning:fields.awning.value,
   awningColor:fields.awningColor.value,awningPreset:fields.awningPreset.value,
   awningDepth:Number(fields.awningDepth.value),
   awningStart:Number(fields.awningStart.value)/100,
   awningWidth:Number(fields.awningWidth.value)/100,
   balconyStart:Number(fields.balconyStart.value)/100,
   balconyWidth:Number(fields.balconyWidth.value)/100,
   shop:facadeSelect.value,sign:fields.sign.value,bladeSign:fields.bladeSign.value,bladePosition:Number(fields.bladePosition.value)/100,bladeDepth:Number(fields.bladeDepth.value),bladeSize:Number(fields.bladeSize.value)
  };
 }
 $('facade-apply').addEventListener('click',()=>{
  const selected=selectedHouses();
  if(!selected.length){show('Selecciona primero uno o varios edificios.','error');return}
  snapshot();
  const decor=readInputs();
  for(const item of selected){
   const house=getData().houses[item.index];
   house.facade=cleanFacade(decor,house.poly.length-1);
  }
  changed();
  show('Fachadas aplicadas a '+selected.length+' edificio(s). Sin modificar paredes ni colisiones.','good');
 });
 $('facade-remove').addEventListener('click',()=>{
  const selected=selectedHouses();
  if(!selected.length){show('Selecciona primero los edificios de los que quieras quitar la decoración.','error');return}
  if(!selected.some(item=>getData().houses[item.index].facade)){
   show('Los edificios seleccionados no tienen decoración para quitar.','info');return;
  }
  snapshot();
  for(const item of selected)delete getData().houses[item.index].facade;
  changed();refreshSelected();
  show('Decoración eliminada; geometría y tejados conservados.','good');
 });
 makeSurfaceGalleries();
 // Search both catalogs without changing any material id, geometry or state.
 const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 $('surface-search')?.addEventListener('input',e=>{
  const needle=normalized(e.target.value);
  for(const kind of ['roads','sidewalks']){
   const cards=galleries[kind].querySelectorAll('button[data-material]');
   for(const button of cards)button.hidden=!normalized(button.textContent).includes(needle);
  }
 });
 refreshSelected();
 const redrawFloorPreviews=()=>{
  for(const kind of ['roads','sidewalks'])for(const item of materials[kind]){
   const thumbnail=cached.get(kind+':'+item.id);
   if(thumbnail)redrawSurface(thumbnail,kind,item.id);
  }
  syncSurface();
 };
 return{refreshSelected,syncSurface,redrawFloorPreviews,readInputs};
}
