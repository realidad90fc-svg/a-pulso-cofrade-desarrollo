import {drawRouteMarkers} from './route-markers.mjs';
import {multiply} from './original-scene.mjs';
import {drawStreetNotice} from './street-identifiers.mjs';
export class Renderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.width=1;this.height=1;this.dpr=1;}
 resize(width,height,dpr=1){this.width=width;this.height=height;this.dpr=Math.min(dpr,2);this.canvas.width=Math.round(width*this.dpr);this.canvas.height=Math.round(height*this.dpr);}
 render(sim,images,showOverlay=true){
  const ctx=this.ctx,w=this.width,h=this.height,d=this.dpr;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#55524f';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);ctx.imageSmoothingEnabled=true;
  // Original Unity framing, but allow the Arenal ONLY to zoom a little
  // closer than the general renderer's hard 1.0 lower limit. This modifies
  // no step/body/world dimensions and leaves all other maps untouched.
  const cam=sim.camera,isArenal=sim.map.variant?.key==='RegresoArenal';
  const requested=(sim.map.variant?.viewScale||1)*Math.min(1,h/w);
  const viewScale=isArenal?Math.max(.89,requested):Math.max(1,requested);
  const scale=h/(2*cam.size*viewScale)*d,c=Math.cos(cam.angle),s=Math.sin(cam.angle);
  if(isArenal)sim._arenalRenderInfo={viewScale,camSize:cam.size,portrait:h>=w};
  const project=[scale*c,scale*s,scale*s,-scale*c,w*d/2-scale*(c*cam.x+s*cam.y),h*d/2+scale*(-s*cam.x+c*cam.y)];
  // Arenal's world is PROCEDURAL: it is not a sprite and must not depend
  // on reference-architecture image loading, node visibility, sprite culling,
  // or draw order. Paint its 8m cached world tiles behind all actors/props.
  // This is the ONLY base-scene draw for Arenal, preventing double painting.
  if(isArenal&&sim.routeAdapter?.drawArchitecture){
   const route=sim.routeAdapter,scene=route.scene,bounds=route.renderBounds||scene?.bounds;
   const p=scene?.ppu;
   if(Array.isArray(bounds)&&bounds.length===4&&p>0){
    const worldToTile=multiply(project,[1/p,0,0,-1/p,bounds[0],bounds[3]]);
    const sprite={rectSize:[Math.round((bounds[2]-bounds[0])*p),Math.round((bounds[3]-bounds[1])*p)]};
    route.drawArchitecture(ctx,worldToTile,null,sprite,null,images);
   }
  }
  if(sim.map.variant?.kind==='city')sim.routeAdapter?.drawScene(ctx,project,images,this.canvas);
  const drawable=[];
  for(const graph of sim.renderGraphs||sim.graphs)for(const node of graph.nodes.values()){
   // Keep the original body animator and contacts; replace only its visible art.
   if(sim.step.variant&&graph===sim.stepEntity.graph&&node.path.startsWith(graph.root.path+'/body/'))continue;
   if(!sim.tutorial&&!sim.routeAdapter&&(node.path.includes('/zonaInter')||node.path.includes('/zonaParada')))continue;
   if(!node.sprite?.enabled||!graph._active(node))continue;
   const sprite=graph.data.sprites[node.sprite.key];
   if(!sprite)continue;
   const im=images.get(node.sprite.key)||(sprite.image?images.get(sprite.image):null);
   // The procedural route reference-architecture has NO image file.
   // Its sprite is just a world-space carrier for drawArchitecture(),
   // which paints the actual streets, sidewalks and roofs into tiles.
   // Requiring a loaded bitmap here silently skipped the entire Arenal
   // scene, leaving only the canvas background (#55524f) visible.
   const procedural=!!sim.routeAdapter&&
    (node.name==='reference-architecture'||node.name==='extension');
   // Already painted directly above; do not draw a second time.
   if(isArenal&&node.name==='reference-architecture')continue;
   if(!im&&!procedural)continue;
   drawable.push({graph,node,sprite,im});
  }
  if(sim.step.variant){
   const graph=sim.stepEntity.graph,body=graph.find('body'),v=sim.step.variant,im=images.get(v.image);
   if(im&&graph._active(body))drawable.push({graph,node:{...body,sprite:{order:5,color:[1,1,1,1]}},sprite:{pixelsToUnits:100,rectSize:v.size.map(x=>x*100),pivot:[.5,.5],crop:v.crop,rotation:v.rotation},im});
  }
  drawable.sort((a,b)=>a.node.sprite.order-b.node.sprite.order);
  let markers=false,floor=false,editorDrawn=false;
  for(const {graph,node,sprite,im}of drawable){
   if(!editorDrawn&&node.sprite.order>=3){sim.editorDraft?.draw(ctx,project,images,this.canvas);editorDrawn=true;}
   if(!floor&&node.sprite.order>=0){sim.routeAdapter?.drawFloor(ctx,project,images,this.canvas);floor=true;}
   if(!markers&&node.sprite.order>=2){if(sim.routeAdapter)sim.routeAdapter.drawMarkers(ctx,project);else if(!sim.tutorial)drawRouteMarkers(ctx,project,!sim.mapController.zonaInterPasada?sim.mapColliders.find(c=>c.entity.tag==='zonaInter')?.world().points:null,sim.mapColliders.find(c=>c.entity.tag==='zonaParada')?.world().points);markers=true;}
   const ppu=sprite.pixelsToUnits,[sw,sh]=sprite.rectSize;
   let m=multiply(project,graph.worldMatrix(node.id));
   if(sprite.rotation===180)m=multiply(m,[-1,0,0,-1,0,0]);
   if(node.sprite.flipX||node.sprite.flipY)m=multiply(m,[node.sprite.flipX?-1:1,0,0,node.sprite.flipY?-1:1,0,0]);
   m=multiply(m,[1/ppu,0,0,-1/ppu,-sprite.pivot[0]*sw/ppu,(1-sprite.pivot[1])*sh/ppu]);
   const corners=[[0,0],[sw,0],[sw,sh],[0,sh]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
   if(Math.max(...corners.map(p=>p[0]))<0||Math.min(...corners.map(p=>p[0]))>w*d||Math.max(...corners.map(p=>p[1]))<0||Math.min(...corners.map(p=>p[1]))>h*d)continue;
   if(sim.routeAdapter&&(node.name==='reference-architecture'||node.name==='extension')){sim.routeAdapter.drawArchitecture(ctx,m,im,sprite,node,images);continue;}
   ctx.save();const include=sim.routeAdapter?.spriteClip?.(graph,node);if(include){ctx.setTransform(...project);ctx.beginPath();include.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();}const cutouts=sim.routeAdapter?.spriteCutouts?.(graph,node)||[];if(cutouts.length){ctx.setTransform(1,0,0,1,0,0);ctx.beginPath();ctx.rect(-1,-1,this.canvas.width+2,this.canvas.height+2);for(const poly of cutouts){poly.forEach(([x,y],i)=>{const q=[project[0]*x+project[2]*y+project[4],project[1]*x+project[3]*y+project[5]];i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}ctx.clip('evenodd');}ctx.setTransform(...m);ctx.globalAlpha=node.sprite.color[3];ctx.filter=sim.routeAdapter?.spriteFilter?.(graph,node)||'none';
   if(sprite.crop){ctx.imageSmoothingEnabled=false;ctx.drawImage(im,...sprite.crop,0,0,sw,sh);ctx.imageSmoothingEnabled=true;}
   else{ctx.imageSmoothingEnabled=!sim.routeAdapter;ctx.drawImage(im,0,0,sw,sh);ctx.imageSmoothingEnabled=true;}
   ctx.filter='none';ctx.restore();
  }
  if(!editorDrawn)sim.editorDraft?.draw(ctx,project,images,this.canvas);
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  if(showOverlay){
   const identifiers=sim.editorDraft||sim.routeAdapter?.contacts;
   // An edited map owns its announcements, including having no active one.
   // Never substitute a hardcoded route name before its first trigger.
   drawStreetNotice(ctx,w,h,d,sim,identifiers?identifiers.streetNoticeFor(sim):sim.routeAdapter?.streetNotice);
   sim.routeAdapter?.drawOverlay?.(ctx,w,h,d);
  }
 }
}
