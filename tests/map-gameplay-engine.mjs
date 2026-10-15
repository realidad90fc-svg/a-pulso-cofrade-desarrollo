import assert from 'node:assert/strict';
import {data,resources,OriginalSimulation,prepareMap,prepareStep} from './resources.mjs';
import {customStep} from '../custom-steps.mjs';
import {customMap} from '../custom-routes.mjs';
import {EDITOR_MAPS} from '../editor-map-catalog.mjs';
import {blankMapDocument} from '../city-project.mjs';
import {defaultGameplay,newRouteEvent} from '../map-gameplay.mjs';
import {attachMapGameplay} from '../map-gameplay-runtime.mjs';
const rect=[[-2000,-2000],[2000,-2000],[2000,2000],[-2000,2000]];
let combinations=0;
for(const meta of EDITOR_MAPS)for(let i=0;i<8;i++){
 const nativeId=meta.nativeId||meta.route?.mapId||1,map=meta.type==='native'?prepareMap(data.maps[nativeId-1]):customMap(prepareMap(data.maps[nativeId-1]),meta.key),step=i===7?customStep(prepareStep(data.steps[0]),'JesusPenas'):prepareStep(data.steps[i]);
 const sim=new OriginalSimulation(map,step,resources,'practice');
 const doc=blankMapDocument({key:meta.key,name:meta.name});doc.roads=[{poly:rect}];doc.gameplay=defaultGameplay();doc.gameplay.collision.mode='replace';doc.gameplay.route.enabled=true;
 const p=sim.position(sim.stepEntity.transform),cp=newRouteEvent('checkpoint',[p.x,p.y]);cp.mandatory=true;doc.gameplay.route.events=[cp,newRouteEvent('finish',[1500,1500])];
 attachMapGameplay(sim,doc);for(let n=0;n<5;n++)sim.tick(.016);assert.equal(sim.state.status,'playing',meta.key+' / '+step.code);
 assert(sim.gameplay.replacesCollisions);const snapshot=sim.snapshot();sim.gameplay.completed.add(cp.id);sim.restore(snapshot);assert.equal(sim.gameplay.completed.has(cp.id),snapshot.gameplay.completed.includes(cp.id));
 combinations++;
}
console.log(`Configured physics and event isolation: ${combinations} combinations, all 17 maps × 8 pasos, startup and snapshot restore passed.`);
