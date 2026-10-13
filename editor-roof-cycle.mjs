// Alternates only roofs available in the chosen category.
export function nextRoofId(roofs,currentId,mode,random=Math.random){
 const options=(roofs||[]).filter(r=>r&&typeof r.id==='string');
 if(!options.length||mode==='fixed'||options.length===1)return currentId;
 const index=options.findIndex(r=>r.id===currentId);
 if(mode==='random'){
  const others=options.filter(r=>r.id!==currentId);
  const raw=Number(random()),v=Number.isFinite(raw)?Math.max(0,Math.min(.999999999,raw)):0;
  return others[Math.floor(v*others.length)].id;
 }
 if(mode==='cycle')return options[(index<0?0:index+1)%options.length].id;
 return currentId;
}
