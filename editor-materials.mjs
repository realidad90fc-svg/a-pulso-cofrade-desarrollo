import {paintWorldSurface} from './surface-renderer.mjs';
import {textureImage} from './seville-textures.mjs';
import {customAssetMaterial} from './custom-assets.mjs';
import {traceSurface} from './map-geometry.mjs';
import {renderInsetRoof} from './editor-roof-render.mjs';
import {REALISTIC_ROOFS} from './editor-roof-variants.mjs';
export {REALISTIC_ROOFS} from './editor-roof-variants.mjs';
import {SEVILLE_ROAD_MATERIALS,SEVILLE_SIDEWALK_MATERIALS,paintSevilleSurface} from './editor-seville-surfaces.mjs';
import {SEVILLA_ROOFS,SEVILLA_NEIGHBOURHOOD_ROOFS,SEVILLA_ROOFS_BY_FAMILY,residentialSeed} from './editor-residential-roofs.mjs';
export {SEVILLA_ROOFS,SEVILLA_NEIGHBOURHOOD_ROOFS,SEVILLA_ROOFS_BY_FAMILY,residentialSeed} from './editor-residential-roofs.mjs';
import {TEMPLE_ROOF_MATERIALS,drawTempleRoof} from './editor-temple-roofs.mjs';
export {TEMPLE_ROOF_MATERIALS} from './editor-temple-roofs.mjs';
// Visual-only editor material library. Keeps all native game assets untouched.
// Roof variants reuse original Chicotaz sprites with weathering and tile/terrace treatments.
export const NATIVE_ROOF_IDS=[569,416,463,480,495,562,566,581,554];
const roofModes=[
 {name:'Teja tradicional',filter:'none',tint:null,detail:'ridge'},
 {name:'Teja envejecida',filter:'sepia(.34) saturate(.7) brightness(.83)',tint:'rgba(87,48,35,.17)',detail:'tiles'},
 {name:'Cubierta clara',filter:'sepia(.35) saturate(.60) brightness(1.25)',tint:'rgba(233,218,181,.16)',detail:'terrace'},
 {name:'Cubierta oscura',filter:'saturate(.65) hue-rotate(12deg) brightness(.70)',tint:'rgba(45,39,45,.17)',detail:'parapet'}
];
export const ROOF_MATERIALS=NATIVE_ROOF_IDS.flatMap((id,i)=>roofModes.map((v,j)=>({
 id:'roof-'+i+'-'+j,key:'sharedassets2.assets:'+id,name:v.name+' · '+(i+1),
 family:j,filter:v.filter,tint:v.tint,detail:v.detail
})));
// Stylized, top-down Sevillian landmark roofs. Unlike flat recolors these
// are drawn as distinct plans, compatible with the editor and gameplay bridge.
// Existing 36 native styles retain their IDs for old saved maps.
export const LANDMARK_ROOF_MATERIALS=[
 {id:'landmark-catedral',name:'Catedral de Sevilla',landmark:'cathedral',description:'Naves, crucero y bóvedas góticas',key:'sharedassets2.assets:569',group:'landmark'},
 {id:'landmark-giralda',name:'La Giralda',landmark:'giralda',description:'Torre almohade y cuerpo de campanas',key:'sharedassets2.assets:416',group:'landmark'},
 {id:'landmark-torre-oro',name:'Torre del Oro',landmark:'goldTower',description:'Planta dodecagonal y linterna',key:'sharedassets2.assets:463',group:'landmark'},
 {id:'landmark-salvador',name:'Iglesia del Salvador',landmark:'salvador',description:'Cubiertas de teja y nave central',key:'sharedassets2.assets:480',group:'landmark'},
 {id:'landmark-santa-ana',name:'Santa Ana de Triana',landmark:'santaAna',description:'Naves mudéjares, teja y aleros',key:'sharedassets2.assets:495',group:'landmark'},
 {id:'landmark-baratillo',name:'Capilla del Baratillo',landmark:'baratillo',description:'Capilla encalada, tejas y espadaña',key:'sharedassets2.assets:562',group:'landmark'},
 {id:'landmark-maestranza',name:'Real Maestranza',landmark:'maestranza',description:'Graderío anular en torno al ruedo',key:'sharedassets2.assets:566',group:'landmark'},
 {id:'landmark-archivo-indias',name:'Archivo de Indias',landmark:'archivo',description:'Cuatro crujías y patio interior',key:'sharedassets2.assets:581',group:'landmark'},
 {id:'landmark-san-telmo',name:'Palacio de San Telmo',landmark:'sanTelmo',description:'Tejados palaciegos y patio central',key:'sharedassets2.assets:554',group:'landmark'},
 {id:'landmark-alcazar',name:'Real Alcázar',landmark:'alcazar',description:'Cubiertas, patios y alicatados mudéjares',key:'sharedassets2.assets:569',group:'landmark'}
];
function drawLandmarkRoof(ctx,m,p,w,h){
 if(!(w>0&&h>0))return;
 ctx.save();ctx.translate(p[0],p[1]);ctx.scale(w,h);
 const fill=(x,y,ww,hh,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,ww,hh)};
 const border=(x,y,ww,hh,color='#755e47',line=.014)=>{
  ctx.strokeStyle=color;ctx.lineWidth=line;ctx.strokeRect(x,y,ww,hh)
 };
 const ellipse=(x,y,rx,ry,color,stroke=null,width=.014)=>{
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,2*Math.PI);
  ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
 };
 const roof=(x,y,ww,hh,color='#b76e4e')=>{
  fill(x,y,ww,hh,color);border(x,y,ww,hh,'#6e4738',.009);
  ctx.strokeStyle='rgba(248,207,160,.6)';ctx.lineWidth=.007;
  for(let k=y+.035;k<y+hh-.012;k+=.06){ctx.beginPath();ctx.moveTo(x+.008,k);ctx.lineTo(x+ww-.008,k);ctx.stroke()}
  ctx.strokeStyle='#80503e';ctx.lineWidth=.014;ctx.beginPath();
  ctx.moveTo(x+ww/2,y+.01);ctx.lineTo(x+ww/2,y+hh-.01);ctx.stroke()
 };
 const blocks=(x,y,ww,hh,nx,ny)=>{
  ctx.strokeStyle='rgba(92,74,52,.29)';ctx.lineWidth=.004;
  for(let i=1;i<nx;i++){let z=x+i*ww/nx;ctx.beginPath();ctx.moveTo(z,y);ctx.lineTo(z,y+hh);ctx.stroke()}
  for(let j=1;j<ny;j++){let z=y+j*hh/ny;ctx.beginPath();ctx.moveTo(x,z);ctx.lineTo(x+ww,z);ctx.stroke()}
 };
 const polygon=(x,y,r,n,color,stroke='#76583c')=>{
  ctx.beginPath();
  for(let i=0;i<n;i++){let a=-Math.PI/2+2*Math.PI*i/n,q=[x+Math.cos(a)*r,y+Math.sin(a)*r];i?ctx.lineTo(...q):ctx.moveTo(...q)}
  ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=.013;ctx.stroke()
 };
 const shine=()=>{ctx.strokeStyle='rgba(255,244,210,.65)';ctx.lineWidth=.012;ctx.strokeRect(.025,.025,.95,.95)};
 switch(m.landmark){
  case 'cathedral':
   fill(0,0,1,1,'#baaa86');blocks(0,0,1,1,11,7);
   fill(.14,.12,.72,.76,'#c9b997');border(.14,.12,.72,.76,'#78684c',.022);
   fill(.34,.08,.32,.84,'#dac8a0');fill(.08,.36,.84,.28,'#d0be9c');
   for(let i=0;i<7;i++)for(let j=0;j<3;j++){
    let x=.38+j*.105,y=.14+i*.102;
    border(x,y,.085,.082,'#907a56',.007);
    ctx.strokeStyle='#9d8868';ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.085,y+.082);ctx.moveTo(x+.085,y);ctx.lineTo(x,y+.082);ctx.stroke()
   }
   fill(.39,.4,.22,.2,'#a99571');border(.39,.4,.22,.2,'#68573f',.016);
   shine();break;
  case 'giralda':
   fill(0,0,1,1,'#af8154');blocks(0,0,1,1,6,6);
   fill(.13,.13,.74,.74,'#cea06d');border(.13,.13,.74,.74,'#674f3b',.032);
   for(let i=0;i<4;i++){fill(.24+i*.145,.15,.065,.11,'#69563f');fill(.24+i*.145,.74,.065,.11,'#69563f')}
   for(let i=0;i<4;i++){fill(.15,.24+i*.145,.11,.065,'#69563f');fill(.74,.24+i*.145,.11,.065,'#69563f')}
   fill(.29,.29,.42,.42,'#dec493');border(.29,.29,.42,.42,'#795b41',.026);
   polygon(.5,.5,.17,8,'#b78a58','#745337');ellipse(.5,.5,.062,.062,'#f4d38d','#755637');
   shine();break;
  case 'goldTower':
   fill(0,0,1,1,'#827a63');polygon(.5,.5,.47,12,'#b4a076');
   polygon(.5,.5,.39,12,'#d7c391');polygon(.5,.5,.3,12,'#b59d6d');
   for(let i=0;i<12;i++){let a=-Math.PI/2+i*Math.PI/6;ctx.strokeStyle='#886f4b';ctx.lineWidth=.018;ctx.beginPath();ctx.moveTo(.5+Math.cos(a)*.18,.5+Math.sin(a)*.18);ctx.lineTo(.5+Math.cos(a)*.43,.5+Math.sin(a)*.43);ctx.stroke()}
   polygon(.5,.5,.19,12,'#e4c987');ellipse(.5,.5,.07,.07,'#9d7a4b','#6f5137');break;
  case 'salvador':
   fill(0,0,1,1,'#e0c99f');roof(.1,.12,.27,.76,'#b65d42');roof(.63,.12,.27,.76,'#b25d43');
   roof(.36,.07,.28,.86,'#cb754a');fill(.36,.41,.28,.13,'#ddae78');
   for(let i=0;i<5;i++){border(.15,.18+i*.14,.17,.1,'#eee1be',.011);border(.69,.18+i*.14,.17,.1,'#eee1be',.011)}
   shine();break;
  case 'santaAna':
   fill(0,0,1,1,'#e1d2ad');
   roof(.08,.1,.26,.8,'#bc6647');roof(.37,.1,.26,.8,'#cd8153');roof(.66,.1,.26,.8,'#ad5a43');
   for(let i=0;i<8;i++){ctx.strokeStyle='#e8cfab';ctx.lineWidth=.01;ctx.beginPath();ctx.moveTo(.08,.14+i*.1);ctx.lineTo(.92,.14+i*.1);ctx.stroke()}
   fill(.33,.06,.34,.085,'#e5bf83');fill(.33,.86,.34,.085,'#e5bf83');shine();break;
  case 'baratillo':
   fill(0,0,1,1,'#f0e3c9');border(.045,.045,.91,.91,'#ad916c',.025);
   roof(.18,.13,.64,.65,'#b86b49');fill(.1,.78,.8,.16,'#f5ead1');
   fill(.41,.78,.18,.11,'#c6a777');border(.41,.78,.18,.11,'#8a7051');
   fill(.455,.8,.09,.08,'#e3cf9c');
   ellipse(.5,.17,.095,.095,'#e4c98f','#745e46');ellipse(.5,.17,.043,.043,'#866549');
   shine();break;
  case 'maestranza':
   fill(0,0,1,1,'#e6d2b0');
   ellipse(.5,.5,.47,.43,'#e9e0c7','#b39a7a',.027);
   ellipse(.5,.5,.39,.35,'#9d865f','#554636',.015);
   ellipse(.5,.5,.34,.3,'#c3aa81','#8b795c',.015);
   ellipse(.5,.5,.26,.23,'#e7c38b','#d3a971',.014);
   for(let i=0;i<24;i++){const a=i*Math.PI/12;ctx.strokeStyle='#f0e5cb';ctx.lineWidth=.008;ctx.beginPath();ctx.moveTo(.5+Math.cos(a)*.35,.5+Math.sin(a)*.31);ctx.lineTo(.5+Math.cos(a)*.45,.5+Math.sin(a)*.4);ctx.stroke()}
   break;
  case 'archivo':
   fill(0,0,1,1,'#ddc8a5');roof(.05,.05,.9,.21,'#a96446');roof(.05,.74,.9,.21,'#ab6645');
   roof(.05,.24,.21,.52,'#c1794e');roof(.74,.24,.21,.52,'#bd724b');
   fill(.27,.27,.46,.46,'#e6d7b9');border(.27,.27,.46,.46,'#866b4f',.022);
   fill(.31,.31,.38,.38,'#c7bd9e');blocks(.31,.31,.38,.38,5,5);
   shine();break;
  case 'sanTelmo':
   fill(0,0,1,1,'#edd7b5');roof(.08,.08,.84,.22,'#bc744e');
   roof(.08,.7,.84,.22,'#b46a49');roof(.08,.28,.22,.44,'#c47a55');roof(.70,.28,.22,.44,'#b76f50');
   fill(.33,.33,.34,.34,'#d7c8a7');border(.33,.33,.34,.34,'#927c62',.023);
   fill(.47,.3,.06,.4,'#a6b1a2');fill(.33,.47,.34,.06,'#a6b1a2');
   ellipse(.5,.5,.082,.082,'#e9ce9a','#95744f');shine();break;
  case 'alcazar':
   fill(0,0,1,1,'#d3c0a0');roof(.06,.06,.37,.25,'#c78353');roof(.57,.06,.37,.25,'#b66e48');
   roof(.06,.67,.37,.27,'#bb6848');roof(.57,.67,.37,.27,'#cb8752');
   roof(.06,.32,.18,.34,'#c58152');roof(.76,.32,.18,.34,'#c58152');
   fill(.26,.33,.48,.33,'#e5d9be');border(.26,.33,.48,.33,'#856d50',.017);
   fill(.31,.38,.38,.23,'#67938c');border(.31,.38,.38,.23,'#d6c699');
   ellipse(.5,.5,.04,.04,'#f2e3c8','#a08768');
   for(let i=0;i<4;i++){ellipse(.12+i*.24,.16,.028,.026,'#4c7d53');ellipse(.12+i*.24,.84,.028,.026,'#4c7d53')}shine();break;
 }
 ctx.restore();
}
const surfaces=[
 ['Asfalto clásico','#45474a','#6e6c6a','asphalt'],
 ['Asfalto renovado','#34383d','#4c5156','asphalt'],
 ['Asfalto desgastado','#696a68','#90908a','asphalt'],
 ['Piedra gris','#97938b','#bcb8b0','slabs'],
 ['Adoquín antiguo','#82756b','#b6aaa0','cobbles'],
 ['Adoquín rojizo','#876a62','#aa8a80','cobbles'],
 ['Granito claro','#b1b1a8','#d0cfc3','slabs'],
 ['Losas albero','#b5a383','#dfcfaa','slabs'],
 ['Pavimento cálido','#a6947f','#c9baa1','cobbles'],
 ['Hormigón','#868886','#adaeac','concrete'],
 ['Piedra irregular','#99918a','#c1b8aa','stone'],
 ['Piedra oscura','#686664','#8d8984','stone'],
];
export const ROAD_MATERIALS=[{id:'road-art-granite',name:'Piedra sevillana · textura ilustrada',base:'#8b867e',light:'#b7b1a6',pattern:'art-granite'},...surfaces.map((v,i)=>({id:'road-'+i,name:v[0],base:v[1],light:v[2],pattern:v[3]})),...SEVILLE_ROAD_MATERIALS];
const pavements=[
 ['Baldosa sevillana','#d0c4ad','#a59a89','tiles'],
 ['Acerado crema','#d7cbb9','#aea18e','slabs'],
 ['Acerado gris','#b8b5af','#8f8c87','slabs'],
 ['Acerado piedra','#a8a59b','#77766f','stone'],
 ['Baldosa rojiza','#bc9b91','#936e66','tiles'],
 ['Baldosa beige','#c1b29d','#968773','tiles'],
 ['Mármol envejecido','#cbc9bd','#99968e','slabs'],
 ['Granito claro','#cac7bb','#ada79b','stone'],
 ['Loseta antigua','#adacaa','#797776','tiles'],
 ['Adoquín peatonal','#bbb0a2','#888176','cobbles'],
 ['Hormigón lavado','#b9b7b1','#93908a','concrete'],
 ['Acerado amarillo','#c7b793','#9a8a6c','tiles'],
];
export const SIDEWALK_MATERIALS=[{id:'sidewalk-art-caliza',name:'Caliza sevillana · textura ilustrada',base:'#cfbea2',light:'#ecdec4',pattern:'art-caliza'},...pavements.map((v,i)=>({id:'sidewalk-'+i,name:v[0],base:v[1],light:v[2],pattern:v[3]})),...SEVILLE_SIDEWALK_MATERIALS];
export const TREE_VARIANTS=[
 {id:'tree-0',name:'Árbol original · copa ancha',tone:'#426a3e',shape:'round'},
 {id:'tree-1',name:'Naranjo · azahar de primavera',tone:'#356646',shape:'round',texture:'tree-naranjo'},
 {id:'tree-2',name:'Plátano de sombra · brotación',tone:'#5c7846',shape:'lobed',texture:'tree-platano'},
 {id:'tree-3',name:'Ficus · copa densa',tone:'#28543f',shape:'cluster',texture:'tree-ficus'},
 {id:'tree-4',name:'Palmera',tone:'#547353',shape:'palm',texture:'tree-palmera'},
 {id:'tree-5',name:'Árbol pequeño',tone:'#769059',shape:'small',texture:'tree-pequeno'},
 {id:'tree-6',name:'Ciprés ornamental',tone:'#395341',shape:'slim',texture:'tree-cipres'},
 {id:'tree-7',name:'Árbol de sombra claro',tone:'#688551',shape:'lobed',texture:'tree-sombra'}
];
const asPoly=poly=>poly&&poly.length>=3;
const polygonPath=(ctx,poly,pixel)=>{
 ctx.beginPath();poly.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();
};
const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
export const roofById=id=>customAssetMaterial(id)||REALISTIC_ROOFS.find(m=>m.id===id)||SEVILLA_ROOFS.find(m=>m.id===id)||TEMPLE_ROOF_MATERIALS.find(m=>m.id===id)||LANDMARK_ROOF_MATERIALS.find(m=>m.id===id)||ROOF_MATERIALS.find(m=>m.id===id)||ROOF_MATERIALS.find(m=>m.key===id)||ROOF_MATERIALS[0];
export const surfaceById=(id,kind='roads')=>{
 const list=kind==='sidewalks'?SIDEWALK_MATERIALS:ROAD_MATERIALS;
 return customAssetMaterial(id)||list.find(m=>m.id===id)||list[0];
};
export function drawRoof(ctx,poly,material,pixel,getImage,zoom,options={}){
 const custom=customAssetMaterial(material);
 if(custom)return paintWorldSurface(ctx,poly,custom,pixel,null,options);
 const m=roofById(material);
 ctx.save();if(options.holes?.length){traceSurface(ctx,{poly,holes:options.holes},pixel);ctx.clip('evenodd')}
 const result=renderInsetRoof(ctx,poly,m,pixel,zoom,options,(item,top,w,h)=>{
  if(item.temple)drawTempleRoof(ctx,item,top,w,h);
  else if(item.landmark)drawLandmarkRoof(ctx,item,top,w,h);
 });ctx.restore();return result;
}
// Lines are anchored to world coordinates rather than the viewport edge.
// Both editor pixels/metro and the game's world-unit camera now use the
// same slab/cobble dimensions. No fixed 7px/0.7-world-unit minimum.
function lineGridWorld(ctx,pixel,box,dx,dy,alpha){
 const [x0,y0,x1,y1]=box;
 if(!(x1>x0&&y1>y0))return;
 const t=pixel(x0,y0),q=pixel(x1,y0);
 const z=Math.max(.00001,Math.hypot(q[0]-t[0],q[1]-t[1])/(x1-x0));
 ctx.save();ctx.strokeStyle='rgba(27,26,26,'+alpha+')';ctx.lineWidth=.012*z;
 let count=0;const limit=14000;
 const nx=Math.ceil((x1-x0)/dx),ny=Math.ceil((y1-y0)/dy);
 const skip=Math.max(1,Math.ceil(Math.sqrt(Math.max(1,(nx+ny))/limit)));
 for(let i=Math.floor(x0/dx);i<=Math.ceil(x1/dx);i+=skip){
  if(++count>limit)break;
  const x=i*dx,a=pixel(x,y0),b=pixel(x,y1);
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
 }
 for(let j=Math.floor(y0/dy);j<=Math.ceil(y1/dy);j+=skip){
  if(++count>limit)break;
  const y=j*dy,a=pixel(x0,y),b=pixel(x1,y);
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
 }
 ctx.restore();
}
export function drawSurface(ctx,poly,kind,materialId,pixel,zoom,baseFloor,visible=null,options={}){
 const m=customAssetMaterial(materialId)||surfaceById(materialId,kind);
 return paintWorldSurface(ctx,poly,m,pixel,visible,options);
}
// The editor zoom is pixels/world-unit, but the game draws in world units
// through its camera transform. Never impose a screen-pixel minimum on world units.
export function treeDrawRadius(tree,zoom=1){
 if(tree?.size)return Math.max(...tree.size)/2*Math.max(.00001,zoom);
 const radius=Number.isFinite(tree?.radius)?tree.radius:.35;
 const scale=Number.isFinite(tree?.scale)?tree.scale:1;
 return Math.max(.125,radius*scale)*Math.max(.00001,Number.isFinite(zoom)?zoom:1);
}
export function drawTree(ctx,tree,pixel,zoom,getImage){
 const variant=TREE_VARIANTS.find(m=>m.id===tree.variant)||TREE_VARIANTS[0],p=pixel(...tree.point),
   r=treeDrawRadius(tree,zoom),a=(tree.rotation||0)*Math.PI/180;
 ctx.save();ctx.translate(...p);ctx.rotate(-a);
 const original=getImage?.('sharedassets2.assets:563');
 const image=textureImage(variant.texture)||original;
 // Every view uses the same raster crown; the original is also the fallback
 // while a texture loads. Existing map IDs, positions and collision radii stay valid.
 if(image&&(image.naturalWidth||image.width)>0){
  ctx.imageSmoothingEnabled=variant.id!=='tree-0';ctx.imageSmoothingQuality='high';
  const w=tree.size?tree.size[0]*zoom:r*2,d=tree.size?tree.size[1]*zoom:r*2;ctx.drawImage(image,-w/2,-d/2,w,d);
 }
 ctx.restore();
}
export function drawFurniture(ctx,item,type,pixel,zoom,selected=false){
 if(zoom<8){
  ctx.save();ctx.scale(1/96,1/96);
  drawFurniture(ctx,item,type,(x,y)=>pixel(x,y).map(v=>v*96),zoom*96,selected);ctx.restore();return;
 }
 const [x,y]=pixel(...item.point),angle=(item.angle||0)*Math.PI/180;
 const w=Math.max(.0001,zoom*(item.width|| (type==='fence'?.95:.40))),d=Math.max(.0001,zoom*(item.depth||(type==='fence'?.18:.43)));
 ctx.save();ctx.translate(x,y);ctx.rotate(-angle);
 ctx.lineWidth=Math.max(.0001,zoom*.028);
 if(type==='fence'){
  // A continuous red rail in plan view; all joints stay inside the rail.
  const rail=d*.50;
  ctx.fillStyle='#762522';ctx.fillRect(-w/2,-rail/2,w,rail);
  ctx.fillStyle='#b9332c';ctx.fillRect(-w/2,-rail*.40,w,rail*.68);
  ctx.fillStyle='#de6751';ctx.fillRect(-w/2,-rail*.40,w,rail*.15);
  const bars=Math.max(1,Math.ceil((item.width||.95)/.32));
  for(let i=1;i<bars;i++){const xx=-w/2+i*w/bars;ctx.fillStyle='#8e2925';ctx.fillRect(xx-zoom*.006,-rail/2,zoom*.012,rail);}
 }else{
  // Folding wooden Carrera Oficial chair. Keep the saved .40 x .43 m footprint
  // and orientation: the backrest is at negative screen Y in every view.
  const image=textureImage('chair-carrera'),iw=image?.naturalWidth||image?.width,ih=image?.naturalHeight||image?.height;
  if(iw>0&&ih>0){
   const fit=Math.min(w/iw,d/ih);
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   if(item.edit?.resized)ctx.drawImage(image,-w/2,-d/2,w,d);else ctx.drawImage(image,-iw*fit/2,-ih*fit/2,iw*fit,ih*fit);
  }else{
   // A recognisable slatted wooden chair also remains visible while loading.
   ctx.save();ctx.scale(w,d);ctx.lineWidth=.018;ctx.strokeStyle='#71401d';
   const wood=(x,y,width,height,tone)=>{
    const grain=ctx.createLinearGradient(x,y,x,y+height);
    grain.addColorStop(0,'#dfaa65');grain.addColorStop(.22,tone);grain.addColorStop(1,'#915625');
    ctx.fillStyle=grain;ctx.fillRect(x,y,width,height);ctx.strokeRect(x,y,width,height);
    ctx.strokeStyle='rgba(92,48,18,.23)';ctx.lineWidth=.006;ctx.beginPath();ctx.moveTo(x+.04,y+height*.55);ctx.lineTo(x+width-.04,y+height*.64);ctx.stroke();
    ctx.strokeStyle='#71401d';ctx.lineWidth=.018;
   };
   wood(-.48,-.48,.08,.96,'#af722f');wood(.40,-.48,.08,.96,'#ad6b2a');
   wood(-.43,-.45,.86,.095,'#ba7c35');
   for(let i=0;i<6;i++){
    const y=-.20+i*.111;wood(-.40,y,.80,.092,i%2?'#c98a42':'#ce954e');
    ctx.fillStyle='#77716a';for(const x of [-.355,.355]){ctx.beginPath();ctx.arc(x,y+.045,.013,0,Math.PI*2);ctx.fill()}
   }
   ctx.restore();
  }
 }
 if(selected){ctx.strokeStyle='#51ebef';ctx.lineWidth=2;ctx.strokeRect(-w/2-3,-d/2-3,w+6,d+6)}
 ctx.restore();
}
