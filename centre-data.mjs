import {AYUNTAMIENTO_ASSET} from './city-landmarks.mjs';
import {BRIDGE_ANCHORS,ENVIRONMENT_PRESETS} from './bridge-data.mjs';

// Compressed geography in the existing bridge's frame. These modules contain
// urban geometry only: no brotherhood, paso, unlocks or star targets.
export const MODULO_REYES_CATOLICOS={id:'MODULO_REYES_CATOLICOS',name:'Reyes Católicos',style:'avenue',points:[[33.5,29.6],[45.1,29.6]],halfWidth:2.7,lane:1.65,crowdRows:5,sectorLabels:[{id:'puerta-triana',name:'Puerta de Triana',from:8.8}],
 branches:[{position:[39.8,29.6],direction:[0,-1],length:4,width:1.7},{position:[43.7,29.6],direction:[0,1],length:4,width:1.5}],trees:[[38.2,27.5,.45],[41.4,31.75,.48],[43.1,27.4,.45]]};
export const MODULO_ZARAGOZA={id:'MODULO_ZARAGOZA',name:'Zaragoza',style:'historic',points:[[45.1,29.6],[47.5,27.2],[55.5,27.2]],halfWidth:1.36,lane:1.12,crowdRows:3,
 branches:[{position:[51.2,27.2],direction:[0,-1],length:3.6,width:.95}],trees:[]};
export const MODULO_MADRID={id:'MODULO_MADRID',name:'Madrid',style:'historic',points:[[55.5,27.2],[53.1,29.6]],halfWidth:1.32,lane:1.1,crowdRows:3,branches:[],trees:[]};
export const MODULO_PLAZA_NUEVA={id:'MODULO_PLAZA_NUEVA',name:'Plaza Nueva',style:'square',points:[[53.1,29.6],[58.1,34.6]],halfWidth:1.6,lane:1.15,crowdRows:7,
 polygon:[[50.8,30.8],[55.8,30.8],[59.4,34.4],[59.4,36.3],[50.8,36.3]],
 townHall:{asset:AYUNTAMIENTO_ASSET,id:'ayuntamiento',rect:[59.6,30.8,62.6,35.9],front:'west'},visual:{footprint:[50.8,30.8,59.4,36.3],paving:'#b7afa0',frontages:[[49.6,30.8,50.8,36.3],[50.8,36.3,57.1,38.1]],facadePalette:['#d8cbb4','#ccbb9a','#e3d9c6']},monument:{id:'fernando-iii',position:[53.3,33.5],radius:.36},
 trees:[[51.25,31.5,.42],[51.25,33.1,.45],[51.25,34.8,.44],[52.7,35.5,.46],[54.2,35.5,.45],[55.8,35.5,.46]],branches:[]};
export const MODULO_TETUAN={id:'MODULO_TETUAN',name:'Tetuán',style:'commercial',points:[[58.1,34.6],[58.1,43.1]],halfWidth:1.36,lane:1.1,crowdRows:4,
 branches:[{position:[58.1,36.7],direction:[1,0],length:3.6,width:.95},{position:[58.1,39.4],direction:[1,0],length:3.5,width:.95}],trees:[]};
export const MODULO_VELAZQUEZ={id:'MODULO_VELAZQUEZ',name:'Velázquez',style:'commercial',points:[[58.1,43.1],[58.1,47.6]],halfWidth:1.4,lane:1.1,crowdRows:4,
 branches:[{position:[58.1,43.1],direction:[-1,0],length:3.7,width:1}],trees:[]};
export const MODULO_ODONNELL={id:'MODULO_ODONNELL',name:'O’Donnell',style:'expectation',points:[[58.1,47.6],[84,47.6]],halfWidth:1.48,lane:1.15,crowdRows:5,branches:[],trees:[]};
export const CENTRE_MODULES=[MODULO_REYES_CATOLICOS,MODULO_ZARAGOZA,MODULO_MADRID,MODULO_PLAZA_NUEVA,MODULO_TETUAN,MODULO_VELAZQUEZ,MODULO_ODONNELL];
export const CENTRE_ANCHORS={start:BRIDGE_ANCHORS.end,end:{id:'campana_before_official',position:[63.4,47.6],angle:270}};
export const CENTRE_CHECKPOINT={id:'plaza-nueva',position:[55.65,32.15],angle:315,radius:.68};
export const CENTRE_MAP={key:'CaminoCentro',name:'Camino al centro',kind:'centre',image:'assets/original-animation/sprite-569.webp',
 bounds:[28,19,92,58],ppu:48,tileSize:10,maxCachedTiles:12,modules:CENTRE_MODULES,
 path:[[33.5,29.6],[45.1,29.6],[47.5,27.2],[55.5,27.2],[53.1,29.6],[58.1,34.6],[58.1,43.1],[58.1,47.6],[84.0,47.6]],
 turnRadius:1.35,compression:{kind:'landmarks',metresPerUnitApprox:5,uniform:false},
 bridgeTail:{deck:[31.2,27.8,36,31.4],water:[28,19,32.2,40]},
};
export const CENTRE_ROUTE={id:'puente-future-3',name:'CAMINO AL CENTRO',order:3,playable:true,mapId:1,mapKey:CENTRE_MAP.key,
 brotherhoodId:'madruga_05',stepRef:'TreCai',clockStart:'control',threeStars:520,twoStars:580,provisionalTimes:true,
 unlock:{scope:'brotherhood',stars:0,completedRoute:'puente-future-2'},checkpoints:{policy:'time',points:[{id:'zaragoza',position:[50.8,27.2],angle:270,radius:.68},CENTRE_CHECKPOINT,{id:'tetuan-velazquez',position:[58.1,42.1],angle:0,radius:.68}]},
 start:CENTRE_ANCHORS.start,end:CENTRE_ANCHORS.end,moduleIds:CENTRE_MODULES.map(m=>m.id),environment:'madrugada',viewScale:1.55,
 crowd:{spacing:.205,maxPeople:5600,liveDistance:7},
 finish:{polygon:[[62.3,47.0],[64.5,47.0],[64.5,48.2],[62.3,48.2]],heading:270,tolerance:12,invisible:true},
 instructions:'Paso: Cristo / Misterio. Reyes Católicos, entorno actual de Puerta de Triana, Zaragoza y Madrid; cruza Plaza Nueva y continúa por Tetuán y Velázquez. Gira a la derecha en O’Donnell. Arriada final dentro del recuadro amarillo de llegada, antes de Campana. Puntos de control en Zaragoza, Plaza Nueva y final de Tetuán. Reanudar desde ellos recupera el tiempo guardado y permite conseguir estrellas y récord según el tiempo final.',
};
export function centreScene(route=CENTRE_ROUTE){const options={...CENTRE_ROUTE,...route};return {...CENTRE_MAP,start:options.start,end:options.end,finish:options.finish,checkpoint:CENTRE_CHECKPOINT,checkpoints:options.checkpoints.points,crowd:{...CENTRE_ROUTE.crowd,...options.crowd},viewScale:options.viewScale,ambient:ENVIRONMENT_PRESETS[options.environment]||ENVIRONMENT_PRESETS.madrugada};}
