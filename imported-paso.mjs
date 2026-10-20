import {CONTENT_STEPS} from './content-catalogue.mjs';
import {assetById} from './custom-assets.mjs';
import {validateImportedStep} from './brotherhood-content.mjs';
export function importedPasoChoice(appearance,id){if(!appearance)return null;validateImportedStep(appearance);const base=CONTENT_STEPS.find(s=>s.id===appearance.baseStepId);return{...base,id:id||'imported:preview',engineVariant:id||'imported:preview',appearance};}
export function makeImportedPaso(base,appearance,id='imported:preview'){
 if(!appearance)return base;validateImportedStep(appearance);const asset=assetById(appearance.assetId);if(!asset?.image)throw Error('Falta la imagen del paso importado. Abre el proyecto con sus recursos.');
 return{...base,name:appearance.name,imported:structuredClone(appearance),variant:{key:id,name:appearance.name,image:asset.image,size:[appearance.width,appearance.length],rotation:0,imageRotation:appearance.rotation}};
}
export function calibrateImportedPaso(sim){
 const spec=sim.step.imported;if(!spec)return;for(const c of sim.stepColliders)delete c._frame;const t=sim.stepEntity.transform,node=t.graph.nodes.get(t.id),initial=[...node.scale],p=sim.position(t),a=sim.angle(t)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points=[];
 for(const collider of sim.stepColliders.filter(c=>c.entity!==sim.contraEntity)){const w=collider.world();if(w.circle)for(let i=0;i<16;i++)points.push([w.center[0]+Math.cos(i*Math.PI/8)*w.radius,w.center[1]+Math.sin(i*Math.PI/8)*w.radius]);else points.push(...w.points||[]);}
 const local=points.map(([x,y])=>[(x-p.x)*c+(y-p.y)*s,-(x-p.x)*s+(y-p.y)*c]),width=Math.max(...local.map(q=>Math.abs(q[0])))*2,length=Math.max(...local.map(q=>Math.abs(q[1])))*2;
 if(!(width>0&&length>0))throw Error('No se ha podido medir la base de colisión del paso.');const sx=spec.width/width,sy=spec.length/length;t.graph.setLocalScale(t.id,[initial[0]*sx,initial[1]*sy,initial[2]]);
 for(const collider of sim.stepColliders)delete collider._frame;
 sim.step.variant={...sim.step.variant,size:[spec.width/sx,spec.length/sy]};
}

// Rotate a source image inside the declared footprint, preserving its aspect.
export function drawImportedPasoImage(ctx,image,width,height,degrees=0){
 const a=degrees*Math.PI/180,iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
 const bx=Math.abs(Math.cos(a))*iw+Math.abs(Math.sin(a))*ih,by=Math.abs(Math.sin(a))*iw+Math.abs(Math.cos(a))*ih,fit=Math.min(width/bx,height/by);
 ctx.save();ctx.translate(width/2,height/2);ctx.rotate(a);ctx.drawImage(image,-iw*fit/2,-ih*fit/2,iw*fit,ih*fit);ctx.restore();
}
