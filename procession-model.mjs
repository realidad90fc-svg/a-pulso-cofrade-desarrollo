// Route geometry and wardrobe shared by the editor and the real game.
export const DEFAULT_UNIFORM=Object.freeze({robe:'#f0e9dc',hood:'#332337',cape:'#332337',belt:'#c5a05b',shoes:'#292722',emblem:'cross',capeOn:true});
export const DEFAULT_ACOLYTE=Object.freeze({robe:'#f3ead9',hood:'#f3ead9',cape:'#722d3c',belt:'#c4a25c',shoes:'#292722',emblem:'none',capeOn:true});
export const PROCESSION_ROLES=['nazarenes','acolytes'];
export function defaultProcession(){return{enabled:true,nazarenes:{points:[],count:12,columns:2,spacing:.5,lane:.35,offset:4},acolytes:{points:[],count:3,columns:1,spacing:.4,lane:.25,offset:2},uniform:{...DEFAULT_UNIFORM},acolyteUniform:{...DEFAULT_ACOLYTE}};}
export function validateUniform(u){if(u===undefined)return;for(const k of ['robe','hood','cape','belt','shoes'])if(!/^#[0-9a-f]{6}$/i.test(u?.[k]))throw Error('Los colores de la ropa deben ser válidos.');if(!['none','cross','shield'].includes(u.emblem)||typeof u.capeOn!=='boolean')throw Error('Vestimenta de cortejo no válida.');}
export function validateProcession(p){
 if(p===undefined)return;if(!p||typeof p.enabled!=='boolean')throw Error('Configuración de cortejo no válida.');
 for(const role of PROCESSION_ROLES){const r=p[role];if(!r||!Array.isArray(r.points)||r.points.length>2000||r.points.some(q=>!Array.isArray(q)||q.length!==2||!q.every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)))throw Error('El recorrido del cortejo contiene puntos no válidos.');
 if(!Number.isInteger(r.count)||r.count<0||r.count>120||!Number.isInteger(r.columns)||r.columns<1||r.columns>4||!Number.isFinite(r.spacing)||r.spacing<.2||r.spacing>10||!Number.isFinite(r.lane)||r.lane<.15||r.lane>5||!Number.isFinite(r.offset)||Math.abs(r.offset)>200)throw Error('Revisa cantidad, filas, separación y distancia del cortejo.');
 if(r.points.some((q,i)=>i&&Math.hypot(q[0]-r.points[i-1][0],q[1]-r.points[i-1][1])<.01))throw Error('Hay dos puntos del cortejo demasiado próximos.');}
 validateUniform(p.uniform);validateUniform(p.acolyteUniform);
}
export function pathSegments(points){let distance=0;return points.slice(1).map((b,i)=>{const a=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),s={a,b,length,start:distance};distance+=length;return s;}).filter(s=>s.length>.00001);}
export function routeProgress(points,position,previous=null){const segments=pathSegments(points);let best=null;for(const s of segments){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((position[0]-s.a[0])*dx+(position[1]-s.a[1])*dy)/(s.length*s.length))),along=s.start+t*s.length,point=[s.a[0]+dx*t,s.a[1]+dy*t],distance=Math.hypot(position[0]-point[0],position[1]-point[1]),score=distance+(previous===null?0:Math.max(0,Math.abs(along-previous)-2)*.08);if(!best||score<best.score)best={along,distance,score};}return best;}
export function pathPose(points,distance){const segments=pathSegments(points),end=segments.at(-1);if(!end||distance<0||distance>end.start+end.length)return null;const s=segments.find(s=>distance<=s.start+s.length)||end,t=(distance-s.start)/s.length,dx=(s.b[0]-s.a[0])/s.length,dy=(s.b[1]-s.a[1])/s.length;return{x:s.a[0]+dx*(distance-s.start),y:s.a[1]+dy*(distance-s.start),angle:Math.atan2(-dx,dy)*180/Math.PI,right:[dy,-dx]};}
export function processionPoses(config,pose,progress={}){
 if(!config?.enabled)return[];const result=[],a=pose.angle*Math.PI/180,front=[-Math.sin(a),Math.cos(a)],right=[Math.cos(a),Math.sin(a)];
 for(const role of PROCESSION_ROLES){const r=config[role];if(!r)continue;const nearest=r.points?.length>1?routeProgress(r.points,[pose.x,pose.y],progress[role]??null):null;if(nearest)progress[role]=nearest.along;
  for(let i=0;i<r.count;i++){const row=Math.floor(i/r.columns),lateral=(i%r.columns-(r.columns-1)/2)*r.lane,distance=r.offset+row*r.spacing;
   const p=nearest?pathPose(r.points,nearest.along+distance):{x:pose.x+front[0]*distance,y:pose.y+front[1]*distance,angle:pose.angle,right};if(!p)continue;
   result.push({x:p.x+p.right[0]*lateral,y:p.y+p.right[1]*lateral,angle:p.angle,role,index:i,uniform:role==='nazarenes'?config.uniform||DEFAULT_UNIFORM:config.acolyteUniform||DEFAULT_ACOLYTE});
  }
 }return result;
}
export function updateProcession(sim){
 const config=sim.processionConfig||sim.map?.variant?.document?.procession;if(!config){sim.processionActive=false;sim.processionActors=[];return;}
 sim.processionActive=true;for(const e of sim.cortejos||[])for(const c of e.components?.Colliders||[])c.enabled=false;if(!config.enabled){sim.processionActors=[];return;}
 const p=sim.position(sim.stepEntity.transform);sim.processionActive=true;sim.processionProgress??={};sim.processionActors=processionPoses(config,{x:p.x,y:p.y,angle:sim.angle(sim.stepEntity.transform)},sim.processionProgress);
 // Configured figures replace the original three actors; remove their hidden
 // collision bodies so the player can never hit an invisible old cortejo.
 for(const e of sim.cortejos||[])for(const c of e.components?.Colliders||[])c.enabled=false;
}
export function drawProcessionFigure(ctx,actor,pixel,zoom,time=0){
 const u=actor.uniform||DEFAULT_UNIFORM,[x,y]=pixel(actor.x,actor.y);ctx.save();ctx.translate(x,y);ctx.rotate(-(actor.angle||0)*Math.PI/180);ctx.scale(zoom,zoom);
 const oval=(cx,cy,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();};
 oval(.018,.015,.125,.16,'#17271e2a');const gait=Math.sin(time*4+actor.index*1.7)*.018;
 oval(-.048,.095+gait,.025,.047,u.shoes);oval(.048,.095-gait,.025,.047,u.shoes);
 oval(0,.025,.096,.135,u.robe);
 if(u.capeOn){ctx.fillStyle=u.cape;ctx.beginPath();ctx.moveTo(-.092,-.045);ctx.quadraticCurveTo(-.145,.10,-.08,.15);ctx.quadraticCurveTo(0,.17,.08,.15);ctx.quadraticCurveTo(.145,.1,.092,-.045);ctx.closePath();ctx.fill();}
 const light=ctx.createLinearGradient(-.09,0,.09,0);light.addColorStop(0,'#00000030');light.addColorStop(.45,'#ffffff27');light.addColorStop(1,'#00000035');oval(0,.035,.09,.125,light);
 oval(-.101,.025,.023,.062,u.robe);oval(.101,.025,.023,.062,u.robe);
 ctx.strokeStyle=u.belt;ctx.lineWidth=.014;ctx.beginPath();ctx.moveTo(-.071,.055);ctx.lineTo(.071,.055);ctx.stroke();
 if(actor.role==='nazarenes'){
  oval(0,-.045,.075,.076,u.hood);ctx.fillStyle=u.hood;ctx.beginPath();ctx.moveTo(-.052,-.075);ctx.lineTo(0,-.21);ctx.lineTo(.052,-.075);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffffff20';ctx.beginPath();ctx.moveTo(0,-.21);ctx.lineTo(.006,-.04);ctx.lineTo(-.052,-.075);ctx.closePath();ctx.fill();
  ctx.fillStyle='#d2a25e';ctx.fillRect(.127,-.15,.009,.27);ctx.fillStyle='#ffe8a1';ctx.fillRect(.125,-.165,.013,.025);
 }else{oval(0,-.061,.055,.052,'#5b382a');oval(0,-.055,.044,.037,'#d7ac83');ctx.strokeStyle='#d0ac62';ctx.lineWidth=.009;ctx.beginPath();ctx.moveTo(.13,.11);ctx.lineTo(.13,-.22);ctx.stroke();oval(.13,-.22,.035,.026,'#c3a35e');}
 if(u.emblem==='shield'){ctx.fillStyle=u.belt;ctx.beginPath();ctx.moveTo(-.022,-.005);ctx.lineTo(.022,-.005);ctx.lineTo(.018,.034);ctx.lineTo(0,.049);ctx.lineTo(-.018,.034);ctx.closePath();ctx.fill();}
 if(u.emblem!=='none'){ctx.strokeStyle='#d4b36d';ctx.lineWidth=.009;ctx.beginPath();ctx.moveTo(0,.005);ctx.lineTo(0,.045);ctx.moveTo(-.014,.017);ctx.lineTo(.014,.017);ctx.stroke();}
 ctx.restore();
}
export function drawProcession(ctx,sim,pixel,zoom=1){for(const actor of sim.processionActors||[])drawProcessionFigure(ctx,actor,pixel,zoom,sim.levelTime||0);}
