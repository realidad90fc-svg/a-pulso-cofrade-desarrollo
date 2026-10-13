// Sevilla residential roofs: faithful stylized aerial shapes, not stretched sprites.
const flats=[
 ['Blanca encalada','#f1eee3','#c9c2af','caseton'],
 ['Blanca con tendedero','#eee9d9','#d6ccb5','tendedero'],
 ['Crema','#dbccb3','#ae9a82','patio'],
 ['Albero','#d9bf92','#aa8d62','caseton'],
 ['Rojiza impermeabilizada','#b96e5a','#8e5346','caseton'],
 ['Granate','#97504e','#6d353b','deposito'],
 ['Terracota lisa','#c6896e','#9f6453','patio'],
 ['Gris de cemento','#a8a9a5','#82817b','maquinas'],
 ['Gris clara','#d0cfc8','#a7a79f','claraboya'],
 ['Ocre envejecida','#b69a79','#8b7967','chimenea']
];
const tiles=[
 ['Teja roja clásica','#b36a4d','#e09c76','chimenea'],
 ['Teja anaranjada','#c98052','#eab285','cumbrera'],
 ['Teja roja oscura','#964b42','#bd7161','cumbrera'],
 ['Teja marrón antigua','#96664b','#bc9372','parche'],
 ['Teja envejecida irregular','#ad775f','#d1a58c','parche'],
 ['Teja clara mediterránea','#c4a184','#e7c3a2','claraboya'],
 ['Teja curva tradicional','#c07155','#dfa180','cumbrera'],
 ['Teja histórica oscurecida','#8c6250','#b98e76','chimenea'],
 ['Teja rosada','#c18c7b','#e5bcaa','parche'],
 ['Teja ladrillo','#c56e4d','#e69972','claraboya']
];
const mixed=[
 ['Azotea y teja roja','#e7d8bf','#bc7652','caseton'],
 ['Teja y azotea blanca','#f1ebdb','#a96b4e','patio'],
 ['Azotea rojiza y teja','#b96c5a','#d39970','deposito'],
 ['Patio crema y teja ocre','#d9c5a0','#c19d72','patio'],
 ['Gris y teja oscura','#bab9b2','#95634f','maquinas'],
 ['Terraza con teja','#d4c5ad','#ae6b4b','tendedero']
];
const make=(a,f)=>a.map(([name,base,detail,feature],i)=>({
 id:'sevilla-'+f+'-'+i,name:(f==='flat'?'Azotea ':f==='tile'?'Cubierta ':'Mixto · ')+name,
 roofFamily:f,base,detail,feature,
 key:'sharedassets2.assets:'+([569,416,463,480,495,562,566,581,554][i%9]),
 family:f,group:'residential'
}));
export const SEVILLA_ROOFS=[...make(flats,'flat'),...make(tiles,'tile'),...make(mixed,'mixed')];
export const SEVILLA_ROOFS_BY_FAMILY=f=>SEVILLA_ROOFS.filter(r=>r.roofFamily===f);
const A=SEVILLA_ROOFS_BY_FAMILY('flat'),B=SEVILLA_ROOFS_BY_FAMILY('tile'),C=SEVILLA_ROOFS_BY_FAMILY('mixed');
// Real alternating categories, interleaving 40% terraces, 40% tiles, 20% mixed.
export const SEVILLA_NEIGHBOURHOOD_ROOFS=Array.from({length:10},(_,i)=>[A[i],B[i],...(i%2===0?[C[i/2]]:[])]).flat().concat(C[5]);
export function residentialSeed(poly,offset=0){
 let hash=(2166136261^Math.imul(offset+1,2654435761))>>>0;
 for(const p of poly||[])for(const val of p||[]){
  const n=Math.round(val*1000)|0;
  for(let k=0;k<4;k++)hash=Math.imul(hash^((n>>>(k*8))&255),16777619)>>>0;
 }
 return hash>>>0;
}
export function drawSevillaResidentialRoof(ctx,layout,m,pixel,zoom,options={}){
 const pts=layout.points.map(p=>pixel(...p)),ref=pts[layout.longestEdgeIndex],nxt=pts[(layout.longestEdgeIndex+1)%pts.length];
 const origin=[pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length];
 const theta=Math.atan2(nxt[1]-ref[1],nxt[0]-ref[0]),ca=Math.cos(theta),sa=Math.sin(theta);
 const local=pts.map(p=>{const x=p[0]-origin[0],y=p[1]-origin[1];return[x*ca+y*sa,-x*sa+y*ca]});
 const xmin=Math.min(...local.map(p=>p[0])),xmax=Math.max(...local.map(p=>p[0]));
 const ymin=Math.min(...local.map(p=>p[1])),ymax=Math.max(...local.map(p=>p[1]));
 const w=xmax-xmin,h=ymax-ymin,z=Math.max(.001,zoom),compact=layout.compact||w<1.7*z||h<1.25*z;
 const seed=Number.isFinite(options.roofSeed)?options.roofSeed:residentialSeed(layout.points);
 const rand=k=>{let n=Math.imul(seed^Math.imul(k+31,374761393),668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296};
 const rect=(x,y,ww,hh,paint,border)=>{ctx.fillStyle=paint;ctx.fillRect(x,y,ww,hh);if(border){ctx.lineWidth=.015*z;ctx.strokeStyle=border;ctx.strokeRect(x,y,ww,hh)}};
 function tiles(x,y,ww,hh){
  rect(x,y,ww,hh,m.roofFamily==='tile'?m.base:m.detail,'#73574a');
  ctx.lineWidth=.016*z;ctx.strokeStyle=m.detail;ctx.beginPath();
  for(let yy=y+.14*z;yy<y+hh;yy+=.17*z){ctx.moveTo(x,yy);ctx.lineTo(x+ww,yy)}ctx.stroke();
  ctx.lineWidth=.012*z;ctx.strokeStyle='rgba(75,48,37,.37)';ctx.beginPath();
  for(let xx=x+.32*z;xx<x+ww;xx+=.44*z){ctx.moveTo(xx,y);ctx.lineTo(xx,y+hh)}ctx.stroke();
 }
 ctx.save();ctx.translate(...origin);ctx.rotate(theta);
 rect(xmin-.1*z,ymin-.1*z,w+.2*z,h+.2*z,m.base);
 if(m.roofFamily==='tile'){
  tiles(xmin,ymin,w,h);
  if(!compact){
   ctx.beginPath();ctx.moveTo(xmin,ymin+h*.52);ctx.lineTo(xmax,ymin+h*.52);
   ctx.lineWidth=.045*z;ctx.strokeStyle='rgba(107,68,51,.86)';ctx.stroke();
  }
 }else if(m.roofFamily==='mixed'){
  const part=.35+rand(1)*.25;
  tiles(xmin,ymin,w*part,h);
  rect(xmin+w*part,ymin,w*(1-part),h,m.base);
  ctx.strokeStyle='#8b735f';ctx.lineWidth=.03*z;
  ctx.beginPath();ctx.moveTo(xmin+w*part,ymin);ctx.lineTo(xmin+w*part,ymax);ctx.stroke();
 }else{
  // Quiet flat roofs: no fake pitched tile texture. Patio slabs, faint repairs.
  ctx.fillStyle=m.detail;ctx.globalAlpha=.1;
  for(let i=0;i<5;i++)ctx.fillRect(xmin+w*rand(i+2),ymin+h*rand(i+12),(.10+rand(i+9)*.25)*z,.13*z);
  ctx.globalAlpha=1;
  if(!compact){
   ctx.strokeStyle='rgba(98,83,74,.2)';ctx.lineWidth=.01*z;ctx.beginPath();
   for(let i=1;i<4;i++){const x=xmin+i*w/4;ctx.moveTo(x,ymin);ctx.lineTo(x,ymax)}
   ctx.stroke();
  }
 }
 if(!compact&&w>1.9*z&&h>1.5*z){
  let xx=xmin+w*(.16+.22*rand(5)),yy=ymin+h*(.15+.2*rand(6));
  if(m.roofFamily==='mixed')xx=xmin+w*.68;
  let ww=Math.min(.82*z,w*.25),hh=Math.min(.63*z,h*.25);
  if(m.feature==='caseton'||m.feature==='tendedero'||m.feature==='maquinas'||m.feature==='deposito'){
   rect(Math.min(xx,xmax-ww-.1*z),yy,ww,hh,m.feature==='deposito'?'#b8beba':'#dbccb2','#96785e');
   if(m.feature==='deposito'){ctx.beginPath();ctx.ellipse(xx+ww*.45,yy+hh*.5,ww*.20,hh*.25,0,0,Math.PI*2);ctx.fillStyle='#777f80';ctx.fill()}
   if(m.feature==='tendedero'){ctx.strokeStyle='#5f6764';ctx.lineWidth=.022*z;ctx.beginPath();ctx.moveTo(xx,yy+hh+.12*z);ctx.lineTo(xx+ww,yy+hh+.12*z);ctx.stroke()}
  }else if(m.feature==='patio'||m.feature==='parche'){
   rect(xx,yy,ww,hh,m.feature==='patio'?'#957963':m.detail,'#6e6758');
  }else if(m.feature==='chimenea'||m.feature==='claraboya'){
   rect(xx,yy,Math.min(.35*z,ww),Math.min(.3*z,hh),m.feature==='claraboya'?'#8eaaa9':'#ead8be','#8d7260');
  }
 }
 ctx.restore();
}
