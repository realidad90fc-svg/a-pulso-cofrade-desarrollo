import assert from 'node:assert/strict';
import {createCityProject,addCityMap,addCityZone,assignCityZone,resolveCityMap,validateProject} from '../city-project.mjs';
import {activateCityItinerary,compileCityCampaign,campaignCityPreview,makePlayableCity,validatePlayableCity,loadPlayableCampaign} from '../city-campaign.mjs';
import {CAMPAIGN_DATA} from '../campaign-data.mjs';
import {CONTENT_STEPS} from '../content-catalogue.mjs';
import {createProgress,finishCampaign,CampaignAttempt} from '../campaign-progress.mjs';
import {makeProjectPackage,validateProjectPackage} from '../editor-project-package.mjs';
import {defaultGameplay,newRouteEvent} from '../map-gameplay.mjs';
import {OriginalSimulation,data,resources,prepareMap,prepareStep} from './gameplay-resources.mjs';
import {customStep} from '../custom-steps.mjs';
import {attachMapGameplay} from '../map-gameplay-runtime.mjs';
const project=createCityProject([]),documents={};
const available=CONTENT_STEPS.filter(s=>s.implemented),one=available[0],two=available.find(s=>s.brotherhoodId!==one.brotherhoodId);
function add(name){const {meta,document}=addCityMap(project,{name,width:40,height:40});documents[meta.key]=document;document.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]],walkable:true,material:'road-sev-gerena-dark'}];document.startPose={x:10,y:10,angle:0};document.labels=[[name,[10,10],{radius:1}]];document.gameplay=defaultGameplay();document.gameplay.collision.mode='replace';document.gameplay.route.enabled=true;document.gameplay.route.threeStars=60;document.gameplay.route.twoStars=120;document.gameplay.route.events=[{...newRouteEvent('entry',[10,10]),id:'entry-a',heading:0},{...newRouteEvent('checkpoint',[15,15]),id:'control-a'},{...newRouteEvent('finish',[30,30]),id:'finish-a'}];return meta.key;}
const arfe=add('Arfe'),adriano=add('Adriano'),get=key=>{if(!documents[key])throw Error('Falta '+key);return documents[key]};
const v1=assignCityZone(project,one.brotherhoodId,'map:'+arfe).visit,v2=assignCityZone(project,one.brotherhoodId,'map:'+adriano).visit;
assignCityZone(project,two.brotherhoodId,'map:'+arfe);v1.entryId='entry-a';
activateCityItinerary(project,one.brotherhoodId,one.id,get);activateCityItinerary(project,two.brotherhoodId,two.id,get);
let campaign=compileCityCampaign(CAMPAIGN_DATA,project,get),routes=campaign.routes.filter(r=>r.brotherhoodId===one.brotherhoodId),firstId=routes[0].id,secondId=routes[1].id;
assert.equal(routes.length,2);assert.equal(routes[1].unlock.completedRoute,firstId);assert.equal(routes[0].stepRef,one.id);assert.equal(routes[0].cityDocument.metadata.mapKey,arfe);
const oldId=CAMPAIGN_DATA.routes.find(r=>r.playable!==false).id,oldRecord={bestTimeMs:1000,stars:3,completed:true};let progress=createProgress(campaign,{records:{[oldId]:oldRecord}});assert(progress.records[oldId]);assert(!progress.unlocked.routes.includes(secondId));finishCampaign(campaign,progress,firstId,45000,false,[],true);assert(progress.unlocked.routes.includes(secondId));
// Draft membership/order is applied explicitly. A different map cannot replace Arfe.
const postigo=add('Postigo');assignCityZone(project,one.brotherhoodId,'map:'+postigo);project.itineraries[one.brotherhoodId].reverse();assert.equal(compileCityCampaign(CAMPAIGN_DATA,project,get).routes.filter(r=>r.brotherhoodId===one.brotherhoodId).length,2);
activateCityItinerary(project,one.brotherhoodId,one.id,get);campaign=compileCityCampaign(CAMPAIGN_DATA,project,get);assert.equal(campaign.routes.find(r=>r.id===firstId).order,3);progress=createProgress(campaign,progress);assert.equal(progress.records[firstId].bestTimeMs,45000);assert(progress.records[oldId]);
// Shared references stay canonical; the same improvement reaches both brotherhoods.
documents[arfe].trees=[{point:[25,25],radius:.4,variant:'orange'}];campaign=compileCityCampaign(CAMPAIGN_DATA,project,get);assert.equal(campaign.routes.filter(r=>r.cityDocument?.metadata.mapKey===arfe).length,2);assert(campaign.routes.filter(r=>r.cityDocument?.metadata.mapKey===arfe).every(r=>r.cityDocument.trees.length===1));
const whole=add('Recorrido enlazado'),zone=addCityZone(project,arfe,'Arfe compartida',[0,0,40,40],['Arfe']);documents[whole].zoneRefs=[{zoneId:zone.id,offset:[0,0],angle:0}];assert.equal(resolveCityMap(project,whole,get).trees.length,1);
assignCityZone(project,one.brotherhoodId,'map:'+whole);activateCityItinerary(project,one.brotherhoodId,one.id,get);
documents[arfe].reference={image:'PRIVATE-PHOTO'};documents[arfe].metadata.privatePhoto='PRIVATE-PHOTO';
const bundle=makePlayableCity(project,get);validatePlayableCity(JSON.parse(JSON.stringify(bundle)));assert(!JSON.stringify(bundle).includes('PRIVATE-PHOTO'));assert(bundle.documents[arfe]);assert(bundle.documents[whole]);
const pkg=makeProjectPackage({meta:{id:'project-test',name:'Mi Sevilla'},project,documents});validateProjectPackage(pkg);const restored=compileCityCampaign(CAMPAIGN_DATA,pkg.city.project,key=>pkg.city.documents[key]);assert(restored.routes.some(r=>r.id===firstId));assert(restored.routes.some(r=>r.id===secondId));
// Archiving hides legacy routes without deleting legacy scores or source maps.
project.archiveLegacy=true;campaign=compileCityCampaign(CAMPAIGN_DATA,project,get);assert(campaign.routes.every(r=>r.cityDocument));progress=createProgress(campaign,progress);assert(progress.records[oldId]);assert.equal(documents[arfe].metadata.mapKey,arfe);
const activeBefore=structuredClone(project.campaignItineraries);documents[adriano].gameplay.route.events=[];assert.throws(()=>activateCityItinerary(project,one.brotherhoodId,one.id,get),/llegada/);assert.deepEqual(project.campaignItineraries,activeBefore);documents[adriano].gameplay.route.events=[{...newRouteEvent('finish',[30,30]),id:'finish-a'}];
assert.throws(()=>activateCityItinerary(project,one.brotherhoodId,two.id,get),/paso/);
const bad=structuredClone(project);bad.campaignItineraries[one.brotherhoodId].visits[0].zoneId='missing';assert.throws(()=>validateProject(bad));
// The real engine uses only authored geometry, for all eight implemented pasos.
for(const stepInfo of available){
 const route=compileCityCampaign(CAMPAIGN_DATA,project,get).routes.find(r=>r.cityDocument?.metadata.mapKey===arfe),preview=campaignCityPreview(route),map={...prepareMap(data.maps[0]),variant:{kind:'city',key:'city-test',document:preview.document}},step=customStep(prepareStep(data.steps[stepInfo.engineId-1]),stepInfo.engineVariant);
 const sim=new OriginalSimulation(map,step,resources,'career');attachMapGameplay(sim,preview.document);for(let i=0;i<420;i++)sim.tick(1/60);assert.equal(sim.state.status,'playing',stepInfo.id);
 sim.setPosition(sim.stepEntity.transform,[15,15,0]);sim.gameplay.completed.add('control-a');sim.setPosition(sim.stepEntity.transform,[30,30,0]);sim.controller.animator.play('pasoBajado');sim.controller.martillo=false;sim.gameplay.tick(sim);assert.equal(sim.state.status,'won',stepInfo.id);
 const attempt=new CampaignAttempt(route);attempt.clock.elapsedMs=10000;attempt.checkpoint={id:'control-a',snapshot:sim.snapshot(),clock:{elapsedMs:5000,started:true}};assert.equal(attempt.retryFromCheckpoint().clock.elapsedMs,5000);
}
// Public loading adds the authored campaign with an empty local profile.
const storage={getItem:()=>null};const loaded=await loadPlayableCampaign(CAMPAIGN_DATA,storage,async()=>({ok:true,json:async()=>bundle}));assert.equal(loaded.warnings.length,0);assert(loaded.data.routes.some(r=>r.id===firstId));
const retired=structuredClone(project);retired.archiveLegacy=false;delete retired.campaignItineraries[one.brotherhoodId];retired.disabledCampaignBrotherhoods=[one.brotherhoodId];const localStorage={getItem:key=>key==='apulso-city-project-v1'?JSON.stringify(retired):key.startsWith('apulso-universal-editor-v2:')?JSON.stringify(documents[key.slice('apulso-universal-editor-v2:'.length)]):null};const removed=await loadPlayableCampaign(CAMPAIGN_DATA,localStorage,async()=>({ok:true,json:async()=>bundle}));assert.equal(removed.warnings.length,0);assert(!removed.data.routes.some(r=>r.id===firstId));assert(removed.data.routes.some(r=>r.brotherhoodId===one.brotherhoodId&&!r.cityDocument));
console.log('City campaign: explicit activation, available pasos, independent maps, canonical streets across two brotherhoods, ordered unlocks, stable records on reorder, archive without loss, project recovery, private-photo exclusion, published loading and all eight real-engine pasos passed.');
