export const PROJECT_META_KEY='apulso-editor-project-meta-v1';
export const DEFAULT_PROJECT_ID='project-default';
export const projectId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
export function readProjectMeta(storage=localStorage){
 let meta;try{meta=JSON.parse(storage.getItem(PROJECT_META_KEY)||'null')}catch{}
 return meta&&typeof meta.id==='string'&&typeof meta.name==='string'?meta:{id:DEFAULT_PROJECT_ID,name:'Mi Sevilla',createdAt:new Date().toISOString(),generation:'initial'};
}
export function writeProjectMeta(meta,storage=localStorage){if(!meta?.id||!meta.name?.trim()||meta.name.length>100)throw Error('Escribe un nombre de proyecto de hasta 100 caracteres.');const value={...meta,generation:projectId()};storage.setItem(PROJECT_META_KEY,JSON.stringify(value));return value}
export function sameProjectSession(meta,storage=localStorage){const current=readProjectMeta(storage);return current.id===meta.id&&current.generation===meta.generation}
