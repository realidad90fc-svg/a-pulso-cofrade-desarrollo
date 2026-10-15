// Exclusion zone is the rendered tree canopy plus the spectator's body.
// Keep source-map people unchanged; they become visible if a tree is moved.
export function treeCanopyRadius(t){
 if(t?.size)return Math.max(...t.size)/2;
 const r=Number.isFinite(t?.radius)?t.radius:.35;
 const s=Number.isFinite(t?.scale)?t.scale:1;
 return Math.max(.125,r*s);
}
export function personBlockedByTrees(person,trees=[],padding=.115){
 const p=Array.isArray(person)?person:person?.point;
 if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])||!Array.isArray(trees))return false;
 return trees.some(t=>{
  if(!Array.isArray(t?.point)||!Number.isFinite(t.point[0])||!Number.isFinite(t.point[1]))return false;
  const radius=treeCanopyRadius(t)+Math.max(0,padding),dx=p[0]-t.point[0],dy=p[1]-t.point[1];
  return dx*dx+dy*dy<radius*radius;
 });
}
export const visibleSpectators=(people=[],trees=[],padding=.115)=>people.filter(p=>!personBlockedByTrees(p,trees,padding));
