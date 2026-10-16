import assert from 'node:assert/strict';
import {data,resources,OriginalSimulation,prepareMap,prepareStep} from './gameplay-resources.mjs';
import {customStep} from '../custom-steps.mjs';
import {CONTENT_STEPS} from '../content-catalogue.mjs';
import {blankMapDocument,validateMapDocument} from '../city-project.mjs';
import {defaultGameplay,cleanGameplay} from '../map-gameplay.mjs';
import {attachMapGameplay,MapGameplayRuntime} from '../map-gameplay-runtime.mjs';
import {RuntimeEditorDraft,inspectEditorSpawn,obstaclesFor} from '../game-editor-bridge.mjs';
import {newUrbanElement} from '../editor-urban-elements.mjs';
import {OVERHEAD_ITEMS,validateOverhead,obstacleApplies,overheadObstacles} from '../overhead-elements.mjs';
import {captureBlock,placeBlock} from '../editor-selection-model.mjs';
let checks=0;
for(const choice of CONTENT_STEPS)for(const mode of ['inherit','replace'])for(const [stance,height,fails]of [['normal',3.5,true],['crouched',3.5,false],['crouched',3,true],['lowered',3,false],['normal',4,false]]){
 const sim=new OriginalSimulation(prepareMap(data.maps[0]),customStep(prepareStep(data.steps[choice.engineId-1]),choice.engineVariant),resources,'practice');
 const p=sim.position(sim.stepEntity.transform),doc=blankMapDocument({key:'native-1',name:'Alturas'});doc.roads=[{poly:[[-2000,-2000],[2000,-2000],[2000,2000],[-2000,2000]]}];doc.gameplay=defaultGameplay();doc.gameplay.collision.mode=mode;
 doc.urban=[newUrbanElement('canopy-green',[p.x,p.y],{width:20,depth:20,clearance:height})];validateMapDocument(doc);
 attachMapGameplay(sim,doc);const draft=new RuntimeEditorDraft({layers:doc,total:1,mapKey:'native-1'});sim.editorDraft=draft;
 sim.controller.animator.play(stance==='lowered'?'pasoBajado':'mecidaPasoNormal');sim.controller.flex=stance==='crouched';sim.sync();
 const initial=inspectEditorSpawn(sim);assert.equal(initial.ok,!fails,choice.id+' '+mode+' '+stance+' spawn');
 sim.gameplay?.collision(sim);draft.collision(sim);assert.equal(sim.state.status==='failed',fails,choice.id+' '+mode+' '+stance+' runtime');if(fails)assert.equal(sim.prefs.motivoGameOver,6);
 checks++;
}
const portal=newUrbanElement('arch-postigo',[0,0],{width:3,depth:.6,clearance:3.5,pier:.3}),parts=overheadObstacles(portal);assert.equal(parts.length,3);assert(parts.slice(1).every(o=>obstacleApplies(o,{controller:{flex:true}})));assert.equal(overheadObstacles({...portal,solid:false}).length,0);
const archDoc=blankMapDocument({key:'arch',name:'Arco'});archDoc.roads=[{poly:[[-50,-50],[50,-50],[50,50],[-50,50]]}];archDoc.urban=[portal];archDoc.gameplay=defaultGameplay();archDoc.gameplay.collision.mode='replace';const archRuntime=new MapGameplayRuntime(archDoc),square=x=>({points:[[x-.05,-.05],[x+.05,-.05],[x+.05,.05],[x-.05,.05]]}),duck={controller:{flex:true}};assert.equal(archRuntime.collisionReason(square(0),duck),null);assert.equal(archRuntime.collisionReason(square(-1.35),duck),2);archDoc.gameplay.heightProfiles=[{id:'BueMue',standing:4.5,crouched:4,lowered:3}];const calibrated=new MapGameplayRuntime(archDoc);assert.equal(calibrated.collisionReason(square(0),{step:{code:'BueMue'},controller:{flex:true},gameplay:calibrated}),6,'Per-step calibration affects the real collision rule');
const doc=blankMapDocument({key:'copy',name:'Portales'});doc.urban=[portal];const block=captureBlock(doc,[{type:'urban',index:0}]);placeBlock(doc,block,{point:[10,10],angle:90});assert.equal(doc.urban[1].clearance,3.5);assert.equal(doc.urban[1].angle,90);validateMapDocument(doc);
const g=defaultGameplay();g.heightProfiles=[{id:'BueMue',standing:4.1,crouched:3.6,lowered:3.2}];assert.deepEqual(cleanGameplay(g).heightProfiles,g.heightProfiles);assert.throws(()=>cleanGameplay({...g,heightProfiles:[{id:'x',standing:3,crouched:4,lowered:2}]}));
for(const item of OVERHEAD_ITEMS){const o=newUrbanElement(item.id,[0,0]);validateOverhead(o);assert(obstaclesFor({urban:[o]}).some(o=>o.reason===6));}
console.log(`Overhead clearances: ${checks} real-engine cases across eight pasos and inherited/replaced physics; arriado, flex, too-low ceilings, solid piers, templates, profiles and catalogue validated.`);
