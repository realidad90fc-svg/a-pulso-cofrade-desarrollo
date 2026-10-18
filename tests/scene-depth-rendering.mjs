import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {drawOverhead} from '../overhead-render.mjs';
import {drawFurniture} from '../editor-materials.mjs';
import {newUrbanElement,drawUrbanElement,urbanElementSize,urbanCollisionSize} from '../editor-urban-elements.mjs';
import {paintCityScene,paintCityObjects} from '../city-scene.mjs';
import {RuntimeEditorDraft,attachEditorDraft,obstaclesFor} from '../game-editor-bridge.mjs';
import {blankMapDocument,validateMapDocument,createCityProject,addCityMap} from '../city-project.mjs';
import {reorderSelection,captureBlock,placeBlock,groupSelection} from '../editor-selection-model.mjs';
import {sceneDrawOrder} from '../scene-order.mjs';
import {makeGameDraft} from '../editor-game-draft.mjs';
import {registerTexture} from '../seville-textures.mjs';
import {makeProjectPackage,validateProjectPackage} from '../editor-project-package.mjs';
import {Renderer} from '../renderer.mjs';
import {data,resources,OriginalSimulation,prepareMap,prepareStep} from './gameplay-resources.mjs';
import {customMap} from '../custom-routes.mjs';
import {ARENAL_ROUTE} from '../arenal-data.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/'),{createCanvas,loadImage}=require('@napi-rs/canvas');
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
const pixel=(x,y)=>[256+x*96,256-y*96],projection=[96,0,0,-96,256,256],sample=(c,x=256,y=256)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
function bounds(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}return[x0,y0,x1,y1];}
let cases=0;
for(const type of ['lintel-church','lintel-cathedral','lintel-chapel','arch-postigo'])for(const depth of [.06,.24,.6])for(const angle of [0,30,90,145]){
 const item=newUrbanElement(type,[0,0],{width:3,depth,angle}),editor=createCanvas(512,512),game=createCanvas(512,512);
 drawOverhead(editor.getContext('2d'),item,pixel,96);const g=game.getContext('2d');g.setTransform(96,0,0,96,256,256);drawOverhead(g,item,(x,y)=>[x,-y],1);
 const b=bounds(game),a=angle*Math.PI/180,w=(Math.abs(Math.cos(a))*3+Math.abs(Math.sin(a))*depth)*96,h=(Math.abs(Math.sin(a))*3+Math.abs(Math.cos(a))*depth)*96;
 assert(b[2]-b[0]+1<=Math.ceil(w)+2&&b[3]-b[1]+1<=Math.ceil(h)+2,'Portal must fit the dimensions actually placed');assert.deepEqual(b,bounds(editor),'Game and editor must agree at world/screen scales');cases++;
}
const fence=createCanvas(512,512);drawFurniture(fence.getContext('2d'),{point:[0,0],width:3,depth:.18},'fence',pixel,96);const fb=bounds(fence);assert(fb[3]-fb[1]+1<=10,'A red rail has no projecting feet');
const bollard=newUrbanElement('bollard',[0,0]),bc=createCanvas(512,512);drawUrbanElement(bc.getContext('2d'),bollard,pixel,96);assert.deepEqual(urbanElementSize(bollard),[.12,.12]);assert.deepEqual(urbanCollisionSize(bollard),[.12,.12]);const bb=bounds(bc);assert(bb[2]-bb[0]<12&&bb[3]-bb[1]<12,'Bollard must be smaller than a spectator');assert.deepEqual(urbanElementSize({...bollard,size:[.3,.4]}),[.3,.4],'Explicitly resized objects retain their dimensions');
const green=createCanvas(32,32),blue=createCanvas(32,32);green.getContext('2d').fillStyle='#228833';green.getContext('2d').fillRect(0,0,32,32);blue.getContext('2d').fillStyle='#1649fa';blue.getContext('2d').fillRect(0,0,32,32);registerTexture('tree-naranjo',green);
const images=new Map([['sharedassets2.assets:563',green],['person',blue]]),get=k=>images.get(k);
const doc=blankMapDocument({key:'depth',name:'Capas'});doc.trees=[{point:[0,0],radius:.7}];doc.fences=[{point:[0,0],width:2}];doc.people=[{key:'person',point:[0,0],size:[.3,.3]}];
for(const painter of ['city','patch']){const c=createCanvas(512,512);if(painter==='city')paintCityScene(c.getContext('2d'),doc,pixel,96,get);else new RuntimeEditorDraft({mapKey:'depth',layers:doc,total:1}).draw(c.getContext('2d'),projection,images,c);assert.deepEqual(sample(c),[34,136,51,255],painter+': tree above fence and public');}
doc.trees=[];doc.urban=[newUrbanElement('lintel-church',[0,0],{depth:.24})];const render=()=>{const c=createCanvas(512,512);paintCityObjects(c.getContext('2d'),doc,pixel,96,get);return c;};assert.notDeepEqual(sample(render()),[22,73,250,255],'Public below lintel');
const pick=[{type:'people',index:0}],original=JSON.stringify(doc.people[0]),physics=obstaclesFor(doc),baseline=structuredClone(doc);
for(let i=0;i<5;i++)reorderSelection(doc,pick,'forward');assert.deepEqual(sample(render()),[22,73,250,255],'Manual foreground order works across object families');assert.deepEqual(obstaclesFor(doc),physics,'Drawing order does not change physical height or footprints');assert(makeGameDraft(doc,baseline).layers.people.length===1,'Order-only edits reach the game');
const block=captureBlock(doc,pick);placeBlock(doc,block,{point:[2,2]});assert.equal(doc.people[1].edit.drawOrder,80);doc.people.pop();const restored=JSON.parse(JSON.stringify(doc));validateMapDocument(restored);assert.equal(sceneDrawOrder('people',restored.people[0]),80);
reorderSelection(doc,pick,'reset');assert.equal(JSON.stringify(doc.people[0]),original.replace(/}$/,',"edit":{}}'),'Reset retains only empty authoring metadata');assert.notDeepEqual(sample(render()),[22,73,250,255]);
const groupPicks=[...pick,{type:'fences',index:0}];groupSelection(doc,groupPicks);const gap=sceneDrawOrder('people',doc.people[0])-sceneDrawOrder('fences',doc.fences[0]);reorderSelection(doc,pick,'forward');assert.equal(sceneDrawOrder('people',doc.people[0])-sceneDrawOrder('fences',doc.fences[0]),gap,'Group ordering preserves relative levels');
doc.people[0].edit.locked=true;assert.throws(()=>reorderSelection(doc,pick,'backward'),/bloquead/);doc.people[0].edit.locked=false;assert.throws(()=>validateMapDocument({...doc,trees:[{point:[0,0],edit:{drawOrder:Infinity}}]}),/orden visual/);
const project=createCityProject([]),added=addCityMap(project,{name:'Alturas'});const packedDoc={...doc,metadata:{...added.document.metadata}};const pkg=validateProjectPackage(JSON.parse(JSON.stringify(makeProjectPackage({meta:{id:'depth-project',name:'Alturas'},project,documents:{[added.meta.key]:packedDoc}}))));assert.equal(pkg.city.documents[added.meta.key].people[0].edit.drawOrder,40,'Project export/import preserves manual order');
// Full Renderer with real animated actors: a lintel must cover the paso, not
// merely the static crowd. Check the same case in a new map and legacy patch.
const actorImages=new Map();
for(const mode of ['city','patch','arenal']){
 const d=blankMapDocument({key:'depth-'+mode,name:'Altura real'});d.roads=[{poly:[[-50,-50],[50,-50],[50,50],[-50,50]]}];d.startPose={x:0,y:0,angle:0};
 let map=prepareMap(data.maps[mode==='arenal'?4:0]);if(mode==='city')map={...map,variant:{kind:'city',key:'depth-city',document:d}};if(mode==='arenal')map=customMap(map,ARENAL_ROUTE.mapKey,ARENAL_ROUTE);
 const sim=new OriginalSimulation(map,prepareStep(data.steps[6]),resources,'practice');sim.setPosition(sim.stepEntity.transform,[0,0,0]);sim.sync();sim.camera={x:0,y:0,angle:0,size:2};
 const portal=newUrbanElement('lintel-church',[0,0],{width:3,depth:.24,clearance:10});
 if(mode==='city')d.urban=[portal];else{
  if(mode==='arenal')d.metadata.mapKey='RegresoArenal';
  d.urban=[portal];attachEditorDraft(sim,makeGameDraft(d,null));
 }
 for(const graph of sim.renderGraphs||sim.graphs)for(const n of graph.nodes.values()){const key=n.sprite?.key,sp=graph.data.sprites[key];if(sp?.image&&!actorImages.has(key))actorImages.set(key,await loadImage(fileURLToPath(new URL('../'+sp.image,import.meta.url))));}
 const c=createCanvas(512,512),r=new Renderer(c);r.resize(512,512);r.render(sim,actorImages,false);const normal=sample(c);
 portal.edit={drawOrder:10};r.render(sim,actorImages,false);const behind=sample(c);assert.notDeepEqual(normal,behind,mode+': elevated scenery occludes moving native actors');assert(normal[0]>normal[2]&&normal[0]>100,mode+': stone remains above the actor');
}
if(process.env.APULSO_QA_OUTPUT){
 const sheet=createCanvas(1000,650),c=sheet.getContext('2d');c.fillStyle='#eee9df';c.fillRect(0,0,1000,650);c.fillStyle='#183d37';c.font='bold 24px sans-serif';c.fillText('Dinteles, vallas y bolardos · escala compartida',30,40);
 for(const [i,type]of ['lintel-church','lintel-cathedral','lintel-chapel','arch-postigo'].entries()){
  c.fillStyle='#4b5046';c.font='18px sans-serif';c.fillText(type,40,90+i*105);drawOverhead(c,newUrbanElement(type,[0,0]),(x,y)=>[350+x*150,118+i*105-y*150],150);
 }
 c.fillStyle='#4b5046';c.fillText('Valla roja · sin pies',600,90);drawFurniture(c,{point:[0,0],width:2,depth:.18},'fence',(x,y)=>[780+x*140,120-y*140],140);
 c.fillText('Bolardo · 12 cm',600,210);drawUrbanElement(c,bollard,(x,y)=>[780+x*300,265-y*300],300);
 c.fillText('Público bajo el dintel',600,360);paintCityObjects(c,{people:doc.people,urban:doc.urban},(x,y)=>[780+x*110,400-y*110],110,get);
 fs.mkdirSync(process.env.APULSO_QA_OUTPUT,{recursive:true});fs.writeFileSync(process.env.APULSO_QA_OUTPUT+'/scene-depth.png',sheet.toBuffer('image/png'));
}
console.log(`Scene depth: ${cases} exact lintel dimensions at two rendering scales, slim fence/bollard pixels, cross-family ordering, real actors in city/patch/Arenal, independent physics, groups/locks, templates and project recovery passed.`);
