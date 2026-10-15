import {textureImage} from './seville-textures.mjs';
export const PROJECTING_SIGNS=[
 {id:'auto',name:'Automático según el comercio'},{id:'none',name:'Sin banderola'},
 {id:'pharmacy',name:'Cruz luminosa de farmacia'},{id:'gambrinus',name:'Gambrinus · Cruzcampo'},
 {id:'tobacco',name:'Estanco · Tabacos'},{id:'cafe',name:'Taza de cafetería'},{id:'shop',name:'Comercio tradicional'}
];
export function projectingSignType(f){
 if(f.bladeSign&&f.bladeSign!=='auto')return f.bladeSign;
 return{pharmacy:'pharmacy',bar:'gambrinus',baratillo:'gambrinus',morales:'gambrinus',tobacco:'tobacco',cafe:'cafe',campana:'cafe',shop:'shop',maquedano:'shop'}[f.shop]||'none';
}
// A real outward support in map metres; the emblem turns with the facade.
export function drawProjectingSign(ctx,f,at,pixel,length){
 const type=projectingSignType(f);if(type==='none')return;
 const t=f.bladePosition,depth=f.bladeDepth,size=Math.min(f.bladeSize,length*.8),p=pixel(...at(t,depth)),u=pixel(...at(t+1/length,depth)),v=pixel(...at(t,depth+1));
 ctx.save();ctx.transform(u[0]-p[0],u[1]-p[1],v[0]-p[0],v[1]-p[1],p[0],p[1]);
 const box=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)};
 const line=(x,y,xx,yy,c,w=.025)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke()};
 box(-size*.46+.06,-size*.47+.07,size*.92,size*.94,'rgba(25,28,24,.24)');
 line(0,-depth,0,0,'#292e2d',.038);line(-.09,-depth+.02,0,-depth+.25,'#555951',.024);line(-.11,-depth+.025,.11,-depth+.025,'#2d3433',.055);
 ctx.scale(size,size);
 const plate=(x,y,w,h,r,fill,stroke)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=.055;ctx.stroke()};
 const cross=()=>{ctx.beginPath();for(const [i,q]of [[-.15,-.48],[.15,-.48],[.15,-.15],[.48,-.15],[.48,.15],[.15,.15],[.15,.48],[-.15,.48],[-.15,.15],[-.48,.15],[-.48,-.15],[-.15,-.15]].entries())i?ctx.lineTo(...q):ctx.moveTo(...q);ctx.closePath()};
 if(type==='pharmacy'){
  cross();ctx.fillStyle='#164c31';ctx.fill();ctx.strokeStyle='#b8e7bf';ctx.lineWidth=.055;ctx.stroke();ctx.scale(.82,.82);cross();ctx.fillStyle='#35c76d';ctx.fill();
  for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++)if(Math.abs(i)<=1||Math.abs(j)<=1)box(i*.115-.013,j*.115-.013,.026,.026,'#d7ffe1');
 }else if(type==='gambrinus'){
  plate(-.48,-.56,.96,1.12,.18,'#fff5da','#a62b27');
  const image=textureImage('gambrinus');
  if(image){ctx.imageSmoothingEnabled=true;ctx.drawImage(image,280,65,305,345,-.37,-.45,.74,.84)}
  else{box(-.22,-.10,.44,.48,'#c82129');box(-.17,-.35,.27,.19,'#f4d6b5');box(-.28,-.40,.4,.07,'#b91c29');line(.15,.05,.34,-.20,'#c82129',.12);box(.28,-.38,.13,.22,'#dfaa49');box(.27,-.40,.15,.04,'#fff8df')}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#aa2525';ctx.font='800 .105px Georgia,serif';ctx.fillText('CRUZCAMPO',0,.47,.84);
 }else if(type==='tobacco'){
  plate(-.43,-.53,.86,1.06,.08,'#9b202c','#edbd5a');box(-.29,-.25,.58,.13,'#f0c05d');box(-.075,-.18,.15,.4,'#f0c05d');
  ctx.fillStyle='#f5d079';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 .145px Georgia,serif';ctx.fillText('TABACOS',0,.37,.73);
 }else{
  plate(-.45,-.45,.9,.9,.12,type==='cafe'?'#eee2bd':'#315e68','#cfad70');
  if(type==='cafe'){
   ctx.beginPath();ctx.roundRect(-.25,-.10,.45,.33,.06);ctx.fillStyle='#65513c';ctx.fill();ctx.strokeStyle='#65513c';ctx.lineWidth=.055;ctx.beginPath();ctx.arc(.23,.06,.12,-Math.PI/2,Math.PI/2);ctx.stroke();line(-.28,.29,.31,.29,'#9a7048',.05);for(const x of [-.12,.04])line(x,-.20,x+.04,-.34,'#9a7048',.025);
  }else{box(-.26,-.23,.52,.50,'#e9d6ac');ctx.strokeStyle='#e9d6ac';ctx.lineWidth=.05;ctx.beginPath();ctx.arc(0,-.23,.14,Math.PI,Math.PI*2);ctx.stroke()}
 }
 ctx.restore();
}
