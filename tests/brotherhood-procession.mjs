import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {defaultProcession,processionPoses,validateProcession,DEFAULT_UNIFORM,DEFAULT_ACOLYTE,drawProcessionFigure} from '../procession-model.mjs';
import {projectSteps} from '../brotherhood-content.mjs';
import {makeImportedPaso} from '../imported-paso.mjs';
import {createCityProject,addCityMap,assignCityZone,transformMapDocument,validateMapDocument} from '../city-project.mjs';
import {activateCityItinerary,compileCityCampaign,makePlayableCity,validatePlayableCity,loadPlayableCampaign} from '../city-campaign.mjs';
import {makeProjectPackage,validateProjectPackage} from '../editor-project-package.mjs';
import {makeGameDraft} from '../editor-game-draft.mjs';
import {registerCustomAssets} from '../custom-assets.mjs';
import {BROTHERHOODS,CONTENT_STEPS} from '../content-catalogue.mjs';
import {CAMPAIGN_DATA} from '../campaign-data.mjs';
import {newRouteEvent,defaultGameplay} from '../map-gameplay.mjs';
import {overheadObstacles,obstacleApplies} from '../overhead-elements.mjs';
import {newUrbanElement,urbanCollisionSize,drawUrbanElement} from '../editor-urban-elements.mjs';
import {OriginalSimulation,prepareMap,prepareStep,data,resources} from './gameplay-resources.mjs';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/'),{createCanvas,loadImage}=require('@napi-rs/canvas');
const p=defaultProcession();p.nazarenes={points:[[0,0],[0,10],[10,10]],count:3,columns:1,spacing:.5,lane:.3,offset:2};p.acolytes={points:[[0,0],[3,0],[3,10]],count:2,columns:1,spacing:.4,lane:.3,offset:-1};validateProcession(p);
const actors=processionPoses(p,{x:0,y:9,angle:0}),naz=actors.filter(a=>a.role==='nazarenes');assert.deepEqual(naz.map(a=>[a.x,a.y]),[[1,10],[1.5,10],[2,10]],'Nazarenes follow the corner without cutting diagonally');assert(naz.every(a=>Math.abs(a.angle+90)<.001));assert(actors.filter(a=>a.role==='acolytes').every(a=>a.x===3),'Acolytes use their independent route');assert(!processionPoses(p,{x:10,y:10,angle:0}).some(a=>a.role==='nazarenes'),'Actors leave the path instead of piling up at its end');
const moved=transformMapDocument({metadata:{mapKey:'x'},procession:p},[10,4],90);assert.deepEqual(moved.procession.nazarenes.points[0],[10,4]);assert(Math.abs(moved.procession.nazarenes.points[1][0])<1e-8);
assert.throws(()=>validateProcession({...p,nazarenes:{...p.nazarenes,count:500}}));
const canvas=createCanvas(40,80);canvas.getContext('2d').fillStyle='#a13b58';canvas.getContext('2d').fillRect(5,5,30,70);const asset={id:'asset-paso-fixture',name:'Paso aéreo',category:'decor',width:1.4,depth:3,angle:0,collision:{kind:'none'},image:canvas.toDataURL('image/png')};registerCustomAssets([asset]);
const project=createCityProject([]),added=addCityMap(project,{name:'Sevilla propia'}),doc=added.document;doc.roads=[{poly:[[0,0],[40,0],[40,40],[0,40]]}];doc.startPose={x:20,y:20,angle:0};doc.procession=p;doc.gameplay=defaultGameplay();doc.gameplay.route.enabled=true;doc.gameplay.route.events=[newRouteEvent('finish',[30,30])];
const brotherhood=BROTHERHOODS.find(b=>!CONTENT_STEPS.some(s=>s.brotherhoodId===b.id)),another=CONTENT_STEPS[0].brotherhoodId,appearance={assetId:asset.id,name:'Paso nuevo',baseStepId:CONTENT_STEPS[0].id,type:'palio',width:1.4,length:3,rotation:0,standing:4.3,crouched:3.6,lowered:3.1};project.brotherhoodSettings={[brotherhood.id]:{step:appearance,uniform:{...DEFAULT_UNIFORM,robe:'#78114c'},acolyteUniform:{...DEFAULT_ACOLYTE,cape:'#227d4b'}}};
assignCityZone(project,brotherhood.id,'map:'+added.meta.key);activateCityItinerary(project,brotherhood.id,'imported:'+brotherhood.id,key=>doc);const campaign=compileCityCampaign(CAMPAIGN_DATA,project,key=>doc),route=campaign.routes.find(r=>r.brotherhoodId===brotherhood.id&&r.cityDocument);assert(route);assert.equal(route.cityDocument.stepAppearance.assetId,asset.id);assert.equal(route.cityDocument.procession.uniform.robe,'#78114c');assert(!doc.stepAppearance,'Shared source maps never inherit one brotherhood\'s paso');assert.equal(doc.procession.uniform.robe,DEFAULT_UNIFORM.robe);assert(campaign.steps.some(s=>s.id===route.stepRef&&s.type==='palio'));assert.equal(projectSteps(project).filter(s=>s.imported).length,1);
const pkg=validateProjectPackage(JSON.parse(JSON.stringify(makeProjectPackage({meta:{id:'fixture-project',name:'Sevilla'},project,documents:{[added.meta.key]:doc},resources:[asset]}))));assert.equal(pkg.city.project.brotherhoodSettings[brotherhood.id].step.assetId,asset.id);assert(pkg.resources.some(a=>a.image));
const publicCity=validatePlayableCity(JSON.parse(JSON.stringify(makePlayableCity(project,()=>doc,[asset]))));assert(publicCity.resources.some(a=>a.id===asset.id&&a.image));const loaded=await loadPlayableCampaign(CAMPAIGN_DATA,{getItem:()=>null},async()=>({ok:true,json:async()=>publicCity}));assert.equal(loaded.warnings.length,0);assert(loaded.data.steps.some(s=>s.id===route.stepRef));
const draft=makeGameDraft({...doc,procession:p},{...doc,procession:undefined});assert(draft.total>0&&draft.procession.enabled,'Cortejo-only edits publish to legacy maps too');
let cases=0;
for(const source of CONTENT_STEPS)for(const angle of [0,37,90,180]){
 const spec={...appearance,baseStepId:source.id},sim=new OriginalSimulation({...prepareMap(data.maps[0]),variant:{kind:'city',key:'fixture',document:{...doc,procession:undefined}}},makeImportedPaso(prepareStep(data.steps[source.engineId-1]),spec,'imported:'+brotherhood.id),resources,'practice');
 sim.setAngle(sim.stepEntity.transform,angle);const pos=sim.position(sim.stepEntity.transform),a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points=sim.stepColliders.filter(c=>c.entity!==sim.contraEntity).flatMap(c=>{const w=c.world();return w.circle?Array.from({length:16},(_,i)=>[w.center[0]+Math.cos(i*Math.PI/8)*w.radius,w.center[1]+Math.sin(i*Math.PI/8)*w.radius]):w.points||[];}).map(([x,y])=>[(x-pos.x)*c+(y-pos.y)*s,-(x-pos.x)*s+(y-pos.y)*c]);assert(Math.abs(Math.max(...points.map(p=>Math.abs(p[0])))*2-spec.width)<.005,source.id+' actual collision width');assert(Math.abs(Math.max(...points.map(p=>Math.abs(p[1])))*2-spec.length)<.005,source.id+' actual collision length');
 sim.controller.animator.play('mecidaPasoNormal');sim.controller.flex=false;
 const obstruction=overheadObstacles(newUrbanElement('canopy-green',[20,20],{clearance:4}))[0];assert(obstacleApplies(obstruction,sim));sim.controller.flex=true;assert(!obstacleApplies(obstruction,sim),'Imported paso uses its own crouched height');const saved=sim.snapshot(),reopened=new OriginalSimulation(sim.map,sim.step,resources,'practice',saved);assert.equal(reopened.step.imported.width,spec.width);cases++;
}
const figures=createCanvas(500,220),ctx=figures.getContext('2d');ctx.fillStyle='#d3cdbb';ctx.fillRect(0,0,500,220);for(const [i,robe]of ['#78114c','#eeeeed','#153a2c'].entries())drawProcessionFigure(ctx,{x:0,y:0,angle:i*30,index:i,role:'nazarenes',uniform:{...DEFAULT_UNIFORM,robe,cape:robe,hood:robe}},()=>[100+i*150,110],450,1);
const bike=newUrbanElement('bike-rack',[0,0],{size:[.22,.12]}),shape=urbanCollisionSize(bike);assert.deepEqual(shape,[.22,.12]);const small=createCanvas(100,100);drawUrbanElement(small.getContext('2d'),bike,(x,y)=>[50+x*100,50-y*100],100);assert(small.getContext('2d').getImageData(50,50,1,1).data[3]);
if(process.env.APULSO_QA_OUTPUT){const fs=await import('node:fs');fs.mkdirSync(process.env.APULSO_QA_OUTPUT,{recursive:true});fs.writeFileSync(process.env.APULSO_QA_OUTPUT+'/clothing.png',figures.toBuffer('image/png'));}
console.log(`Brotherhood content: independent curved cortejos, editable uniforms, imported paso for a previously unavailable brotherhood, playable publication and project recovery; ${cases} real-engine footprint/height/restore cases and bike-rack size passed.`);
