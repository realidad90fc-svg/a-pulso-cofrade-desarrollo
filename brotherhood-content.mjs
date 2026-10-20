import {CONTENT_STEPS} from './content-catalogue.mjs';
import {validateUniform,defaultProcession} from './procession-model.mjs';
import {assetById,isAssetId} from './custom-assets.mjs';
export function validateBrotherhoodSettings(all){
 if(all===undefined)return;if(!all||Array.isArray(all)||typeof all!=='object'||Object.keys(all).length>200)throw Error('Configuración de hermandades no válida.');
 for(const [id,s]of Object.entries(all)){if(!id||id.length>150||!s||typeof s!=='object'||Array.isArray(s))throw Error('Hermandad no válida.');validateUniform(s.uniform);validateUniform(s.acolyteUniform);if(s.step)validateImportedStep(s.step);}
}
export function validateImportedStep(s){
 if(!s||!isAssetId(s.assetId)||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!CONTENT_STEPS.some(c=>c.id===s.baseStepId)||!['cristo','misterio','palio'].includes(s.type||'cristo'))throw Error('El paso necesita imagen, nombre y una base de movimiento.');
 for(const k of ['width','length','standing','crouched','lowered'])if(!Number.isFinite(s[k])||s[k]<.1||s[k]>20)throw Error('Medidas del paso entre 0,1 y 20 m.');
 if(s.crouched>s.standing||s.lowered>s.crouched||!Number.isFinite(s.rotation)||Math.abs(s.rotation)>360)throw Error('Revisa el giro y las alturas: normal ≥ agachado ≥ arriado.');return s;
}
export function projectSteps(project){const custom=Object.entries(project?.brotherhoodSettings||{}).filter(([,s])=>s.step).map(([brotherhoodId,s])=>{const b=CONTENT_STEPS.find(c=>c.id===s.step.baseStepId);return{...b,id:'imported:'+brotherhoodId,name:s.step.name,brotherhoodId,implemented:true,type:s.step.type||'cristo',engineVariant:'imported:'+brotherhoodId,imported:s.step,image:assetById(s.step.assetId)?.image,thumbnail:assetById(s.step.assetId)?.image};});return[...CONTENT_STEPS,...custom];}
export function applyBrotherhoodDocument(project,id,input,{useStep=true}={}){
 const doc=structuredClone(input),settings=project.brotherhoodSettings?.[id];doc.brotherhoodId=id;if(!settings)return doc;
 if(settings.uniform||settings.acolyteUniform){doc.procession={...defaultProcession(),...doc.procession,uniform:settings.uniform||doc.procession?.uniform||defaultProcession().uniform,acolyteUniform:settings.acolyteUniform||doc.procession?.acolyteUniform||defaultProcession().acolyteUniform};}
 if(settings.step&&useStep){doc.stepAppearance=structuredClone(settings.step);const asset=assetById(settings.step.assetId)||(doc.resources||[]).find(a=>a.id===settings.step.assetId);if(asset&&!doc.resources?.some(a=>a.id===asset.id)){const {image,...meta}=asset;doc.resources=[...(doc.resources||[]),meta];}}
 return doc;
}
export function carryBrotherhoodContent(source,target,step=source?.stepAppearance){
 const doc=structuredClone(target);if(!source&&!step)return doc;
 if(source?.brotherhoodId)doc.brotherhoodId=source.brotherhoodId;
 if(step){doc.stepAppearance=structuredClone(step);const asset=assetById(step.assetId)||(source?.resources||[]).find(a=>a.id===step.assetId);if(asset&&!doc.resources?.some(a=>a.id===asset.id)){const {image,...meta}=asset;doc.resources=[...(doc.resources||[]),meta];}}
 if(source?.procession){const old=source.procession;doc.procession={...defaultProcession(),...doc.procession,...(old.uniform?{uniform:structuredClone(old.uniform)}:{}),...(old.acolyteUniform?{acolyteUniform:structuredClone(old.acolyteUniform)}:{})};}
 return doc;
}
