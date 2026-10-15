import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {cleanFacade,drawFacadeDecor,drawFacadePresetPreview,facadeVisualBounds,FACADE_PRESETS} from '../editor-facades.mjs';
import {projectingSignType} from '../editor-projecting-signs.mjs';
import {registerTexture} from '../seville-textures.mjs';
import {paintCityScene} from '../city-scene.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/'),{createCanvas,loadImage}=require('@napi-rs/canvas');
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
registerTexture('gambrinus',await loadImage(fileURLToPath(new URL('../assets/sevilla/gambrinus.png',import.meta.url))));
const poly=[[1,3],[5,3],[5,5],[1,5]];
for(const [shop,symbol]of [['pharmacy','pharmacy'],['bar','gambrinus'],['tobacco','tobacco'],['cafe','cafe']]){
 const house={poly,facade:cleanFacade({shop,bladeDepth:.9,bladePosition:.5,bladeSize:.75})};assert.equal(projectingSignType(house.facade),symbol);
 const a=createCanvas(600,600),b=createCanvas(600,600);drawFacadeDecor(a.getContext('2d'),house,(x,y)=>[x*96,600-y*96],96);
 const bc=b.getContext('2d');bc.setTransform(96,0,0,96,0,600);drawFacadeDecor(bc,house,(x,y)=>[x,-y],1);
 assert.deepEqual(a.toBuffer('image/png'),b.toBuffer('image/png'),shop+' must match editor and gameplay scale');
 const pixel=a.getContext('2d').getImageData(3*96,Math.round(600-2.1*96),1,1).data;
 assert(pixel[3]>0,shop+' emblem must project beyond its wall');
 assert(facadeVisualBounds(house)[1]<2,'Visual culling must include the hanging sign');
}
assert.equal(projectingSignType(cleanFacade({shop:'bar',bladeSign:'none'})),'none');
const board=createCanvas(1200,370),ctx=board.getContext('2d');ctx.fillStyle='#182b29';ctx.fillRect(0,0,1200,370);
for(const [i,shop]of ['pharmacy','bar','tobacco','cafe'].entries()){
 const tile=createCanvas(290,320),c=tile.getContext('2d');c.fillStyle='#bcb7a7';c.fillRect(0,0,290,320);
 const doc={houses:[{poly:[[.5,2],[4.5,2],[4.5,5],[.5,5]],material:'realista-encalada-clara',facade:{shop,bladePosition:.5,bladeDepth:.85,bladeSize:.8}}]};
 paintCityScene(c,doc,(x,y)=>[x*56,310-y*56],56,()=>null);ctx.drawImage(tile,i*300+5,36);
 ctx.fillStyle='#f5e6cb';ctx.font='17px sans-serif';ctx.fillText(FACADE_PRESETS.find(p=>p.id===shop).name,i*300+12,25);
}
const out=new URL('../../qa-renders/',import.meta.url);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(new URL('projecting-shop-signs.png',out),board.toBuffer('image/png'));
console.log('PASS commerce signs: automatic symbols, outward projection, editor/game pixel parity, visual bounds and removable signs.');
