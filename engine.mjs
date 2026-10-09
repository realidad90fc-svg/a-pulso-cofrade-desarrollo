// Geometry helpers only. Gameplay executes the recovered controller IL in original-vm.mjs.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function pointInPolygon([x,y],poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [ax,ay]=poly[i],[bx,by]=poly[j];
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
export function segmentDistance(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy;
 const t=n?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n,0,1):0;
 const point=[a[0]+dx*t,a[1]+dy*t];
 return {distance:Math.hypot(p[0]-point[0],p[1]-point[1]),point,t};
}
export const prepareMap=raw=>({...raw});
export const prepareStep=raw=>({...raw});
