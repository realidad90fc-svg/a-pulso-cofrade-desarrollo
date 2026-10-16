import assert from 'node:assert/strict';
import {ARENAL_MAP,ARENAL_ROUTE,BARATILLO,arenalScene} from '../arenal-data.mjs';
import {removeArenalPreset} from '../arenal-manual-route.mjs';
import {RuntimeEditorDraft} from '../game-editor-bridge.mjs';
import {makeGameDraft} from '../editor-game-draft.mjs';
import {data,resources,OriginalSimulation,prepareMap,prepareStep} from './gameplay-resources.mjs';
import {customMap} from '../custom-routes.mjs';
import {customStep} from '../custom-steps.mjs';
assert.deepEqual(ARENAL_MAP.presentations,[]);assert.deepEqual(ARENAL_ROUTE.checkpoints.points,[]);assert.equal(arenalScene().checkpoint,null);
const legacy={metadata:{mapKey:'RegresoArenal'},roads:[],sidewalks:[],houses:[],people:[],checkpoints:[{id:'baratillo',name:'Capilla del Baratillo',position:[...BARATILLO.position]},{id:'manual-control',name:'Mi control',position:[...BARATILLO.position]}],labels:[['Capilla del Baratillo',[40.9,35.4]],['Mi calle',[40.9,35.4]]],gameplay:{route:{events:[{id:'manual-presentation',name:'Mi presentación',position:[...BARATILLO.position]}]}}};
const original=JSON.stringify(legacy),clean=removeArenalPreset(legacy);assert.equal(clean.checkpoints.length,1);assert.equal(clean.checkpoints[0].id,'manual-control');assert.equal(clean.labels.length,1);assert.equal(clean.gameplay,legacy.gameplay);assert.equal(JSON.stringify(legacy),original,'Cleanup must not mutate a saved document in place');
assert.equal(removeArenalPreset({...legacy,metadata:{mapKey:'native-5'}}).checkpoints.length,2);assert.equal(removeArenalPreset({...legacy,checkpoints:[{...legacy.checkpoints[0],name:'Control mío'}]}).checkpoints.length,1);
const draft=makeGameDraft(legacy,null),runtime=new RuntimeEditorDraft({mapKey:'RegresoArenal',layers:legacy,total:1,labelScene:legacy.labels});assert.deepEqual(draft.layers.checkpoints.map(p=>p.id),['manual-control']);assert.deepEqual(runtime.layers.checkpoints.map(p=>p.id),['manual-control']);assert.equal(runtime.labels.length,1);
for(let i=0;i<8;i++){
 const step=i===7?customStep(prepareStep(data.steps[0]),'JesusPenas'):prepareStep(data.steps[i]);
 const sim=new OriginalSimulation(customMap(prepareMap(data.maps[4]),ARENAL_ROUTE.mapKey,ARENAL_ROUTE),step,resources,'practice');
 assert.equal(sim.routeAdapter.checkpoints.length,0);assert.equal(sim.routeAdapter.presentations.configs.length,0);assert.equal(typeof sim.routeAdapter.paintBaratillo,'undefined');
 assert(![...sim.routeAdapter.graph.nodes.keys()].some(id=>id.startsWith('centre-checkpoint-marker')),'No native checkpoint marker may be generated');
 const ctx=new Proxy({}, {get:(_,key)=>key==='fillText'?text=>assert(!/BARATILLO|PRESENTACI[ÓO]N/i.test(String(text))):()=>{}});
 sim.timeScale=1;sim.state.status='playing';sim.setPosition(sim.stepEntity.transform,[...BARATILLO.position,0]);sim.routeAdapter.updateStreet();assert(!/Baratillo/i.test(sim.routeAdapter.streetNotice?.name||''));sim.routeAdapter.drawOverlay(ctx,800,600,1);
 // Empty native event configuration cannot gate a valid arrival. The
 // geometry result is isolated here; real collision tests cover all maps.
 sim.setPosition(sim.stepEntity.transform,[...ARENAL_ROUTE.end.position,0]);sim.setAngle(sim.stepEntity.transform,90);sim.controller.animator.play('pasoBajado');sim.controller.martillo=false;sim.gameplay={replacesCollisions:true,ownsEvents:false};
 const old=sim.stepColliders;sim.stepColliders=[];sim.routeAdapter.tick();sim.stepColliders=old;assert(sim.routeAdapter.finished,'Arrival must not require the removed presentation');
}
console.log('Arenal manual itinerary: no default chapel, announcement, marker or mandatory presentation for eight pasos; legacy points removed while manual events and other maps survive; arrival is not gated.');
