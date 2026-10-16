import {appendDrawingPoint,clearDrawing} from './editor-drawing-history.mjs';
import {snapPoint,surfaceRings,validSurface,validRing,surfaceArea,nearestSurfaceEdge,mergeSurfaces,splitSurface,subtractSurface,validateTextureSettings} from './map-geometry.mjs';
import {customAssetMaterial} from './custom-assets.mjs';
import {surfaceById,roofById} from './editor-materials.mjs';
import {surfaceTextureDefaults} from './surface-renderer.mjs';
import {textureMetresFor} from './editor-roof-raster.mjs';
import {assertEditable} from './editor-item-state.mjs';
export function setupPrecisionTools({state,getData,snapshot,changed,requestDraw,show,setSelection,configureTool,pixel,getZoom}){
 const panel=document.createElement('details');panel.id='precision-panel';panel.open=true;
 panel.innerHTML=`<summary>Dibujo preciso · medidas y superficies</summary><div class="stack">
 <div class="actions"><button id="precision-measure" type="button">Medir distancia / anchura</button><button id="precision-clear-measure" type="button">Quitar medida</button></div>
 <output id="precision-measure-value" class="notice">Marca dos puntos para medir en metros.</output>
 <label class="flag"><input id="precision-grid" type="checkbox"> Ajustar puntos a cuadrícula</label>
 <label>Paso de cuadrícula (m)<input id="precision-step" type="number" min=".01" max="5" step=".01" value=".10"></label>
 <label class="flag"><input id="precision-edges" type="checkbox"> Ajustar a vértices y bordes cercanos</label>
 <p class="muted">Mantén Alt para omitir el ajuste temporalmente. La cuadrícula no cambia la escala del mapa ni de las fotos.</p>
 <div class="precision-two"><label>X exacta (m)<input id="precision-x" type="number" step=".01" value="0"></label><label>Y exacta (m)<input id="precision-y" type="number" step=".01" value="0"></label></div>
 <button id="precision-point" type="button">Añadir punto / mover vértice elegido</button>
 <div class="actions"><button id="precision-add-vertex" type="button">Añadir vértice</button><button id="precision-remove-vertex" type="button">Eliminar vértice</button></div>
 <p class="muted">Selecciona una superficie. Puedes editar también los bordes de sus patios.</p>
 <div class="actions"><button id="precision-union" type="button">Unir superficies</button><button id="precision-split" type="button">Dividir con recta</button><button id="precision-hole" type="button">Recortar patio / hueco</button></div>
 <p class="muted">Unir requiere superficies de una misma capa y conserva el material de la primera. Para dividir, marca dos puntos: la recta se prolonga. Para un patio, dibuja y cierra el recorte con Enter.</p>
 <p id="precision-selection" class="notice">Sin superficie seleccionada.</p>
 <div class="line"></div><strong>Tamaño y orientación de la textura</strong>
 <div class="precision-two"><label>Ancho por imagen (m)<input id="precision-texture-width" type="number" min=".02" max="100" step=".01" value="1"></label><label>Fondo por imagen (m)<input id="precision-texture-depth" type="number" min=".02" max="100" step=".01" value="1"></label></div>
 <label>Giro de textura (°)<input id="precision-texture-angle" type="number" min="-360" max="360" step="1" value="0"></label>
 <label>Distribución<select id="precision-texture-mode"><option value="repeat">Repetir a tamaño real</option><option value="stretch">Ajustar una imagen a la superficie</option></select></label>
 <div class="actions"><button id="precision-texture-apply" type="button">Aplicar textura ajustada</button><button id="precision-texture-reset" type="button">Tamaño original</button></div>
 <p class="muted">Se aplica a las superficies seleccionadas. Sin selección, prepara el próximo trazado. Las medidas corresponden a la imagen completa, que puede contener varias baldosas o tejas.</p>
 </div>`;
 document.querySelector('.sidebar').prepend(panel);
 const $=id=>document.getElementById(id),tools=new Set(['measure','split','hole','vertex-add','vertex-remove']);
 let measure=[],cut=[],snap=null;
 const guard=fn=>(...args)=>{try{return fn(...args)}catch(error){show(error.message,'error');return true}};
 const selected=()=>state.selectedItems.filter(s=>['roads','sidewalks','houses'].includes(s.type)&&getData()?.[s.type]?.[s.index]);
 const one=()=>{const items=selected();assertEditable(getData(),items);if(items.length!==1)throw Error('Selecciona una sola calzada, acera o edificio.');const s=items[0];return{s,item:getData()[s.type][s.index]}};
 function markGeometry(){getData().metadata.precisionGeometry=true}
 function applyParts(s,parts){snapshot();markGeometry();getData()[s.type].splice(s.index,1,...parts);setSelection(parts.map((_,i)=>({type:s.type,index:s.index+i,vertex:-1})));changed()}
 function textureDefaults(s){
  const o=getData()[s.type][s.index],m=customAssetMaterial(o.material)||(s.type==='houses'?roofById(o.material||o.key):surfaceById(o.material,s.type));
  const standard=s.type==='houses'&&!m.assetId?{width:textureMetresFor(m),depth:textureMetresFor(m),angle:0,mode:'repeat'}:surfaceTextureDefaults(m);
  return{...standard,...o.texture};
 }
 function refresh(){
  const items=selected();$('precision-selection').textContent=items.length?items.length+' superficie(s) · '+items.reduce((sum,s)=>sum+surfaceArea(getData()[s.type][s.index]),0).toFixed(2)+' m²':'Selecciona calzada, acera o edificio para editar su contorno.';
  if(items.length===1){
   const s=items[0],o=getData()[s.type][s.index],ring=surfaceRings(o)[s.ring||0],p=ring?.[s.vertex];
   if(p){$('precision-x').value=p[0];$('precision-y').value=p[1]}
   const t=textureDefaults(s);for(const [field,value]of Object.entries(t)){const input=$('precision-texture-'+field);if(input)input.value=value}
  }
 }
 function exactPoint(){const p=[+$('precision-x').value,+$('precision-y').value];if(!p.every(Number.isFinite)||p.some(n=>Math.abs(n)>100000))throw Error('Escribe coordenadas válidas.');return p}
 function updateVertex(s,point){
  const o=getData()[s.type][s.index],candidate=structuredClone(o),ring=surfaceRings(candidate)[s.ring||0];
  if(!ring?.[s.vertex])throw Error('Selecciona un vértice del contorno.');ring[s.vertex]=point;
  if(!validSurface(candidate))throw Error('Ese punto cruza bordes o deja un patio fuera del edificio.');snapshot();markGeometry();getData()[s.type][s.index]=candidate;changed();refresh();
 }
 function insertVertex(point){
  const {s,item}=one(),near=nearestSurfaceEdge(item,point);if(!near||near.distance>14/getZoom())throw Error('Pulsa cerca del borde donde quieres añadir el vértice.');
  const candidate=structuredClone(item),ring=surfaceRings(candidate)[near.ring];ring.splice(near.vertex+1,0,near.point);
  if(!validSurface(candidate))throw Error('Ese vértice coincide con una esquina existente.');snapshot();markGeometry();getData()[s.type][s.index]=candidate;setSelection([{...s,ring:near.ring,vertex:near.vertex+1}]);changed();refresh();
 }
 function removeVertex(s){
  const item=getData()[s.type]?.[s.index],candidate=structuredClone(item),ring=surfaceRings(candidate)[s.ring||0];
  if(!ring?.[s.vertex])throw Error('Pulsa el vértice que quieres eliminar.');if(ring.length<=3)throw Error('Un contorno necesita al menos tres vértices.');ring.splice(s.vertex,1);
  if(!validSurface(candidate))throw Error('No se puede eliminar: quedaría un contorno o patio no válido.');snapshot();markGeometry();getData()[s.type][s.index]=candidate;setSelection([{...s,vertex:-1}]);changed();refresh();
 }
 function activate(tool){if(tool!=='measure')one();cut=[];configureTool(tool);show({measure:'Marca dos puntos para medir distancia o anchura.',split:'Marca dos puntos de la recta que dividirá la superficie.',hole:'Dibuja el patio o hueco y pulsa Enter para cerrar.', 'vertex-add':'Pulsa sobre un borde para añadir un vértice.','vertex-remove':'Pulsa sobre una esquina para eliminar ese vértice.'}[tool]);}
 $('precision-measure').onclick=()=>{measure=[];activate('measure')};$('precision-clear-measure').onclick=()=>{measure=[];$('precision-measure-value').textContent='Marca dos puntos para medir en metros.';requestDraw(true)};
 for(const id of ['precision-grid','precision-step','precision-edges'])$(id).addEventListener('input',()=>{if($('precision-grid').checked)$('grid-on').checked=true;requestDraw()});
 $('precision-add-vertex').onclick=guard(()=>activate('vertex-add'));$('precision-remove-vertex').onclick=guard(()=>{const {s}=one();if(s.vertex>=0)removeVertex(s);else activate('vertex-remove')});
 $('precision-split').onclick=guard(()=>activate('split'));$('precision-hole').onclick=guard(()=>activate('hole'));
 $('precision-union').onclick=guard(()=>{
  const items=selected();assertEditable(getData(),items);if(items.length<2||new Set(items.map(s=>s.type)).size!==1)throw Error('Selecciona dos o más superficies de la misma capa.');
  const kind=items[0].type,parts=mergeSurfaces(items.map(s=>getData()[kind][s.index]));snapshot();markGeometry();for(const s of [...items].sort((a,b)=>b.index-a.index))getData()[kind].splice(s.index,1);
  const start=getData()[kind].length;getData()[kind].push(...parts);setSelection(parts.map((_,i)=>({type:kind,index:start+i,vertex:-1})));changed();refresh();show('Unión aplicada. Se conserva el material de la primera superficie.','good');
 });
 $('precision-point').onclick=guard(()=>{
  const p=exactPoint();if(['road','sidewalk','house','hole'].includes(state.tool)){appendDrawingPoint(state,p);requestDraw(true);show('Punto exacto añadido.','good')}
  else{const {s}=one();updateVertex(s,p)}
 });
 const readTexture=()=>validateTextureSettings({width:+$('precision-texture-width').value,depth:+$('precision-texture-depth').value,angle:+$('precision-texture-angle').value,mode:$('precision-texture-mode').value});
 $('precision-texture-apply').onclick=guard(()=>{const t=readTexture(),items=selected();assertEditable(getData(),items);if(items.length){snapshot();for(const s of items)getData()[s.type][s.index].texture={...t};changed()}else state.pendingTexture=t;show(items.length?'Textura ajustada en '+items.length+' superficies.':'Textura preparada para el próximo polígono.','good');requestDraw()});
 $('precision-texture-reset').onclick=guard(()=>{const items=selected();assertEditable(getData(),items);if(items.length){snapshot();for(const s of items)delete getData()[s.type][s.index].texture;changed()}delete state.pendingTexture;refresh();show('Tamaño y giro originales de la textura restaurados.','good')});
 function snapped(p,event){
  const relevant=tools.has(state.tool)||['road','sidewalk','house','custom','custom-row'].includes(state.tool)||state.drag?.action==='select'&&state.drag.selection?.vertex>=0;
  if(!relevant||event?.altKey){snap=null;return p}
  snap=snapPoint(p,getData(),{grid:$('precision-grid').checked,step:+$('precision-step').value,edges:$('precision-edges').checked,tolerance:10/getZoom(),exclude:state.drag?.selection});return snap.point;
 }
 const down=guard(p=>{
  if(!tools.has(state.tool))return false;
  if(state.tool==='measure'){
   if(measure.length===2)measure=[];measure.push([...p]);if(measure.length===2){const dx=measure[1][0]-measure[0][0],dy=measure[1][1]-measure[0][1];$('precision-measure-value').textContent=Math.hypot(dx,dy).toFixed(3)+' m · ΔX '+Math.abs(dx).toFixed(3)+' · ΔY '+Math.abs(dy).toFixed(3)}requestDraw(true);return true;
  }
  if(state.tool==='vertex-add'){insertVertex(p);return true}
  if(state.tool==='vertex-remove'){
   const {s,item}=one();let near=null;for(const [ringIndex,ring]of surfaceRings(item).entries())for(const [vertex,q]of ring.entries()){const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(!near||d<near.distance)near={ring:ringIndex,vertex,distance:d}}if(!near||near.distance>14/getZoom())throw Error('Pulsa cerca de una esquina.');removeVertex({...s,...near});return true;
  }
  if(state.tool==='split'){cut.push([...p]);if(cut.length===2){const points=cut;cut=[];requestDraw(true);const {s,item}=one(),parts=splitSurface(item,...points);applyParts(s,parts);configureTool('select');show('Superficie dividida.','good')}requestDraw(true);return true}
  if(state.tool==='hole'){if(state.working.length>=3&&Math.hypot(p[0]-state.working[0][0],p[1]-state.working[0][1])<10/getZoom())finish();else appendDrawingPoint(state,p);requestDraw(true);return true}
  return false;
 });
 const finish=guard(()=>{
  if(state.tool!=='hole')return false;const {s,item}=one();if(!validRing(state.working))throw Error('El patio necesita al menos tres puntos y un contorno sin cruces.');
  const parts=subtractSurface(item,state.working);if(!parts.length)throw Error('El recorte eliminaría toda la superficie.');if(Math.abs(parts.reduce((sum,p)=>sum+surfaceArea(p),0)-surfaceArea(item))<.00001)throw Error('El recorte no toca la superficie seleccionada.');
  applyParts(s,parts);clearDrawing(state);configureTool('select');show('Patio o hueco recortado. El suelo y las colisiones respetarán el contorno.','good');return true;
 });
 function overlay(ctx){
  const line=points=>{if(points.length<2)return;ctx.beginPath();points.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.stroke()};
  ctx.save();ctx.strokeStyle='#ffd178';ctx.lineWidth=2;ctx.setLineDash([7,4]);
  const live=state.mouseWorld;if(measure.length)line(measure.length===2?measure:live?[measure[0],live]:measure);if(cut.length&&live)line([cut[0],live]);
  if(measure.length===2){const p=pixel((measure[0][0]+measure[1][0])/2,(measure[0][1]+measure[1][1])/2);ctx.font='bold 13px system-ui';ctx.fillStyle='#fff0c6';ctx.textAlign='center';ctx.fillText(Math.hypot(measure[1][0]-measure[0][0],measure[1][1]-measure[0][1]).toFixed(3)+' m',p[0],p[1]-10)}
  if(snap?.kind){ctx.setLineDash([]);ctx.strokeStyle=snap.kind==='grid'?'#c4f1df':'#5af5ee';const p=pixel(...snap.point);ctx.strokeRect(p[0]-5,p[1]-5,10,10)}ctx.restore();
 }
 refresh();return{snap:snapped,down,finish,overlay,refresh,cancel(){cut=[];snap=null},uses:tool=>tools.has(tool)};
}
