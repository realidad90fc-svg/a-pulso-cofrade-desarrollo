import {readCityPreview} from './city-runtime.mjs';
import {validateMapDocument,MAP_STORAGE_PREFIX} from './city-project.mjs';
import {EDITOR_MAPS} from './editor-map-catalog.mjs';
import {GAME_PATCH_PREFIX,withEditorStreetPoints} from './editor-game-draft.mjs';
import {campaignMapPreview} from './city-campaign.mjs';
export function applyMapEntry(preview,entryId){
 if(!entryId)return preview;
 const document=structuredClone(preview.document),e=document.gameplay?.route?.events?.find(e=>e.id===entryId&&e.type==='entry');
 if(!e)throw Error('La entrada de destino ya no existe. Revisa la conexión en el editor.');
 document.startPose={x:e.position[0],y:e.position[1],angle:e.heading??document.startPose?.angle??document.paso?.angle??0};
 return{...preview,document,draft:{...withEditorStreetPoints(preview.draft,document),startPose:document.startPose}};
}
export async function resolveMapConnection({targetMap,targetEntry},storage,fetcher=fetch){
 if(typeof targetMap!=='string'||!targetMap||targetMap.length>150)throw Error('La salida no tiene un mapa de destino válido.');
 const authored=campaignMapPreview(targetMap);if(authored)return applyMapEntry(authored,targetEntry);
 if(storage.getItem(MAP_STORAGE_PREFIX+targetMap)){const preview=readCityPreview('?cityMap='+encodeURIComponent(targetMap),storage);const raw=storage.getItem(GAME_PATCH_PREFIX+targetMap);if(raw)preview.draft=JSON.parse(raw);return applyMapEntry(preview,targetEntry);}
 const response=await fetcher('./published-maps/'+encodeURIComponent(targetMap)+'.json',{cache:'no-store'});
 if(!response.ok)throw Error('Guarda el mapa de destino en este navegador o publica su diseño antes de conectar la salida.');
 const draft=await response.json(),document=validateMapDocument(draft.gameplayScene||draft.authoringScene);
 if(document.metadata.mapKey!==targetMap)throw Error('El mapa de destino no coincide con la conexión.');
 const meta=EDITOR_MAPS.find(m=>m.key===targetMap);
 const preview={key:targetMap,name:document.metadata.map||meta?.name||targetMap,document,draft,isolated:!meta||meta.type==='user'||!!draft.authoringScene,nativeId:meta?.nativeId||meta?.route?.mapId||1};
 return applyMapEntry(preview,targetEntry);
}
