// Shared visual language: blue passing checkpoint, gold final arriado zone. No labels.
export function drawRouteMarkers(ctx,project,checkpoint,finish){
 ctx.save();ctx.setTransform(...project);ctx.globalAlpha=1;
 for(const [polygon,color,fill]of [[checkpoint,'#6ab6c8','rgba(78,151,167,.13)'],[finish,'#bfa05f','rgba(191,160,95,.10)']]){
  if(!polygon?.length)continue;ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.lineWidth=.028;ctx.strokeStyle=color;ctx.fillStyle=fill;ctx.fill();ctx.stroke();
 }
 ctx.restore();
}
