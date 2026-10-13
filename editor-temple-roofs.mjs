// Top-down, pixel-inspired interpretations of Sevillian churches and chapels.
// They are schematic plans, not traced floorplans or official architectural models.
// No changes to the game's original sprites or existing saved roof IDs.
export const TEMPLE_ROOF_MATERIALS=[
 {id:'temple-macarena',name:'Basílica de la Macarena',temple:'macarena',style:'basilica',roof:'#bb6950',wall:'#e6cfad',accent:'#669382',description:'Naves y cubierta de la basílica de la Esperanza Macarena'},
 {id:'temple-gran-poder',name:'Basílica del Gran Poder',temple:'gran-poder',style:'dome',roof:'#b36e50',wall:'#dec9a8',accent:'#b79d70',description:'Nave, crucero y cúpula'},
 {id:'temple-marineros',name:'Capilla de los Marineros',temple:'marineros',style:'chapel',roof:'#b7694b',wall:'#ebdbc3',accent:'#3e8d88',description:'Capilla de la Esperanza de Triana'},
 {id:'temple-estrella',name:'Capilla de la Estrella',temple:'estrella',style:'chapel',roof:'#b76844',wall:'#efe2c8',accent:'#6783a3',description:'Capilla de la Estrella de Triana'},
 {id:'temple-cachorro',name:'Basílica del Cachorro',temple:'cachorro',style:'basilica',roof:'#ae6750',wall:'#e5d7c2',accent:'#b29562',description:'Basílica del Cristo de la Expiración en Triana'},
 {id:'temple-san-lorenzo',name:'Iglesia de San Lorenzo',temple:'san-lorenzo',style:'mudejar',roof:'#c07952',wall:'#dfc6a0',accent:'#98815c',description:'Cubiertas de varias naves y torre'},
 {id:'temple-san-isidoro',name:'Iglesia de San Isidoro',temple:'san-isidoro',style:'mudejar',roof:'#af6344',wall:'#dac09e',accent:'#b89a64',description:'Iglesia histórica del centro de Sevilla'},
 {id:'temple-san-vicente',name:'Iglesia de San Vicente',temple:'san-vicente',style:'mudejar',roof:'#ba7551',wall:'#dbc6a7',accent:'#9b826b',description:'Naves y cubiertas tradicionales'},
 {id:'temple-san-esteban',name:'Iglesia de San Esteban',temple:'san-esteban',style:'mudejar',roof:'#b65c46',wall:'#dfc5aa',accent:'#a78d63',description:'Templo mudéjar con torre'},
 {id:'temple-san-benito',name:'Iglesia de San Benito',temple:'san-benito',style:'transept',roof:'#bc7250',wall:'#ebd7b6',accent:'#a58260',description:'Nave, crucero y cabecera'},
 {id:'temple-magdalena',name:'Iglesia de la Magdalena',temple:'magdalena',style:'baroque',roof:'#bf724a',wall:'#d8c29d',accent:'#c2a579',description:'Gran iglesia barroca con cúpula'},
 {id:'temple-san-juan-palma',name:'Iglesia de San Juan de la Palma',temple:'san-juan-palma',style:'mudejar',roof:'#ab6248',wall:'#dfc8a8',accent:'#a28b60',description:'Naves y torre del templo histórico'},
 {id:'temple-santa-catalina',name:'Iglesia de Santa Catalina',temple:'santa-catalina',style:'mudejar',roof:'#b96d47',wall:'#e7d3af',accent:'#95764c',description:'Cubiertas mudéjares y torre'},
 {id:'temple-san-pedro',name:'Iglesia de San Pedro',temple:'san-pedro',style:'mudejar',roof:'#b36c4f',wall:'#d9c09b',accent:'#aa8757',description:'Tres naves y torre'},
 {id:'temple-carreteria',name:'Capilla de la Carretería',temple:'carreteria',style:'chapel',roof:'#b26343',wall:'#f0e2c8',accent:'#b39465',description:'Capilla de la Carretería en el Arenal'},
 {id:'temple-montserrat',name:'Capilla de Montserrat',temple:'montserrat',style:'chapel',roof:'#b96b4f',wall:'#e9d6b2',accent:'#836f9b',description:'Capilla de Montserrat en Sevilla'}
].map((temple,i)=>({...temple,group:'temple',key:'sharedassets2.assets:'+([569,416,463,480,495,562,566,581,554][i%9])}));

