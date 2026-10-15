const valid=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
export const DEFAULT_STREET_TRIGGER_RADIUS=1;
export function streetTriggerRadius(label){const r=label?.[2]?.radius;return Number.isFinite(r)?Math.max(.2,Math.min(5,r)):DEFAULT_STREET_TRIGGER_RADIUS}
// First entry along a movement segment, including a small trigger crossed
// entirely between frames. No nearest-street inference is involved.
function entryTime(from,to,point,radius){
 const x=from[0]-point[0],y=from[1]-point[1],dx=to[0]-from[0],dy=to[1]-from[1],c=x*x+y*y-radius*radius;
 if(c<=0)return 0;
 const a=dx*dx+dy*dy;if(a<1e-12)return null;
 const b=2*(x*dx+y*dy),discriminant=b*b-4*a*c;if(discriminant<0)return null;
 const t=(-b-Math.sqrt(discriminant))/(2*a);return t>=0&&t<=1?t:null;
}

// Only entering a configured point announces a street. The current name
// remains active until another point is crossed, even outside every radius.
export class StreetIdentifiers{
 constructor(labels=[]){
  this.labels=labels.filter(l=>Array.isArray(l)&&typeof l[0]==='string'&&l[0].trim()&&valid(l[1])).map(l=>{
   const name=l[0].trim().slice(0,90),point=[...l[1]],radius=streetTriggerRadius(l);
   return{id:JSON.stringify([name,point,radius]),name,point,radius};
  });
  this.notice=null;this.previous=null;this.inside=new Set();this.lastTime=null;
 }
 at(position,time){
  if(!valid(position)||!Number.isFinite(time))return this.notice;
  if(this.lastTime!==null&&time<this.lastTime){this.notice=null;this.previous=null;this.inside.clear()}
  const entered=[],inside=new Set();
  for(const label of this.labels){
   const distance=Math.hypot(position[0]-label.point[0],position[1]-label.point[1]);
   if(distance<=label.radius)inside.add(label.id);
   if(this.inside.has(label.id))continue;
   const t=entryTime(this.previous||position,position,label.point,label.radius);
   if(t!==null)entered.push({...label,t,distance});
  }
  entered.sort((a,b)=>a.t-b.t||b.distance-a.distance);
  for(const label of entered)this.notice={id:label.id,name:label.name,since:this.notice?.name===label.name?this.notice.since:time};
  this.previous=[...position];this.inside=inside;this.lastTime=time;
  return this.notice;
 }
 snapshot(){return{notice:this.notice?{...this.notice}:null,previous:this.previous?[...this.previous]:null,inside:[...this.inside],lastTime:this.lastTime}}
 restore(value){
  const known=new Set(this.labels.map(l=>l.id)),notice=value?.notice;
  this.notice=known.has(notice?.id)&&Number.isFinite(notice.since)?{id:notice.id,name:this.labels.find(l=>l.id===notice.id).name,since:notice.since}:null;
  this.previous=valid(value?.previous)?[...value.previous]:null;
  this.inside=new Set(Array.isArray(value?.inside)?value.inside.filter(id=>known.has(id)):[]);
  this.lastTime=Number.isFinite(value?.lastTime)?value.lastTime:null;
 }
}

export function drawStreetTriggerGuide(ctx,label,pixel,zoom){
 const [name,position]=label,q=pixel(...position),radius=streetTriggerRadius(label)*zoom;
 ctx.save();ctx.strokeStyle='rgba(241,199,91,.75)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(q[0],q[1],radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#f1c75b';ctx.beginPath();ctx.arc(q[0],q[1],3,0,Math.PI*2);ctx.fill();
 ctx.font='600 12px system-ui';ctx.lineWidth=3;ctx.strokeStyle='#171a20';ctx.strokeText(name,q[0]+6,q[1]);ctx.fillStyle='#fff5e7';ctx.fillText(name,q[0]+6,q[1]);ctx.restore();
}

export function drawStreetNotice(ctx,width,height,dpr,sim,notice){
 if(!notice||sim.timeScale===0||sim.state.status!=='playing')return;
 const age=sim.levelTime-notice.since,duration=3.5;if(age<0||age>=duration)return;
 const alpha=Math.min(1,age/.18,(duration-age)/.55),w=Math.min(260,width-40),h=34,x=(width-w)/2,y=Math.max(112,height*.145);
 ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=alpha;ctx.fillStyle='rgba(37,19,24,.94)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#a68b55';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.fillStyle='#eee0c5';ctx.font='17px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(notice.name,x+w/2,y+h/2,w-20);ctx.restore();
}
