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
export const ROAD_MATERIALS=surfaces.map((v,i)=>({id:'road-'+i,name:v[0],base:v[1],light:v[2],pattern:v[3]}));
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
export const SIDEWALK_MATERIALS=pavements.map((v,i)=>({id:'sidewalk-'+i,name:v[0],base:v[1],light:v[2],pattern:v[3]}));
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
export const roofById=id=>ROOF_MATERIALS.find(m=>m.id===id)||ROOF_MATERIALS.find(m=>m.key===id)||ROOF_MATERIALS[0];
export const surfaceById=(id,kind='roads')=>{
 const list=kind==='sidewalks'?SIDEWALK_MATERIALS:ROAD_MATERIALS;
 return list.find(m=>m.id===id)||list[0];
};
export function drawRoof(ctx,poly,material,pixel,getImage,zoom){
 if(!asPoly(poly))return;
 const m=roofById(material),b=bounds(poly),img=getImage(m.key);
 ctx.save();polygonPath(ctx,poly,pixel);ctx.clip();
 const p=pixel(b[0],b[3]),w=(b[2]-b[0])*zoom,h=(b[3]-b[1])*zoom;
 ctx.fillStyle='#aa8974';ctx.fillRect(p[0],p[1],w,h);
 if(img){
  ctx.filter=m.filter;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(img,p[0],p[1],w,h);ctx.filter='none';
 }
 if(m.tint){ctx.fillStyle=m.tint;ctx.fillRect(p[0],p[1],w,h)}
 // Fine details define different roof/terrace categories without duplicating source sprites.
 const variant=m.family;
 ctx.lineWidth=Math.max(.65,zoom*.018);ctx.strokeStyle=variant===2?'rgba(240,232,215,.5)':'rgba(42,32,27,.32)';
 if(variant===0||variant===1){
  const spacing=Math.max(7,zoom*.34);
  for(let y=p[1]+spacing;y<p[1]+h;y+=spacing){ctx.beginPath();ctx.moveTo(p[0],y);ctx.lineTo(p[0]+w,y);ctx.stroke()}
 }else if(variant===2){
  ctx.strokeStyle='rgba(105,98,82,.6)';
  ctx.strokeRect(p[0]+Math.min(3,w*.1),p[1]+Math.min(3,h*.1),Math.max(0,w-Math.min(6,w*.2)),Math.max(0,h-Math.min(6,h*.2)));
  if(w>25&&h>25){ctx.fillStyle='rgba(202,194,180,.6)';ctx.fillRect(p[0]+w*.17,p[1]+h*.19,w*.16,h*.12)}
 }else{
  ctx.strokeStyle='rgba(25,26,26,.55)';ctx.lineWidth=Math.max(1,zoom*.09);
  ctx.strokeRect(p[0]+2,p[1]+2,Math.max(0,w-4),Math.max(0,h-4));
 }
 ctx.restore();
}
function lineGrid(ctx,x0,y0,x1,y1,stepX,stepY,vertical,alpha){
 ctx.save();ctx.strokeStyle='rgba(27,26,26,'+alpha+')';ctx.lineWidth=.7;
 for(let x=x0;x<x1;x+=stepX){ctx.beginPath();ctx.moveTo(x,y0);ctx.lineTo(x,y1);ctx.stroke()}
 for(let y=y0;y<y1;y+=stepY){ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke()}
 ctx.restore();
}
export function drawSurface(ctx,poly,kind,materialId,pixel,zoom,baseFloor){
 if(!asPoly(poly))return;
 const m=surfaceById(materialId,kind),b=bounds(poly);
 ctx.save();polygonPath(ctx,poly,pixel);ctx.clip();
 const p=pixel(b[0],b[3]),x0=p[0],y0=p[1],x1=x0+(b[2]-b[0])*zoom,y1=y0+(b[3]-b[1])*zoom;
 ctx.fillStyle=m.base;ctx.fillRect(x0,y0,x1-x0,y1-y0);
 const style=m.pattern,step=Math.max(7,zoom*(style==='cobbles'?.23:style==='tiles'?.42:style==='stone'?.67:1.15));
 // Keep the original floor sprite for asphalt, then overlay coordinated seams.
 if(kind==='roads'&&baseFloor&&(style==='asphalt'||style==='concrete')){
  ctx.imageSmoothingEnabled=false;
  const minX=Math.floor(b[0]),maxX=Math.ceil(b[2]),minY=Math.floor(b[1]),maxY=Math.ceil(b[3]);
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
export function drawTree(ctx,tree,pixel,zoom,getImage){
 const variant=TREE_VARIANTS.find(m=>m.id===tree.variant)||TREE_VARIANTS[0],p=pixel(...tree.point),
   r=Math.max(3,(tree.radius||.35)*(tree.scale||1)*zoom),a=(tree.rotation||0)*Math.PI/180;
 ctx.save();ctx.translate(...p);ctx.rotate(-a);
 const original=getImage('sharedassets2.assets:563');
 if(variant.id==='tree-0'&&original){ctx.imageSmoothingEnabled=false;ctx.drawImage(original,-r,-r,r*2,r*2);ctx.restore();return}
 ctx.fillStyle='#47392c';ctx.beginPath();ctx.arc(0,0,r*.2,0,Math.PI*2);ctx.fill();
 ctx.shadowColor='rgba(0,0,0,.27)';ctx.shadowBlur=Math.max(1,r*.22);
 ctx.fillStyle=variant.tone;ctx.strokeStyle='rgba(25,42,26,.75)';ctx.lineWidth=Math.max(1,r*.08);
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
