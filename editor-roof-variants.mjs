// Additional bird's-eye Sevilla roofing finishes, inspired by the visual
// reference board. Canvas geometry is in native map units: these are NOT
// stretched photographs and do not alter building footprints or collision.
const entries=[
 ['encalada-clara','Azotea encalada · clara','flat','#e9e4d8','#faf7ed','#b7ad9a','lime'],
 ['encalada-patina','Azotea encalada · pátina antigua','flat','#d5c9b4','#e8ddcc','#a49984','lime-aged'],
 ['piedra-crema','Terraza de piedra crema','flat','#dbc6a6','#f1e4c9','#ae9876','stone'],
 ['piedra-miel','Terraza de piedra tostada','flat','#bf9e7a','#e0c49d','#957859','stone-aged'],
 ['cemento-claro','Azotea de cemento · gris claro','flat','#b9bab5','#d3d2ca','#868987','concrete'],
 ['cemento-antiguo','Azotea de cemento · envejecida','flat','#929692','#b6b8b1','#666a68','concrete-aged'],
 ['terracota','Azotea de barro rojo','flat','#b9694e','#db9573','#8a4e40','terracotta'],
 ['terracota-vieja','Azotea de barro gastado','flat','#a46c55','#c28c72','#755141','terracotta-aged'],
 ['ocre','Azotea ocre envejecida','flat','#c8ab73','#e5cb98','#958057','ochre'],
 ['marmol','Losas de mármol claro','flat','#e1ddce','#f8f6e8','#aaa69c','marble'],
 ['baldosa-hidraulica','Terraza hidráulica geométrica','flat','#c2b19c','#e7d8bf','#877663','hydraulic'],
 ['soleria-gris','Azotea de solería gris','flat','#a7aaa6','#c7c8c0','#777b79','stone'],
 ['teja-arabe','Teja árabe roja · nueva','tile','#be6f4c','#f0af82','#834b3a','tile-red'],
 ['teja-vieja','Teja árabe · antigua oscura','tile','#7e5947','#b68a6d','#493d35','tile-dark'],
 ['teja-musgo','Teja árabe · musgo y pátina','tile','#916e51','#c29874','#585141','tile-moss'],
 ['teja-rosada','Teja árabe · rosada','tile','#bf8b78','#e5b8a0','#895b52','tile-pink'],
 ['teja-albero','Teja curva · ocre','tile','#b48a65','#e7bc88','#745c4a','tile-ochre'],
 ['mixta-tradicional','Azotea + teja sevillana','mixed','#d9c9ab','#b77753','#a88d6d','mixed-red'],
 ['mixta-antigua','Azotea vieja + teja oscura','mixed','#c1b7a3','#92715b','#807464','mixed-old'],
 ['mixta-ajardinada','Azotea con jardineras + teja','mixed','#dad2bc','#c58361','#a69d81','mixed-garden'],
 ['pintada-blanca','Azotea pintada · blanco mate','flat','#e9e9de','#faf9ed','#acae9e','paint-white'],
 ['pintada-hueso','Azotea pintada · hueso','flat','#e4daca','#f4edde','#ac9d87','paint-cream'],
 ['pintada-gris','Azotea pintada · gris impermeable','flat','#afb3af','#d0d2c8','#777d7b','paint-grey'],
 ['pintada-clorocaucho','Azotea impermeabilizada · rojo óxido','flat','#a66c60','#c18b7c','#77574f','paint-rubber'],
 ['pintada-envejecida','Azotea encalada · capas gastadas','flat','#d4d3c5','#eeebdc','#96988a','paint-worn']
];
export const REALISTIC_ROOFS=entries.map(([id,name,roofFamily,base,detail,shadow,surfaceStyle],i)=>({
 id:'realista-'+id,name,roofFamily,base,detail,shadow,surfaceStyle,
 key:'sharedassets2.assets:'+([569,416,463,480,495,562,566,581,554][i%9]),
 group:'realistic'
}));
export function paintRoofVariant(ctx,m,area,zoom,noise){
 const {x0,y0,w,h}=area,z=Math.max(.01,zoom),style=m.surfaceStyle||'';
 if(!style)return false;
 const stone=style==='stone'||style==='stone-aged'||style==='marble'||style==='soleria-gris'||style==='hydraulic';
 const tile=style.startsWith('tile-');
 const mix=style.startsWith('mixed-');
 const isTerracotta=style.startsWith('terracotta');
 const isConcrete=style.startsWith('concrete')||style.startsWith('lime')||style==='ochre';
 const rough=style.endsWith('aged')||style==='tile-moss'||style==='tile-dark'||style==='encalada-patina';
 const rect=(x,y,a,b,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,a,b)};
 const line=(x,y,xx,yy,color,width=.009)=>{
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(.3,z*width);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();
 };
 const patch=(x,y,rx,ry,color,alpha=.18)=>{
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,noise(Math.round(x+y))*.25,0,Math.PI*2);ctx.fill();ctx.restore();
 };
 const count=(span,step,cap=120)=>Math.min(cap,Math.ceil(span/step)+1);
 const drawSlabs=(ax,aw,variant=style)=>{
  let tw=(variant==='marble'? .86:variant==='hydraulic'?.34:variant==='stone-aged'?.59:.56)*z;
  let th=(variant==='marble'?.72:variant==='hydraulic'?.34:.47)*z;
  const nc=count(aw,tw),nr=count(h,th);
  for(let row=0;row<nr;row++){
   const y=y0+row*th;
   for(let col=-1;col<nc+1;col++){
    const x=ax+col*tw+((row%2)&&variant!=='hydraulic'?tw*.45:0);
    if(x+tw<ax||x>ax+aw||y>y0+h)continue;
    const v=noise(row*187+col*31),l=noise(row*59+col*13+61);
    const dx=Math.min(tw-.025*z,ax+aw-x),dy=Math.min(th-.027*z,y0+h-y);
    if(dx<=0||dy<=0)continue;
    rect(x+.01*z,y+.01*z,dx,dy,v>.62?'rgba(253,245,224,.14)':'rgba(45,39,35,.035)');
    line(x,y,x+Math.max(0,dx),y,m.shadow,.009);
    line(x,y,x,y+Math.max(0,dy),m.shadow,.008);
    if(variant==='marble'&&v>.60){
      line(x+.12*tw,y+.23*th,x+.7*tw,y+.34*th,'rgba(121,116,102,.21)',.008);
      line(x+.42*tw,y+.32*th,x+.86*tw,y+.58*th,'rgba(255,255,255,.23)',.011);
    }
    if(variant==='hydraulic'){
      const cx=x+tw*.5,cy=y+th*.5;
      ctx.beginPath();ctx.arc(cx,cy,tw*.25,0,Math.PI*2);
      ctx.strokeStyle=l>.5?'rgba(125,87,71,.46)':'rgba(234,219,187,.68)';
      ctx.lineWidth=Math.max(.35,z*.015);ctx.stroke();
      line(x+tw*.18,y+th*.18,x+tw*.82,y+th*.82,'rgba(142,101,87,.34)',.009);
    }
    if(v>.90)patch(x+tw*.43,y+th*.38,tw*.25,th*.18,m.shadow,.08);
   }
  }
 };
 const drawTiles=(ax,aw)=>{
  const tw=.29*z,th=.22*z,nc=count(aw,tw),nr=count(h,th);
  for(let row=0;row<nr;row++)for(let col=0;col<nc;col++){
    const x=ax+col*tw+(row%2?tw*.5:0),y=y0+row*th;
    if(x>ax+aw||y>y0+h)continue;
    const v=noise((col+1)*79+(row+2)*421);
    const lighter=v>.52?m.detail:m.base,aged=style==='tile-moss'||style==='tile-dark';
    rect(x,y,Math.min(tw,ax+aw-x),Math.min(th,y0+h-y),v>.84?'rgba(249,214,169,.13)':'rgba(68,37,31,.09)');
    ctx.beginPath();ctx.moveTo(x+.017*z,y+.018*z);
    ctx.bezierCurveTo(x+tw*.32,y-th*.03,x+tw*.74,y+th*.03,x+tw*.96,y+.035*z);
    ctx.strokeStyle=lighter;ctx.lineWidth=Math.max(.6,tw*.11);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+.04*z,y+th*.82);
    ctx.quadraticCurveTo(x+tw*.50,y+th*.92,x+tw*.95,y+th*.83);
    ctx.strokeStyle='rgba(51,36,29,.48)';ctx.lineWidth=Math.max(.4,z*.016);ctx.stroke();
    if(aged&&v>.83)patch(x+tw*.5,y+th*.55,tw*.28,th*.37,'#4d6741',style==='tile-moss'?.42:.16);
    else if(v>.76)patch(x+tw*.5,y+th*.42,tw*.18,th*.25,m.shadow,.13);
   }
  if(w>2*z)line(ax,y0+h*.51,ax+aw,y0+h*.51,'rgba(87,62,44,.42)',.025);
 };
 // Tile/stone variation is oriented with the longest roof edge and clipped
 // to the building's unmodified polygon by renderInsetRoof.
 if(tile){drawTiles(x0,w);}
 else if(mix){
  const split=x0+w*(style==='mixed-old'?.47:.59);
  drawSlabs(x0,split-x0,style==='mixed-old'?'stone-aged':'stone');
  drawTiles(split,x0+w-split);
  line(split,y0,split,y0+h,'rgba(77,62,49,.45)',.027);
  if(style==='mixed-garden'&&w>2*z&&h>1*z){
   for(let k=0;k<5;k++){
    const px=x0+(split-x0)*(.16+.15*k);
    const py=y0+h*(.18+(k%2)*.53);
    ctx.beginPath();ctx.arc(px,py,Math.min(.17*z,h*.10),0,Math.PI*2);
    ctx.fillStyle=k%2?'#496642':'#647a46';ctx.fill();
    ctx.strokeStyle='#9b7857';ctx.lineWidth=.025*z;ctx.stroke();
   }
  }
 }else if(stone||isTerracotta){
  drawSlabs(x0,w,isTerracotta?'stone-aged':style);
  if(isTerracotta){ctx.save();ctx.globalAlpha=.17;rect(x0,y0,w,h,'#ac503c');ctx.restore()}
 }else if(isConcrete){
  // Bigger porous patches plus subtle expansion joints, not fake roof tiles.
  const spacing=(style==='ochre'?1.15:1.25)*z;
  for(let x=x0+spacing;x<x0+w;x+=spacing)
    line(x,y0,x,y0+h,'rgba(100,98,89,.22)',.018);
  for(let y=y0+spacing*.76;y<y0+h;y+=spacing*.76)
    line(x0,y,x0+w,y,'rgba(100,98,89,.16)',.014);
  const howMany=Math.min(135,Math.ceil(w*h/(z*z)*13));
  for(let i=0;i<howMany;i++){
    const px=x0+w*noise(i*31+6),py=y0+h*noise(i*57+49);
    const r=(.025+noise(i*99+3)*.23)*z;
    patch(px,py,r,r*(.38+noise(i+145)*.4),
      rough?(i%3===0?'#8d826d':'#e5dcc9'):(i%4===0?'#91897e':'#fffaed'),
      rough?.20:.09);
  }
  if(style.startsWith('lime')&&w>2*z)for(let i=0;i<6;i++){
    const px=x0+w*noise(1+i*7),py=y0+h*noise(21+i*9);
    patch(px,py,.16*z,.08*z,'#9a9b89',.11);
  }
 }
 return true;
}
