// A paso points along its original Unity local +Y axis.
// All saved angles are the *actual* Unity engine root angle: 0° = north,
// 90° = west. Older editor previews incorrectly subtracted 90 degrees.
const rad=angle=>(Number.isFinite(angle)?angle:0)*Math.PI/180;
export function pasoAxes(angle=0){
 const a=rad(angle),c=Math.cos(a),s=Math.sin(a);
 return{right:[c,s],front:[-s,c]};
}
export function pasoPoint(pose,lateral,forward){
 const v=pasoAxes(pose.angle);
 return[pose.x+v.right[0]*lateral+v.front[0]*forward,
        pose.y+v.right[1]*lateral+v.front[1]*forward];
}
export function pasoFootprint(pose,width=1.0386,length=2.15){
 if(!pose||![pose.x,pose.y].every(Number.isFinite))return[];
 return[[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2]].map(([x,y])=>pasoPoint(pose,x,y));
}
export function pasoRotationHandle(pose,zoom,pixel){
 return pixel(...pasoPoint(pose,0,Math.max(1.8,52/Math.max(.1,zoom))));
}
export function pasoFacingName(angle=0){
 const labels=['norte','noroeste','oeste','suroeste','sur','sureste','este','noreste'];
 const value=(((Number.isFinite(angle)?angle:0)%360)+360)%360;
 return labels[Math.round(value/45)%8];
}
