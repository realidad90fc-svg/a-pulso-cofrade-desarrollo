import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {ROAD_MATERIALS,SIDEWALK_MATERIALS,drawSurface,drawRoof} from '../editor-materials.mjs';
import {registerTexture} from '../seville-textures.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
for(const name of ['piedra','caliza','teja'])registerTexture(name,await loadImage(new URL('../assets/sevilla/'+name+'.webp',import.meta.url).pathname));
const out=new URL('../../qa-renders/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const sample=(c,x,y)=>Array.from(c.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data);
const poly=[[10,5],[16,5],[16,9],[10,9]],visible=[10,5,16,9];
// Equivalent editor pixels and game world coordinates must paint the same
// world-locked texture, including offsets far from the origin.
const a=createCanvas(600,400),ac=a.getContext('2d');
drawSurface(ac,poly,'roads','road-art-granite',(x,y)=>[(x-10)*100,(9-y)*100],100,null,visible);
const b=createCanvas(600,400),bc=b.getContext('2d');bc.setTransform(100,0,0,100,-1000,900);
drawSurface(bc,poly,'roads','road-art-granite',(x,y)=>[x,-y],1,null,visible);
assert.deepEqual(a.toBuffer('image/png'),b.toBuffer('image/png'),'Editor and gameplay must paint identical material pixels');
const pixels=ac.getImageData(10,10,200,200).data,colours=new Set();for(let i=0;i<pixels.length;i+=4)colours.add(pixels.slice(i,i+3).join(','));
assert(colours.size>300,'Road must have visible texture, not a flat gray polygon');
const c=createCanvas(600,400),cc=c.getContext('2d');cc.fillStyle='#123456';cc.fillRect(0,0,600,400);
drawSurface(cc,[[0,0],[3,0],[0,3]],'sidewalks','sidewalk-art-caliza',(x,y)=>[x*100,400-y*100],100,null,[-1,-1,5,5]);
assert.deepEqual(sample(c,500,100),[18,52,86,255],'Material must remain inside its polygon');
const all=[...ROAD_MATERIALS,...SIDEWALK_MATERIALS],board=createCanvas(1000,Math.ceil(all.length/5)*145),ctx=board.getContext('2d');ctx.fillStyle='#19251e';ctx.fillRect(0,0,board.width,board.height);
for(const [i,m]of all.entries()){
 const x=(i%5)*200,y=Math.floor(i/5)*145;ctx.save();ctx.beginPath();ctx.rect(x+7,y+7,186,104);ctx.clip();
 drawSurface(ctx,[[0,0],[3,0],[3,1.65],[0,1.65]],m.id.startsWith('sidewalk')?'sidewalks':'roads',m.id,(wx,wy)=>[x+7+wx*62,y+111-wy*62],62,null,[0,0,3,1.65]);ctx.restore();ctx.fillStyle='#f3e8cf';ctx.font='11px sans-serif';ctx.fillText(m.name.slice(0,29),x+8,y+130);
}
fs.writeFileSync(new URL('material-library.png',out),board.toBuffer('image/png'));
fs.writeFileSync(new URL('road-editor-game-parity.png',out),a.toBuffer('image/png'));
const roof=createCanvas(650,400),rc=roof.getContext('2d');rc.fillStyle='#6c7067';rc.fillRect(0,0,650,400);
const houses=[[[0,0],[4,0],[4,4],[0,4]],[[4.5,0],[8.5,0],[8.5,4],[4.5,4]],[[9,0],[13,0],[13,4],[9,4]]];
for(const [i,house]of houses.entries())drawRoof(rc,house,['realista-teja-arabe','realista-mixta-tradicional','realista-encalada-patina'][i],(x,y)=>[x*45+25,350-y*45],()=>null,45,{roofDetail:'patio'});
fs.writeFileSync(new URL('seville-roofs.png',out),roof.toBuffer('image/png'));
console.log('PASS surfaces: pixel-identical editor/gameplay, detailed material, exact clipping, '+all.length+' preserved/new material IDs and material/roof render boards.');
