// Optional hand-painted material images. A failed image never removes a floor:
// the same deterministic raster material is available offline as a fallback.
const images=new Map();
let pending=null,revision=0;
export const textureRevision=()=>revision;
export const textureImage=key=>images.get(key)||null;
export function registerTexture(key,image){images.set(key,image);revision++;}
export async function loadSevilleTextures(){
 if(pending)return pending;
 if(typeof Image==='undefined')return;
 pending=Promise.all(['piedra','caliza','teja'].map(key=>new Promise(resolve=>{
  const image=new Image();let done=false;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timer);if(ok)registerTexture(key,image);resolve(ok)};
  const timer=setTimeout(()=>finish(false),12000);
  image.onload=()=>finish(true);image.onerror=()=>finish(false);
  image.src=new URL('./assets/sevilla/'+key+'.webp',import.meta.url).href;
 }))).then(()=>undefined);
 return pending;
}
