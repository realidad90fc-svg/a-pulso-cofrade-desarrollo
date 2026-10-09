import {CENTRE_ANCHORS} from './centre-data.mjs';
import {ENVIRONMENT_PRESETS} from './bridge-data.mjs';
import {AYUNTAMIENTO_ASSET} from './city-landmarks.mjs';
// The ONLY source of O'Donnell, Campana and Sierpes is the original mapa7 graph.
// Rigid placement rotates the original northbound start to the preceding eastbound end.
export const ORIGINAL_OFFICIAL_MAP={mapId:7,graph:'mapa7',contactSeamTolerance:.06,rotation:-90,anchor:CENTRE_ANCHORS.end.position,
 sectors:[{id:'MODULO_ODONNELL_ORIGINAL',name:'O’Donnell',source:'mapa7',until:3.4},
 {id:'MODULO_CAMPANA',name:'Campana',source:'mapa7',until:12.59},
 {id:'MODULO_SIERPES',name:'Sierpes',source:'mapa7',until:26.87}]};
export const originalOfficialPoint=([x,y])=>[CENTRE_ANCHORS.end.position[0]+y,CENTRE_ANCHORS.end.position[1]-x];
export const OFFICIAL_SEATING={laneHalfWidth:.96,railThickness:.06,seatFirstOffset:1.15,seatRowPitch:.22,seatAlongPitch:.23};
export const SIERPES_JOIN={start:[58.4,39.25],end:[52.9,39.25],halfWidth:1.6};
const sierpesEnd=originalOfficialPoint([8.35,-10.5]);
export const MODULO_PLAZA_SAN_FRANCISCO={id:'MODULO_PLAZA_SAN_FRANCISCO',name:'Plaza de San Francisco',style:'square',
 points:[sierpesEnd,[44.9,39.25]],halfWidth:2.4,crowdRows:7,branches:[],trees:[],
 polygon:[[44,36.6],[53.2,36.6],[53.2,40.5],[44,40.5]],
 townHall:{asset:AYUNTAMIENTO_ASSET,id:'ayuntamiento',rect:[44.7,40.8,47.7,45.9],front:'south',facade:'plateresque'},
 visual:{footprint:[44,36.6,53.2,40.5],paving:'#a99a83'},palcos:{pitch:.95,rows:3,sideOffsets:[-1.35,1.35]}};
export const MODULO_AVENIDA_CONSTITUCION={id:'MODULO_AVENIDA_CONSTITUCION',name:'Avenida de la Constitución',style:'avenue',
 points:[[44.9,39.25],[32.9,36.25]],halfWidth:2.15,crowdRows:6,branches:[],trees:[[40.2,35.9,.38],[36.7,34.8,.40]],
 cathedral:{id:'catedral-sevilla',rect:[28.1,29.4,40.6,34.3],wing:[38.1,33.4,40.6,35.8],giralda:[39.3,35.95],gate:[30.2,34.3]}};
export const MODULO_PUERTA_SAN_MIGUEL={id:'MODULO_PUERTA_SAN_MIGUEL',name:'Puerta de San Miguel',style:'historic',
 points:[[32.9,36.25],[29.9,36.25],[20,36.25]],halfWidth:1.45,crowdRows:4,branches:[],trees:[]};
export const OFFICIAL_MODULES=[MODULO_PLAZA_SAN_FRANCISCO,MODULO_AVENIDA_CONSTITUCION,MODULO_PUERTA_SAN_MIGUEL];
export const OFFICIAL_ANCHORS={start:CENTRE_ANCHORS.end,end:{id:'san_miguel_before_cathedral',position:[29.9,36.25],angle:90}};
export const OFFICIAL_CHECKPOINT={id:'sierpes-san-francisco',position:sierpesEnd,angle:90,radius:.68};
export const OFFICIAL_MAP={key:'CarreraOficial',name:'Carrera Oficial',kind:'official',reuseNativeMap:true,image:'assets/original-animation/sprite-569.webp',
 bounds:[20,22,79,58],ppu:48,tileSize:10,maxCachedTiles:12,modules:OFFICIAL_MODULES,turnRadius:1.25,
 path:[[0,-2],[0,3.78],[8.83,3.60],[8.83,0],[8.35,-6.7],[8.35,-10.5]].map(originalOfficialPoint).concat([[44.9,39.25],[32.9,36.25],[20,36.25]]),
 compression:{kind:'original-plus-landmarks',uniform:false},original:ORIGINAL_OFFICIAL_MAP};
export const OFFICIAL_ROUTE={id:'puente-future-4',name:'CARRERA OFICIAL',order:4,playable:true,mapId:7,mapKey:OFFICIAL_MAP.key,
 brotherhoodId:'madruga_05',stepRef:'TreCai',clockStart:'control',threeStars:497,twoStars:557,provisionalTimes:true,
 unlock:{scope:'brotherhood',stars:0,completedRoute:'puente-future-3'},checkpoints:{policy:'time',points:[{id:'campana-sierpes',position:originalOfficialPoint([8.83,1]),angle:90,radius:.68},OFFICIAL_CHECKPOINT,{id:'avenida-constitucion',position:[38.9,37.75],angle:104,radius:.68}]},
 start:OFFICIAL_ANCHORS.start,end:OFFICIAL_ANCHORS.end,moduleIds:[...ORIGINAL_OFFICIAL_MAP.sectors.map(m=>m.id),...OFFICIAL_MODULES.map(m=>m.id)],environment:'madrugada',viewScale:1.55,
 crowd:{spacing:.205,maxPeople:5200,liveDistance:7},
 finish:{polygon:[[28.8,35.65],[31,35.65],[31,36.85],[28.8,36.85]],heading:90,tolerance:12,invisible:true},
 instructions:'Paso: Cristo / Misterio. O’Donnell, Campana y Sierpes del mapa original; Plaza de San Francisco, Avenida y Puerta de San Miguel. Arriada final dentro del recuadro amarillo. Los tres puntos de control en Sierpes, San Francisco y Avenida recuperan el tiempo guardado y permiten conseguir estrellas y récord según el tiempo final.'};
export function officialScene(route=OFFICIAL_ROUTE){const options={...OFFICIAL_ROUTE,...route};return {...OFFICIAL_MAP,start:options.start,end:options.end,finish:options.finish,checkpoint:OFFICIAL_CHECKPOINT,checkpoints:options.checkpoints.points,crowd:{...OFFICIAL_ROUTE.crowd,...options.crowd},viewScale:options.viewScale,ambient:ENVIRONMENT_PRESETS[options.environment]||ENVIRONMENT_PRESETS.madrugada};}
