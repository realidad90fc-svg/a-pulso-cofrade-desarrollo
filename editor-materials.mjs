import {renderInsetRoof} from './editor-roof-render.mjs';
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
export const ROAD_MATERIALS=[...surfaces.map((v,i)=>({id:'road-'+i,name:v[0],base:v[1],light:v[2],pattern:v[3]})),...SEVILLE_ROAD_MATERIALS];
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
export const SIDEWALK_MATERIALS=[...pavements.map((v,i)=>({id:'sidewalk-'+i,name:v[0],base:v[1],light:v[2],pattern:v[3]})),...SEVILLE_SIDEWALK_MATERIALS];
export const TREE_VARIANTS=[
 {id:'tree-0',name:'Árbol original · copa ancha',tone:'#426a3e',shape:'round'},
 {id:'tree-1',name:'Naranjo · copa redonda',tone:'#356646',shape:'round'},
 {id:'tree-2',name:'Plátano de sombra',tone:'#5c7846',shape:'lobed'},
 {id:'tree-3',name:'Ficus · copa densa',tone:'#28543f',shape:'cluster'},
 {id:'tree-4',name:'Palmera',tone:'#547353',shape:'palm'},
 {id:'tree-5',name:'Árbol pequeño',tone:'#769059',shape:'small'},
 {id:'tree-6',name:'Ciprés ornamental',tone:'#395341',shape:'slim'},
 {id:'tree-7',name:'Árbol de sombra claro',tone:'#688551',shape:'lobed'}
];
const asPoly=poly=>poly&&poly.length>=3;
const polygonPath=(ctx,poly,pixel)=>{
 ctx.beginPath();poly.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();
};
const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
export const roofById=id=>SEVILLA_ROOFS.find(m=>m.id===id)||TEMPLE_ROOF_MATERIALS.find(m=>m.id===id)||LANDMARK_ROOF_MATERIALS.find(m=>m.id===id)||ROOF_MATERIALS.find(m=>m.id===id)||ROOF_MATERIALS.find(m=>m.key===id)||ROOF_MATERIALS[0];
export const surfaceById=(id,kind='roads')=>{
 const list=kind==='sidewalks'?SIDEWALK_MATERIALS:ROAD_MATERIALS;
 return list.find(m=>m.id===id)||list[0];
};
export function drawRoof(ctx,poly,material,pixel,getImage,zoom,options={}){
 const m=roofById(material);
 return renderInsetRoof(ctx,poly,m,pixel,zoom,options,(item,top,w,h)=>{
  if(item.temple)drawTempleRoof(ctx,item,top,w,h);
  else if(item.landmark)drawLandmarkRoof(ctx,item,top,w,h);
 });
}
function lineGrid(ctx,x0,y0,x1,y1,stepX,stepY,vertical,alpha){
 ctx.save();ctx.strokeStyle='rgba(27,26,26,'+alpha+')';ctx.lineWidth=.7;
 for(let x=x0;x<x1;x+=stepX){ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);ctx.stroke()}
 for(let y=y0;y<y1;y+=stepY){ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()}
 ctx.restore();
}
export function drawSurface(ctx,poly,kind,materialId,pixel,zoom,baseFloor,visible=null){
 if(!asPoly(poly))return;
 const m=surfaceById(materialId,kind),b=bounds(poly);
 ctx.save();polygonPath(ctx,poly,pixel);ctx.clip();
 const p=pixel(b[0],b[3]);
 const area=visible?[Math.max(b[0],visible[0]),Math.max(b[1],visible[1]),Math.min(b[2],visible[2]),Math.min(b[3],visible[3])]:b;
 const region=area[2]>area[0]&&area[3]>area[1]?area:b;
 const top=pixel(region[0],region[3]),x0=top[0],y0=top[1],x1=x0+(region[2]-region[0])*zoom,y1=y0+(region[3]-region[1])*zoom;
 ctx.fillStyle=m.base;ctx.fillRect(x0,y0,x1-x0,y1-y0);
 const style=m.pattern,step=Math.max(7,zoom*(style==='cobbles'?.23:style==='tiles'?.42:style==='stone'?.67:1.15));
 // Sevilla-specific profiles use world-space joints, repeatable across
 // large maps and matching their own preview at the exact same scale.
 if(style.startsWith('sev-')){
  paintSevilleSurface(ctx,m,pixel,zoom,region);
  if(kind==='sidewalks'){
   ctx.lineWidth=Math.max(.022*zoom,.004);
   ctx.strokeStyle='rgba(244,230,204,.40)';
   polygonPath(ctx,poly,pixel);ctx.stroke();
  }
  ctx.restore();return;
 }
 // Keep the original floor sprite for asphalt, then overlay coordinated seams.
 if(kind==='roads'&&baseFloor&&(style==='asphalt'||style==='concrete')){
  ctx.imageSmoothingEnabled=false;
  const minX=Math.floor(region[0]),maxX=Math.ceil(region[2]),minY=Math.floor(region[1]),maxY=Math.ceil(region[3]);
  ctx.globalAlpha=style==='asphalt'?.24:.13;
  for(let x=minX;x<maxX;x++)for(let y=minY;y<maxY;y++){
   const a=pixel(x,y+1);ctx.drawImage(baseFloor,322,40,110,110,a[0],a[1],zoom,zoom);
  }
  ctx.globalAlpha=1;
 }
 if(style==='tiles'||style==='slabs'||style==='cobbles'||style==='stone'){
  lineGrid(ctx,x0,y0,x1,y1,step,style==='cobbles'?step*.52:step,0,style==='cobbles'?.28:.2);
  if(style==='cobbles'||style==='stone'){
   ctx.strokeStyle='rgba(238,225,206,.25)';ctx.lineWidth=.75;
   for(let y=y0+step/2;y<y1;y+=step){for(let x=x0+step/2;x<x1;x+=step*1.5){
    ctx.beginPath();ctx.moveTo(x,y-step*.22);ctx.lineTo(x+step*.22,y);ctx.stroke()
   }}
  }
 }
 if(kind==='sidewalks'){
  ctx.lineWidth=Math.max(1,zoom*.045);ctx.strokeStyle='rgba(244,230,204,.47)';
  polygonPath(ctx,poly,pixel);ctx.stroke();
 }
 ctx.restore();
}
// The editor zoom is pixels/world-unit, but the game draws in world units
// through its camera transform. Never impose a screen-pixel minimum on world units.
export function treeDrawRadius(tree,zoom=1){
 const radius=Number.isFinite(tree?.radius)?tree.radius:.35;
 const scale=Number.isFinite(tree?.scale)?tree.scale:1;
 return Math.max(.125,radius*scale)*Math.max(.00001,Number.isFinite(zoom)?zoom:1);
}
export function drawTree(ctx,tree,pixel,zoom,getImage){
 const variant=TREE_VARIANTS.find(m=>m.id===tree.variant)||TREE_VARIANTS[0],p=pixel(...tree.point),
   r=treeDrawRadius(tree,zoom),a=(tree.rotation||0)*Math.PI/180;
 ctx.save();ctx.translate(...p);ctx.rotate(-a);
 const original=getImage('sharedassets2.assets:563');
 if(variant.id==='tree-0'&&original){ctx.imageSmoothingEnabled=false;ctx.drawImage(original,-r,-r,r*2,r*2);ctx.restore();return}
 ctx.fillStyle='#47392c';ctx.beginPath();ctx.arc(0,0,r*.2,0,Math.PI*2);ctx.fill();
 ctx.shadowColor='rgba(0,0,0,.27)';ctx.shadowBlur=Math.max(.075*zoom,r*.22);
 ctx.fillStyle=variant.tone;ctx.strokeStyle='rgba(25,42,26,.75)';ctx.lineWidth=Math.max(.04*zoom,r*.08);
 if(variant.shape==='palm'){
  for(let i=0;i<9;i++){const t=i*Math.PI*2/9;ctx.save();ctx.rotate(t);ctx.beginPath();ctx.ellipse(r*.37,0,r*.47,r*.13,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore()}
 }else if(variant.shape==='lobed'||variant.shape==='cluster'){
  const n=variant.shape==='cluster'?8:5;
  for(let i=0;i<n;i++){const t=i*Math.PI*2/n;ctx.beginPath();ctx.arc(Math.cos(t)*r*.35,Math.sin(t)*r*.35,r*.52,0,Math.PI*2);ctx.fill();ctx.stroke()}
 }else{
  ctx.beginPath();ctx.ellipse(0,0,r*(variant.shape==='slim'?.4:1),r*(variant.shape==='small'?.7:1.03),0,0,Math.PI*2);ctx.fill();ctx.stroke();
 }
 ctx.shadowBlur=0;ctx.fillStyle='rgba(188,209,151,.22)';
 ctx.beginPath();ctx.ellipse(-r*.21,-r*.23,r*.22,r*.15,-.55,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
export function drawFurniture(ctx,item,type,pixel,zoom,selected=false){
 const [x,y]=pixel(...item.point),angle=(item.angle||0)*Math.PI/180;
 const w=Math.max(5,zoom*(item.width|| (type==='fence'?.95:.40))),d=Math.max(3,zoom*(type==='fence'?.18:.43));
 ctx.save();ctx.translate(x,y);ctx.rotate(-angle);
 ctx.lineWidth=Math.max(1,zoom*.028);
 if(type==='fence'){
  // Small red Sevilla crowd-control barrier viewed from above: segmented crossbar and feet.
  ctx.fillStyle='#ba2726';ctx.strokeStyle='#791b18';
  ctx.fillRect(-w/2,-d*.30,w,d*.60);ctx.strokeRect(-w/2,-d*.30,w,d*.60);
  ctx.fillStyle='#de4841';
  for(let i=1;i<Math.max(2,Math.floor(w/12));i++){const xx=-w/2+i*w/Math.max(2,Math.floor(w/12));ctx.fillRect(xx-1,-d*.34,2,d*.68)}
  ctx.fillStyle='#912524';ctx.fillRect(-w/2,-d,w*.06,d*2);ctx.fillRect(w/2-w*.06,-d,w*.06,d*2);
 }else{
  // Chair with backrest, seat and four legs; distinct from public sprites.
  ctx.fillStyle='#d6c7a5';ctx.strokeStyle='#6b5c47';ctx.fillRect(-w/2,-d/2,w,d);ctx.strokeRect(-w/2,-d/2,w,d);
  ctx.fillStyle='#756956';ctx.fillRect(-w/2,-d/2,w,d*.20);
  ctx.fillStyle='#5c5244';const leg=Math.max(2,w*.10);
  for(const xx of [-w/2,w/2-leg])for(const yy of [-d/2,d/2-leg])ctx.fillRect(xx,yy,leg,leg);
 }
 if(selected){ctx.strokeStyle='#51ebef';ctx.lineWidth=2;ctx.strokeRect(-w/2-3,-d/2-3,w+6,d+6)}
 ctx.restore();
}
