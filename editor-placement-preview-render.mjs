import {overheadType,overheadSize} from './overhead-elements.mjs';
import {drawRoof,drawSurface,drawTree,drawFurniture} from './editor-materials.mjs';
import {drawFacadeDecor} from './editor-facades.mjs';
import {drawUrbanElement,urbanIsMarking,urbanCollisionSize} from './editor-urban-elements.mjs';
import {drawTrafficSign,drawCheckpointGuide} from './editor-object-render.mjs';
import {drawStreetTriggerGuide} from './street-identifiers.mjs';
import {pasoFootprint,pasoPoint} from './editor-paso-orientation.mjs';
import {assetById,isSurfaceAsset,newCustomObject,drawCustomObject} from './custom-assets.mjs';

const building=[[-3,0],[3,0],[3,3],[-3,3]];
const bounds=poly=>[Math.min(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
function extent(s){
 if(s.kind==='custom'){
  const a=assetById(s.id),w=a?.width||1,d=a?.depth||1,angle=(a?.angle||0)*Math.PI/180;
  return{width:s.row?(s.spacing||.7)*4+w+Math.max(w,d)*.35:Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d+Math.max(w,d)*.35,height:Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*d+Math.max(w,d)*.35};
 }
 if(['roof','facade'].includes(s.kind)){
  const b=bounds(s.poly||building);return{width:b[2]-b[0]+1,height:b[3]-b[1]+2.3,center:[(b[0]+b[2])/2,(b[1]+b[3])/2-.45]};
 }
 if(s.kind==='tree'){const r=(s.radius||.35)*(s.scale||1);return{width:r*2.5,height:r*2.5}}
 if(s.kind==='person')return{width:Math.max(.35,s.size?.[0]||.19)*1.2,height:Math.max(.35,s.size?.[1]||.19)*1.2};
 if(s.kind==='fence'||s.kind==='chair')return{width:s.row?Math.max(s.kind==='fence'?1.25:.65,(s.spacing||.7)*4+1.15):s.kind==='fence'?1.35:.7,height:s.row?1.2:s.kind==='fence'?.5:.7};
 if(s.kind==='urban'){
  if(overheadType(s.type)){const [w,d]=overheadSize(s);return{width:w+.5,height:d+.5}}
  if(urbanIsMarking(s.type))return{width:(s.width||3)+.5,height:(s.depth||2.6)+.5};
  const size=urbanCollisionSize(s)||[.9,.9];return{width:Math.max(.9,size[0]+.4),height:Math.max(.9,size[1]+.3)};
 }
 if(s.kind==='sign')return{width:.4,height:.4};
 if(s.kind==='checkpoint')return{width:1.1,height:1.1};
 if(s.kind==='street-name')return{width:(s.radius||1)*2.5,height:(s.radius||1)*3.4,center:[0,(s.radius||1)*.25]};
 if(s.kind==='paso')return{width:3.5,height:3.5};
 if(s.kind==='reference')return{width:4,height:3};
 return{width:4,height:2.2};
}
export function paintPlacementPreview(canvas,spec,getImage=()=>null){
 if(spec.kind==='custom'){
  const asset=assetById(spec.id);if(isSurfaceAsset(asset))return paintPlacementPreview(canvas,{kind:{roads:'road',sidewalks:'sidewalk',houses:'roof'}[asset.category],material:asset.id},getImage);
 }
 const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,density=w/288;
 c.clearRect(0,0,w,h);c.fillStyle=['road','urban','sign'].includes(spec.kind)?'#65686a':'#c2bfae';c.fillRect(0,0,w,h);
 c.strokeStyle='rgba(65,72,65,.10)';c.lineWidth=density;
 for(let x=0;x<w;x+=24*density){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
 for(let y=0;y<h;y+=24*density){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
 const e=extent(spec),z=Math.min((w-28*density)/e.width,(h-24*density)/e.height),center=e.center||[0,0];
 const pixel=(x,y)=>[w/2+(x-center[0])*z,h/2-(y-center[1])*z];
 c.save();c.imageSmoothingEnabled=false;
 if(spec.kind==='custom'){
  const asset=assetById(spec.id);
  if(asset){const n=spec.row?5:1;for(let i=0;i<n;i++)drawCustomObject(c,newCustomObject(asset,[(i-(n-1)/2)*(spec.spacing||.7),0]),pixel,z)}
  else{c.fillStyle='#344a4d';c.textAlign='center';c.font=12*density+'px system-ui';c.fillText('Importa tu primer recurso en Mis recursos',w/2,h/2)}
 }else if(spec.kind==='roof'||spec.kind==='facade'){
  const poly=spec.poly||building;
  drawRoof(c,poly,spec.material,pixel,getImage,z,spec.roof||{roofDetail:'none',roofInset:.05});
  if(spec.kind==='facade')drawFacadeDecor(c,{poly,facade:spec.facade},pixel,z);
 }else if(spec.kind==='road'||spec.kind==='sidewalk'){
  const poly=[[-2,-1.1],[2,-1.1],[2,1.1],[-2,1.1]];
  drawSurface(c,poly,spec.kind==='road'?'roads':'sidewalks',spec.material,pixel,z,getImage('sharedassets2.assets:373'));
 }else if(spec.kind==='tree'){
  drawTree(c,{point:[0,0],variant:spec.id,radius:spec.radius||.35,scale:spec.scale||1,rotation:spec.angle||0},pixel,z,getImage);
 }else if(spec.kind==='person'){
  const image=getImage(spec.id),size=spec.size||[.19,.19],p=pixel(0,0);
  if(image){c.save();c.translate(...p);c.rotate(-(spec.angle||0)*Math.PI/180);c.drawImage(image,-size[0]*z/2,-size[1]*z/2,size[0]*z,size[1]*z);c.restore()}
  else{c.fillStyle='#2e4147';c.font=12*density+'px system-ui';c.textAlign='center';c.fillText('Cargando imagen…',w/2,h/2)}
 }else if(spec.kind==='fence'||spec.kind==='chair'){
  const n=spec.row?5:1,spacing=spec.spacing||.7;
  for(let i=0;i<n;i++)drawFurniture(c,{point:[(i-(n-1)/2)*spacing,0],angle:0,width:spec.kind==='fence'?.95:.4},spec.kind,pixel,z);
 }else if(spec.kind==='urban')drawUrbanElement(c,{point:[0,0],type:spec.type,angle:0,width:spec.width||3,depth:spec.depth||2.6},pixel,z);
 else if(spec.kind==='sign')drawTrafficSign(c,{point:[0,0],angle:0},pixel,z);
 else if(spec.kind==='checkpoint')drawCheckpointGuide(c,{position:[0,0]},pixel,z,{label:false});
 else if(spec.kind==='street-name'){
  drawStreetTriggerGuide(c,[spec.name||'Nombre de calle',[0,0],{radius:spec.radius||1}],pixel,z);
  c.fillStyle='#5d352b';c.strokeStyle='#c7a76a';c.lineWidth=density;c.fillRect(14*density,8*density,w-28*density,27*density);c.strokeRect(14*density,8*density,w-28*density,27*density);
  c.fillStyle='#fff0d0';c.textAlign='center';c.textBaseline='middle';c.font='bold '+13*density+'px Georgia';c.fillText(spec.name||'Nombre de calle',w/2,22*density,w-40*density);
 }else if(spec.kind==='paso'){
  const pose={x:0,y:0,angle:spec.angle||0},poly=pasoFootprint(pose);
  c.beginPath();poly.forEach((p,i)=>{const q=pixel(...p);i?c.lineTo(...q):c.moveTo(...q)});c.closePath();c.fillStyle='rgba(108,59,151,.7)';c.fill();c.strokeStyle='#efc96e';c.lineWidth=2*density;c.stroke();
  for(const [y,colour]of [[1.075,'#4af2ce'],[-1.075,'#e89984']]){c.strokeStyle=colour;c.lineWidth=3*density;c.beginPath();c.moveTo(...pixel(...pasoPoint(pose,-.5193,y)));c.lineTo(...pixel(...pasoPoint(pose,.5193,y)));c.stroke()}
  const begin=pixel(...pasoPoint(pose,0,.45)),tip=pixel(...pasoPoint(pose,0,1.45));c.strokeStyle='#1a6e62';c.lineWidth=2*density;c.beginPath();c.moveTo(...begin);c.lineTo(...tip);c.stroke();
  c.fillStyle='#1a6e62';c.textAlign='center';c.font='bold '+11*density+'px system-ui';c.fillText('FRENTE',tip[0],tip[1]-8*density);
 }else if(spec.kind==='reference'){
  const image=spec.image;
  if(image){
   const a=-(spec.angle||0)*Math.PI/180,iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
   const bw=Math.abs(iw*Math.cos(a))+Math.abs(ih*Math.sin(a)),bh=Math.abs(iw*Math.sin(a))+Math.abs(ih*Math.cos(a)),fit=Math.min((w-24*density)/bw,(h-24*density)/bh);
   c.translate(w/2,h/2);c.rotate(a);c.globalAlpha=spec.opacity??1;c.imageSmoothingEnabled=true;c.drawImage(image,-iw*fit/2,-ih*fit/2,iw*fit,ih*fit);
  }else{c.fillStyle='#344a4d';c.textAlign='center';c.font=12*density+'px system-ui';c.fillText('Añade una fotografía guía',w/2,h/2)}
 }
 c.restore();
}
