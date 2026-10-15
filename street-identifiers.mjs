import {pointInPolygon,segmentDistance} from './engine.mjs';
const valid=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
const distanceToPolygon=(p,poly)=>pointInPolygon(p,poly)?0:Math.min(...poly.map((a,i)=>segmentDistance(p,a,poly[(i+1)%poly.length]).distance));

// Editor anchors identify the current street. They are metadata, never paint
// on the ground. Prefer anchors on the same road at close parallel streets.
export class StreetIdentifiers{
 constructor(labels=[]){
  this.labels=labels.filter(l=>Array.isArray(l)&&typeof l[0]==='string'&&l[0].trim()&&valid(l[1])).map((l,i)=>({id:'editor-street-'+i,name:l[0].trim().slice(0,90),point:l[1]}));
  this.notice=null;this.roads=null;
 }
 at(position,time,roads=[]){
  if(this.roads!==roads){
   this.roads=roads;
   this.bindings=this.labels.map(l=>{const distances=roads.map(p=>distanceToPolygon(l.point,p)),nearest=Math.min(...distances);return distances.map((d,i)=>d<=nearest+.12?i:-1).filter(i=>i>=0)});
  }
  const occupied=new Set(roads.flatMap((poly,i)=>pointInPolygon(position,poly)?[i]:[]));
  const ranked=this.labels.map((l,i)=>{const distance=Math.hypot(l.point[0]-position[0],l.point[1]-position[1]);return{...l,distance,score:distance+(occupied.size&&!this.bindings[i].some(j=>occupied.has(j))?3:0)}}).filter(l=>l.distance<=18).sort((a,b)=>a.score-b.score);
  let selected=ranked[0];const current=ranked.find(l=>l.id===this.notice?.id);
  if(current&&selected&&current.score<=selected.score+.2)selected=current;
  if(!selected){this.notice=null;return null}
  if(this.notice?.id!==selected.id||time<this.notice.since)this.notice={id:selected.id,name:selected.name,since:time};
  return this.notice;
 }
}

export function drawStreetNotice(ctx,width,height,dpr,sim,notice){
 if(!notice||sim.timeScale===0||sim.state.status!=='playing')return;
 const age=sim.levelTime-notice.since,duration=3.5;if(age<0||age>=duration)return;
 const alpha=Math.min(1,age/.18,(duration-age)/.55),w=Math.min(260,width-40),h=34,x=(width-w)/2,y=Math.max(112,height*.145);
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=alpha;ctx.fillStyle='rgba(37,19,24,.94)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#a68b55';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle='#eee0c5';ctx.font='17px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(notice.name,x+w/2,y+h/2,w-20);ctx.restore();
}