// Draws a roof onto a normalized 1 × 1 area. The caller clips to the user's
// polygon: visual detail never changes the existing collision footprint.
export function drawTempleRoof(ctx,temple,p,w,h){
 if(!(w>0&&h>0))return;
 const i=TEMPLE_ROOF_MATERIALS.findIndex(x=>x.id===temple.id);
 const index=Math.max(0,i);
 const stone=temple.wall,brick=temple.roof,accent=temple.accent;
 ctx.save();ctx.translate(p[0],p[1]);ctx.scale(w,h);
 const block=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
 const rect=(x,y,w,h,color='#70543d',line=.014)=>{ctx.strokeStyle=color;ctx.lineWidth=line;ctx.strokeRect(x,y,w,h)};
 const line=(x,y,u,v,color='#6f503b',width=.012)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke()};
 const ellipse=(x,y,rx,ry,color,outline='#7c6850')=>{
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  ctx.strokeStyle=outline;ctx.lineWidth=.012;ctx.stroke();
 };
 const cover=(x,y,w,h,tone=brick)=>{
  block(x,y,w,h,tone);rect(x,y,w,h,'#71513e',.012);
  for(let at=y+.045;at<y+h-.025;at+=.074){
   line(x+.014,at,x+w-.014,at,'rgba(248,206,160,.43)',.007);
  }
  line(x+w/2,y+.01,x+w/2,y+h-.01,'#80513a',.017);
 };
 const tower=(x,y,scale=.15)=>{
  block(x,y,scale,scale,stone);rect(x,y,scale,scale,'#735a41',.016);
  block(x+.025,y+.025,scale-.05,scale-.05,accent);
  rect(x+.025,y+.025,scale-.05,scale-.05,'#74583e',.012);
  ellipse(x+scale/2,y+scale/2,scale*.14,scale*.14,'#e7d4a4');
 };
 const dome=(x,y,r)=>{
  ellipse(x,y,r,r,'#a28f73','#755c43');
  ellipse(x,y,r*.77,r*.77,'#d8bf8f');
  for(let j=0;j<8;j++){
   const a=j*Math.PI/4;line(x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.2,
      x+Math.cos(a)*r*.74,y+Math.sin(a)*r*.74,'rgba(102,80,55,.65)',.008)
  }
  ellipse(x,y,r*.18,r*.18,accent);
 };
 const apse=(x,y,r)=>{
  ctx.beginPath();
  for(let j=0;j<=6;j++){
   const a=Math.PI+j*Math.PI/6;
   const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;
   if(j===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.fillStyle='#c0ab86';ctx.fill();ctx.strokeStyle='#72563c';ctx.lineWidth=.012;ctx.stroke();
 };
 const cross=(x,y,size=.06)=>{
  line(x-size,y,x+size,y,'#785e40',.012);
  line(x,y-size,x,y+size,'#785e40',.012);
  ellipse(x,y,.013,.013,'#ddc28d')
 };
 block(0,0,1,1,stone);
 rect(.025,.025,.95,.95,'rgba(91,74,54,.55)',.018);
 const design=temple.style;
 if(design==='chapel'){
  // Narrow chapels with a visibly gabled nave and a small front belfry.
  cover(.17,.1,.66,.76);
  block(.10,.76,.8,.19,stone);
  rect(.1,.76,.8,.19,'#ad9679',.018);
  block(.39,.81,.22,.1,accent);
  rect(.39,.81,.22,.1,'#715b46',.012);
  tower(index%2?.7:.16,.76,.14);
  if(index%3===0){dome(.5,.22,.12)}else{cross(.5,.19,.075)}
  if(index%4===0){
   cover(.04,.17,.14,.55,'#c68d62');
   rect(.04,.17,.14,.55,'#98744f',.014);
  }
 }else if(design==='dome'||design==='baroque'){
  // Round crossing dome, nave and side roofs (Gran Poder / Magdalena).
  cover(.32,.07,.36,.86);
  cover(.08,.37,.84,.26);
  cover(.11,.09,.19,.28);
  cover(.7,.64,.19,.27);
  dome(.5,.5,design==='dome'?.22:.25);
  apse(.5,.17,.13);
  tower(index%2?.11:.75,.78,.14);
  if(design==='baroque'){tower(.11,.12,.12);rect(.05,.05,.9,.9,'#8e7758',.01)}
 }else if(design==='basilica'){
  // Long main nave, narrower aisles and crossing. Semblance of large basílicas.
  cover(.13,.09,.22,.82,index%2?'#be7d57':brick);
  cover(.39,.065,.23,.87,brick);
  cover(.66,.09,.21,.82,index%2?'#c1865d':brick);
  cover(.08,.40,.84,.18,stone);
  cover(.39,.41,.23,.16,accent);
  for(let y=.13;y<.87;y+=.12)for(const x of [.27,.73])rect(x-.038,y,.076,.067,'#e3cfab',.009);
  cross(.5,.48,.065);
  tower(index%2?.76:.1,.09,.12);
  tower(index%2?.1:.76,.78,.12);
 }else if(design==='transept'){
  cover(.32,.07,.36,.86,brick);
  cover(.075,.34,.85,.31,index%2?'#bd805d':brick);
  cover(.11,.10,.19,.26);
  cover(.7,.68,.19,.25);
  dome(.5,.5,.13);
  apse(.5,.2,.12);
  tower(.75,.1,.14);
 }else{
  // Mudéjar parish churches: multiple parallel roof slopes and bell tower.
  const n=index%3===0?2:3,spacing=.02,bw=(.82-(n-1)*spacing)/n;
  for(let j=0;j<n;j++){
   const x=.09+j*(bw+spacing),tone=j%2===0?brick:'#cb845a';
   cover(x,.09,bw,.82,tone);
   for(let y=.13;y<.83;y+=.135)rect(x+.055,y,Math.max(.03,bw-.11),.095,'rgba(244,218,165,.5)',.006)
  }
  if(index%2===0){
   cover(.05,.38,.9,.16,'#bc7950');
   tower(.73,.08,.16);
  }else{
   tower(.08,.73,.16);
   apse(.5,.16,.11);
  }
  if(index%5===0){ellipse(.5,.49,.095,.095,'#b5a183');cross(.5,.49,.044)}
 }
 ctx.restore();
}
