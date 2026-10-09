import {MODULO_AVENIDA_CONSTITUCION} from './official-data.mjs';
// Exact portal drawing from Carrera Oficial, at its original world anchor.
// No generated replacement doorway, no changed entrance/checkpoint contacts.
export function paintSanMiguel(ctx,project,filter='none',facade=false){
 const [gx,gy]=MODULO_AVENIDA_CONSTITUCION.cathedral.gate;
 ctx.save();ctx.setTransform(...project);ctx.filter=filter;
 const box=(r,c)=>{ctx.fillStyle=c;ctx.fillRect(r[0],r[1],r[2]-r[0],r[3]-r[1]);};
 const line=(ps,c,w)=>{ctx.beginPath();ps.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();};
 const fill=(ps,c)=>{ctx.beginPath();ps.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=c;ctx.fill();};
 if(facade){const [cx,cy,cxx,cyy]=MODULO_AVENIDA_CONSTITUCION.cathedral.rect;box([cx,cy,cxx,cyy],'#aa987e');box([cx+.35,cy+.35,cxx-.35,cyy-.35],'#756c60');for(let x=cx+.5;x<cxx;x+=.8){box([x,cyy-.5,x+.22,cyy+.10],'#c4b092');fill([[x,cyy+.1],[x+.11,cyy+.36],[x+.22,cyy+.1]],'#d3c09c');}for(let y=cy+.35;y<cyy-.5;y+=.55)line([[cx+.6,y],[cxx-.6,y]],'#b4a183',.08);}
 box([gx-.62,gy-.13,gx+.62,gy+.27],'#d1bd9b');
 for(let i=0;i<5;i++){const w=.56-i*.065,h=.70-i*.06;line([[gx-w,gy-.08],[gx-w,gy+.12],[gx,gy+h],[gx+w,gy+.12],[gx+w,gy-.08]],i%2?'#dec9a5':'#9b8263',.038);}box([gx-.24,gy-.10,gx+.24,gy+.23],'#29443e');line([[gx,gy-.10],[gx,gy+.23]],'#141e21',.023);
 for(const sign of [-1,1]){const x=gx+sign*.7;box([x-.055,gy-.03,x+.055,gy+.56],'#c2aa84');fill([[x-.12,gy+.56],[x,gy+.90],[x+.12,gy+.56]],'#d8c19b');}
 ctx.restore();
}
