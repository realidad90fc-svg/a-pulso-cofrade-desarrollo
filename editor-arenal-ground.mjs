// Shared Arenal ground painter: editor and playable scene use the same
// world-anchored Sevilla paving. This is VISUAL ONLY. It does not add
// roads, sidewalks, walkable polygons or collision geometry.
import {SEVILLE_ROAD_MATERIALS,paintSevilleSurface} from './editor-seville-surfaces.mjs';

const ROAD=SEVILLE_ROAD_MATERIALS.find(m=>m.id==='road-sev-gerena-dark')
 || SEVILLE_ROAD_MATERIALS[0];

/**
 * Paint the exposed street ground underneath all explicit road and sidewalk
 * polygons. Previously the engine and editor filled this with flat #676863,
 * so any gaps between segment polygons looked like a missing road.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {(x:number,y:number)=>[number,number]} pixel  World-to-canvas transform
 * @param {number} zoom  Pixels per world unit
 * @param {number[]} visible  World bounds [xmin,ymin,xmax,ymax]
 * @param {number[]} sceneBounds  Full Arenal map bounds
 */
export function paintArenalGround(ctx,pixel,zoom,visible,sceneBounds){
 if(!Array.isArray(visible)||visible.length!==4||!Number.isFinite(zoom)||zoom<=0)return false;
 const extent=Array.isArray(sceneBounds)&&sceneBounds.length===4?sceneBounds:visible;
 const x0=Math.max(visible[0],extent[0]),y0=Math.max(visible[1],extent[1]);
 const x1=Math.min(visible[2],extent[2]),y1=Math.min(visible[3],extent[3]);
 if(!(x1>x0&&y1>y0))return false;
 const a=pixel(x0,y1),b=pixel(x1,y0);
 const left=Math.min(a[0],b[0]),top=Math.min(a[1],b[1]);
 const width=Math.abs(b[0]-a[0]),height=Math.abs(b[1]-a[1]);
 if(!(width>0&&height>0))return false;
 ctx.save();
 ctx.beginPath();ctx.rect(left,top,width,height);ctx.clip();
 ctx.fillStyle=ROAD.base;ctx.fillRect(left,top,width,height);
 // Coordinates are locked to the world, not to the camera or tile edges.
 // Never stroke the outer perimeter: that created seam lines between tiles.
 paintSevilleSurface(ctx,ROAD,pixel,zoom,[x0,y0,x1,y1]);
 ctx.restore();
 return true;
}
