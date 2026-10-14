// Additional historically inspired Sevillian street and pavement surfaces.
// New stable identifiers preserve legacy road-0..11 and sidewalk-0..11.
export const SEVILLE_ROAD_MATERIALS=[
 {id:'road-sev-gerena',name:'Adoquín de Gerena · rosado',base:'#ab8578',light:'#d0a899',pattern:'sev-gerena',grout:'#695953'},
 {id:'road-sev-gerena-old',name:'Adoquín de Gerena · envejecido',base:'#94746c',light:'#b8a193',pattern:'sev-gerena',grout:'#5b504b'},
 {id:'road-sev-granito-grey',name:'Adoquín de granito gris',base:'#959698',light:'#bcbabd',pattern:'sev-gerena',grout:'#565c5d'},
 {id:'road-sev-gerena-dark',name:'Adoquín histórico oscuro',base:'#716560',light:'#92847d',pattern:'sev-gerena',grout:'#463d3c'},
 {id:'road-sev-granito-quintana',name:'Granito Quintana · piezas pequeñas',base:'#a9aba9',light:'#dad9d3',pattern:'sev-quintana',grout:'#737473'},
 {id:'road-sev-losa-constitucion',name:'Losa gris · monumental',base:'#a7a7a3',light:'#d1d0c9',pattern:'sev-slab',grout:'#777973'},
 {id:'road-sev-espiga',name:'Adoquín en espiga',base:'#a49385',light:'#c1b2a5',pattern:'sev-herring',grout:'#6f6760'},
 {id:'road-sev-empedrado',name:'Empedrado antiguo · cantos',base:'#847970',light:'#b8aa9a',pattern:'sev-pebbles',grout:'#595047'},
 {id:'road-sev-plataforma',name:'Plataforma única · piedra clara',base:'#c1b5a7',light:'#e0d1bf',pattern:'sev-slab',grout:'#867a70'},
 {id:'road-sev-caliza',name:'Adoquín calizo · albero',base:'#baaa8c',light:'#e1cfaa',pattern:'sev-gerena',grout:'#8a7c61'},
 {id:'road-sev-adoquin-band',name:'Adoquín con encintado de granito',base:'#948a7e',light:'#cabfb0',pattern:'sev-band',grout:'#665f59'},
 {id:'road-sev-albero',name:'Albero compactado · plazas',base:'#d3b27b',light:'#edcd8d',pattern:'sev-albero',grout:'#ab956b'}
];
export const SEVILLE_SIDEWALK_MATERIALS=[
 {id:'sidewalk-sev-no8do',name:'Baldosa hexagonal NO8DO',base:'#bfc2b9',light:'#e5e2d6',pattern:'sev-no8do',grout:'#848781'},
 {id:'sidewalk-sev-hex-granite',name:'Terrazo hexagonal gris',base:'#afb1af',light:'#d3d3cd',pattern:'sev-hex',grout:'#828581'},
 {id:'sidewalk-sev-hex-cream',name:'Terrazo hexagonal marfil',base:'#ddcdb2',light:'#f1e4ca',pattern:'sev-hex',grout:'#ad9d86'},
 {id:'sidewalk-sev-quintana',name:'Granito Quintana · 15 × 21',base:'#a6a6a3',light:'#d0d0ca',pattern:'sev-quintana',grout:'#757777'},
 {id:'sidewalk-sev-slab-large',name:'Losa de granito gris · grande',base:'#a7a8a6',light:'#d2d1ca',pattern:'sev-slab',grout:'#777a77'},
 {id:'sidewalk-sev-caliza-cream',name:'Losa de piedra caliza',base:'#d6c7ac',light:'#efe1c8',pattern:'sev-slab',grout:'#a7977e'},
 {id:'sidewalk-sev-hidraulica-red',name:'Baldosa hidráulica · granate',base:'#b8897c',light:'#dfd0ba',pattern:'sev-hydraulic',grout:'#7d5c54'},
 {id:'sidewalk-sev-hidraulica-flower',name:'Baldosa hidráulica · flor',base:'#c0b6a2',light:'#f1e6ce',pattern:'sev-hydraulic',grout:'#8f816e'},
 {id:'sidewalk-sev-damero',name:'Loseta bicolor · damero',base:'#c4b398',light:'#e6d7bc',pattern:'sev-checker',grout:'#857665'},
 {id:'sidewalk-sev-barro',name:'Baldosa de barro cocido',base:'#a87158',light:'#ca9675',pattern:'sev-barro',grout:'#795545'},
 {id:'sidewalk-sev-cuatro-pastillas',name:'Baldosa de cuatro pastillas',base:'#aeaca4',light:'#d1cec3',pattern:'sev-four',grout:'#77776f'},
 {id:'sidewalk-sev-marmol',name:'Mármol claro · piedra pulida',base:'#d9d6c8',light:'#f3efe2',pattern:'sev-slab',grout:'#aaa99b'},
 {id:'sidewalk-sev-pizarra',name:'Losa de pizarra gris',base:'#707576',light:'#929c9b',pattern:'sev-slab',grout:'#454d4e'},
 {id:'sidewalk-sev-gerena',name:'Adoquín peatonal de Gerena',base:'#b09283',light:'#d4b4a3',pattern:'sev-gerena',grout:'#82685d'},
 {id:'sidewalk-sev-encintado',name:'Losas con encintado de granito',base:'#c8bfb0',light:'#ebe2d4',pattern:'sev-band',grout:'#81827d'},
 {id:'sidewalk-sev-albero',name:'Albero peatonal · jardines',base:'#d7b680',light:'#ebce98',pattern:'sev-albero',grout:'#af9467'}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function paintSevilleSurface(ctx,m,pixel,zoom,area){
 if(!m?.pattern?.startsWith('sev-'))return false;
 const [xmin,ymin,xmax,ymax]=area;
 if(!(xmax>xmin&&ymax>ymin)||zoom<=0)return true;
 const style=m.pattern;
 const grout=m.grout||'#766e66';
 const main=m.base,light=m.light;
 const setStroke=(color=grout,width=.015)=>{
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(.0001,width*zoom);
 };
 const path=(points)=>{
  ctx.beginPath();
  for(let i=0;i<points.length;i++){const p=pixel(...points[i]);i?ctx.lineTo(...p):ctx.moveTo(...p)}
  ctx.closePath();
 };
 const tile=(x,y,w,h,fill=main,stroke=grout)=>{
  path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
  ctx.fillStyle=fill;ctx.fill();
  if(stroke){setStroke(stroke,.016);ctx.stroke()}
 };
 const line=(a,b,col=grout,w=.014)=>{
  const p=pixel(...a),q=pixel(...b);
  ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);setStroke(col,w);ctx.stroke();
 };
 const circle=(x,y,r,col,outline=null)=>{
  const center=pixel(x,y);
  ctx.beginPath();ctx.arc(...center,r*zoom,0,Math.PI*2);
  ctx.fillStyle=col;ctx.fill();
  if(outline){setStroke(outline,.014);ctx.stroke()}
 };
 const poly=(points,color,stroke=grout)=>{
  path(points);ctx.fillStyle=color;ctx.fill();
  if(stroke){setStroke(stroke,.014);ctx.stroke()}
 };
 let count=0;const LIMIT=3200;
 const cells=(dx,dy,cb)=>{
  const x0=Math.floor(xmin/dx)-1,x1=Math.ceil(xmax/dx)+1;
  const y0=Math.floor(ymin/dy)-1,y1=Math.ceil(ymax/dy)+1;
  const nx=x1-x0+1,ny=y1-y0+1;
  // LOD: skip entire stones when too far away; NEVER stretch one stone
  // to occupy the space of several. The old dx*skip/dy*skip produced
  // enormous paving slabs whenever the editor rendered a broad area.
  const skip=Math.max(1,Math.ceil(Math.sqrt(nx*ny/LIMIT)));
  for(let i=x0;i<=x1;i+=skip)for(let j=y0;j<=y1;j+=skip){
   if(count++>LIMIT)return;
   cb(i*dx,j*dy,i,j,dx,dy);
  }
 };
 if(style==='sev-gerena'||style==='sev-barro'||style==='sev-quintana'||style==='sev-slab'||style==='sev-band'||style==='sev-four'){
  const config={
   // Actual world-sized paving rather than oversized rectangles.
   'sev-gerena':[.23,.15],'sev-barro':[.24,.15],
   'sev-quintana':[.18,.13],'sev-slab':[.68,.44],
   'sev-band':[.72,.36],'sev-four':[.32,.32]
  };
  const [dx,dy]=config[style];
  cells(dx,dy,(x,y,i,j,ww,hh)=>{
   const offset=(style==='sev-gerena'||style==='sev-barro'||style==='sev-quintana')?(j%2)*dx*.5:0;
   const xx=x+offset;
   const v=((i*3+j*7)%7+7)%7;
   const fill=v===0?light:v===1?'#a59a8f':main;
   tile(xx+.012*ww,y+.012*hh,ww*.976,hh*.976,fill);
   if(style==='sev-four'){
    const quarter=ww/2,half=hh/2;
    for(let a=0;a<2;a++)for(let b=0;b<2;b++){
     tile(xx+ww*.09+a*quarter,y+hh*.09+b*half,ww*.32,hh*.32,(a+b)%2?main:light,'#958e85');
    }
   }
   if(style==='sev-band'){
    if(j%3===0)tile(xx,y,ww,hh*.17,grout,null);
    line([xx+.10*ww,y+.23*hh],[xx+.10*ww,y+.9*hh],light,.018);
   }
   if(style==='sev-slab'&&v%3===0)
    line([xx+.1*ww,y+.09*hh],[xx+.6*ww,y+.11*hh],'rgba(255,255,255,.25)',.012);
  });
 }else if(style==='sev-hex'||style==='sev-no8do'){
  const r=.19,dx=1.5*r,dy=Math.sqrt(3)*r;
  cells(dx,dy,(x,y,i,j)=>{
   const cy=y+(i%2?dy/2:0);
   const p=[];
   for(let k=0;k<6;k++){const a=k*Math.PI/3;p.push([x+Math.cos(a)*r,cy+Math.sin(a)*r])}
   poly(p,((i*7+j*5)%5===0)?light:main);
   if(style==='sev-no8do'&&((Math.abs(i)+Math.abs(j)*2)%5===0)){
    const center=pixel(x,cy);
    ctx.save();ctx.fillStyle='#656a66';
    ctx.font='700 '+Math.max(.02,.11*zoom)+'px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('NO8DO',...center,.30*zoom);ctx.restore();
   }
  });
 }else if(style==='sev-hydraulic'||style==='sev-checker'){
  cells(.42,.42,(x,y,i,j,ww,hh)=>{
   const alt=(i+j)%2===0;
   tile(x,y,ww,hh,style==='sev-checker'?(alt?main:light):main);
   if(style==='sev-hydraulic'){
    circle(x+ww/2,y+hh/2,ww*.28,light,grout);
    for(let k=0;k<4;k++){
     const t=k*Math.PI/2;
     circle(x+ww/2+Math.cos(t)*ww*.22,y+hh/2+Math.sin(t)*hh*.22,ww*.08,
      k%2?main:'#99695f');
    }
    circle(x+ww/2,y+hh/2,ww*.074,'#8d756b');
   }
  });
 }else if(style==='sev-herring'){
  cells(.46,.46,(x,y,i,j,ww,hh)=>{
   if((i+j)%2===0){
    poly([[x,y],[x+ww*.7,y],[x+ww,y+hh*.28],[x+ww*.28,y+hh*.28]],light);
    poly([[x+ww*.28,y+hh*.31],[x+ww,y+hh*.31],[x+ww,y+hh],[x+ww*.7,y+hh]],main);
   }else{
    poly([[x,y+hh*.25],[x+ww*.72,y+hh*.25],[x+ww,y+hh],[x+ww*.28,y+hh]],light);
    poly([[x,y],[x+ww*.72,y],[x+ww*.72,y+hh*.22],[x,y+hh*.22]],main);
   }
  });
 }else if(style==='sev-pebbles'){
  cells(.35,.3,(x,y,i,j,ww,hh)=>{
   const shift=(j%2)*ww*.43;
   circle(x+shift+ww*.38,y+hh*.53,Math.min(ww,hh)*.35,(i+j)%3===0?light:main,grout);
   circle(x+shift+ww*.81,y+hh*.27,Math.min(ww,hh)*.18,light,grout);
  });
 }else if(style==='sev-albero'){
  cells(.24,.24,(x,y,i,j,ww,hh)=>{
   const v=Math.abs((i*37+j*17)%19)/19;
   circle(x+ww*(.22+v*.41),y+hh*(.18+v*.65),.018,
      v>.5?light:'#bfa070');
   if((i+j)%4===0)circle(x+ww*.65,y+hh*.3,.012,'#a58b63');
  });
 }
 return true;
}
