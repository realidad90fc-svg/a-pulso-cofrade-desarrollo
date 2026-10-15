// Bird's-eye storefront details. Every preset is a distinct plan composition,
// NOT a facade elevation with only the lettering replaced.
// All coordinates are relative to an EXISTING building's chosen edge.
// Draw-only. No shape changes and no collision objects are generated here.
const styles={
 bar:{wall:'#895943',trim:'#e1c5a0',roof:'#75533e',sign:'#392a24',ink:'#ffe9c9'},
 cafe:{wall:'#dcc7a0',trim:'#967451',roof:'#b8a383',sign:'#516749',ink:'#fff8d4'},
 pharmacy:{wall:'#e4e6d6',trim:'#488961',roof:'#b8c9b7',sign:'#377b53',ink:'#f8fff1'},
 tobacco:{wall:'#d3bf96',trim:'#d3aa50',roof:'#8e5344',sign:'#972b34',ink:'#f7d780'},
 shop:{wall:'#aa9c86',trim:'#c9b997',roof:'#647c82',sign:'#3e555f',ink:'#f8eccc'},
 campana:{wall:'#ebdab6',trim:'#ad8658',roof:'#d7c8a8',sign:'#802935',ink:'#fff3d4'},
 maquedano:{wall:'#c0afa0',trim:'#795d45',roof:'#b08e68',sign:'#4d3428',ink:'#ffe4ac'},
 baratillo:{wall:'#e2bf8d',trim:'#975f3c',roof:'#bd8d63',sign:'#93512e',ink:'#fff0cf'},
 morales:{wall:'#c6b99d',trim:'#645140',roof:'#9a8063',sign:'#4d3a2e',ink:'#f8e3bd'}
};
export function drawDistinctShop(ctx,{shop,sign,at,polygon:quad,stroke,pixel,zoom,length}){
 const style=styles[shop];
 if(!style)return;
 const maxInset=Math.min(.78,length*.23);
 const inset=.12+maxInset;
 const Q=(s,e,a,b,color,border=null)=>quad(s,e,a,b,color,border);
 const L=(s,d,e,z,color,w=.025)=>stroke(at(s,d),at(e,z),color,w);
 const circle=(t,d,r,fill,outline=null,w=.022)=>{
  const p=pixel(...at(t,d));
  ctx.beginPath();ctx.arc(p[0],p[1],Math.max(1.1,r*zoom),0,Math.PI*2);
  ctx.fillStyle=fill;ctx.fill();
  if(outline){ctx.strokeStyle=outline;ctx.lineWidth=Math.max(.75,w*zoom);ctx.stroke()}
 };
 const diamond=(t,d,r,fill)=>{
  const p=[at(t,d+r),at(t+r/Math.max(length,.01),d),at(t,d-r),at(t-r/Math.max(length,.01),d)];
  ctx.beginPath();p.forEach((v,i)=>{const q=pixel(...v);i?ctx.lineTo(...q):ctx.moveTo(...q)});
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 };
 const glass=(a,b,d=.10)=>{
  Q(a,b,-.08,d,'#4d6e73','#e6ddc7');
  L(a+.008,d*.5,b-.008,d*.5,'#dce7dd',.018);
 };
 // Plan-view band inside the existing building: roof lines, roofline,
 // skylights, verandas, barrels and canopies occupy DIFFERENT geometries.
 Q(.025,.975,-inset,-.04,style.roof,'#604b38');
 if(shop==='campana'){
  // La Campana: pale masonry, traditional dark-red timber shopfront,
  // broad red-and-cream confectionery canopy and glass display sections.
  Q(.025,.975,-inset,-inset+.17,'#f2dfb6','#ac916b');
  Q(.035,.965,-inset+.19,-.19,'#d5b68e');
  for(let i=0;i<7;i++){
   const t=.075+i*.12;
   Q(t,t+.055,-inset+.22,-.20,i%2?'#deb18f':'#f1e1c4',null);
  }
  for(let i=0;i<4;i++){
   const t=.13+i*.245;
   glass(t,t+.14,-.015);
   circle(t+.07,-.22,.07,'#f4d2a0','#925d3d');
   circle(t+.07,-.22,.029,'#a46c43');
  }
  // A fixed distinctive scalloped marquee is seen from directly above.
  Q(.015,.985,.05,.33,'#8e2734','#e4c394');
  for(let i=0;i<11;i++){
   const a=.02+i*.087,b=a+.041;
   Q(a,b,.055,.31,'#edd5a7',null);
  }
 }else if(shop==='maquedano'){
  // Modernist wood and marble composition, curved display bays and
  // hat-display motifs. Distinct from cafe/red striped La Campana.
  Q(.025,.975,-inset,-inset+.16,'#ebdbcb','#876c55');
  Q(.04,.96,-inset+.19,-.30,'#6c4b35','#c3a37d');
  for(let i=0;i<3;i++){
   const t=.18+i*.31;
   Q(t-.112,t+.112,-.29,-.035,'#304b50','#b59363');
   circle(t,-.12,.105,'#bca077','#553f30');
   circle(t,-.12,.063,'#e4cfac','#684e3b');
   circle(t,-.12,.018,'#6f5236');
   diamond(t,-inset+.26,.06,'#ead2a1');
  }
  for(const t of [.05,.36,.67,.95])L(t,-inset+.10,t,.24,'#65442f',.055);
  Q(.02,.98,.12,.31,'#674a36','#d5b78a');
 }else if(shop==='baratillo'){
  // Traditional Arenal tavern: terracotta tiles, azulejo strips,
  // little iron grille and deep ochre clay-tile canopy.
  Q(.03,.97,-inset+.12,-.12,'#ba6e4b');
  for(let i=0;i<14;i++){
   const t=.06+i*.063;
   L(t,-inset+.14,t,-.12,'#e9b987',.018);
  }
  Q(.055,.945,-.10,.07,'#ecdfbc','#875f43');
  for(let i=0;i<12;i++){
   Q(.075+i*.071,.11+i*.071,.075,.23,i%2?'#f0eee2':'#447b94',null);
  }
  Q(.025,.975,.26,.49,'#a64e34','#d8bb87');
  for(let i=0;i<9;i++)L(.07+i*.105,.29,.07+i*.105,.48,'#e4a579',.02);
  circle(.14,-.35,.09,'#f3d5a4','#463d36');
  circle(.86,-.35,.09,'#f3d5a4','#463d36');
 }else if(shop==='morales'){
  // A bodega: old timber joists, stone floor and distinct top-down
  // wine barrel heads along the inside of the store.
  Q(.035,.965,-inset+.10,-.10,'#ab9275','#5a4838');
  for(let i=0;i<9;i++)L(.06+i*.106,-inset+.09,.06+i*.106,-.11,'#5b4032',.04);
  for(let i=0;i<4;i++){
   const t=.16+i*.22;
   circle(t,-inset+.31,.16,'#9c6539','#503b2e',.06);
   circle(t,-inset+.31,.11,'#cc9c60','#765038',.02);
   circle(t,-inset+.31,.03,'#69482e');
  }
  Q(.025,.975,.08,.29,'#3a5740','#e1c8a1');
  for(let i=0;i<5;i++){
   const t=.11+i*.19;L(t,.11,t,.28,'#b39b6c',.02);
  }
 }else if(shop==='pharmacy'){
  Q(.06,.94,-inset+.08,-.12,'#edf2e7');
  for(let i=0;i<11;i++){
   const t=.07+i*.08;L(t,-inset+.09,t,-.11,'#b2d4c3',.011);
  }
  Q(.16,.84,.02,.22,'#2e855e','#ecf5e8');
  const crossPos=.49,r=Math.min(.22,maxInset*.65);
  Q(.445,.555,-inset+.10,-.13,'#409b65');
  Q(.32,.68,-inset+.10+r*.40,-inset+.10+r*.9,'#409b65');
  circle(crossPos,-.15,.025,'#fff');
 }else if(shop==='tobacco'){
  Q(.04,.96,-inset+.08,-.10,'#945b42');Q(.06,.94,.03,.22,'#9b2931','#f3d078');for(let i=0;i<5;i++)Q(.09+i*.17,.20+i*.17,-inset+.14,-.16,'#d9b676','#6c4633');
 }else if(shop==='bar'){
  Q(.05,.95,-inset+.10,-.12,'#a38b67');
  for(let i=0;i<7;i++){
   const t=.09+i*.13;L(t,-inset+.11,t,-.12,'#d5b07a',.022);
  }
  Q(.04,.96,.07,.33,'#415d42','#d6c18d');
  for(let i=0;i<4;i++)circle(.16+i*.23,-.26,.11,'#5c4739','#e4cfaa');
 }else if(shop==='cafe'){
  Q(.03,.97,-inset+.08,-.12,'#e7d5a7');
  Q(.09,.91,.02,.31,'#67825c','#e9d9b2');
  for(let i=0;i<4;i++){
   const t=.14+i*.24;
   circle(t,-.27,.15,i%2?'#f2e0b8':'#d7c99d','#806f56');
   circle(t,-.27,.045,'#9c7954');
  }
 }else if(shop==='shop'){
  Q(.05,.95,-inset+.08,-.13,'#637e86');
  for(let i=0;i<5;i++){
   const start=.07+i*.18;
   Q(start,start+.135,-inset+.13,-.18,'#a8ccd2','#d7d1bd');
   L(start+.067,-inset+.14,start+.067,-.19,'#54707a',.018);
  }
  Q(.045,.955,.05,.31,'#455a68','#ebe3ce');
 }
 // Each commerce gets an architecturally distinct threshold, not repeated
 // "five windows and another name".
 if(shop!=='campana'&&shop!=='baratillo'&&shop!=='maquedano'&&shop!=='morales'){
  glass(.04,.28,.02);glass(.72,.96,.02);
 }
 // Fixed, plan-visible street sign. Labels can be overridden by the user.
 const palette=(styles[shop]||styles.shop);
 const plate={campana:[.17,.83,.35,.59],maquedano:[.24,.76,.34,.58],
  baratillo:[.20,.80,.50,.73],morales:[.17,.83,.32,.53]}[shop]||[.24,.76,.34,.54];
 Q(...plate,palette.sign,'#d8bf92');
 const center=pixel(...at((plate[0]+plate[1])/2,(plate[2]+plate[3])/2));
 const p0=pixel(...at(0,plate[2])),p1=pixel(...at(1,plate[2]));
 let angle=Math.atan2(p1[1]-p0[1],p1[0]-p0[0]);
 if(angle>Math.PI/2||angle<-Math.PI/2)angle+=Math.PI;
 ctx.save();ctx.translate(...center);ctx.rotate(angle);
 const text=(sign||{
  bar:'BAR',cafe:'CAFETERÍA',pharmacy:'FARMACIA',tobacco:'TABACOS',shop:'COMERCIO',
  campana:'LA CAMPANA',maquedano:'MAQUEDANO',baratillo:'EL BARATILLO',morales:'CASA MORALES'
 }[shop]||'').slice(0,36);
 ctx.font='800 '+Math.max(7,Math.min(16,.18*zoom))+'px system-ui';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=palette.ink;
 ctx.fillText(text,0,0,Math.max(10,length*(plate[1]-plate[0])*zoom*.95));
 ctx.restore();
}
