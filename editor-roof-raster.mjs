import {textureImage,textureRevision} from './seville-textures.mjs';
// True locally-rasterized tile surfaces, shared by editor and gameplay.
// Each 240px bitmap represents a different number of metres depending
// on material. These are purely visual UV/repetition settings: never change
// geometry, collisions, sprite sizes, photo proportions, or map storage.
const SIZE=240, GRAIN=96, CACHE_MAX=30, cache=new Map();

/** World metres covered by one 240px image tile (used in editor and game). */
export function textureMetresFor(m){
 const style=String(m?.surfaceStyle||'');
 if(style.startsWith('tile-'))return 1.12; // curved clay pieces ~12 cm
 if(style.startsWith('mixed-'))return 1.08; // finer mixed roofs
 if(style==='marble'||style==='hydraulic'||style==='stone'
   ||style==='stone-aged'||style==='soleria-gris'
   ||style.startsWith('terracotta'))return .95; // stone/terracotta slabs
 if(style.startsWith('lime')||style.startsWith('concrete')||style==='ochre')return 1.25;
 return 1.12;
}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function seedFor(s){
 let h=2166136261>>>0;
 for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
 return h;
}
function hash(x,y,s){
 let h=Math.imul(x^s,374761393)^Math.imul(y+198491317,668265263);
 h=Math.imul(h^(h>>>13),1274126177);
 return (h^(h>>>16))>>>0;
}
function valNoise(x,y,scale,seed){
 const px=x/scale,py=y/scale,X=Math.floor(px),Y=Math.floor(py);
 const fx=px-X,fy=py-Y,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const a=(i,j)=>hash(X+i,Y+j,seed)/4294967295;
 return ((a(0,0)*(1-u)+a(1,0)*u)*(1-v)
       +(a(0,1)*(1-u)+a(1,1)*u)*v)*2-1;
}
function rgb(hex){
 const s=String(hex||'#b8afa0').replace('#','');
 const f=s.length===3?s.split('').map(c=>c+c).join(''):s;
 return[parseInt(f.slice(0,2),16)||0,parseInt(f.slice(2,4),16)||0,parseInt(f.slice(4,6),16)||0];
}
function bitmap(size=SIZE){
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=size;c.height=size;return c;
 }
 if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(size,size);
 return null;
}
function makeTile(m,variation){
 const tile=bitmap();if(!tile)return null;
 const g=tile.getContext('2d',{willReadFrequently:true});
 if(!g||!g.createImageData)return null;
 const seed=seedFor(String(m.id||m.surfaceStyle)+':'+variation);
 const base=rgb(m.base||'#cbbba6'),kind=m.surfaceStyle||'stone';
 const painted=kind.startsWith('tile-')?textureImage('teja'):null;
 if(painted){g.imageSmoothingEnabled=true;g.drawImage(painted,0,0,SIZE,SIZE);g.globalAlpha=.14;g.fillStyle=m.base;g.fillRect(0,0,SIZE,SIZE);g.globalAlpha=1;return tile;}

 const worn=/aged|vieja|dark|moss|antigu|patina|viejo/.test(kind);
 // Compute the fine pigment field only at 96px and upscale it before adding
 // full-resolution clay ridges and grout. This cuts the per-material grain
 // work by 84%, keeping game startup fluid on an iPhone.
 const grainCanvas=bitmap(GRAIN);
 const grain=grainCanvas?.getContext('2d',{willReadFrequently:true});
 if(!grain?.createImageData)return null;
 const data=grain.createImageData(GRAIN,GRAIN),px=data.data;
 for(let y=0;y<GRAIN;y++)for(let x=0;x<GRAIN;x++){
  const xx=x*SIZE/GRAIN,yy=y*SIZE/GRAIN;
  const broad=valNoise(xx,yy,57,seed^0x11111);
  const medium=valNoise(xx,yy,17,seed^0x76543);
  const dust=valNoise(xx,yy,4,seed^0x99cc);
  const grit=hash(x,y,seed^0xa45b)/4294967295-.5;
  const tone=broad*(worn?31:18)+medium*(worn?17:11)+dust*6+grit*19;
  const i=(y*GRAIN+x)*4;
  px[i]=clamp(base[0]+tone,0,255);
  px[i+1]=clamp(base[1]+tone*.98,0,255);
  px[i+2]=clamp(base[2]+tone*.92,0,255);
  px[i+3]=255;
 }
 grain.putImageData(data,0,0);
 g.imageSmoothingEnabled=true;
 g.drawImage(grainCanvas,0,0,SIZE,SIZE);
 let iter=0;const rand=()=>hash(++iter,seed>>>8,seed)/4294967295;
 const c=rgb(m.shadow||'#685647');
 const shadow=a=>'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
 const stroke=(color,width)=>{g.strokeStyle=color;g.lineWidth=width;g.stroke()};
 const high=m.detail||'#ead4b5';
 const stone=(a=0,b=SIZE,style=kind)=>{
  const W=style==='marble'?70:style==='hydraulic'?30:style==='stone-aged'?42:45;
  const H=style==='marble'?63:style==='hydraulic'?30:40;
  for(let row=-1;row<=Math.ceil(SIZE/H)+1;row++)
   for(let col=-2;col<=Math.ceil(SIZE/W)+1;col++){
    const x=col*W+((row%2&&style!=='hydraulic')?W*.45:0),y=row*H;
    if(x+W<a||x>b)continue;
    const shade=rand()*.19;
    g.fillStyle=rand()>.5?'rgba(250,242,214,'+shade.toFixed(3)+')':'rgba(57,42,37,'+(shade*.43).toFixed(3)+')';
    g.fillRect(x+2,y+2,W-4,H-4);
    g.beginPath();g.moveTo(x+1,y+H-1);g.lineTo(x+1,y+1);g.lineTo(x+W-1,y+1);
    stroke(shadow(worn?.48:.37),3.2);
    g.beginPath();g.moveTo(x+W-2,y+2);g.lineTo(x+W-2,y+H-2);g.lineTo(x+2,y+H-2);
    stroke('rgba(255,245,216,.37)',2.0);
    if(rand()>.66){
     g.beginPath();g.moveTo(x+W*.1,y+H*.2);
     g.bezierCurveTo(x+W*.31,y+H*.29,x+W*.52,y+H*.46,x+W*.85,y+H*.68);
     stroke(style==='marble'?'rgba(115,113,107,.45)':'rgba(94,77,62,.23)',style==='marble'?2.2:1.2);
    }
    if(style==='hydraulic'){
     g.beginPath();g.arc(x+W*.5,y+H*.5,W*.23,0,Math.PI*2);stroke('rgba(100,74,63,.53)',2);
     g.beginPath();g.arc(x+W*.5,y+H*.5,W*.08,0,Math.PI*2);g.fillStyle='#d7b68c';g.fill();
    }
   }
 };
 const tiles=(a=0,b=SIZE,style=kind)=>{
  const W=25,H=27;
  for(let row=-1;row<=Math.ceil(SIZE/H)+1;row++)
   for(let col=-2;col<=Math.ceil(SIZE/W)+1;col++){
    const x=col*W+(row%2)*W*.5,y=row*H;
    if(x+W<a||x>b)continue;
    const v=rand();
    g.fillStyle=v>.75?'rgba(251,212,158,.23)':'rgba(61,35,28,.18)';
    g.fillRect(x+2,y+3,W-3,H-5);
    g.beginPath();g.moveTo(x+W*.08,y+H*.12);
    g.bezierCurveTo(x+W*.28,y+H*.02,x+W*.75,y+H*.03,x+W*.93,y+H*.12);
    stroke(shadow(.80),4.5);
    g.beginPath();g.moveTo(x+W*.2,y+H*.25);
    g.bezierCurveTo(x+W*.34,y+H*.04,x+W*.72,y+H*.04,x+W*.82,y+H*.26);
    stroke(v>.50?high:style==='tile-dark'?'#a57f64':m.base,5.6);
    g.beginPath();g.moveTo(x+W*.08,y+H*.78);
    g.quadraticCurveTo(x+W*.50,y+H*.94,x+W*.92,y+H*.78);
    stroke('rgba(51,34,29,.62)',3.2);
    if((style==='tile-moss'||style==='tile-dark')&&rand()>.72){
     g.fillStyle=style==='tile-moss'?'rgba(57,86,47,.59)':'rgba(50,35,27,.43)';
     g.beginPath();g.ellipse(x+W*.60,y+H*.63,5.2,2.8,rand(),0,Math.PI*2);g.fill();
    }
   }
 };
 if(kind.startsWith('mixed-')){
  const split=Math.round(SIZE*(kind==='mixed-old'?.47:.59));
  g.save();g.beginPath();g.rect(0,0,split,SIZE);g.clip();stone(0,split);g.restore();
  g.save();g.beginPath();g.rect(split,0,SIZE-split,SIZE);g.clip();tiles(split,SIZE,kind==='mixed-old'?'tile-dark':'tile-red');g.restore();
  g.fillStyle=shadow(.58);g.fillRect(split-2,0,4,SIZE);
 }else if(kind.startsWith('tile-'))tiles();
 else if(/stone|marble|hydraulic|soleria|terracotta/.test(kind))stone();
 else if(kind.startsWith('paint-')){
  // Painted waterproofing: roller passes and pigment layers, with no
  // domestic floor tiles or visible checkerboard expansion-joint pattern.
  const aged=kind==='paint-worn',rubber=kind==='paint-rubber';
  for(let i=0;i<(aged?125:85);i++){
   const x=rand()*SIZE,y=rand()*SIZE,w=12+rand()*67,h=2+rand()*11;
   g.save();g.translate(x,y);g.rotate((rand()-.5)*.16);
   g.fillStyle=rand()>.46?
    'rgba(255,251,236,'+(aged?.13:.075)+')':
    'rgba(70,67,59,'+(aged?.115:.045)+')';
   g.fillRect(-w*.5,-h*.5,w,h);
   g.restore();
  }
  // Sun-bleached repaired waterproofing, subtle edge dirt and humidity.
  for(let i=0;i<(aged?31:14);i++){
   const x=rand()*SIZE,y=rand()*SIZE,rx=7+rand()*30,ry=4+rand()*14;
   g.fillStyle=rand()>.55?'rgba(252,246,230,.17)':
    rubber?'rgba(86,51,43,.11)':'rgba(72,76,65,.10)';
   g.beginPath();g.ellipse(x,y,rx,ry,(rand()-.5)*.5,0,Math.PI*2);g.fill();
  }
 }else{
  // Whitewash and concrete are naturally irregular, not flat tint cards.
  const spacing=kind==='ochre'?115:125;
  g.strokeStyle=shadow(.30);g.lineWidth=2.8;
  for(let x=spacing;x<SIZE;x+=spacing){g.beginPath();g.moveTo(x,0);g.lineTo(x,SIZE);g.stroke()}
  for(let y=spacing;y<SIZE;y+=spacing){g.beginPath();g.moveTo(0,y);g.lineTo(SIZE,y);g.stroke()}
  for(let i=0;i<(worn?48:28);i++){
   const x=rand()*SIZE,y=rand()*SIZE,rx=5+rand()*27,ry=3+rand()*13;
   g.fillStyle=rand()>.5?'rgba(68,59,48,.17)':'rgba(255,248,224,.17)';
   g.beginPath();g.ellipse(x,y,rx,ry,rand()*Math.PI,0,Math.PI*2);g.fill();
  }
  for(let i=0;i<(worn?18:7);i++){
   let x=rand()*SIZE,y=rand()*SIZE;g.beginPath();g.moveTo(x,y);
   for(let j=0;j<3;j++){x+=rand()*14-6;y+=rand()*15-8;g.lineTo(x,y)}
   stroke(shadow(.22),1.4);
  }
 }
 if(kind==='mixed-garden'){
  for(let i=0;i<4;i++){
   const x=22+i*29,y=25+(i%2)*171;
   g.fillStyle='#a88764';g.fillRect(x-8,y-8,16,16);
   g.beginPath();g.arc(x,y,6.8,0,Math.PI*2);g.fillStyle='#5b8050';g.fill();
  }
 }
 for(let i=0;i<(worn?430:230);i++){
  g.fillStyle=rand()>.5?'rgba(253,240,210,.32)':'rgba(58,48,43,.23)';
  const x=rand()*SIZE,y=rand()*SIZE,v=.65+rand()*1.45;g.fillRect(x,y,v,v);
 }
 return tile;
}
function cachedTile(m,seed){
 const key=String(m.id||m.surfaceStyle)+':'+(Math.abs(seed)%2)+':'+textureRevision();
 if(cache.has(key))return cache.get(key);
 const t=makeTile(m,Math.abs(seed)%2);if(!t)return null;
 if(cache.size>=CACHE_MAX)cache.delete(cache.keys().next().value);
 cache.set(key,t);return t;
}
export function paintRasterRoof(ctx,m,area,ppu,seed=0){
 if(!m?.surfaceStyle)return false;
 const image=cachedTile(m,seed);if(!image)return false;
 const {x0,y0,w,h}=area,z=Math.max(.001,ppu),step=textureMetresFor(m)*z;
 if(!(w>0&&h>0)||!Number.isFinite(w+h))return false;
 const xb=Math.floor(x0/step)*step,yb=Math.floor(y0/step)*step;
 ctx.save();ctx.beginPath();ctx.rect(x0,y0,w,h);ctx.clip();
 ctx.imageSmoothingEnabled=true;
 for(let y=yb;y<y0+h;y+=step)
  for(let x=xb;x<x0+w;x+=step)ctx.drawImage(image,x,y,step,step);
 ctx.restore();
 return true;
}
