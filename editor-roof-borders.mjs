// Thin decorative parapets: same original polygon, visual strokes ONLY.
export const ROOF_BORDERS=[
 {id:'enlucido',name:'Pretil fino encalado',color:'#e5dcc9'},
 {id:'piedra',name:'Pretil de piedra natural',color:'#c1af91'},
 {id:'teja',name:'Remate de teja curva',color:'#b36e50'},
 {id:'decorativa',name:'Esquina decorativa',color:'#ddc5a5'},
 {id:'albardilla',name:'Albardilla clara',color:'#e9dfca'},
 {id:'cornisa',name:'Cornisa tradicional',color:'#c8b89a'},
 {id:'viejo',name:'Pretil encalado envejecido',color:'#c5b7a2'},
 {id:'comercial',name:'Borde de edificio comercial',color:'#b3a896'}
];
export function drawRoofBorder(ctx,points,pixel,zoom,id='enlucido',inset=.05){
 const item=ROOF_BORDERS.find(o=>o.id===id)||ROOF_BORDERS[0],z=Math.max(.01,zoom);
 const stroke=(color,width)=>{
  ctx.beginPath();points.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});
  ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=width*z;ctx.stroke();
 };
 const thin=Math.min(.09,Math.max(.039,Number(inset)||.05));
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 stroke('rgba(32,33,32,.22)',thin*2+.022);
 stroke(item.color,thin*1.6);
 stroke('rgba(255,248,230,.45)',.012);
 if(id==='cornisa'){stroke('rgba(93,74,51,.38)',thin*2+.065);stroke('#d4c3a5',thin*2+.039);stroke('#f0e4cd',thin*1.2);}
 if(id==='albardilla'){stroke('rgba(92,89,82,.31)',thin*2+.044);stroke('#e9deca',thin*1.3);}
 if(id==='piedra'){stroke('rgba(64,59,52,.39)',thin*2+.033);stroke('#c6b899',thin*1.6);}
 if(id==='viejo'){
  for(let i=0;i<points.length;i++){
   const p=points[i],q=points[(i+1)%points.length];
   const a=pixel(...p),b=pixel(...q),n=Math.floor(Math.hypot(a[0]-b[0],a[1]-b[1])/(.8*z));
   for(let j=0;j<n;j++){
    if((i*17+j*19)%5===0){
     const t=(j+.4)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
     ctx.beginPath();ctx.arc(x,y,Math.max(.7,.029*z),0,Math.PI*2);
     ctx.fillStyle='rgba(82,76,62,.32)';ctx.fill();
    }
   }
  }
 }
 if(id==='teja'){
  // Roof coping is individual curved clay tiles, visible in plan view.
  for(let i=0;i<points.length;i++){
   const a=pixel(...points[i]),b=pixel(...points[(i+1)%points.length]);
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const n=Math.min(180,Math.floor(length/(.25*z)));
   const ux=(b[0]-a[0])/Math.max(1,length),uy=(b[1]-a[1])/Math.max(1,length);
   for(let j=0;j<n;j++){
    const t=(j+.5)*length/n,x=a[0]+ux*t,y=a[1]+uy*t;
    ctx.beginPath();ctx.arc(x,y,.062*z,0,Math.PI*2);
    ctx.fillStyle=j%4?'#b86e50':'#ce8a60';ctx.fill();
    ctx.strokeStyle='rgba(77,47,39,.37)';ctx.lineWidth=Math.max(.4,.012*z);ctx.stroke();
   }
  }
 }
 if(id==='comercial'){stroke('rgba(48,49,49,.41)',thin*1.3);stroke('#c8c2b4',thin*.6);}
 if(id==='decorativa'){
  for(let i=0;i<points.length;i++){
   const p=pixel(...points[i]);
   ctx.beginPath();ctx.arc(...p,.105*z,0,Math.PI*2);
   ctx.fillStyle='#e8d7b9';ctx.fill();
   ctx.strokeStyle='#a99574';ctx.lineWidth=.019*z;ctx.stroke();
   ctx.beginPath();ctx.arc(p[0]-.018*z,p[1]-.018*z,.027*z,0,Math.PI*2);
   ctx.fillStyle='rgba(255,252,239,.59)';ctx.fill();
  }
 }
 ctx.restore();
}
