import {PUREZA_ANCHORS} from './pureza-data.mjs';
// Shared map geometry: no brotherhood, paso, star targets or save IDs here.
export const ENVIRONMENT_PRESETS={
 'first-light':{tint:'#4f5260',darkness:.13,water:'#597f85',lamps:true,crowdTint:[.94,.92,.87,1]},
 day:{tint:'#eadfc7',darkness:.02,water:'#527c7a',lamps:false,crowdTint:[1,1,1,1]},
 sunset:{tint:'#754748',darkness:.15,water:'#486365',lamps:true,crowdTint:[.95,.86,.79,1]},
 night:{tint:'#111c32',darkness:.29,water:'#203b46',lamps:true,crowdTint:[.84,.82,.76,1]},
 madrugada:{tint:'#111a2c',darkness:.24,water:'#47747b',lamps:true,crowdTint:[.88,.85,.78,1]},
};
const ALTOZANO_LAYOUT={id:'MODULO_ALTOZANO',kind:'square',name:'Plaza del Altozano',
 polygon:[[-10,27.65],[-6,27.65],[-6,24.5],[-3.2,23.8],[1.8,25],[4,29],[4,35],[-7,35],[-7,31.55],[-10,31.55]],
 accesses:[{name:'Pureza',rect:[-2.95,23.8,-.35,27.1]},{name:'San Jacinto',rect:[-2.8,34,1.2,39]}],
 trees:[[-4.5,32,.7],[-5,32.2,.8],[-3.25,27.6,.5],[.9,32.5,.75],[1.7,33.5,.7]],
 houses:[{rect:[-.15,25.8,5.8,27.05],material:4},{rect:[4,28,8,31.4],material:2},{rect:[4,31.5,8,35.5],material:1},{rect:[-6.8,35, -2.9,39],material:5},{rect:[1.3,35,5.5,39],material:0}],
 landmarks:[{id:'capillita-carmen',kind:'tower',position:[-9,32.7],radius:.5},{id:'mercado-triana',kind:'market',rect:[-12,34,-7.5,37.5]},{id:'monumento-altozano',kind:'monument',position:[-4.42,28.87],radius:.2}],
};
const BRIDGE_LAYOUT={id:'MODULO_PUENTE_ISABEL_II',kind:'bridge',name:'Puente de Isabel II',
 deck:[-36,27.8,-10,31.4],river:[-35.5,19,-11.2,40],banks:[-11.2,-35.5],
 spans:3,ringSpacing:.47,railWidth:.09,sidewalkWidth:.49,lampSpacing:3.2,
};
const LEGACY_ANCHORS={start:PUREZA_ANCHORS.end,end:{id:'sevilla_bridgehead',position:[-39.4,29.6],angle:90}};
const LEGACY_MAP={key:'AltozanoPuente',name:'Altozano y Puente',kind:'bridge',image:'assets/original-animation/sprite-569.webp',
 bounds:[-44,19,8,40],ppu:48,modules:[ALTOZANO_LAYOUT,BRIDGE_LAYOUT],
 path:[[-1.65,24.5],[-1.65,29.6],[-10,29.6],[-40.8,29.6]],
 cityHead:[-43,26.1,-35.8,33.1],
 skyline:[{id:'sevilla-silhouette',rect:[-44,20,-38,24.5]},{id:'triana-silhouette',rect:[-9,20,5,23.6]}],
};
// The layout frame is anchored to the unchanged end of Pureza. Only map
// coordinates are oriented eastwards; native paso transforms/scales are never mirrored.
export const bridgeWorldPoint=([x,y])=>[2*PUREZA_ANCHORS.end.position[0]-x,y];
export const bridgeWorldRect=([x,y,xx,yy])=>[bridgeWorldPoint([xx,y])[0],y,bridgeWorldPoint([x,yy])[0],yy];
const worldPolygon=poly=>poly.map(bridgeWorldPoint).reverse();
export const MODULO_ALTOZANO={...ALTOZANO_LAYOUT,
 polygon:worldPolygon(ALTOZANO_LAYOUT.polygon),accesses:ALTOZANO_LAYOUT.accesses.map(a=>({...a,rect:bridgeWorldRect(a.rect)})),
 trees:ALTOZANO_LAYOUT.trees.map(([x,y,r])=>[...bridgeWorldPoint([x,y]),r]),houses:ALTOZANO_LAYOUT.houses.map(h=>({...h,rect:bridgeWorldRect(h.rect)})),
 landmarks:ALTOZANO_LAYOUT.landmarks.map(l=>({...l,...(l.rect?{rect:bridgeWorldRect(l.rect)}:{position:bridgeWorldPoint(l.position)})})),
};
export const MODULO_PUENTE_ISABEL_II={...BRIDGE_LAYOUT,deck:bridgeWorldRect(BRIDGE_LAYOUT.deck),river:bridgeWorldRect(BRIDGE_LAYOUT.river),banks:BRIDGE_LAYOUT.banks.map(x=>bridgeWorldPoint([x,0])[0])};
export const BRIDGE_ANCHORS={start:PUREZA_ANCHORS.end,end:{...LEGACY_ANCHORS.end,position:bridgeWorldPoint(LEGACY_ANCHORS.end.position),angle:270}};
export const BRIDGE_MAP={...LEGACY_MAP,geometryVersion:2,layout:LEGACY_MAP,bounds:bridgeWorldRect(LEGACY_MAP.bounds),
 modules:[MODULO_ALTOZANO,MODULO_PUENTE_ISABEL_II],path:LEGACY_MAP.path.map(bridgeWorldPoint),cityHead:bridgeWorldRect(LEGACY_MAP.cityHead),
 skyline:LEGACY_MAP.skyline.map(l=>({...l,rect:bridgeWorldRect(l.rect)})),
};
// A route selects a shared map and supplies gameplay/environment separately.
export const BRIDGE_ROUTE={id:'puente-future-2',name:'ALTOZANO Y PUENTE',order:2,playable:true,mapId:1,mapKey:BRIDGE_MAP.key,
 brotherhoodId:'madruga_05',stepRef:'TreCai',threeStars:369,twoStars:429,provisionalTimes:true,clockStart:'control',
 unlock:{scope:'brotherhood',stars:0,completedRoute:'puente-pureza-01'},checkpoints:{policy:'time',points:[{id:'puente-centro',position:bridgeWorldPoint([-23,29.6]),radius:.65}]},
 start:BRIDGE_ANCHORS.start,end:BRIDGE_ANCHORS.end,moduleIds:BRIDGE_MAP.modules.map(m=>m.id),
 environment:'madrugada',viewScale:1.6,crowd:{spacing:.20,lanes:[.9,1.11,1.32,1.53,1.72],maxPeople:4000},
 finish:{polygon:worldPolygon([[-40.5,29.0],[-38.3,29.0],[-38.3,30.2],[-40.5,30.2]]),heading:270,tolerance:18},
 instructions:'Paso: Cristo / Misterio. Desde el final de Pureza, avanza al Altozano y gira a la derecha hacia el puente. Cruza hasta la cabecera de Sevilla. Punto de control en el centro del puente y llegada señalizada en la cabecera de Sevilla: debes arriar dentro del recuadro dorado. Reanudar desde el checkpoint recupera el tiempo guardado y permite conseguir estrellas y récord según el tiempo final. Puedes arriar para descansar; el cronómetro sigue contando.',
};
export function bridgeScene(route=BRIDGE_ROUTE){const options={...BRIDGE_ROUTE,...route,crowd:{...BRIDGE_ROUTE.crowd,...route?.crowd}};return {...BRIDGE_MAP,start:options.start,end:options.end,finish:options.finish,checkpoint:options.checkpoints.points[0]||null,crowd:options.crowd,viewScale:options.viewScale||1,ambient:ENVIRONMENT_PRESETS[options.environment]||ENVIRONMENT_PRESETS.madrugada};}
