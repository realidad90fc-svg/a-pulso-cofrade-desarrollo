import {makeImportedPaso,importedPasoChoice} from './imported-paso.mjs';
import {OriginalSimulation} from './original-engine.mjs';
import {prepareMap,prepareStep} from './engine.mjs';
import {customMap} from './custom-routes.mjs';
import {customStep} from './custom-steps.mjs';
import {CONTENT_STEPS} from './content-catalogue.mjs';
import {validateMapDocument} from './city-project.mjs';
import {makeGameDraft,makeArenalPreviewDraft,withEditorStreetPoints} from './editor-game-draft.mjs';
import {attachEditorDraft,applyEditorStart,inspectEditorSpawn} from './game-editor-bridge.mjs';
import {attachMapGameplay} from './map-gameplay-runtime.mjs';
import {registerCustomAssets,lightweightDocument,assetById} from './custom-assets.mjs';
import {inSurface} from './map-geometry.mjs';
let cache;
export async function loadReviewResources(fetcher=fetch){if(!cache)cache=Promise.all(['game-data','original-code','original-assets','original-animation','runtime-controls'].map(async name=>{const r=await fetcher('./assets/'+name+'.json');if(!r.ok)throw Error('No se pudo cargar el motor: '+name);return r.json()})).then(([data,code,assets,animation,controls])=>({data,resources:{code,assets,animation,controls,random:()=>.5}})).catch(e=>{cache=null;throw e});return cache}
export function makeReviewPreview(doc,baseline,meta,pose){
 const document=structuredClone(lightweightDocument(doc));document.startPose={...pose};
 const isolated=meta.type==='user'||!!doc.metadata.precisionGeometry&&meta.type==='native'||!!doc.zoneRefs?.length||!!doc.metadata.zoneId;
 const draft=withEditorStreetPoints(makeArenalPreviewDraft(document)||makeGameDraft(document,baseline),document);draft.startPose={...pose};
 return{key:doc.metadata.mapKey,name:doc.metadata.map||meta.name,document,draft,isolated,nativeId:meta.nativeId||meta.route?.mapId||1};
}
export function createReviewSimulation({preview,stepId,loaded}){
 validateMapDocument(preview.document);const {data,resources}=loaded,choice=preview.document.stepAppearance?importedPasoChoice(preview.document.stepAppearance,stepId):CONTENT_STEPS.find(s=>s.id===stepId);if(!choice)throw Error('Selecciona uno de los ocho pasos.');registerCustomAssets(preview.document.resources||[]);
 const native=prepareMap(data.maps[preview.nativeId-1]),map=preview.isolated?{...native,name:preview.name,variant:{kind:'city',key:'city-preview:'+preview.key,document:preview.document}}:customMap(native,preview.key),step=makeImportedPaso(customStep(prepareStep(data.steps[choice.engineId-1]),choice.engineVariant),preview.document.stepAppearance,stepId);
 const sim=new OriginalSimulation(map,step,{...resources,prefs:{}},'practice');if(!preview.isolated)attachEditorDraft(sim,preview.draft);attachMapGameplay(sim,preview.document);return sim;
}
export function placeReviewStep(sim,pose){
 // This is an isolated simulation; a rejected pose remains visible for diagnosis.
 const result=applyEditorStart(sim,pose);if(!result.ok){sim.setPosition(sim.stepEntity.transform,[pose.x,pose.y,0]);sim.setAngle(sim.stepEntity.transform,pose.angle);const a=pose.angle*Math.PI/180;for(const[e,d]of[[sim.capatazEntity,1.2],[sim.contraEntity,-1.3],...(sim.cortejos||[]).map((e,i)=>[e,[3,-3,-4.5][i]])])if(e)sim.setPosition(e.transform,[pose.x-Math.sin(a)*d,pose.y+Math.cos(a)*d,0]);sim.routeAdapter?.follow?.();sim.sync()}
 return inspectEditorSpawn(sim);
}
export function probeReviewPose(sim,pose){
 const inspection=placeReviewStep(sim,pose);if(!inspection.ok)return{ok:false,reason:inspection.reason};
 // Run the original controller and contact rules, including native collider conditions.
 sim.controller.animator.play('mecidaPasoNormal');sim.controller.martillo=false;sim.controller.gameOver=false;sim.state.status='playing';sim.sync();
 for(let i=0;i<6&&sim.state.status==='playing';i++){sim.tick(1/60);sim.editorDraft?.collision(sim);sim.editorDraft?.update(sim)}
 const failure=sim.drainEvents().find(e=>e.type==='failed');if(failure&&failure.reasonId!==12)return{ok:false,reason:failure.reason,reasonId:failure.reasonId};return{ok:true,reason:''};
}
export async function reviewMap({document,baseline,meta,stepIds,pose,getDocument,getMeta,signal,onProgress=()=>{},loaded}){
 const issues=[],add=(severity,message,position=null,stepId=null)=>issues.push({severity,message,position,stepId});
 try{validateMapDocument(document)}catch(e){add('error',e.message);return{issues,checked:0}}
 for(const a of document.resources||[])if(!a.image&&!assetById(a.id)?.image)add('error','Falta la imagen del recurso «'+a.name+'».');
 const route=document.gameplay?.route;if(route?.enabled&&!route.events.some(e=>['finish','exit'].includes(e.type)))add('error','Falta una llegada o una salida en el recorrido.');
 const anchors=route?.enabled?route.events.filter(e=>e.type!=='announcement'):(document.checkpoints||[]).map(cp=>({...cp,type:cp.finish?'finish':'checkpoint',heading:cp.angle??null}));
 for(const e of route?.events||[])if(e.type==='exit')try{const target=getDocument(e.targetMap);if(!target)throw Error('No existe el mapa de destino.');const entry=e.targetEntry?target.gameplay?.route?.events?.find(q=>q.type==='entry'&&q.id===e.targetEntry):null;if(e.targetEntry&&!entry)throw Error('No existe la entrada de destino.');validateMapDocument(target);if(getMeta&&!getMeta(e.targetMap))throw Error('El destino no está en el catálogo.');}catch(error){add('error','Salida «'+e.name+'»: '+error.message,e.position)}
 const preview=makeReviewPreview(document,baseline,meta,pose);let checked=0;
 for(const stepId of stepIds){if(signal?.aborted)throw Error('Revisión cancelada.');let sim;try{sim=createReviewSimulation({preview,stepId,loaded})}catch(e){add('error',e.message,[pose.x,pose.y],stepId);continue}const initial=sim.snapshot();
  const probes=[{name:'Punto de inicio de la prueba',position:[pose.x,pose.y],heading:pose.angle},...anchors];
  for(let i=0;i<probes.length;i++){if(signal?.aborted)throw Error('Revisión cancelada.');const p=probes[i],position=p.position,heading=p.heading??pose.angle;sim.restore(initial);const hit=probeReviewPose(sim,{x:position[0],y:position[1],angle:heading});checked++;if(!hit.ok)add(i===0?'error':'warning',p.name+': '+hit.reason,position,stepId);
   onProgress({stepId,index:i+1,total:probes.length});if(i%4===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 return{issues,checked,createdAt:new Date().toISOString(),note:'Se han comprobado las posiciones con el motor y los volúmenes reales del paso. Las maniobras entre puntos se comprueban jugando.'};
}
export function reviewAnchors(doc){return[{id:'saved',name:'Salida guardada',pose:doc.startPose||doc.paso},...(doc.gameplay?.route?.events||[]).map(e=>({id:e.id,name:e.name,pose:{x:e.position[0],y:e.position[1],angle:e.heading??doc.startPose?.angle??doc.paso.angle},event:true})),...(doc.checkpoints||[]).map(e=>({id:'cp:'+e.id,name:e.name||e.id,pose:{x:e.position[0],y:e.position[1],angle:e.angle??doc.paso.angle}}))]}
