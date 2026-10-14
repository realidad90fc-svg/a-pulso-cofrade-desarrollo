import {drawDistinctShop} from './editor-shop-overhead.mjs';
// Decorative Sevillian street fronts in native editor world units.
// Attached to existing buildings; never exported as collision geometry.
// This is a stylised library of references, not photographic replicas.
export const FACADE_PRESETS=[
 {id:'none',name:'Sin comercio',sign:'',type:'none',color:'#e8d8bc',ink:'#413626'},
 {id:'bar',name:'Bar sevillano',sign:'BAR',type:'bar',color:'#823e36',ink:'#fff0cb'},
 {id:'cafe',name:'Cafetería',sign:'CAFETERÍA',type:'cafe',color:'#5f704b',ink:'#fff0ca'},
 {id:'pharmacy',name:'Farmacia',sign:'FARMACIA',type:'pharmacy',color:'#e1f0df',ink:'#25633e'},
 {id:'shop',name:'Comercio tradicional',sign:'COMERCIO',type:'shop',color:'#4e6173',ink:'#fff1d3'},
 {id:'campana',name:'La Campana · referencia',sign:'LA CAMPANA',type:'cafe',color:'#741f2b',ink:'#fce5b5'},
 {id:'maquedano',name:'Maquedano · referencia',sign:'MAQUEDANO',type:'shop',color:'#233d4c',ink:'#f7e0ac'},
 {id:'baratillo',name:'Bar El Baratillo · referencia',sign:'EL BARATILLO',type:'bar',color:'#92532c',ink:'#ffebc8'},
 {id:'morales',name:'Casa Morales · referencia',sign:'CASA MORALES',type:'bar',color:'#654d3a',ink:'#f4e2b9'}
];
export const AWNING_COLORS=[
 {id:'green',name:'Verde botella',hex:'#296a57'},
 {id:'red',name:'Granate',hex:'#872f3d'},
 {id:'cream',name:'Crema',hex:'#e7d4ab'},
 {id:'blue',name:'Azul oscuro',hex:'#34567d'},
 {id:'ochre',name:'Ocre',hex:'#bd8946'}
];
export function getFacadePreset(id){
 return FACADE_PRESETS.find(x=>x.id===id)||FACADE_PRESETS[0];
}
const number=(n,defaultValue,min,max)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):defaultValue;
export function cleanFacade(input={},edgeMax=3){
 const shop=getFacadePreset(input.shop).id;
 const balcony=['none','individual','continuous','reja'].includes(input.balcony)?input.balcony:'none';
 const awning=['none','plain','striped'].includes(input.awning)?input.awning:'none';
 const color=AWNING_COLORS.find(x=>x.id===input.awningColor)?.id||'green';
 return{
  edge:Math.floor(number(input.edge,0,0,Math.max(0,edgeMax))),
  balcony,balconyCount:Math.round(number(input.balconyCount,2,1,6)),
  flowers:!!input.flowers,hangings:!!input.hangings,
  awning,awningColor:color,awningDepth:number(input.awningDepth,.55,.2,1.2),
  shop,
  // A harmless sign label: never inserted as HTML.
  sign:String(input.sign||'').trim().slice(0,42)
 };
}
export function drawFacadeDecor(ctx,house,pixel,zoom=1){
 const poly=house?.poly,decor=house?.facade;
 if(!decor||!Array.isArray(poly)||poly.length<3)return;
 const f=cleanFacade(decor,poly.length-1);
 const a=poly[f.edge],b=poly[(f.edge+1)%poly.length];
 if(!a||!b)return;
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(length<.38||!Number.isFinite(length))return;
 const direction=[(b[0]-a[0])/length,(b[1]-a[1])/length];
 const signed=poly.reduce((sum,p,i)=>sum+p[0]*poly[(i+1)%poly.length][1]-p[1]*poly[(i+1)%poly.length][0],0);
 const outward=signed>=0?[direction[1],-direction[0]]:[-direction[1],direction[0]];
 const at=(t,d)=>[a[0]+direction[0]*length*t+outward[0]*d,
                     a[1]+direction[1]*length*t+outward[1]*d];
 const polygon=(start,end,inner,outer,color,line='#504739')=>{
  const pts=[at(start,inner),at(end,inner),at(end,outer),at(start,outer)];
  ctx.beginPath();pts.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});
  ctx.closePath();ctx.fillStyle=color;ctx.fill();
  if(line){ctx.strokeStyle=line;ctx.lineWidth=Math.max(.7,zoom*.02);ctx.stroke()}
 };
 const stroke=(u,v,color,width=.025)=>{
  const aa=pixel(...u),bb=pixel(...v);
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(.75,zoom*width);ctx.beginPath();
  ctx.moveTo(...aa);ctx.lineTo(...bb);ctx.stroke();
 };
 const span=Math.min(.045,.14/length);
 ctx.save();
 // Door/window rhythm and shopfront: drawn against one selected facade edge.
 // Every business gets its own true top-down decorative ground plan.
 // Signs are secondary to roofline, pavement and frontage shape.
 drawDistinctShop(ctx,{shop:f.shop,sign:f.sign,at,polygon,stroke,pixel,zoom,length});
 if(f.awning!=='none'){
  const base=AWNING_COLORS.find(c=>c.id===f.awningColor)?.hex||'#296a57';
  polygon(.06,.94,.42,.42+f.awningDepth,base,'#f7e8cd');
  if(f.awning==='striped'){
   for(let i=0;i<12;i++){
    if(i%2===0){
     const lo=.06+.88*i/12,hi=.06+.88*(i+1)/12;
     polygon(lo,hi,.43,.41+f.awningDepth,'rgba(248,235,204,.72)',null);
    }
   }
  }
  stroke(at(.06,.42+f.awningDepth),at(.94,.42+f.awningDepth),'#d2b998',.03);
 }
 if(f.balcony!=='none'){
  const count=f.balcony==='continuous'?1:f.balconyCount;
  const width=f.balcony==='continuous'?.88:Math.min(.78/count,.24);
  for(let i=0;i<count;i++){
   const t=(i+.5)/count;
   const from=Math.max(.03,t-width/2),to=Math.min(.97,t+width/2);
   polygon(from,to,-.09,.23,f.balcony==='reja'?'#d3c8b7':'#aeb0a5','#35312e');
   const bars=5;
   for(let j=0;j<=bars;j++){
    const v=from+(to-from)*j/bars;
    stroke(at(v,.05),at(v,.24),'#282b31',.019);
   }
   stroke(at(from,.24),at(to,.24),'#23282b',.036);
   if(f.flowers){
    for(let j=0;j<3;j++){
     const p=pixel(...at(from+(to-from)*(j+.5)/3,.26));
     ctx.fillStyle=j%2?'#af4149':'#46783f';
     ctx.beginPath();ctx.arc(...p,Math.max(1.3,zoom*.047),0,Math.PI*2);ctx.fill();
    }
   }
   if(f.hangings){
    polygon(from+.01,to-.01,.27,.47,'#8d2431','#d9b47c');
    stroke(at((from+to)/2,.31),at((from+to)/2,.44),'#d8b876',.023);
   }
  }
 }
 ctx.restore();
}
// Preview built from original preset colors rather than external trademark imagery.
// The thumbnail is a TOP-DOWN map crop using the EXACT SAME rendering
// function as the real editor/game, not a front/elevation illustration.
export function drawFacadePresetPreview(ctx,preset){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 const scale=Math.min((w-20)/7.6,(h-9)/4.55);
 const pix=(x,y)=>[10+x*scale,5+(4.5-y)*scale];
 const poly=[[.4,1.12],[7.15,1.12],[7.15,4.13],[.4,4.13]];
 ctx.save();
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#797770';ctx.fillRect(0,0,w,h);
 // Aerial roof surface/terrace: lines are parallel to the building edge.
 const tl=pix(.4,4.13),br=pix(7.15,1.12);
 ctx.fillStyle=preset.id==='maquedano'?'#cfbfa9':
  preset.id==='campana'?'#e5d1af':preset.id==='baratillo'?'#c59670':
  preset.id==='morales'?'#b9ab93':'#d8c5a6';
 ctx.fillRect(tl[0],tl[1],br[0]-tl[0],br[1]-tl[1]);
 ctx.strokeStyle='#79664f';ctx.lineWidth=3;
 ctx.strokeRect(tl[0],tl[1],br[0]-tl[0],br[1]-tl[1]);
 // Parallel tile courses. Deliberately no perspective, horizon or windows
 // in an upright wall: this is what the player sees from above.
 ctx.strokeStyle='rgba(82,56,40,.24)';ctx.lineWidth=1;
 for(let y=1.8;y<4;y+=.47){
  const p0=pix(.47,y),p1=pix(7.08,y);
  ctx.beginPath();ctx.moveTo(...p0);ctx.lineTo(...p1);ctx.stroke();
 }
 const facade={shop:preset.id,sign:preset.sign,
  edge:0,balcony:'none',awning:'none',flowers:false,hangings:false};
 drawFacadeDecor(ctx,{poly,facade},pix,scale);
 ctx.font='700 9px system-ui';ctx.textAlign='left';ctx.textBaseline='alphabetic';
 ctx.fillStyle='#f3f0e9';ctx.fillText('CALLE · VISTA CENITAL',9,h-3,Math.max(30,w-18));
 ctx.restore();
}