export const starsForTime=(route,timeMs)=>timeMs<=route.threeStars*1000?3:timeMs<=route.twoStars*1000?2:1;
export function formatCampaignTime(ms){if(!Number.isFinite(ms))return '—';const n=Math.max(0,Math.floor(ms/10));return `${String(Math.floor(n/6000)).padStart(2,'0')}:${String(Math.floor(n/100)%60).padStart(2,'0')}.${String(n%100).padStart(2,'0')}`;}
export const starSymbols=n=>'★'.repeat(n)+'☆'.repeat(3-n);
export function createProgress(data,old={}){
 const p={version:2,records:{...old?.records},unlocked:{days:[],brotherhoods:[],routes:[]},totals:{},active:old?.active||null};
 for(const route of data.routes){const r=p.records[route.id]||{},best=Number.isFinite(r.bestTimeMs)&&r.bestTimeMs>=0?Math.round(r.bestTimeMs):null;
  p.records[route.id]={bestTimeMs:best,stars:best===null?0:Math.max(Math.min(3,Math.max(0,Math.floor(r.stars||0))),starsForTime(route,best)),assistedStars:Math.min(3,Math.max(0,Math.floor(r.assistedStars||0))),completed:best!==null||!!r.completed,completedAssisted:!!r.completedAssisted,...(route.presentations?{presentationIds:(r.presentationIds||[]).filter(id=>route.presentations.some(e=>e.id===id))}:{})};
 }
 const previous=structuredClone(old?.unlocked||{});previous.brotherhoods=(previous.brotherhoods||[]).map(id=>data.migration?.brotherhoods?.[id]||id);
 recalculate(data,p,previous);return p;
}
export function recalculate(data,p,previous=p.unlocked){
 const totals={stars:0,max:data.routes.filter(r=>r.playable!==false).length*3,days:{},brotherhoods:{}};
 for(const day of data.days)totals.days[day.id]={stars:0,max:0};
 for(const b of data.brotherhoods)totals.brotherhoods[b.id]={stars:0,max:0};
 for(const route of data.routes){if(route.playable===false)continue;const b=data.brotherhoods.find(b=>b.id===route.brotherhoodId);if(!b)throw new Error('Hermandad desconocida: '+route.id);const record=p.records[route.id];if(record.bestTimeMs!==null)record.stars=Math.max(record.stars,starsForTime(route,record.bestTimeMs));const stars=Math.max(record.stars,record.assistedStars||0);totals.stars+=stars;for(const bucket of [totals.days[b.dayId],totals.brotherhoods[b.id]]){bucket.stars+=stars;bucket.max+=3;}}
 p.totals=totals;
 const met=(item,dayId,bId)=>{const u=item.unlock||{stars:0};const count=u.scope==='day'?totals.days[dayId]?.stars:u.scope==='brotherhood'?totals.brotherhoods[bId]?.stars:totals.stars;return (count||0)>=(u.stars||0)&&(!u.completedRoute||!!p.records[u.completedRoute]?.completed);};
 const unlocked={days:[],brotherhoods:[],routes:[]};
 for(const d of data.days)if(met(d,d.id)||previous?.days?.includes(d.id))unlocked.days.push(d.id);
 for(const b of data.brotherhoods)if(unlocked.days.includes(b.dayId)&&(met(b,b.dayId,b.id)||previous?.brotherhoods?.includes(b.id)))unlocked.brotherhoods.push(b.id);
 for(const r of data.routes){const b=data.brotherhoods.find(b=>b.id===r.brotherhoodId);if(r.playable!==false&&unlocked.brotherhoods.includes(b.id)&&(met(r,b.dayId,b.id)||previous?.routes?.includes(r.id)))unlocked.routes.push(r.id);}
 p.unlocked=unlocked;return unlocked;
}
export function finishCampaign(data,p,routeId,timeMs,assisted=false,presentationIds=[],allowDevelopmentAccess=false){
 const route=data.routes.find(r=>r.id===routeId);if(!route||route.playable===false||(!allowDevelopmentAccess&&!p.unlocked.routes.includes(routeId))||!Number.isFinite(timeMs)||timeMs<0)throw new Error('Resultado de recorrido no válido');
 if(route.presentations?.some(event=>event.mandatory&&!presentationIds.includes(event.id)))throw new Error('Falta una presentación obligatoria');
 timeMs=Math.round(timeMs);const before=structuredClone(p.unlocked),record=p.records[routeId];let newRecord=false;
 const cleanOnly=assisted&&route.checkpoints.policy==='cleanRecord';
 const currentStars=cleanOnly?Math.min(2,starsForTime(route,timeMs)):starsForTime(route,timeMs);
 record.completed=true;
 if(route.presentations)record.presentationIds=[...new Set([...(record.presentationIds||[]),...presentationIds.filter(id=>route.presentations.some(e=>e.id===id))])];
 if(assisted){record.completedAssisted=true;record.assistedStars=Math.max(record.assistedStars,currentStars);}
 if(!cleanOnly&&(record.bestTimeMs===null||timeMs<record.bestTimeMs)){record.bestTimeMs=timeMs;record.stars=Math.max(record.stars,currentStars);newRecord=true;}
 p.active=null;recalculate(data,p);
 const newlyUnlocked=[];for(const [kind,ids]of Object.entries(p.unlocked))for(const id of ids)if(!before[kind].includes(id))newlyUnlocked.push({kind,id});
 return {timeMs,currentStars,bestStars:Math.max(record.stars,record.assistedStars),bestTimeMs:record.bestTimeMs,newRecord,assisted,newlyUnlocked};
}
// Wall-clock time during active play, independent of frame caps / simulation lag.
export class CampaignClock{
 constructor(saved={}){this.elapsedMs=Math.max(0,saved.elapsedMs||0);this.started=!!saved.started;this.last=null;this.running=false;}
 update(now,ready=true){if(this.running&&this.last!==null)this.elapsedMs+=Math.max(0,now-this.last);this.last=now;if(ready)this.started=true;this.running=this.started&&ready;return this.elapsedMs;}
 pause(now){this.update(now,false);this.last=null;}
 snapshot(){return {elapsedMs:this.elapsedMs,started:this.started};}
}
export class CampaignAttempt{
 constructor(route,saved={}){this.route=route;this.clock=new CampaignClock(saved.clock);this.assisted=!!saved.assisted;this.checkpoint=saved.checkpoint||null;this.checkpointIds=[...(saved.checkpointIds||[])];this.stopped=false;}
 observe(sim,now){if(this.stopped)return;const ready=this.clock.started||(this.route.clockStart==='control'?!!sim.buttons?.[0]?.interactable:sim.controller.tiempo>0);this.clock.update(now,ready);this.captureCheckpoints(sim);if(sim.state.status!=='playing'){this.clock.pause(now);this.stopped=true;}}
 captureCheckpoints(sim){for(const point of this.route.checkpoints.points){if(this.checkpointIds.includes(point.id))continue;let snapshot;
  if(point.activation==='presentation'&&sim.state.status==='playing'&&sim.routeAdapter?.presentationIds?.includes(point.presentationId))snapshot=sim.snapshot();
  else if(point.native&&sim.checkpointState)snapshot=sim.checkpointState;
  else if(!point.activation&&point.position&&sim.state.status==='playing'&&sim.state.lifted){const p=sim.position(sim.stepEntity.transform);if(Math.hypot(p.x-point.position[0],p.y-point.position[1])<=(point.radius||.2))snapshot=sim.snapshot();}
  if(snapshot){this.checkpointIds.push(point.id);this.checkpoint={id:point.id,snapshot:structuredClone(snapshot),clock:this.clock.snapshot()};}
 }}
 retryFromCheckpoint(){if(!this.checkpoint)throw new Error('No hay checkpoint');
  // Restore the checkpoint clock, not the time spent after passing it.
  // Old saves did not store the campaign clock here; use their saved native
  // timer rather than the failed-attempt clock. All retries remain assisted.
  const native=this.checkpoint.snapshot?.controller?.tiempo??this.checkpoint.snapshot?.state?.time;
  const clock=this.checkpoint.clock||{elapsedMs:Number.isFinite(native)?Math.max(0,native*1000):0,started:this.clock.started};
  return new CampaignAttempt(this.route,{clock,assisted:true,checkpoint:this.checkpoint,checkpointIds:this.checkpointIds});
 }
 snapshot(){return {routeId:this.route.id,clock:this.clock.snapshot(),assisted:this.assisted,checkpoint:this.checkpoint,checkpointIds:[...this.checkpointIds]};}
}
