// Urban street fixtures for Sevilla-inspired editor maps.
// Every piece is lightweight vector artwork; map data stores only type,
// position, heading and dimensions. All dimensions are in map units (metres).
export const URBAN_ITEMS=[
 {id:'crosswalk',name:'Paso de peatones · cebra',kind:'marking'},
 {id:'raised-crosswalk',name:'Paso de peatones elevado',kind:'marking'},
 {id:'stop-line',name:'Línea de detención',kind:'marking'},
 {id:'lamp-sevilla',name:'Farola clásica sevillana',kind:'fixture'},
 {id:'lamp-modern',name:'Farola urbana moderna',kind:'fixture'},
 {id:'traffic-light',name:'Semáforo de vehículos',kind:'fixture'},
 {id:'pedestrian-light',name:'Semáforo peatonal',kind:'fixture'},
 {id:'crossing-sign',name:'Señal de paso de peatones',kind:'fixture'},
 {id:'bollard',name:'Bolardo metálico',kind:'fixture'},
 {id:'bench',name:'Banco urbano',kind:'fixture'},
 {id:'bin',name:'Papelera',kind:'fixture'},
 {id:'planter',name:'Jardinera',kind:'fixture'},
 {id:'bike-rack',name:'Aparcabicicletas',kind:'fixture'},
 {id:'bus-shelter',name:'Marquesina de autobús',kind:'fixture'},
 {id:'tree-grille',name:'Alcorque de árbol',kind:'fixture'}
];
const ids=new Set(URBAN_ITEMS.map(v=>v.id));
export const urbanName=type=>URBAN_ITEMS.find(v=>v.id===type)?.name||'Elemento urbano';
export const urbanIsMarking=type=>URBAN_ITEMS.find(v=>v.id===type)?.kind==='marking';
const finite=n=>Number.isFinite(n);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const round=n=>Math.round(n*1000)/1000;
export function newUrbanElement(type,point,options={}){
 if(!ids.has(type)||!Array.isArray(point)||!point.slice(0,2).every(finite))throw Error('Elemento urbano no válido.');
 const angle=finite(options.angle)?options.angle:0;
 const width=clamp(finite(options.width)?options.width:3,1.5,12);
 const depth=clamp(finite(options.depth)?options.depth:2.6,1,6);
 return{type,point:point.slice(0,2).map(round),angle:round(((angle%360)+360)%360),width:round(width),depth:round(depth)};
}
export function crosswalkFromDrag(type,start,end,depth=2.6){
 if(!urbanIsMarking(type))throw Error('Tipo de marca vial no válido.');
 const dist=Math.hypot(end[0]-start[0],end[1]-start[1]);
 const point=dist<.1?start:[(start[0]+end[0])/2,(start[1]+end[1])/2];
 const angle=dist<.1?0:Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI;
 return newUrbanElement(type,point,{angle,width:dist<.1?3:dist,depth});
}
const sizes={
 'lamp-sevilla':[.24,.24],'lamp-modern':[.22,.22],
 'traffic-light':[.30,.22],'pedestrian-light':[.24,.24],
 'crossing-sign':[.23,.23],'bollard':[.20,.20],
 'bench':[1.15,.43],'bin':[.36,.36],'planter':[.76,.52],
 'bike-rack':[.84,.45],'bus-shelter':[1.95,.53],
 'tree-grille':[.90,.90]
};
export function urbanCollisionSize(item){
 return urbanIsMarking(item?.type)||item?.type==='tree-grille'?null:(sizes[item?.type]||[.32,.32]);
}
export function urbanContains(item,point,tolerance=.18){
 if(!Array.isArray(item?.point)||!Array.isArray(point))return false;
 const dx=point[0]-item.point[0],dy=point[1]-item.point[1],
  a=(item.angle||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),
  x=dx*c+dy*s,y=-dx*s+dy*c;
 const dims=urbanIsMarking(item.type)?[item.width||3,item.depth||2.6]:(sizes[item.type]||[.4,.4]);
 return Math.abs(x)<=dims[0]/2+tolerance&&Math.abs(y)<=dims[1]/2+tolerance;
}
export function drawUrbanElement(ctx,item,pixel,zoom,selected=false){
 if(!item?.point||!ids.has(item.type))return;
 const [x,y]=pixel(...item.point),z=Math.max(.1,zoom);
 ctx.save();ctx.translate(x,y);ctx.rotate(-(item.angle||0)*Math.PI/180);ctx.scale(z,z);
 const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
 const outline=(x,y,w,h,color='#312f2c',weight=.025)=>{ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.strokeRect(x,y,w,h)};
 const disk=(x,y,r,color,stroke=null)=>{
  ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.025;ctx.stroke()}
 };
 const line=(x,y,u,v,color='#4c4b45',weight=.03)=>{
  ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke();
 };
 const t=item.type;
 if(urbanIsMarking(t)){
  const w=clamp(item.width||3,1.5,12),d=clamp(item.depth||2.6,1,6);
  if(t==='raised-crosswalk'){
   rect(-w/2,-d/2,w,d,'#8b8982');
   outline(-w/2,-d/2,w,d,'#cdc3a9',.04);
   rect(-w/2+.04,-d/2+.04,w-.08,.09,'#d5c7ab');
   rect(-w/2+.04,d/2-.13,w-.08,.09,'#d5c7ab');
  }
  if(t==='stop-line'){
   rect(-w/2,-Math.min(.16,d/2),w,.30,'#edece5');
   outline(-w/2,-Math.min(.16,d/2),w,.30,'#bab9b4',.014);
  }else{
   const count=Math.max(3,Math.min(22,Math.round(w/.45))),unit=w/count,stroke=Math.min(.39,unit*.73);
   for(let i=0;i<count;i++){
    const sx=-w/2+i*unit+(unit-stroke)/2;
    rect(sx,-d/2+.05,stroke,d-.10,'#f5f2e9');
    outline(sx,-d/2+.05,stroke,d-.10,'rgba(155,152,142,.40)',.009);
   }
  }
 }else if(t==='lamp-sevilla'){
  disk(0,0,.105,'#313b39','#161a1b');disk(0,0,.052,'#716f59');
  for(let i=0;i<4;i++){
   const a=i*Math.PI/2+.23,c=Math.cos(a),s=Math.sin(a);
   line(c*.08,s*.08,c*.32,s*.32,'#343f3c',.075);
   disk(c*.33,s*.33,.125,'#f8dfa0','#545f58');
   disk(c*.33-.035,s*.33-.03,.032,'#fff8d9');
  }
  disk(0,0,.052,'#e8c88b','#26342f');
 }else if(t==='lamp-modern'){
  disk(0,0,.10,'#7c8180','#303b41');
  line(0,0,.30,0,'#6d7473',.055);
  rect(.27,-.085,.23,.17,'#c6d9d9');outline(.27,-.085,.23,.17,'#526067');
  rect(.32,-.04,.13,.08,'#eef8e7');
 }else if(t==='traffic-light'||t==='pedestrian-light'){
  disk(-.18,-.05,.085,'#8f9691','#404547');
  line(-.13,-.05,.03,-.05,'#737d78',.055);
  const w=t==='traffic-light'?.27:.23,h=t==='traffic-light'?.42:.31;
  rect(-w/2,-h/2,w,h,'#232d2b');outline(-w/2,-h/2,w,h,'#101716',.025);
  if(t==='traffic-light'){
   disk(0,-.132,.051,'#db5141','#8a2924');
   disk(0,0,.051,'#d8a746','#8b6d31');
   disk(0,.132,.051,'#39865a','#285839');
  }else{
   rect(-.075,-.095,.15,.075,'#a6433c');rect(-.075,.02,.15,.075,'#338c55');
   rect(-.027,-.078,.054,.039,'#edcdbe');rect(-.014,.045,.028,.031,'#dce9d2');
  }
 }else if(t==='crossing-sign'){
  disk(0,0,.12,'#6b7774','#303a39');
  rect(-.20,-.2,.40,.40,'#e8e6d8');outline(-.20,-.2,.40,.40,'#344b78',.055);
  ctx.fillStyle='#3c6a9b';ctx.beginPath();ctx.moveTo(0,-.145);ctx.lineTo(.15,.125);ctx.lineTo(-.15,.125);ctx.closePath();ctx.fill();
  disk(0,-.065,.027,'#f2f2eb');line(0,-.04,.035,.045,'#f1f2ef',.027);line(.025,.02,-.025,.085,'#f1f2ef',.025);
 }else if(t==='bollard'){
  disk(0,0,.108,'#282e30','#111c1e');disk(-.016,-.02,.064,'#adb0a4','#525f5d');
  disk(-.025,-.032,.023,'#e5e3d2');
 }else if(t==='bench'){
  rect(-.58,-.22,1.16,.44,'#393c37');outline(-.58,-.22,1.16,.44,'#262b29',.025);
  for(let i=0;i<4;i++){rect(-.53,-.185+i*.09,1.06,.075,i%2?'#a78155':'#c49b67');line(-.53,-.185+i*.09,.53,-.185+i*.09,'#725b45',.009)}
  rect(-.51,-.29,1.02,.065,'#666c65');
 }else if(t==='bin'){
  disk(0,0,.18,'#355b4f','#243a32');disk(0,0,.12,'#769a7e','#294738');
  rect(-.08,-.035,.16,.07,'#223e34');disk(-.10,-.105,.018,'#d1cbaf');
 }else if(t==='planter'){
  rect(-.37,-.25,.74,.5,'#bd956f');outline(-.37,-.25,.74,.5,'#70513e',.05);
  rect(-.28,-.16,.56,.32,'#665641');
  for(const [cx,cy,r]of [[-.17,-.07,.14],[.10,.04,.17],[.23,-.08,.105],[-.08,.13,.12]])disk(cx,cy,r,'#466d46','#2d5039');
 }else if(t==='bike-rack'){
  for(const xx of [-.29,0,.29]){
   ctx.beginPath();ctx.ellipse(xx,0,.105,.26,0,0,2*Math.PI);
   ctx.strokeStyle='#929a98';ctx.lineWidth=.057;ctx.stroke();
  }
  rect(-.41,-.025,.82,.05,'#5c6461');
 }else if(t==='bus-shelter'){
  rect(-.96,-.29,1.92,.58,'rgba(102,151,167,.60)');outline(-.96,-.29,1.92,.58,'#35434a',.045);
  rect(-.88,-.22,1.76,.09,'#d0d4c7');rect(-.88,.17,1.76,.055,'#526265');
  for(const xx of [-.85,.85])rect(xx,-.30,.08,.59,'#485352');
  rect(-.57,-.085,.90,.13,'#a6b0a5');
  disk(.66,0,.11,'#274d8d');ctx.font='bold .13px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText('BUS',.66,0);
 }else if(t==='tree-grille'){
  rect(-.44,-.44,.88,.88,'#a3947d');outline(-.44,-.44,.88,.88,'#665d4d',.028);
  for(let v=-.32;v<.40;v+=.16){line(v,-.40,v,.40,'#4f5750',.025);line(-.40,v,.40,v,'#4f5750',.025)}
  disk(0,0,.175,'#4e6b40','#675849');
 }
 if(selected){
  const dims=urbanIsMarking(t)?[item.width||3,item.depth||2.6]:(sizes[t]||[.4,.4]);
  ctx.strokeStyle='#42ecf6';ctx.lineWidth=Math.max(.022,.9/z);
  ctx.strokeRect(-dims[0]/2-.09,-dims[1]/2-.09,dims[0]+.18,dims[1]+.18);
 }
 ctx.restore();
}
