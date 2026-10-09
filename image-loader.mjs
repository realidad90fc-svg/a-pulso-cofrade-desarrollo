// Share in-flight requests and bound waits when a mobile connection stalls.
export function createImageLoader({ImageClass=globalThis.Image,cache=new Map(),timeout=20000,retries=1}={}){
 const pending=new Map();
 const attempt=path=>new Promise((resolve,reject)=>{
  const image=new ImageClass();let done=false;
  const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;if(error){try{image.src='';}catch{}reject(error);}else resolve(image);};
  const timer=setTimeout(()=>finish(new Error('La imagen no ha respondido: '+path)),timeout);
  image.onload=()=>finish();image.onerror=()=>finish(new Error('No se ha podido cargar '+path));
  try{image.src=path;if(image.complete&&image.naturalWidth>0)finish();}catch(error){finish(error);}
 });
 return function load(path){
  if(cache.has(path))return Promise.resolve(cache.get(path));
  if(pending.has(path))return pending.get(path);
  const promise=(async()=>{try{let image;for(let n=0;n<=retries;n++){try{image=await attempt(path);break;}catch(error){if(n===retries)throw error;}}cache.set(path,image);return image;}finally{pending.delete(path);}})();
  pending.set(path,promise);return promise;
 };
}
export async function loadSceneImages(sim,load,images,onProgress=()=>{}){
 const needed=new Map();
 for(const g of sim.renderGraphs||sim.graphs)for(const n of g.nodes.values()){
  if(!n.sprite)continue;
  if(sim.step.variant&&g===sim.stepEntity.graph&&n.path.startsWith(g.root.path+'/body/'))continue;
  needed.set(n.sprite.key,g.data.sprites[n.sprite.key].image);
 }
 const paths=[...new Set([...needed.values(),...(sim.step.variant?[sim.step.variant.image]:[])])];let index=0,completed=0;
 onProgress(0,paths.length);
 await Promise.all(Array.from({length:Math.min(6,paths.length)},async()=>{while(index<paths.length){const path=paths[index++];await load(path);onProgress(++completed,paths.length);}}));
 for(const [key,path]of needed)images.set(key,images.get(path));
}
