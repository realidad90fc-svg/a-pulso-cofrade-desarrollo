// Heights are explicit game calibration, not surveyed monument measurements.
export const OVERHEAD_ITEMS=[
 ...[['cream','Toldo crema'],['green','Toldo verde'],['burgundy','Toldo burdeos'],['stripe-green','Toldo a rayas verdes'],['stripe-burgundy','Toldo a rayas burdeos']].map(([fabric,name])=>({id:'canopy-'+fabric,name,kind:'canopy',fabric})),
 {id:'lintel-church',name:'Dintel de iglesia · piedra',kind:'portal'},
 {id:'lintel-cathedral',name:'Dintel de catedral · cantería',kind:'portal'},
 {id:'lintel-chapel',name:'Dintel de capilla · ladrillo',kind:'portal'},
 {id:'arch-postigo',name:'Arco inspirado en el Postigo',kind:'arch'}
];
export const overheadType=type=>OVERHEAD_ITEMS.find(o=>o.id===type)||null;
export const DEFAULT_HEIGHTS=Object.freeze({standing:3.8,crouched:3.25,lowered:2.9});
export function validateHeightProfiles(profiles){
 if(profiles===undefined)return;if(!Array.isArray(profiles)||profiles.length>100)throw Error('Perfiles de altura no válidos.');
 const ids=new Set();for(const p of profiles){if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||!['standing','crouched','lowered'].every(k=>Number.isFinite(p[k])&&p[k]>=.1&&p[k]<=20)||p.crouched>p.standing||p.lowered>p.crouched)throw Error('Alturas no válidas: normal ≥ agachado ≥ arriado, entre 0,1 y 20 m.');ids.add(p.id)}
}
export function heightProfile(sim){const id=sim?.step?.variant?.key||sim?.step?.code;return(sim?.gameplay?.config?.heightProfiles||sim?.editorHeightProfiles||[]).find(p=>p.id===id)||DEFAULT_HEIGHTS}
export function pasoHeight(sim){const p=heightProfile(sim),state=sim?.controller?.animator?.state;return ['pasoBajado','prelevanta'].includes(state)?p.lowered:sim?.controller?.flex?p.crouched:p.standing}
export const obstacleApplies=(obstacle,sim)=>obstacle.clearance===undefined||pasoHeight(sim)>obstacle.clearance+1e-6;
export function overheadSize(o){return o.size||[o.width??3,o.depth??(overheadType(o.type)?.kind==='canopy'?1.2:.6)]}
export function validateOverhead(o){if(!overheadType(o?.type))return;const size=overheadSize(o);if(!size.every(n=>Number.isFinite(n)&&n>=.05&&n<=100)||!Number.isFinite(o.clearance)||o.clearance<.1||o.clearance>20||!Number.isFinite(o.angle)||Math.abs(o.angle)>360000||!Number.isFinite(o.pier??.3)||(o.pier??.3)<.05||(overheadType(o.type).kind!=='canopy'&&(o.pier??.3)>size[0]/2))throw Error('Revisa las medidas, altura libre y grosor de los laterales del toldo o portal.');}
export function overheadObstacles(o){
 if(!overheadType(o?.type)||o.solid===false)return[];validateOverhead(o);
 const [w,d]=overheadSize(o),a=o.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rect=(x,width)=>[[-width/2,-d/2],[width/2,-d/2],[width/2,d/2],[-width/2,d/2]].map(([u,v])=>[o.point[0]+(x+u)*c-v*s,o.point[1]+(x+u)*s+v*c]);
 const result=[{poly:rect(0,w),clearance:o.clearance,reason:6,name:overheadType(o.type).name}];
 if(overheadType(o.type).kind!=='canopy'){const p=o.pier??.3;for(const side of [-1,1])result.push({poly:rect(side*(w-p)/2,p),reason:2})}
 return result;
}
