// Pure editor operations: continuous crowd brush and Windows-style area selection.
// Coordinates are always map-world units, independent of zoom or device pixels.
export const PICKABLE_TYPES=['checkpoints','signs','trees','fences','chairs','people','houses','sidewalks','roads'];
export const PUBLIC_MIN_DISTANCE=.135;
const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const round=n=>Math.round(n*1000)/1000;
const contains=(b,p)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
export function rectangle(a,b){
 return[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])];
}
export function picksInRectangle(map,start,end,visible=()=>true){
 const bounds=rectangle(start,end),found=[];
 for(const type of PICKABLE_TYPES){
  if(!visible(type))continue;
  for(const [index,item] of (map[type]||[]).entries()){
   if(Array.isArray(item.poly)){
    // Like Windows Explorer: select complete buildings/streets only when
    // all polygon vertices fit inside the blue selection rectangle.
    if(item.poly.length>=3&&item.poly.every(p=>valid(p)&&contains(bounds,p)))found.push({type,index,vertex:-1});
   }else{
    const point=item.point||item.position;
    if(valid(point)&&contains(bounds,point))found.push({type,index,vertex:-1});
   }
  }
 }
 return found;
}
export function unifySelections(items){
 const keys=new Set(),unique=[];
 for(const item of items){
  if(!item||!Number.isInteger(item.index)||!item.type)continue;
  const id=item.type+'|'+item.index;
  if(!keys.has(id)){keys.add(id);unique.push({type:item.type,index:item.index,vertex:item.vertex??-1})}
 }
 return unique;
}
export function translateSelections(map,selections,dx,dy){
 if(!dx&&!dy)return;
 for(const {type,index} of unifySelections(selections)){
  const item=map[type]?.[index];if(!item)continue;
  if(Array.isArray(item.poly))for(const p of item.poly){p[0]=round(p[0]+dx);p[1]=round(p[1]+dy)}
  else{
   const point=item.point||item.position;
   if(point){point[0]=round(point[0]+dx);point[1]=round(point[1]+dy)}
  }
 }
}
export function deleteSelections(map,selections){
 const byType=new Map();
 for(const {type,index} of unifySelections(selections)){
  if(!byType.has(type))byType.set(type,[]);
  byType.get(type).push(index);
 }
 let removed=0;
 for(const [type,indices] of byType){
  if(!Array.isArray(map[type]))continue;
  for(const index of indices.sort((a,b)=>b-a)){
   if(index>=0&&index<map[type].length){map[type].splice(index,1);removed++}
  }
 }
 return removed;
}
export function makeCrowdStroke(existing=[],minimum=PUBLIC_MIN_DISTANCE){
 const cell=Math.max(.08,minimum),grid=new Map();
 const coord=n=>Math.floor(n/cell);
 const key=(x,y)=>x+':'+y;
 const addPoint=p=>{const k=key(coord(p[0]),coord(p[1]));
  if(!grid.has(k))grid.set(k,[]);
  grid.get(k).push(p);
 };
 for(const item of existing)if(valid(item.point))addPoint(item.point);
 return{
  last:null,carried:0,placed:0,
  tryPlace(p,onPlace){
   const x=coord(p[0]),y=coord(p[1]);
   for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++){
    for(const q of grid.get(key(i,j))||[])if(length(p,q)<minimum)return false;
   }
   const point=[round(p[0]),round(p[1])];
   if(!onPlace(point))return false;
   addPoint(point);this.placed++;return true;
  },
  start(point,onPlace){
   this.last=[...point];this.carried=0;
   return this.tryPlace(point,onPlace)?1:0;
  },
  continue(point,step,onPlace){
   if(!this.last)return this.start(point,onPlace);
   const previous=this.last,span=length(previous,point);
   this.last=[...point];
   if(span<.00001)return 0;
   const spacing=Math.max(minimum,Math.min(1.5,Number(step)||.22));
   let offset=spacing-this.carried,added=0;
   // Bound work if the pointer jumps a whole map after leaving the canvas.
   let attempts=0;
   while(offset<=span+1e-8&&attempts++<2500){
    const t=offset/span,p=[previous[0]+(point[0]-previous[0])*t,previous[1]+(point[1]-previous[1])*t];
    if(this.tryPlace(p,onPlace))added++;
    offset+=spacing;
   }
   this.carried=(this.carried+span)%spacing;
   return added;
  }
 };
}
