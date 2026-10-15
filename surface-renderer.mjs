import {textureImage,textureRevision} from './seville-textures.mjs';
import {paintSevilleSurface} from './editor-seville-surfaces.mjs';

// One material bitmap, measured in metres, used by editor, tile cache and
// rotated gameplay cameras. No screen-pixel minimums in a world-space call.
const SIZE=256,cache=new Map(),LIMIT=96;
const hash=(x,y,s=0)=>{let n=Math.imul(x^s,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0};
const rgb=s=>{const h=(s||'#99948a').replace('#','');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)||0)};
function canvasFor(ctx){
 if(typeof OffscreenCanvas!=='undefined'){try{const c=new OffscreenCanvas(SIZE,SIZE);if(c.getContext('2d'))return c}catch{}}
 if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=SIZE;return c}
 try{return new ctx.canvas.constructor(SIZE,SIZE)}catch{return null}
}
function materialTile(ctx,m){
 const key=m.id+':'+textureRevision();if(cache.has(key))return cache.get(key);
 const canvas=canvasFor(ctx),c=canvas?.getContext('2d');if(!c)return null;
 const style=m.pattern||'slabs';
 const coarse=/slab|band|stone/.test(style),paving=/asphalt|concrete|albero/.test(style);
 const metres=style==='art-caliza'?1.8:style==='art-granite'?1.84:coarse?2.72:paving?2:1.84;
 const base=rgb(m.base),seed=[...m.id].reduce((a,b)=>Math.imul(a^b.charCodeAt(0),16777619),2166136261);
 const data=c.createImageData(SIZE,SIZE);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const h=hash(x,y,seed),v=(h%19-9)*.65+(hash(x>>3,y>>3,seed)%13-6)*.45,i=(y*SIZE+x)*4;
  data.data[i]=base[0]+v;data.data[i+1]=base[1]+v;data.data[i+2]=base[2]+v;data.data[i+3]=255;
 }
 c.putImageData(data,0,0);
 const painted=textureImage(style==='art-caliza'?'caliza':style==='art-granite'?'piedra':null);
 if(painted){c.imageSmoothingEnabled=true;c.drawImage(painted,0,0,SIZE,SIZE)}
 else if(style.startsWith('sev-')){
  paintSevilleSurface(c,m,(x,y)=>[x*SIZE/metres,SIZE-y*SIZE/metres],SIZE/metres,[0,0,metres,metres]);
 }
 else if(!paving){
  const hex=/hex|no8do/.test(style),hydraulic=/hydraulic/.test(style),checker=/checker/.test(style);
  const rows=coarse?4:8,cols=coarse?4:8,W=SIZE/cols,H=SIZE/rows;
  c.lineJoin='round';
  for(let row=-1;row<=rows;row++)for(let col=-1;col<=cols;col++){
   const stagger=/cobble|gerena|quintana|art-granite/.test(style)?(row%2)*W/2:0;
   const x=col*W+stagger,y=row*H,variation=hash(col,row,seed)%11;
   c.fillStyle=checker?(Math.abs(col+row)%2?m.light:m.base):variation<2?m.light:m.base;
   c.strokeStyle=m.grout||'rgba(47,43,38,.40)';c.lineWidth=1.1;
   c.beginPath();
   if(hex){const xx=col*W*.75,yy=y+(col%2)*H/2;for(let i=0;i<6;i++){const a=i*Math.PI/3,p=[xx+W/2+Math.cos(a)*W/2,yy+H/2+Math.sin(a)*H/2];i?c.lineTo(...p):c.moveTo(...p)}}
   else c.rect(x+.7,y+.7,W-1.4,H-1.4);
   c.closePath();c.fill();c.stroke();
   c.save();c.clip();
   for(let i=0;i<22;i++){const n=hash(col*47+i,row*61+i,seed);c.fillStyle=n&1?'rgba(255,247,222,.13)':'rgba(35,34,29,.11)';c.fillRect(x+(n%253)/253*W,y+((n>>>9)%251)/251*H,1.3,1.3)}
   c.strokeStyle='rgba(255,244,220,.27)';c.lineWidth=.8;c.beginPath();c.moveTo(x+2,y+H-2);c.lineTo(x+2,y+2);c.lineTo(x+W-2,y+2);c.stroke();
   if(hydraulic){c.strokeStyle=m.light;c.lineWidth=1.7;c.beginPath();c.arc(x+W/2,y+H/2,W*.29,0,Math.PI*2);c.stroke();c.beginPath();c.arc(x+W/2,y+H/2,W*.1,0,Math.PI*2);c.stroke()}
   c.restore();
  }
 }
 if(!painted){
  // A translucent mineral field above the seams gives every legacy finish
  // real pigment variation while retaining its own geometry and motif.
  const grain=canvasFor(ctx),g=grain?.getContext('2d');
  if(g){const field=g.createImageData(SIZE,SIZE);for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const n=hash(x,y,seed),i=(y*SIZE+x)*4,v=90+(n%80)+(hash(x>>3,y>>3,seed)%37);field.data[i]=field.data[i+1]=field.data[i+2]=v;field.data[i+3]=70}g.putImageData(field,0,0);c.save();c.globalCompositeOperation='soft-light';c.drawImage(grain,0,0);c.restore()}
 }
 const result={canvas,metres};if(cache.size>=LIMIT)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export function surfaceCacheSize(){return cache.size}
export function paintWorldSurface(ctx,poly,m,pixel,visible=null){
 if(!Array.isArray(poly)||poly.length<3||poly.some(p=>!Array.isArray(p)||!p.slice(0,2).every(Number.isFinite)))return false;
 const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
 let area=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
 if(visible)area=[Math.max(area[0],visible[0]),Math.max(area[1],visible[1]),Math.min(area[2],visible[2]),Math.min(area[3],visible[3])];
 if(!(area[2]>area[0]&&area[3]>area[1]))return false;
 ctx.save();ctx.beginPath();poly.forEach((p,i)=>{const q=pixel(...p);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();
 ctx.fillStyle=m.base;ctx.fill();ctx.clip();
 const tile=materialTile(ctx,m),o=pixel(0,0),x=pixel(1,0),y=pixel(0,1);
 if(tile){
  const pattern=ctx.createPattern(tile.canvas,'repeat');
  if(pattern){
   const units=SIZE/tile.metres;
   ctx.transform((x[0]-o[0])/units,(x[1]-o[1])/units,(y[0]-o[0])/units,(y[1]-o[1])/units,o[0],o[1]);
   ctx.fillStyle=pattern;ctx.imageSmoothingEnabled=true;
   ctx.fillRect(area[0]*units,area[1]*units,(area[2]-area[0])*units,(area[3]-area[1])*units);
  }
 }
 ctx.restore();return true;
}
