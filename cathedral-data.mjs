import {OFFICIAL_ANCHORS} from './official-data.mjs';
import {ENVIRONMENT_PRESETS} from './bridge-data.mjs';
// Shared source graphs, instantiated once each. No Cathedral/Postigo copy.
export const CATHEDRAL_MODULE={mapId:4,graph:'mapa4',rotation:90,origin:[21.9,36.25],entrance:[0,-8],exit:[0,3.24]};
export const POSTIGO_MODULE={mapId:5,graph:'mapa5',rotation:-90,origin:[32,47.5]};
export const cathedralPoint=([x,y])=>[21.9-y,36.25+x];
export const postigoPoint=([x,y])=>[32+y,47.5-x];
export const CATHEDRAL_EXITS={alemanes:{native:true,mapId:4,source:'mapa4',exit:CATHEDRAL_MODULE.exit},postigo:{native:false,exit:CATHEDRAL_MODULE.exit,join:cathedralPoint([0,9]),moduleIds:['MODULO_PLAZA_TRIUNFO','MODULO_FRAY_CEFERINO']}};
const street=(id,name,points,halfWidth,style='historic')=>({id,name,points,halfWidth,style,crowdRows:4,branches:[],trees:[]});
export const CATHEDRAL_CONNECTIONS=[
 street('MODULO_ENTRADA_SAN_MIGUEL','Puerta de San Miguel',[cathedralPoint([0,-13]),cathedralPoint([0,-6.5])],.72),
 street('MODULO_PLAZA_TRIUNFO','Plaza del Triunfo',[cathedralPoint([0,9]),[12.9,48]],2.0,'square'),
 street('MODULO_FRAY_CEFERINO','Fray Ceferino González',[[12.9,48],[29,48],[32,47.5]],1.5)
];
export const CATHEDRAL_CHECKPOINT={id:'palos-exit',position:cathedralPoint([0,4.5]),angle:90,radius:.55};
export const CATHEDRAL_CHECKPOINT_ALMIRANTAZGO={id:'almirantazgo-entry',position:postigoPoint([0,1]),angle:270,radius:.45};
export const CATHEDRAL_ANCHORS={start:OFFICIAL_ANCHORS.end,end:{id:'arfe-route-05',position:postigoPoint([14.48,14.73]),angle:147}};
const rounded=raw=>{const out=[raw[0]];for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),r=Math.min(i===3?1.25:i<5?.65:.85,ab/3,bc/3),u=b.map((x,k)=>x+(a[k]-x)*r/ab),v=b.map((x,k)=>x+(c[k]-x)*r/bc);out.push(u);for(let j=1;j<=(i===3?24:12);j++){const t=j/(i===3?24:12);out.push(b.map((_,k)=>(1-t)**2*u[k]+2*t*(1-t)*b[k]+t*t*v[k]));}}out.push(raw.at(-1));return out;};
export const CATHEDRAL_MAP={key:'CatedralPostigo',name:'Catedral y Postigo',kind:'cathedral',reuseNativeMap:true,image:'assets/original-animation/sprite-569.webp',bounds:[-10,30,66,77],ppu:96,tileSize:10,maxCachedTiles:8,turnRadius:1.25,modules:CATHEDRAL_CONNECTIONS,
 path:rounded([CATHEDRAL_ANCHORS.start.position,cathedralPoint([0,0]),cathedralPoint([0,4.5]),cathedralPoint([0,9]),[12.9,48],[29,48],[32,47.5],...[[0,2.25],[3.7,2.25],[6.35,3.8],[7.7,6],[7.7,15],[8.1,16.3],[8.9,17.2],[9.9,17.45],[11,17.18],[14.48,14.73]].map(postigoPoint)]),original:[CATHEDRAL_MODULE,POSTIGO_MODULE]};
export const CATHEDRAL_ROUTE={id:'puente-future-5',name:'CATEDRAL Y POSTIGO',order:5,playable:true,mapId:4,mapKey:CATHEDRAL_MAP.key,stepRef:'TreCai',brotherhoodId:'madruga_05',cathedralExit:'postigo',clockStart:'control',threeStars:900,twoStars:1080,provisionalTimes:true,unlock:{scope:'brotherhood',stars:0,completedRoute:'puente-future-4'},checkpoints:{policy:'time',points:[CATHEDRAL_CHECKPOINT,CATHEDRAL_CHECKPOINT_ALMIRANTAZGO]},start:CATHEDRAL_ANCHORS.start,end:CATHEDRAL_ANCHORS.end,environment:'madrugada',viewScale:1.55,crowd:{spacing:.22,maxPeople:1800,liveDistance:7},finish:{polygon:[[-.67,-1.2],[.67,-1.2],[.67,1.2],[-.67,1.2]].map(([x,y])=>{const a=237*Math.PI/180;return postigoPoint([14.48+x*Math.cos(a)-y*Math.sin(a),14.73+x*Math.sin(a)+y*Math.cos(a)]);}),heading:147,tolerance:14,invisible:true},instructions:'San Miguel, interior original de Catedral, salida por Palos, Triunfo y Fray Ceferino; Almirantazgo, Postigo, Dos de Mayo y Arfe originales. Dos checkpoints: tras Palos y al entrar en Almirantazgo; reanudar recupera el tiempo guardado y permite conseguir estrellas y récord según el tiempo final. Arriar dentro del recuadro amarillo en Arfe.'};
export function cathedralScene(route=CATHEDRAL_ROUTE){const v={...CATHEDRAL_ROUTE,...route};if(v.cathedralExit!=='postigo')throw new Error('La salida Alemanes utiliza mapa4 original sin adaptador');return {...CATHEDRAL_MAP,start:v.start,end:v.end,finish:v.finish,checkpoint:CATHEDRAL_CHECKPOINT,checkpoints:v.checkpoints.points,crowd:v.crowd,viewScale:v.viewScale,ambient:ENVIRONMENT_PRESETS[v.environment]||ENVIRONMENT_PRESETS.madrugada,cathedralExit:v.cathedralExit};}
