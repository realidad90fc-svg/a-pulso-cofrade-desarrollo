// Small authored objects shared by the workshop, catalogues and game bridge.
// Geometry is always in map units, including when the game camera supplies zoom=1.
export function drawTrafficSign(ctx,item,pixel,zoom){
 const [x,y]=pixel(...item.point),r=.1*zoom;
 ctx.save();ctx.translate(x,y);ctx.rotate(-(item.angle||0)*Math.PI/180);
 if(item.size)ctx.scale(item.size[0]/.2,item.size[1]/.2);
 ctx.fillStyle='#d9c5a8';ctx.strokeStyle='#ad302c';ctx.lineWidth=.025*zoom;
 ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(-r*.65,r*.65);ctx.lineTo(r*.65,-r*.65);ctx.stroke();ctx.restore();
}
export function drawCheckpointGuide(ctx,item,pixel,zoom,{label=true}={}){
 const [x,y]=pixel(...item.position),r=.28*zoom;
 ctx.save();ctx.strokeStyle='#65eed8';ctx.lineWidth=.045*zoom;
 ctx.save();ctx.translate(x,y);ctx.rotate(-(item.angle||0)*Math.PI/180);ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,0);ctx.moveTo(0,-r);ctx.lineTo(0,r);ctx.stroke();ctx.restore();
 if(label){ctx.fillStyle='#a6fff0';ctx.font='11px system-ui';ctx.fillText(item.name||item.id||'Control',x+r+5,y-5)}
 ctx.restore();
}
