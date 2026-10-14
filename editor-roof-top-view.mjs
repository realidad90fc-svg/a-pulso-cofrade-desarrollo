// Lightly textured, plan-view Sevilla rooftops. Drawn in world-relative units
// and clipped by editor-roof-render to each EXISTING building footprint.
// No invented protrusions by default; optional identifiable roof elements
// are deliberately selected by the map author, never placed randomly.
import {paintRoofVariant} from './editor-roof-variants.mjs';
import {paintRasterRoof} from './editor-roof-raster.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const colors=[
 ['#c9ba9e','#e8dcc1','#a99b84'],['#c6aa87','#e5c89e','#a18367'],
 ['#b3765c','#dba486','#8e5948'],['#c1c1b8','#e5e4dc','#98998f'],
 ['#d7c7ab','#eee0c7','#aa977d']
];
const palettes={
 flat:['#e7deca','#faf4e5','#bbb19b'],
 tile:['#b66c50','#dc9976','#7e4e3e'],
 mixed:['#d9cbb2','#eee5d6','#b87a5d']
};
function paletteFor(m){
 if(m.roofFamily){
  const p=palettes[m.roofFamily]||palettes.flat;
  return{base:m.base||p[0],highlight:m.detail||p[1],shadow:m.shadow||p[2],kind:m.roofFamily};
 }
 const id=String(m.id||'roof-0-0').match(/^roof-(\d+)-(\d+)$/);
 const idx=id?+id[1]:0,mode=id?+id[2]:2;
 if(mode===0||mode===1)return{base:colors[(idx+2)%colors.length][0],highlight:'#dea486',shadow:'#885a49',kind:'tile'};
 if(mode===3)return{base:'#77756e',highlight:'#a6a49d',shadow:'#514f4e',kind:'flat'};
 return{base:colors[idx%colors.length][0],highlight:colors[idx%colors.length][1],shadow:colors[idx%colors.length][2],kind:'flat'};
}
export function paintArchitecturalRoof(ctx,layout,m,pixel,zoom,options={}){
 const points=layout.points.map(p=>pixel(...p));
 const sum=points.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]);
 const center=sum.map(x=>x/points.length);
 const start=points[layout.longestEdgeIndex||0],end=points[(layout.longestEdgeIndex+1)%points.length];
 const angle=Math.atan2(end[1]-start[1],end[0]-start[0]),co=Math.cos(angle),si=Math.sin(angle);
 const local=points.map(p=>{const dx=p[0]-center[0],dy=p[1]-center[1];return[dx*co+dy*si,-dx*si+dy*co]});
 const x0=Math.min(...local.map(p=>p[0])),x1=Math.max(...local.map(p=>p[0]));
 const y0=Math.min(...local.map(p=>p[1])),y1=Math.max(...local.map(p=>p[1]));
 const w=x1-x0,h=y1-y0,z=Math.max(.01,zoom),p=paletteFor(m),compact=layout.compact||w<.95*z||h<.72*z;
 if(!(w>0&&h>0))return;
 const rect=(x,y,ww,hh,fill)=>{ctx.fillStyle=fill;ctx.fillRect(x,y,ww,hh)};
 const strokeLine=(x,y,xx,yy,color,width=.012)=>{
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(.6,width*z);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();
 };
 const thin=(x,y,ww,hh,color,stroke=null)=>{
  rect(x,y,ww,hh,color);
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.55,.012*z);ctx.strokeRect(x,y,ww,hh)}
 };
 const tint=(col,alpha)=>{ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=col;ctx.fillRect(x0,y0,w,h);ctx.restore()};
 // Every mapped building has its own stored roofSeed, preventing a repeated
 // texture stamp even across neighboring roofs with identical dimensions.
 const seed=(Number.isFinite(options.roofSeed)?(options.roofSeed>>>0):
  Math.floor(layout.area*7823+layout.perimeter*2187))^(String(m.id||'').length*2654435761>>>0);
 const noise=k=>{let v=Math.imul((k+1)^seed,1103515245)>>>0;v^=v>>>15;return (v>>>0)/4294967295};
 ctx.save();ctx.translate(...center);ctx.rotate(angle);
 // Continuous roof body, modest tonal gradient and a restrained texture.
 rect(x0-.05*z,y0-.05*z,w+.1*z,h+.1*z,p.base);
 if(typeof ctx.createLinearGradient==='function'){
  const g=ctx.createLinearGradient(x0,y0,x1,y1);
  g.addColorStop(0,'rgba(255,251,240,.19)');
  g.addColorStop(.52,'rgba(255,251,240,0)');
  g.addColorStop(1,'rgba(40,33,28,.13)');
  rect(x0,y0,w,h,g);
 }
 const tileBand=(fromX,spanW,fromY,spanH)=>{
  if(spanW<.1*z||spanH<.1*z)return;
  rect(fromX,fromY,spanW,spanH,p.kind==='mixed'?p.shadow:p.base);
  const row=.19*z,col=.26*z;
  if(row<1.0||col<1.0)return;
  const rowN=Math.min(120,Math.ceil(spanH/row)),colN=Math.min(140,Math.ceil(spanW/col));
  // Tile rows are actual overlapping scales: paired highlight/dark arcs.
  for(let j=0;j<rowN;j++){
   const cy=fromY+j*row,shift=(j%2)*col*.5;
   for(let i=0;i<colN;i++){
    const cx=fromX+(i*col+shift);
    if(cx+col>fromX+spanW+.01||cy+row>fromY+spanH+.01)continue;
    ctx.beginPath();ctx.moveTo(cx,cy+row*.12);
    ctx.quadraticCurveTo(cx+col*.45,cy+row*.23,cx+col,cy+row*.13);
    ctx.strokeStyle=p.highlight;ctx.lineWidth=Math.max(.65,z*.025);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+col*.05,cy+row*.82);
    ctx.quadraticCurveTo(cx+col*.46,cy+row*.91,cx+col*.95,cy+row*.78);
    ctx.strokeStyle='rgba(57,36,30,.35)';ctx.lineWidth=Math.max(.45,z*.015);ctx.stroke();
    if(noise(j*109+i*7)>.88){ctx.fillStyle='rgba(255,224,184,.15)';ctx.fillRect(cx+.07*col,cy+.25*row,.65*col,.27*row)}
   }
  }
 };
 const slabs=(fromX,spanW,fromY,spanH)=>{
  const dx=.54*z,dy=.46*z;
  if(dx<3||dy<3)return;
  const rows=Math.min(100,Math.ceil(spanH/dy)+1),cols=Math.min(110,Math.ceil(spanW/dx)+1);
  for(let j=0;j<rows;j++){
   const cy=fromY+j*dy;
   for(let i=0;i<cols;i++){
    const cx=fromX+i*dx+(j%2)*dx*.5;
    if(cx>fromX+spanW||cy>fromY+spanH)continue;
    const maxW=Math.min(dx,fromX+spanW-cx),maxH=Math.min(dy,fromY+spanH-cy);
    if(maxW<=0||maxH<=0)continue;
    ctx.fillStyle=noise(j*231+i*17)>.65?'rgba(252,246,230,.11)':'rgba(81,73,59,.055)';
    ctx.fillRect(cx+.018*z,cy+.018*z,Math.max(.01,maxW-.035*z),Math.max(.01,maxH-.035*z));
    strokeLine(cx,cy,cx+maxW,cy,'rgba(83,75,64,.18)',.009);
    strokeLine(cx,cy,cx,cy+maxH,'rgba(83,75,64,.14)',.007);
   }
  }
 };
 // Legacy roofs already placed in saved maps also need real texture,
 // otherwise the game still shows the old flat stripes next to new roofs.
 // Preserve their base colors, IDs, geometry and optional rooftop details.
 const oldId=/^roof-(\d+)-(\d+)$/.exec(String(m.id||''));
 const family=m.roofFamily||null;
 const legacyStyle=oldId?(+oldId[2]<=1?'tile-red':+oldId[2]===2?'stone':'concrete-aged')
  :family==='tile'?'tile-red':family==='mixed'?'mixed-red':family==='flat'?'stone':null;
 const rasterMaterial=m.surfaceStyle?m:legacyStyle?{
  id:m.id,base:p.base,detail:p.highlight,shadow:p.shadow,
  surfaceStyle:legacyStyle
 }:null;
 if(rasterMaterial){
  // A MIXED ROOF IS TWO BUILDING AREAS, not an atlas with 50/50 texture
  // repeated every metre. Split the actual roof footprint only ONCE.
  if(String(rasterMaterial.surfaceStyle).startsWith('mixed-')){
   const variant=rasterMaterial.surfaceStyle;
   const sideVertical=(seed&1)===0,ratio=variant==='mixed-old'?.50:variant==='mixed-garden'?.57:.50;
   const stoneMaterial={...rasterMaterial,id:rasterMaterial.id+'-stone',roofFamily:'flat',
    surfaceStyle:variant==='mixed-old'?'stone-aged':'paint-lime-worn',
    base:variant==='mixed-old'?'#c8bdb1':'#e0d6c3',detail:'#f1e5cd',shadow:'#9c927f'};
   const tileMaterial={...rasterMaterial,id:rasterMaterial.id+'-tile',roofFamily:'tile',
    surfaceStyle:variant==='mixed-old'?'tile-dark':'tile-red',
    base:variant==='mixed-old'?'#8c6555':'#bc7555',
    detail:'#ddaa83',shadow:'#714b3d'};
   const first=sideVertical
    ?{x0,y0,w:w*ratio,h}:{x0,y0,w,h:h*ratio};
   const second=sideVertical
    ?{x0:x0+w*ratio,y0,w:w*(1-ratio),h}:{x0,y0:y0+h*ratio,w,h:h*(1-ratio)};
   let painted=true;
   for(const [part,material] of [[first,stoneMaterial],[second,tileMaterial]]){
    ctx.save();ctx.beginPath();ctx.rect(part.x0,part.y0,part.w,part.h);ctx.clip();
    painted=paintRasterRoof(ctx,material,part,z,seed)&&painted;ctx.restore();
   }
   if(!painted)paintRoofVariant(ctx,m,{x0,y0,w,h},z,noise);
   const seam=sideVertical?x0+w*ratio:y0+h*ratio;
   strokeLine(...(sideVertical?[seam,y0,seam,y1]:[x0,seam,x1,seam]),'rgba(93,76,59,.63)',.035);
   strokeLine(...(sideVertical?[seam+.045*z,y0,seam+.045*z,y1]:[x0,seam+.045*z,x1,seam+.045*z]),'rgba(251,240,218,.46)',.012);
   if(variant==='mixed-garden'){
    // Four little roof planters exclusively on the terrace half.
    for(let i=0;i<4;i++){
     const xx=sideVertical?x0+w*ratio*(.18+.18*i):x0+w*(.19+.20*i);
     const yy=sideVertical?y0+h*(.24+(i%2)*.46):y0+h*ratio*(.24+(i%2)*.45);
     const size=Math.min(.075*z,w*.027,h*.032);
     ctx.beginPath();ctx.arc(xx,yy,size*1.5,0,Math.PI*2);
     ctx.fillStyle='#9c7658';ctx.fill();
     ctx.beginPath();ctx.arc(xx,yy,size,0,Math.PI*2);
     ctx.fillStyle=i%2?'#547b48':'#71834e';ctx.fill();
    }
   }
  }else if(!paintRasterRoof(ctx,rasterMaterial,{x0,y0,w,h},z,seed)){
   if(m.surfaceStyle)paintRoofVariant(ctx,m,{x0,y0,w,h},z,noise);
   else if(p.kind==='tile')tileBand(x0,w,y0,h);
   else slabs(x0,w,y0,h);
  }
 }else if(p.kind==='tile'){
  tileBand(x0,w,y0,h);
  if(!compact){
   strokeLine(x0,y0+h*.5,x1,y0+h*.5,'rgba(85,51,39,.77)',.065);
   strokeLine(x0,y0+h*.5-.04*z,x1,y0+h*.5-.04*z,'rgba(235,174,122,.67)',.012);
  }
 }else if(p.kind==='mixed'){
  const half=w*.55;
  slabs(x0,half,y0,h);
  tileBand(x0+half,w-half,y0,h);
  strokeLine(x0+half,y0,x0+half,y1,'#9e8b72',.045);
 }else slabs(x0,w,y0,h);
 // Extremely faint weathering, deterministic and scaled in world units.
 if(!compact&&w>.75*z&&h>.75*z){
  for(let k=0;k<Math.min(34,Math.ceil(w*h/(z*z)*2));k++){
   const x=x0+.07*z+(w-.14*z)*noise(k*11+8);
   const y=y0+.07*z+(h-.14*z)*noise(k*13+29);
   ctx.fillStyle=k%3===0?'rgba(74,70,60,.035)':'rgba(254,250,241,.05)';
   ctx.fillRect(x,y,Math.min(.16*z,w*.1),Math.min(.07*z,h*.05));
  }
 }
 // Do not manufacture anonymous squares/diamonds above houses.
 // Architectural structures only appear when explicitly chosen in the editor.
 const feature=['patio','castillete','claraboya','instalaciones','terraza','lavadero'].includes(options.roofDetail)?options.roofDetail:'none';
 const sx=Math.min(1.15*z,w*.27),sy=Math.min(.95*z,h*.35);
 if(!compact&&w>2*z&&h>1.6*z&&feature!=='none'){
  const fx=x0+w*.58-sx*.5,fy=y0+h*.54-sy*.5;
  if(feature==='patio'){
   thin(fx,fy,sx,sy,'#d0c2a8','#e8dec8');
   thin(fx+.10*z,fy+.10*z,sx-.20*z,sy-.20*z,'#7e7a70','#ad9c80');
   strokeLine(fx+.12*z,fy+.13*z,fx+sx-.13*z,fy+.13*z,'#efe5cd',.035);
  }else if(feature==='castillete'){
   thin(fx+.08*z,fy+.09*z,sx,sy,'rgba(51,49,43,.25)');
   thin(fx,fy,sx,sy,'#d8c9ae','#9a866b');
   thin(fx,fy,sx,.23*z,'#c1ae90','#776b58');
   strokeLine(fx+.06*z,fy+.22*z,fx+sx-.06*z,fy+sy-.06*z,'rgba(125,104,79,.25)',.016);
  }else if(feature==='claraboya'){
   thin(fx+.05*z,fy+.04*z,sx-.1*z,sy-.08*z,'#e4d8c3','#85745f');
   thin(fx+.13*z,fy+.13*z,sx-.26*z,sy-.26*z,'#66868b','#4a6268');
   strokeLine(fx+.5*sx,fy+.14*z,fx+.5*sx,fy+sy-.14*z,'#cbdfe0',.018);
   strokeLine(fx+.14*z,fy+.5*sy,fx+sx-.14*z,fy+.5*sy,'#bed5d7',.018);
  }else if(feature==='instalaciones'){
   for(let i=0;i<2;i++){
    const x=fx+i*.51*z;
    thin(x,fy,.44*z,.42*z,'#9a9c96','#61655f');
    const cx=x+.22*z,cy=fy+.20*z;
    ctx.beginPath();ctx.arc(cx,cy,.125*z,0,Math.PI*2);
    ctx.strokeStyle='#555951';ctx.lineWidth=.027*z;ctx.stroke();
    strokeLine(cx-.1*z,cy-.1*z,cx+.1*z,cy+.1*z,'#535951',.019);
   }
  }else if(feature==='terraza'){
   // Recognisable top-view pots and a little round terrace table.
   const cx=fx+sx*.5,cy=fy+sy*.5,r=Math.min(.20*z,sy*.30);
   ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
   ctx.fillStyle='#c5b08d';ctx.fill();ctx.strokeStyle='#756653';
   ctx.lineWidth=.024*z;ctx.stroke();
   for(let i=0;i<4;i++){
    const a=i*Math.PI/2,tx=cx+Math.cos(a)*r*1.9,ty=cy+Math.sin(a)*r*1.9;
    ctx.beginPath();ctx.arc(tx,ty,.075*z,0,Math.PI*2);
    ctx.fillStyle=i%2?'#4d723c':'#74904d';ctx.fill();
    ctx.strokeStyle='#98755b';ctx.lineWidth=.023*z;ctx.stroke();
   }
  }else if(feature==='lavadero'){
   // Two small washing lines, laundry silhouettes and outdoor washbasin.
   const xa=fx+.1*z,xb=fx+sx-.07*z;
   for(let k=0;k<2;k++){
    const yy=fy+.16*z+k*.27*z;
    strokeLine(xa,yy,xb,yy,'#666b69',.022);
    for(let j=0;j<3;j++){
     const xx=xa+.09*z+j*.23*z;
     thin(xx,yy+.014*z,.12*z,.17*z,[(k+j)%2?'#e5e5d7':'#92b6bd']);
     strokeLine(xx,yy,xx+.12*z,yy,'#4d5c59',.012);
    }
   }
   thin(fx+sx*.63,fy+sy*.68,.28*z,.18*z,'#cac6bb','#868c89');
  }
 }
 ctx.restore();
}
