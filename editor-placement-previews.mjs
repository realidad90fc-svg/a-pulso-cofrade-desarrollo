import {TREE_VARIANTS,ROAD_MATERIALS,SIDEWALK_MATERIALS,roofById} from './editor-materials.mjs';
import {URBAN_ITEMS} from './editor-urban-elements.mjs';
import {getFacadePreset} from './editor-facades.mjs';
import {textureRevision} from './seville-textures.mjs';
import {paintPlacementPreview} from './editor-placement-preview-render.mjs';
import {listCustomAssets} from './custom-assets.mjs';

// Reuses existing tool/options actions, including applying a material to an
// already selected surface. No objects or photo transforms are created here.
export function setupPlacementPreviews({state,getImage,spriteDims,getRoofs,chooseRoof,configureTool,nextAudience,getPaso,getFacade,getPhotos,selectPhoto}){
 const $=id=>document.getElementById(id),root=$('placement-preview-panel'),select=$('placement-category'),gallery=$('placement-preview-gallery');
 let groupId='tree',fingerprint='',galleryKey='',cards=[];
 const value=id=>$(id)?.value,number=(id,fallback)=>Number(value(id))||fallback;
 const options=id=>[...$(id).options].map(o=>({id:o.value,name:o.textContent}));
 const pick=(id,chosen)=>{const el=$(id);el.value=chosen;el.dispatchEvent(new Event('change',{bubbles:true}))};
 const facade=()=>({kind:'facade',material:state.material,facade:{...getFacade(),edge:0}});
 const roof=()=>({roofInset:number('roof-inset',.05),roofDetail:value('roof-detail'),roofBorder:value('roof-border'),roofSimplify:$('roof-simplify').checked});
 const facadeGroup=(id,name,field)=>({id,name,tools:['select'],tool:'select',adjust:field,items:()=>options(field),selected:()=>value(field),spec:item=>({...facade(),facade:{...facade().facade,[{'facade-balcony':'balcony','facade-awning-preset':'awningPreset','facade-blade-sign':'bladeSign','facade-shop':'shop'}[field]]:item.id,...(field==='facade-shop'?{sign:getFacadePreset(item.id).sign}:{})}}),choose:item=>pick(field,item.id)});
 const groups=[
  {id:'roof',name:'Edificios y tejados',tools:['house'],tool:'house',adjust:'roof-category',items:getRoofs,selected:()=>state.material,spec:item=>({kind:'roof',material:item.id,roof:roof()}),choose:item=>chooseRoof(item.id)},
  ...[['road','Calzadas',ROAD_MATERIALS,'road-material'],['sidewalk','Aceras',SIDEWALK_MATERIALS,'sidewalk-material']].map(([id,name,items,field])=>({id,name,tools:[id],tool:id,adjust:field,items:()=>items,selected:()=>value(field),spec:item=>({kind:id,material:item.id}),choose:item=>{$(id==='road'?'road-preview-gallery':'sidewalk-preview-gallery').querySelector('[data-material="'+item.id+'"]')?.click()}})),
  {id:'tree',name:'Árboles y vegetación · primavera',tools:['tree'],tool:'tree',adjust:'tree-variant',items:()=>TREE_VARIANTS,selected:()=>$('tree-cycle').checked?TREE_VARIANTS[state.treeIndex%TREE_VARIANTS.length].id:state.treeVariant,spec:item=>({kind:'tree',id:item.id,radius:number('tree-radius',.35),scale:.88+(state.treeIndex%5)*.06,angle:(state.treeIndex*47)%360}),choose:item=>pick('tree-variant',item.id)},
  {id:'people',name:'Público',tools:['people','people-row'],tool:'people',adjust:'public-mode',items:()=>options('public-sprite'),selected:nextAudience,spec:item=>({kind:'person',id:item.id,size:spriteDims(item.id)}),choose:item=>{pick('public-mode','fixed');pick('public-sprite',item.id)}},
  {id:'furniture',name:'Vallas y sillas',tools:['fence','chair','fence-row','chair-row'],tool:'fence',adjust:'furniture-spacing',items:()=>[{id:'fence',name:'Valla roja de separación'},{id:'chair',name:'Silla plegable de madera · Carrera Oficial'}],selected:()=>state.tool.startsWith('chair')?'chair':'fence',spec:item=>({kind:item.id,spacing:number('furniture-spacing',.7)}),choose:item=>configureTool(item.id+(state.tool.endsWith('-row')?'-row':''))},
  {id:'urban',name:'Urbanismo y marcas viales',tools:['urban'],tool:'urban',adjust:'urban-type',items:()=>URBAN_ITEMS,selected:()=>value('urban-type'),spec:item=>({kind:'urban',type:item.id,depth:number('urban-depth',2.6)}),choose:item=>pick('urban-type',item.id)},
  {id:'sign',name:'Señales',tools:['sign'],tool:'sign',items:()=>[{id:'traffic',name:'Señal de tráfico'}],selected:()=>'traffic',spec:()=>({kind:'sign'}),choose:()=>{}},
  {id:'checkpoint',name:'Checkpoints',tools:['checkpoint'],tool:'checkpoint',items:()=>[{id:'checkpoint',name:'Punto de control'}],selected:()=>'checkpoint',spec:()=>({kind:'checkpoint'}),choose:()=>{},note:'La cruz identifica el punto de control. Puedes moverlo después con Seleccionar.'},
  {id:'street-name',name:'Puntos y carteles de calle',tools:['street-name'],tool:'street-name',adjust:'street-name-text',items:()=>[{id:'street',name:value('street-name-text')||'Nombre de calle'}],selected:()=>'street',spec:()=>({kind:'street-name',name:value('street-name-text'),radius:number('street-trigger-radius',1)}),choose:()=>{},note:'El círculo solo se ve en el editor. El nombre se anuncia en el cartel superior del juego al cruzar el punto.'},
  {id:'paso',name:'Paso de prueba y orientación',tools:['paso'],tool:'paso',adjust:'start-panel',items:()=>[{id:'paso',name:'Huella del paso · frente y trasera'}],selected:()=>'paso',spec:()=>({kind:'paso',angle:getPaso()?.angle||0}),choose:()=>{},note:'Muestra la huella que utiliza el editor para comprobar el giro y fijar el inicio.'},
  {id:'roof-detail',name:'Detalles de cubierta',tools:['house'],tool:'house',adjust:'roof-detail',items:()=>options('roof-detail'),selected:()=>value('roof-detail'),spec:item=>({kind:'roof',material:state.material,roof:{...roof(),roofDetail:item.id}}),choose:item=>pick('roof-detail',item.id)},
  {id:'roof-border',name:'Pretiles y remates',tools:['house'],tool:'house',adjust:'roof-border',items:()=>options('roof-border'),selected:()=>value('roof-border'),spec:item=>({kind:'roof',material:state.material,roof:{...roof(),roofBorder:item.id}}),choose:item=>pick('roof-border',item.id)},
  facadeGroup('facade','Comercios y fachadas','facade-shop'),
  facadeGroup('balcony','Balcones y rejas','facade-balcony'),
  facadeGroup('awning','Toldos','facade-awning-preset'),
  facadeGroup('blade','Banderolas y símbolos comerciales','facade-blade-sign'),
  {id:'awning-colour',name:'Colores de toldo',tools:['select'],tool:'select',adjust:'facade-awning-color',items:()=>options('facade-awning-color'),selected:()=>value('facade-awning-color'),spec:item=>({...facade(),facade:{...facade().facade,awning:'plain',awningPreset:'custom',awningColor:item.id}}),choose:item=>{pick('facade-awning','plain');pick('facade-awning-preset','custom');pick('facade-awning-color',item.id)}},
  {id:'facade-details',name:'Macetas y colgaduras',tools:['select'],tool:'select',adjust:'facade-flowers',items:()=>[{id:'none',name:'Sin macetas ni colgaduras'},{id:'flowers',name:'Macetas con flores'},{id:'hangings',name:'Colgaduras de Semana Santa'},{id:'both',name:'Macetas y colgaduras'}],selected:()=>$('facade-flowers').checked?$('facade-hangings').checked?'both':'flowers':$('facade-hangings').checked?'hangings':'none',spec:item=>({...facade(),facade:{...facade().facade,balcony:facade().facade.balcony==='none'?'individual':facade().facade.balcony,flowers:['flowers','both'].includes(item.id),hangings:['hangings','both'].includes(item.id)}}),choose:item=>{if(value('facade-balcony')==='none')pick('facade-balcony','individual');for(const [id,enabled]of [['facade-flowers',['flowers','both'].includes(item.id)],['facade-hangings',['hangings','both'].includes(item.id)]]){$(id).checked=enabled;$(id).dispatchEvent(new Event('input',{bubbles:true}))}}},
  {id:'reference',name:'Fotografías guía',tools:['reference'],tool:'reference',adjust:'reference-file',items:()=>{const photos=getPhotos();return photos.length?photos:[{id:'empty',name:'Añade una fotografía guía'}]},selected:()=>getPhotos().find(p=>p.selected)?.id||'empty',spec:item=>({kind:'reference',id:item.id,image:item.image,angle:item.rotation||0,opacity:item.opacity}),choose:item=>{if(item.id!=='empty')selectPhoto(item.id)},note:'Vista de la foto privada seleccionada. Elegir una miniatura no cambia su tamaño ni su posición en el plano.'}
 ];
 groups.push({id:'custom-assets',name:'Mis recursos importados',tools:['custom','custom-row','road','sidewalk','house'],tool:'custom',adjust:'custom-assets-panel',items:()=>listCustomAssets().length?listCustomAssets():[{id:'empty',name:'Importa tu primer recurso'}],selected:()=>state.customAssetId||'empty',spec:item=>({kind:'custom',id:item.id,spacing:number('furniture-spacing',.7)}),choose:item=>{if(item.id==='empty'){$('custom-assets-panel').open=true;return}document.dispatchEvent(Object.assign(new Event('editor-custom-choose'),{assetId:item.id}))},note:'Imágenes propias guardadas en tu catálogo. Se incluyen con los mapas al exportarlos y se dibujan igual en el juego.'});
 for(const group of groups)if(['road','sidewalk'].includes(group.id))group.note='Si hay superficies de esta capa seleccionadas, elegir una miniatura aplica el material. Sin selección, prepara el siguiente trazado. Puedes deshacer el cambio.';
 const primary={house:'roof',road:'road',sidewalk:'sidewalk',tree:'tree',people:'people','people-row':'people',fence:'furniture',chair:'furniture','fence-row':'furniture','chair-row':'furniture',urban:'urban',sign:'sign',checkpoint:'checkpoint','street-name':'street-name',paso:'paso',reference:'reference'};
 for(const group of groups){const option=document.createElement('option');option.value=group.id;option.textContent=group.name;select.append(option)}
 function sync(force=false){
  let group=groups.find(g=>g.id===groupId);
  if(primary[state.tool]&&!group.tools.includes(state.tool)){groupId=primary[state.tool];group=groups.find(g=>g.id===groupId)}
  select.value=groupId;
  const items=group.items(),chosen=group.selected(),item=items.find(i=>i.id===chosen)||items[0];if(!item)return;
  const specs=items.map(group.spec),key=groupId+':'+items.map(i=>i.id).join('|');
  const imageStatus=specs.map(s=>{const im=s.image||(s.kind==='person'?getImage(s.id):s.kind==='tree'&&s.id==='tree-0'?getImage('sharedassets2.assets:563'):s.kind==='road'||s.kind==='sidewalk'?getImage('sharedassets2.assets:373'):s.kind==='roof'||s.kind==='facade'?getImage(roofById(s.material).key):null);return(im?.naturalWidth||im?.width||0)+','+(im?.naturalHeight||im?.height||0)}).join(';');
  const stamp=key+':'+chosen+':'+state.tool+':'+textureRevision()+':'+imageStatus+':'+JSON.stringify(specs.map(({image,...s})=>s));
  if(!force&&stamp===fingerprint)return;fingerprint=stamp;
  if(key!==galleryKey){
   galleryKey=key;gallery.replaceChildren();cards=items.map((entry,index)=>{
    const button=document.createElement('button');button.type='button';button.className='decor-card';button.dataset.previewItem=entry.id;button.setAttribute('aria-label','Elegir '+entry.name);
    const canvas=document.createElement('canvas');canvas.width=328;canvas.height=200;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',entry.name);
    const title=document.createElement('span');title.textContent=entry.name;button.append(canvas,title);
    button.onclick=()=>{group.choose(entry);if(!group.tools.includes(state.tool))configureTool(group.tool);sync(true)};
    gallery.append(button);return{button,canvas,index};
   });
  }
  for(const card of cards){const entry=items[card.index],active=entry.id===item.id;card.button.querySelector('span').textContent=entry.name;card.button.classList.toggle('chosen',active);card.button.setAttribute('aria-pressed',String(active));paintPlacementPreview(card.canvas,specs[card.index],getImage)}
  const spec=group.spec(item);if(groupId==='furniture'||groupId==='custom-assets')spec.row=state.tool.endsWith('-row');
  paintPlacementPreview($('placement-preview'),spec,getImage);
  $('placement-preview').setAttribute('aria-label','Vista previa de '+item.name);
  $('placement-preview-name').textContent=(groupId==='tree'&&$('tree-cycle').checked||groupId==='people'&&value('public-mode')!=='fixed'?'Siguiente modelo · ':'Elegido · ')+item.name;
  $('placement-preview-note').textContent=group.note||(groupId==='furniture'&&spec.row?'La fila muestra cinco elementos con la separación elegida. Su dirección la define el arrastre.':group.tools[0]==='select'?'Selecciona un edificio y pulsa Aplicar en sus ajustes cuando quieras añadir esta decoración.':'Elige una miniatura para activar ese elemento. La vista previa utiliza su dibujante del mapa.');
  $('placement-adjust').hidden=!group.adjust;
 }
 select.addEventListener('change',()=>{groupId=select.value;fingerprint='';const group=groups.find(g=>g.id===groupId);if(!group.tools.includes(state.tool))configureTool(group.tool);sync(true)});
 $('placement-adjust').onclick=()=>{const group=groups.find(g=>g.id===groupId),target=$(group.adjust);if(!target)return;const section=target.closest('details');if(section)section.open=true;target.scrollIntoView?.({block:'center',behavior:'smooth'});target.focus?.({preventScroll:true})};
 $('mobile-settings-panel').addEventListener('input',()=>sync());$('mobile-settings-panel').addEventListener('change',()=>sync());
 root.dataset.previewCount=String(groups.length);sync();return{sync,redraw:()=>sync(true),showCustom(){groupId='custom-assets';fingerprint='';sync(true)}};
}
