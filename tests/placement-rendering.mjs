import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {drawFurniture} from '../editor-materials.mjs';
import {drawUrbanElement} from '../editor-urban-elements.mjs';
import {drawTrafficSign,drawCheckpointGuide} from '../editor-object-render.mjs';
import {RuntimeEditorDraft} from '../game-editor-bridge.mjs';
import {paintPlacementPreview} from '../editor-placement-preview-render.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/'),{createCanvas,loadImage}=require('@napi-rs/canvas');
const person=await loadImage(fileURLToPath(new URL('../assets/original-animation/sprite-379.webp',import.meta.url)));
const images=new Map([['sharedassets2.assets:379',person]]);
const cases=[
 {kind:'fence',layer:'fences',item:{point:[2.5,2.5],width:.95},draw:(c,o,p,z)=>drawFurniture(c,o,'fence',p,z)},
 {kind:'chair',layer:'chairs',item:{point:[2.5,2.5],width:.4},draw:(c,o,p,z)=>drawFurniture(c,o,'chair',p,z)},
 {kind:'urban',type:'bench',layer:'urban',item:{point:[2.5,2.5],type:'bench'},draw:drawUrbanElement},
 {kind:'sign',layer:'signs',item:{point:[2.5,2.5]},draw:drawTrafficSign},
 {kind:'checkpoint',layer:'checkpoints',item:{position:[2.5,2.5]},draw:(c,o,p,z)=>drawCheckpointGuide(c,o,p,z,{label:false})}
];
for(const fixture of cases){
 const editor=createCanvas(480,480),game=createCanvas(480,480);
 fixture.draw(editor.getContext('2d'),fixture.item,(x,y)=>[x*96,480-y*96],96);
 const layers=Object.fromEntries(['roads','sidewalks','houses','people','trees','signs','checkpoints','fences','chairs','labels','urban'].map(k=>[k,[]]));layers[fixture.layer]=[fixture.item];
 new RuntimeEditorDraft({mapKey:'object-preview-qa',layers,total:1}).draw(game.getContext('2d'),[96,0,0,-96,0,480],images,game);
 const a=editor.getContext('2d').getImageData(0,0,480,480).data,b=game.getContext('2d').getImageData(0,0,480,480).data;
 let delta=0;for(let i=0;i<a.length;i++)delta+=Math.abs(a[i]-b[i]);
 assert(delta/a.length<.001,fixture.kind+' must match editor/game units');
 if(['fence','chair'].includes(fixture.kind)){
  let min=480,max=0;for(let y=0;y<480;y++)for(let x=0;x<480;x++)if(b[(y*480+x)*4+3]){min=Math.min(min,x);max=Math.max(max,x)}
  assert(max-min<110,'Furniture must not inherit a five-metre pixel minimum in gameplay');
 }
}
const previews=[...cases.map(({kind,type})=>({kind,type})),{kind:'fence',row:true,spacing:1.2},{kind:'person',id:'sharedassets2.assets:379',size:[.19,.19]},{kind:'paso',angle:47},{kind:'street-name',name:'Calle Arfe',radius:1}];
const board=createCanvas(1080,660),c=board.getContext('2d');c.fillStyle='#15232e';c.fillRect(0,0,1080,660);
for(const [i,spec]of previews.entries()){
 const canvas=createCanvas(328,200);paintPlacementPreview(canvas,spec,key=>images.get(key));
 c.drawImage(canvas,(i%3)*360+16,Math.floor(i/3)*220+20);
}
const out=new URL('../../qa-renders/',import.meta.url);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(new URL('placeable-objects.png',out),board.toBuffer('image/png'));
console.log('PASS placement rendering: shared fence/chair/urban/sign/checkpoint painters, metre-scale parity, row/person/street/paso previews.');
