// Optional hand-painted material images. A failed image never removes a floor:
// the same deterministic raster material is available offline as a fallback.
const images=new Map(),listeners=new Set();
export const VEGETATION_FILES={
 naranjo:'vegetacion-naranjo-primavera-v2.webp',platano:'vegetacion-platano-primavera-v2.webp',
 ficus:'vegetacion-ficus-v1.webp',palmera:'vegetacion-palmera-v1.webp',pequeno:'vegetacion-pequeno-v1.webp',cipres:'vegetacion-cipres-v1.webp',sombra:'vegetacion-sombra-v1.webp'
};
let pending=null,revision=0;
export const textureRevision=()=>revision;
export const textureImage=key=>images.get(key)||null;
export function registerTexture(key,image){images.set(key,image);revision++;for(const notify of listeners)notify(key);}
export function onTextureReady(notify){listeners.add(notify);return()=>listeners.delete(notify);}
export async function loadSevilleTextures(){
 if(pending)return pending;
 if(typeof Image==='undefined')return;
 const files={piedra:'piedra.webp',caliza:'caliza.webp',teja:'teja.webp',gambrinus:'gambrinus.png',
  ...Object.fromEntries(Object.entries(VEGETATION_FILES).map(([name,file])=>['tree-'+name,file]))};
 pending=Promise.all(Object.entries(files).map(([key,file])=>new Promise(resolve=>{
  const image=new Image();let done=false;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timer);resolve(ok)};
  const timer=setTimeout(()=>finish(false),12000);
  image.onload=()=>{registerTexture(key,image);finish(true)};image.onerror=()=>finish(false);
  image.src=new URL('./assets/sevilla/'+file,import.meta.url).href;
 }))).then(()=>undefined);
 return pending;
}
