import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {TREE_VARIANTS} from '../editor-materials.mjs';
import {textureImage,registerTexture,VEGETATION_FILES} from '../seville-textures.mjs';
import {RuntimeEditorDraft,loadEditorDraftImages} from '../game-editor-bridge.mjs';
import {loadCityImages} from '../city-runtime.mjs';
import {paintCityScene} from '../city-scene.mjs';
import {MAP_KINDS} from '../editor-game-draft.mjs';
import {ARENAL_ROUTE} from '../arenal-data.mjs';
import {customMap} from '../custom-routes.mjs';
import {data,resources,OriginalSimulation,prepareMap,prepareStep} from './gameplay-resources.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const images=new Map(),requests=[];
const load=async path=>{requests.push(path);return loadImage(fileURLToPath(new URL('../'+path,import.meta.url)))};
const layers=Object.fromEntries(MAP_KINDS.map(k=>[k,[]]));
layers.trees=TREE_VARIANTS.map(v=>({variant:v.id,point:[0,0],radius:.55,scale:1,rotation:27}));
const projection=[96,0,0,-96,128,128];
const visible=canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,256,256).data;let n=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])n++;return n};
await loadEditorDraftImages({layers},load,images);
assert(images.has('sharedassets2.assets:563'),'The original tree sprite must be requested even on a map without original scenery');
for(const v of TREE_VARIANTS){
 if(v.texture){assert(textureImage(v.texture));assert(requests.includes('assets/sevilla/'+VEGETATION_FILES[v.texture.replace(/^tree-/,'')]),'The selected spring texture must be loaded by the game');}
 const layer={...layers,trees:layers.trees.filter(t=>t.variant===v.id)};
 const runtime=new RuntimeEditorDraft({mapKey:'RegresoArenal',layers:layer,total:1}),canvas=createCanvas(256,256);
 runtime.draw(canvas.getContext('2d'),projection,images,canvas);assert(visible(canvas)>150,v.id+' must draw visible pixels in the real game patch painter');
 const city=createCanvas(256,256);paintCityScene(city.getContext('2d'),layer,(x,y)=>[128+x*96,128-y*96],96,key=>images.get(key));assert(visible(city)>150,v.id+' must also draw in a standalone city map');
}
const previous=requests.length;await loadCityImages({document:layers},load,images);assert.equal(requests.length,previous,'City maps reuse already-loaded vegetation');
// A failed custom crown keeps a real original crown visible; retrying the
// next load can recover the chosen species rather than cache the failure.
registerTexture('tree-palmera',null);const warnings=console.warn;console.warn=()=>{};
try{
 const fallback=new Map(),palms={...layers,trees:[layers.trees.find(t=>t.variant==='tree-4')]};
 await loadEditorDraftImages({layers:palms},path=>path.includes('vegetacion-palmera')?Promise.reject(Error('offline')):load(path),fallback);
 const runtime=new RuntimeEditorDraft({mapKey:'city-test',layers:palms,total:1}),canvas=createCanvas(256,256);runtime.draw(canvas.getContext('2d'),projection,fallback,canvas);assert(visible(canvas)>150,'A failed variant image must not leave an invisible solid tree');
 await assert.rejects(loadEditorDraftImages({layers:palms},()=>Promise.reject(Error('offline')),new Map()),/imagen de los árboles/);
 await loadEditorDraftImages({layers:palms},load,fallback);assert(textureImage('tree-palmera'),'Failed textures can be retried');
}finally{console.warn=warnings}
const sim=new OriginalSimulation(customMap(prepareMap(data.maps[4]),ARENAL_ROUTE.mapKey,ARENAL_ROUTE),prepareStep(data.steps[6]),resources,'practice');
assert([...sim.routeAdapter.graph.nodes.values()].some(n=>n.sprite?.key==='sharedassets2.assets:563'),'Procedural Arenal must declare its built-in tree asset to the scene loader');
console.log('Game vegetation: all eight crowns load and draw in runtime patches and city scenes; default Arenal declares its original tree; cached reuse, offline fallback and retry passed.');
process.exit(0);
