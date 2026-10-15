import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OriginalSimulation} from '../original-engine.mjs';
import {prepareMap,prepareStep} from '../engine.mjs';
import {CONTENT_STEPS} from '../content-catalogue.mjs';
import {customStep} from '../custom-steps.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL('../assets/'+n+'.json',import.meta.url)));
const data=read('game-data'),resources={code:read('original-code'),assets:read('original-assets'),animation:read('original-animation'),controls:read('runtime-controls'),random:()=>.5};
assert.equal(CONTENT_STEPS.length,8);assert.equal(data.maps.length,10);
let combinations=0;
for(const s of CONTENT_STEPS)for(const raw of data.maps){
 const step=customStep(prepareStep(data.steps[s.engineId-1]),s.engineVariant),sim=new OriginalSimulation(prepareMap(raw),step,resources,'practice');
 for(let i=0;i<420;i++)sim.tick(1/60);
 assert.equal(sim.state.status,'playing');assert.equal(sim.buttons.length,16);assert(sim.stepColliders.length>0);
 const reopened=new OriginalSimulation(prepareMap(raw),step,resources,'practice',sim.snapshot());
 assert.equal(reopened.step.code,s.engineCode);assert.equal(reopened.state.time,sim.state.time);assert.equal(reopened.map.id,raw.id);combinations++;
}
console.log('PASS preservation: 8 pasos × 10 original maps = '+combinations+' playable/reopened combinations with native controls, collision shapes and clocks.');
