// Reusable manual presentation: no steering, teleport, timer reset or cutscene.
export class TemplePresentations {
 constructor(configs=[]){this.configs=configs;this.completed=[];this.hold={};this.previous=null;}
 update({position,heading,dt,stopped,playing}){
  const previous=this.previous;this.previous={position:[...position],heading};
  const angleDelta=(a,b)=>Math.abs(((a-b+540)%360)-180);
  const speed=previous&&dt>0?Math.hypot(position[0]-previous.position[0],position[1]-previous.position[1])/dt:Infinity;
  const angularSpeed=previous&&dt>0?angleDelta(heading,previous.heading)/dt:Infinity;
  const events=[];
  for(const c of this.configs){if(this.completed.includes(c.id))continue;
   const valid=playing&&stopped&&Math.hypot(position[0]-c.position[0],position[1]-c.position[1])<=c.positionTolerance&&angleDelta(heading,c.heading)<=c.headingTolerance&&speed<=c.maxSpeed&&angularSpeed<=c.maxAngularSpeed;
   this.hold[c.id]=valid?(this.hold[c.id]||0)+Math.max(0,dt):0;
   if(this.hold[c.id]+1e-8>=c.holdSeconds){this.completed.push(c.id);this.hold[c.id]=0;events.push(c);}
  }return events;
 }
 get mandatoryComplete(){return this.configs.every(c=>!c.mandatory||this.completed.includes(c.id));}
 snapshot(){return {completed:[...this.completed]};}
 restore(saved){this.completed=(saved?.completed||[]).filter(id=>this.configs.some(c=>c.id===id));this.hold={};this.previous=null;}
}
