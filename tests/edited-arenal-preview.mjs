// Regression of editor save -> game preview, including ground outside the
// original Arenal bounds. Render with the real game camera and tile cache.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {OriginalSimulation} from '../original-engine.mjs';
import {prepareMap,prepareStep} from '../engine.mjs';
import {customMap} from '../custom-routes.mjs';
import {ARENAL_ROUTE} from '../arenal-data.mjs';
import {makeGameDraft} from '../editor-game-draft.mjs';
import {attachEditorDraft,applyEditorStart,inspectEditorSpawn} from '../game-editor-bridge.mjs';
import {Renderer} from '../renderer.mjs';
import {readCityPreview} from '../city-runtime.mjs';
import {MAP_STORAGE_PREFIX} from '../city-project.mjs';
import {registerTexture} from '../seville-textures.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
globalThis.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
const read=name=>JSON.parse(fs.readFileSync(new URL('../assets/'+name+'.json',import.meta.url)));
const data=read('game-data'),resources={code:read('original-code'),assets:read('original-assets'),animation:read('original-animation'),controls:read('runtime-controls'),random:()=>.5};
const makeSim=()=>new OriginalSimulation(customMap(prepareMap(data.maps[4]),ARENAL_ROUTE.mapKey,ARENAL_ROUTE),prepareStep(data.steps[6]),resources,'practice');
const baseline={metadata:{mapKey:'RegresoArenal'},roads:[],sidewalks:[],houses:[],people:[],labels:[]};
const doc={...baseline,roads:[{poly:[[90,80],[110,80],[110,120],[90,120]],material:'road-art-granite'}],
 sidewalks:[{poly:[[90,80],[93,80],[93,120],[90,120]],material:'sidewalk-art-caliza'}],
 labels:[['Arfe',[100,100]],['Adriano',[100,115]]],startPose:{x:100,y:100,angle:0}};
const unchanged=makeGameDraft(doc,doc);
assert.equal(unchanged.total,0);
const request=readCityPreview('?cityMap=RegresoArenal',{getItem:key=>key===MAP_STORAGE_PREFIX+'RegresoArenal'?JSON.stringify(doc):null});
assert(request.draft.total>0,'An explicit preview must work even when the cached delta has no changes');
assert.deepEqual(request.draft.arenalScene.roads,doc.roads,'Preview uses the canonical saved roads');
const sim=makeSim();attachEditorDraft(sim,request.draft);
assert(applyEditorStart(sim,doc.startPose).ok,'The actual native footprint fits the edited floor');
assert(inspectEditorSpawn(sim).ok);
sim.camera={x:100,y:100,angle:.43,size:3.5};sim.levelTime=1;
const canvas=createCanvas(390,844),renderer=new Renderer(canvas);renderer.resize(390,844,1);
const ctx=canvas.getContext('2d'),texts=[],fillText=ctx.fillText.bind(ctx);
ctx.fillText=(value,...args)=>{texts.push({value,matrix:ctx.getTransform()});return fillText(value,...args)};
renderer.render(sim,new Map(),false);
const pixels=ctx.getImageData(70,290,250,250).data;let ground=0;
for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==85||pixels[i+1]!==82||pixels[i+2]!==79)ground++;
assert(ground>pixels.length/4*.95,'The traversable edited road must render outside the original map bounds');
assert(!texts.some(t=>t.value==='Arfe'),'Street identifiers must never be painted on the world plane');
renderer.render(sim,new Map(),true);sim.levelTime=1.4;renderer.render(sim,new Map(),true);
assert(texts.some(t=>t.value==='Arfe'&&t.matrix.a===1&&t.matrix.d===1),'The editor name must appear in the screen-space street banner');
const output=new URL('../../qa-renders/',import.meta.url);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(new URL('edited-arfe-preview.png',output),canvas.toBuffer('image/png'));
// Also exercise the loaded-texture path and real paso sprites, rather than
// only a geometric fixture with procedural fallbacks and empty image cache.
const images=new Map();for(const g of sim.renderGraphs)for(const n of g.nodes.values()){
 const sp=n.sprite&&g.data.sprites[n.sprite.key];if(!sp?.image||images.has(n.sprite.key))continue;
 images.set(n.sprite.key,await loadImage(fileURLToPath(new URL('../'+sp.image,import.meta.url))));
}
for(const name of ['piedra','caliza','teja'])registerTexture(name,await loadImage(fileURLToPath(new URL('../assets/sevilla/'+name+'.webp',import.meta.url))));
sim.routeAdapter.tileCache.clear();renderer.render(sim,images,true);
fs.writeFileSync(new URL('edited-arfe-gameplay.png',output),canvas.toBuffer('image/png'));
assert(sim.routeAdapter.tileCache.size<=sim.routeAdapter.scene.maxCachedTiles);
assert(!applyEditorStart(sim,{x:120,y:100,angle:0}).ok,'A start with no road or pavement must be rejected');
assert.equal(sim.state.x,100,'An invalid start must restore the previous position');
sim.setPosition(sim.stepEntity.transform,[100,115,0]);sim.frameCount++;sim.sync();sim.levelTime=2;
renderer.render(sim,new Map(),true);sim.levelTime=2.4;renderer.render(sim,new Map(),true);
assert(texts.some(t=>t.value==='Adriano'&&t.matrix.a===1&&t.matrix.d===1),'The banner changes as the paso enters the next named street');
// Deleting the entire road layer must clear the old native collision road.
const removed=makeSim();attachEditorDraft(removed,makeGameDraft({...doc,roads:[],sidewalks:[]},doc));
assert(!removed.routeAdapter.walkable.length);
assert(!inspectEditorSpawn(removed).ok,'No hidden native floor may survive deleting the saved floor');
const blocked=makeSim();attachEditorDraft(blocked,makeGameDraft({...doc,houses:[{poly:[[99,99],[101,99],[101,101],[99,101]]}]},doc));
assert(!applyEditorStart(blocked,doc.startPose).ok,'A building overlapping saved ground must block the start');
console.log('PASS edited Arenal: saved floor beyond original bounds, real footprint, rotated portrait rendering, street banner and rejection of out-of-map starts.');
