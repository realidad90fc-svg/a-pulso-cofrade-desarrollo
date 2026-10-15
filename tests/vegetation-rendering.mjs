import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {TREE_VARIANTS,drawTree,treeDrawRadius} from '../editor-materials.mjs';
import {registerTexture,textureImage,VEGETATION_FILES} from '../seville-textures.mjs';
import {RuntimeEditorDraft} from '../game-editor-bridge.mjs';

const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const original=await loadImage(fileURLToPath(new URL('../assets/original-animation/sprite-563.webp',import.meta.url)));
const images=new Map([['sharedassets2.assets:563',original]]);
for(const tree of TREE_VARIANTS.filter(t=>t.texture)){
 const file='../assets/sevilla/'+VEGETATION_FILES[tree.texture.slice(5)];
 const image=await loadImage(fileURLToPath(new URL(file,import.meta.url)));
 assert.equal(image.width,512);assert.equal(image.height,512);
 const sample=createCanvas(128,128),c=sample.getContext('2d');c.drawImage(image,0,0,128,128);
 const pixels=c.getImageData(0,0,128,128).data,colours=new Set();let transparent=0,opaque=0;
 for(let i=0;i<pixels.length;i+=4){
  if(pixels[i+3]===0)transparent++;
  if(pixels[i+3]>200){opaque++;colours.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2])}
 }
 assert(transparent>128*128*.12,tree.id+' must have real transparency around the foliage');
 assert(opaque>128*128*.18,tree.id+' must contain a visible crown');
 assert(colours.size>600,tree.id+' must preserve leaf texture at game size');
 registerTexture(tree.texture,image);assert.equal(textureImage(tree.texture),image);
}
const signatures=new Set();
const board=createCanvas(1200,650),ctx=board.getContext('2d');ctx.fillStyle='#15232e';ctx.fillRect(0,0,1200,650);
for(const [index,variant]of TREE_VARIANTS.entries()){
 const tree={point:[2.5,2.5],variant:variant.id,radius:.8,scale:.94,rotation:47};
 const editor=createCanvas(480,480),game=createCanvas(480,480);
 drawTree(editor.getContext('2d'),tree,(x,y)=>[x*96,480-y*96],96,key=>images.get(key));
 const layers=Object.fromEntries(['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs','labels','urban'].map(k=>[k,[]]));layers.trees=[tree];
 const runtime=new RuntimeEditorDraft({mapKey:'vegetation-qa',layers,total:1});
 runtime.draw(game.getContext('2d'),[96,0,0,-96,0,480],images,game);
 const a=editor.getContext('2d').getImageData(0,0,480,480).data,b=game.getContext('2d').getImageData(0,0,480,480).data;
 let difference=0,maxDifference=0;for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);difference+=delta;maxDifference=Math.max(maxDifference,delta)}
 assert(difference/a.length<.001,variant.id+' editor and real game bridge must match at subpixel precision (max delta '+maxDifference+')');
 signatures.add(editor.toBuffer('image/png').toString('base64'));
 assert.equal(treeDrawRadius(tree,1),.8*.94,'Visual upgrade must preserve saved tree sizes');
 const x=(index%4)*300+12,y=Math.floor(index/4)*325+40;
 ctx.fillStyle='#c2bfae';ctx.fillRect(x,y,276,260);
 drawTree(ctx,{...tree,point:[0,0],rotation:0},()=>[x+138,y+130],144,key=>images.get(key));
 ctx.fillStyle='#f5ecdb';ctx.font='17px sans-serif';ctx.fillText(variant.name,x,y-12);
}
assert.equal(signatures.size,8,'Each model must have its own appearance');
const fallback=createCanvas(200,200);drawTree(fallback.getContext('2d'),{point:[0,0],radius:.8,variant:'old-unknown-id'},()=>[100,100],96,key=>images.get(key));
assert(fallback.getContext('2d').getImageData(100,100,1,1).data[3]>0,'Unknown old IDs retain the original tree');
const out=new URL('../../qa-renders/',import.meta.url);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(new URL('vegetation-editor-game.png',out),board.toBuffer('image/png'));
console.log('PASS vegetation: seven detailed alpha textures, eight distinct models, unchanged saved size and editor/runtime rendering parity within subpixel rounding.');
