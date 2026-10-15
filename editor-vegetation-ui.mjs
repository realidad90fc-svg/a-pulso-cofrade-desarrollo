import {TREE_VARIANTS,drawTree} from './editor-materials.mjs';
import {onTextureReady} from './seville-textures.mjs';
export function setupVegetationPreviews({state,getImage}){
 const $=id=>document.getElementById(id),gallery=$('tree-preview-gallery'),canvases=new Map();let fingerprint='';
 function paint(canvas,id,radius=.55,index=0,large=false){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,density=w/(large?288:164);
  c.clearRect(0,0,w,h);c.fillStyle='#c2bfae';c.fillRect(0,0,w,h);c.strokeStyle='rgba(95,101,81,.12)';c.lineWidth=1;
  for(let x=0;x<w;x+=24*density){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
  for(let y=0;y<h;y+=24*density){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  const scale=large?.88+(index%5)*.06:1,zoom=(large?Math.min(100,76/(radius*scale)):74)*density;
  drawTree(c,{point:[0,0],variant:id,radius,scale,rotation:large?(index*47)%360:0},(x,y)=>[w/2+x*zoom,h/2-y*zoom],zoom,getImage);
 }
 function sync(force=false){
  const cycling=$('tree-cycle').checked,variant=cycling?TREE_VARIANTS[state.treeIndex%TREE_VARIANTS.length]:TREE_VARIANTS.find(t=>t.id===state.treeVariant)||TREE_VARIANTS[0];
  const radius=Number($('tree-radius').value)||.35,next=[variant.id,radius,state.treeIndex,cycling].join(':');
  if(!force&&next===fingerprint)return;fingerprint=next;paint($('tree-preview'),variant.id,radius,state.treeIndex,true);
  $('tree-preview-name').textContent=(cycling?'Siguiente modelo · ':'Modelo elegido · ')+variant.name+' · radio '+radius.toFixed(2).replace('.',',')+' m';
  for(const card of gallery.querySelectorAll('[data-tree]')){const active=card.dataset.tree===variant.id;card.classList.toggle('chosen',active);card.setAttribute('aria-pressed',String(active))}
 }
 function choose(id){if(!TREE_VARIANTS.some(t=>t.id===id))return;state.treeVariant=id;$('tree-variant').value=id;$('tree-cycle').checked=false;sync(true)}
 for(const tree of TREE_VARIANTS){
  const button=document.createElement('button');button.type='button';button.className='decor-card';button.dataset.tree=tree.id;button.setAttribute('aria-label','Elegir '+tree.name);
  const canvas=document.createElement('canvas');canvas.width=328;canvas.height=200;paint(canvas,tree.id);canvases.set(tree.id,canvas);
  const label=document.createElement('span');label.textContent=tree.name;button.append(canvas,label);button.onclick=()=>choose(tree.id);gallery.append(button);
 }
 $('tree-variant').addEventListener('change',()=>choose($('tree-variant').value));$('tree-radius').addEventListener('input',()=>sync(true));$('tree-cycle').addEventListener('change',()=>sync(true));
 const redraw=()=>{for(const tree of TREE_VARIANTS)paint(canvases.get(tree.id),tree.id);sync(true)};
 onTextureReady(key=>{if(key.startsWith('tree-'))redraw()});
 sync();return{sync,redraw};
}
