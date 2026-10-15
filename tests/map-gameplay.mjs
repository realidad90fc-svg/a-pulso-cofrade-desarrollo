import assert from 'node:assert/strict';
import {blankMapDocument,validateMapDocument,transformMapDocument} from '../city-project.mjs';
import {defaultGameplay,newRouteEvent,validateGameplay} from '../map-gameplay.mjs';
import {MapGameplayRuntime,attachMapGameplay} from '../map-gameplay-runtime.mjs';
import {makeGameDraft} from '../editor-game-draft.mjs';
import {applyMapEntry,resolveMapConnection} from '../map-connections.mjs';
import {data,resources,OriginalSimulation,prepareMap,prepareStep} from './resources.mjs';
const rect=(x,y,xx,yy)=>[[x,y],[xx,y],[xx,yy],[x,yy]],shape=(x,y,r=.1)=>({circle:true,center:[x,y],radius:r});
const doc=blankMapDocument({key:'city-test',name:'Prueba',width:30,height:30});doc.roads=[{poly:rect(0,0,20,20),holes:[rect(8,8,10,10)]}];doc.gameplay=defaultGameplay();doc.gameplay.collision.mode='replace';
let rt=new MapGameplayRuntime(doc);assert.equal(rt.collisionReason(shape(3,3)),null);assert.equal(rt.collisionReason(shape(21,3)),1);assert.equal(rt.collisionReason(shape(9,9)),1);
doc.gameplay.collision.zones.push({id:'block',name:'Obstáculo',kind:'blocked',poly:rect(3,3,4,4),enabled:true},{id:'edge',name:'Límite',kind:'boundary',poly:rect(0,0,15,15),enabled:true});
rt=new MapGameplayRuntime(doc);assert.equal(rt.collisionReason(shape(3.5,3.5)),9);assert.equal(rt.collisionReason(shape(16,3)),1);
doc.houses=[{poly:rect(5,5,6,6),collision:false}];rt=new MapGameplayRuntime(doc);assert.equal(rt.collisionReason(shape(5.5,5.5)),null);doc.houses[0].collision=true;assert.equal(new MapGameplayRuntime(doc).collisionReason(shape(5.5,5.5)),2);
// A crossing that only clips the edge of a block is still a collision.
assert.equal(new MapGameplayRuntime(doc).collisionReason({points:rect(2,3.4,5,3.6)}),9);
const inherited=structuredClone(doc);inherited.gameplay.collision.mode='inherit';assert.equal(new MapGameplayRuntime(inherited).collisionReason(shape(6.5,6.5)),null);
const bad=structuredClone(doc.gameplay);bad.collision.zones[0].poly=rect(0,0,2,2).map((p,i,a)=>a[[0,2,1,3][i]]);assert.throws(()=>validateGameplay(bad));
const q=newRouteEvent('checkpoint',[1,1]),presentation=newRouteEvent('presentation',[4,1]),finish=newRouteEvent('finish',[7,1]);presentation.heading=90;presentation.tolerance=10;presentation.hold=.2;finish.heading=90;
const events=structuredClone(doc);events.gameplay.route={enabled:true,ordered:true,threeStars:60,twoStars:120,events:[q,presentation,finish]};
const mock={state:{status:'playing'},timeScale:1,levelTime:1,dt:.1,stepEntity:{transform:{}},cameraEntity:{},controller:{animator:{state:'mecidaPasoNormal'},martillo:false},mapController:{},prefs:{},position:()=>({x:1,y:1}),angle:()=>90,emit:(type,body={})=>mock.events.push({type,...body}),send:(_,name)=>{if(name==='exitoMet')mock.state.status='won'},snapshot:()=>({gameplay:mock.gameplay.snapshot()}),events:[]};
rt=new MapGameplayRuntime(events).attach(mock);assert.equal(mock.controller.limiteActual,60);
mock.position=()=>({x:7,y:1});mock.controller.animator.state='pasoBajado';rt.tick(mock);assert.equal(mock.state.status,'playing');assert(!rt.completed.has(finish.id));
mock.position=()=>({x:1,y:1});mock.controller.animator.state='mecidaPasoNormal';rt.tick(mock);assert(rt.completed.has(q.id));assert(mock.events.some(e=>e.type==='checkpoint'));
mock.position=()=>({x:4,y:1});mock.controller.animator.state='pasoBajado';rt.tick(mock);rt.tick(mock);assert(!rt.completed.has(presentation.id));rt.tick(mock);assert(rt.completed.has(presentation.id));
const snap=rt.snapshot();const restored=new MapGameplayRuntime(events);restored.restore(snap);assert(restored.completed.has(presentation.id));mock.angle=()=>0;mock.position=()=>({x:7,y:1});rt.tick(mock);assert.equal(mock.state.status,'playing');mock.angle=()=>90;rt.tick(mock);assert.equal(mock.state.status,'won');
// A paused presentation cannot accumulate dwell time.
mock.state.status='playing';rt=new MapGameplayRuntime(events).attach(mock);rt.completed.add(q.id);mock.position=()=>({x:4,y:1});rt.tick(mock);mock.timeScale=0;for(let i=0;i<100;i++)rt.tick(mock);assert(!rt.completed.has(presentation.id));mock.timeScale=1;
const exit=newRouteEvent('exit',[4,1]);exit.targetMap='city-target';exit.targetEntry='north';const outgoing=structuredClone(events);outgoing.gameplay.route.events=[exit];rt=new MapGameplayRuntime(outgoing).attach(mock);mock.controller.animator.state='mecidaPasoNormal';rt.tick(mock);assert(mock.events.some(e=>e.type==='map-transition'&&e.targetMap==='city-target'));assert.equal(mock.timeScale,0);
const announcement=newRouteEvent('announcement',[1,1]);announcement.name='Arfe';events.gameplay.route.events=[announcement];rt=new MapGameplayRuntime(events).attach(mock);mock.position=()=>({x:1,y:1});mock.timeScale=1;assert.equal(rt.streetNoticeFor(mock).name,'Arfe');mock.position=()=>({x:12,y:12});mock.levelTime=2;assert.equal(rt.streetNoticeFor(mock).name,'Arfe');
const baseline=structuredClone(doc);const edited=structuredClone(doc);edited.gameplay.route.enabled=true;const draft=makeGameDraft(edited,baseline);assert(draft.total>=1);assert(draft.gameplayScene.gameplay.route.enabled);assert(!('reference' in draft.gameplayScene));validateMapDocument(draft.gameplayScene);
const moved=transformMapDocument(events,[3,4],90);assert(Math.abs(moved.gameplay.route.events[0].position[0]-2)<1e-8);assert.equal(moved.gameplay.collision.zones[0].poly[0][0],0);
const target=blankMapDocument({key:'city-target',name:'Destino'});target.roads=[{poly:rect(0,0,40,40)}];target.gameplay=defaultGameplay();const entry=newRouteEvent('entry',[5,6]);entry.id='north';entry.heading=45;target.gameplay.route.events=[entry];
const incoming=applyMapEntry({document:target,key:'city-target',isolated:true},'north');assert.deepEqual(incoming.document.startPose,{x:5,y:6,angle:45});assert.throws(()=>applyMapEntry({document:target},'missing'));
const store=new Map([['apulso-universal-editor-v2:city-target',JSON.stringify(target)]]);const connected=await resolveMapConnection({targetMap:'city-target',targetEntry:'north'},{getItem:k=>store.get(k)||null});assert.deepEqual(connected.document.startPose,{x:5,y:6,angle:45});
await assert.rejects(()=>resolveMapConnection({targetMap:'missing'},{getItem:()=>null},async()=>({ok:false})),/Guarda/);
// Native VM: manual physics replaces only environment, keeps all original paso controllers.
for(const source of data.steps){const map=prepareMap(data.maps[0]),step=prepareStep(source),sim=new OriginalSimulation(map,step,resources,'practice');const p=sim.position(sim.stepEntity.transform),scene=blankMapDocument({key:'native-1',name:'Prueba'});scene.roads=[{poly:rect(-1000,-1000,1000,1000)}];scene.gameplay=defaultGameplay();scene.gameplay.collision.mode='replace';const runtime=attachMapGameplay(sim,scene);assert(runtime);for(let i=0;i<4;i++)sim.tick(1/60);assert.equal(sim.state.status,'playing');assert.equal(sim.snapshot().gameplay.finished,false);assert.equal(attachMapGameplay(sim,{...scene,gameplay:undefined}),null);}
console.log('Gameplay: validation, solid objects, holes, boundaries, crossings, event order, mandatory arriado, heading, dwell, pause, checkpoint snapshots, announcements, map connections, publication documents and seven native controllers passed.');
