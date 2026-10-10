import {CATHEDRAL_ANCHORS,POSTIGO_MODULE,postigoPoint} from './cathedral-data.mjs';
import {MODULO_REYES_CATOLICOS,CENTRE_MAP} from './centre-data.mjs';
import {ENVIRONMENT_PRESETS,BRIDGE_ANCHORS} from './bridge-data.mjs';
export const ARENAL_FRAME={reyesTranslation:[0,20]};
export const placeModule=(source,[dx,dy])=>({...source,source,placement:{translation:[dx,dy],rotation:0},points:source.points.map(([x,y])=>[x+dx,y+dy]),branches:source.branches.map(b=>({...b,position:[b.position[0]+dx,b.position[1]+dy]})),trees:source.trees.map(([x,y,r])=>[x+dx,y+dy,r])});
const street=(id,name,points,halfWidth,crowdRows=7)=>({id,name,points,halfWidth,crowdRows,style:'historic',trees:[],branches:[]});
export const MODULO_ENLACE_ARFE_ADRIANO=street('MODULO_ENLACE_ARFE_ADRIANO','Arfe · Adriano',[postigoPoint([15.05,14.35]),[45.2,30.66]],1.30);
export const MODULO_ADRIANO=street('MODULO_ADRIANO','Adriano',[[45.2,30.66],[37.8,40.6]],2.45,9);
export const MODULO_PASTOR_LANDERO=street('MODULO_PASTOR_LANDERO','Pastor y Landero',[[37.8,40.6],[39.8,49.6]],1.62,7);
export const ARENAL_REYES=placeModule(MODULO_REYES_CATOLICOS,ARENAL_FRAME.reyesTranslation);
const A=MODULO_ADRIANO.points[0],B=MODULO_ADRIANO.points[1],length=Math.hypot(B[0]-A[0],B[1]-A[1]);
export const ADRIANO_BASIS={t:[(B[0]-A[0])/length,(B[1]-A[1])/length],n:[-(B[1]-A[1])/length,(B[0]-A[0])/length],length};
// Street furniture is tied to the existing street geometry, never a new parallel road.
// The plantings and hexagonal kerbs are based on Seville's 2023/2025 Adriano works;
// individual positions are approximate pending a survey, and can be moved independently.
export const ADRIANO_URBAN_DETAIL={
 sidewalkDepth:.48, // outside the existing playable kerb; does NOT increase the driving width
 kerbInset:.018,
 // Aerial reference: two rows on Adriano, never a trunk in the chapel doorway.
 trees:[{d:1.12,side:1},{d:2.75,side:-1},{d:4.20,side:-1},{d:5.95,side:-1},{d:8.85,side:1},{d:9.35,side:-1},{d:10.65,side:1},{d:11.45,side:-1}],
 signs:[{d:2.04,side:1,type:'no-stopping'},{d:9.95,side:-1,type:'no-parking'}],
 treeSprite:'sharedassets2.assets:563'
};
export const adrianoPoint=(d,side=0)=>[A[0]+ADRIANO_BASIS.t[0]*d+ADRIANO_BASIS.n[0]*side,A[1]+ADRIANO_BASIS.t[1]*d+ADRIANO_BASIS.n[1]*side];
export const BARATILLO={id:'CAPILLA_BARATILLO',name:'Capilla de la Piedad del Baratillo',moduleId:MODULO_ADRIANO.id,door:adrianoPoint(6,2.45),position:adrianoPoint(6,-.60),heading:Math.atan2(-ADRIANO_BASIS.n[0],ADRIANO_BASIS.n[1])*180/Math.PI,facadeWidth:2.0,facadeDepth:1.05};
export const PRESENTACION_BARATILLO={id:'presentacion-baratillo',label:'PRESENTACIÓN EN EL BARATILLO',position:BARATILLO.position,heading:BARATILLO.heading,positionTolerance:.36,headingTolerance:18,maxSpeed:.035,maxAngularSpeed:1.2,holdSeconds:3,checkpoint:true,mandatory:true};
export const CHECKPOINT_BARATILLO={id:'baratillo',position:BARATILLO.position,angle:BARATILLO.heading,radius:.36,activation:'presentation',presentationId:PRESENTACION_BARATILLO.id};
export const ARENAL_ANCHORS={start:CATHEDRAL_ANCHORS.end,end:{id:'sevilla_bridgehead_return',position:[BRIDGE_ANCHORS.end.position[0],BRIDGE_ANCHORS.end.position[1]+20],angle:90}};
const heading=ARENAL_ANCHORS.end.angle*Math.PI/180;
export const ARENAL_MAP={key:'RegresoArenal',kind:'arenal',name:'Regreso por el Arenal',reuseNativeMap:true,image:CENTRE_MAP.image,bounds:[23,24,55,60],ppu:96,tileSize:8,maxCachedTiles:8,turnRadius:1.08,modules:[ARENAL_REYES,MODULO_ENLACE_ARFE_ADRIANO,MODULO_ADRIANO,MODULO_PASTOR_LANDERO],path:[ARENAL_ANCHORS.start.position,...MODULO_ENLACE_ARFE_ADRIANO.points,...MODULO_ADRIANO.points.slice(1),...MODULO_PASTOR_LANDERO.points.slice(1),ARENAL_ANCHORS.end.position],original:[POSTIGO_MODULE],presentations:[PRESENTACION_BARATILLO]};
export const ARENAL_ROUTE={id:'puente-future-6',name:'REGRESO POR EL ARENAL',order:6,playable:true,mapId:5,mapKey:ARENAL_MAP.key,stepRef:'TreCai',brotherhoodId:'madruga_05',clockStart:'control',threeStars:660,twoStars:840,provisionalTimes:true,unlock:{scope:'brotherhood',stars:0,completedRoute:'puente-future-5'},checkpoints:{policy:'cleanRecord',points:[CHECKPOINT_BARATILLO]},start:ARENAL_ANCHORS.start,end:ARENAL_ANCHORS.end,presentations:ARENAL_MAP.presentations,environment:'first-light',viewScale:1.55,crowd:{spacing:.15,maxPeople:8000,liveDistance:7},finish:{polygon:[[-.72,-1.3],[.72,-1.3],[.72,1.3],[-.72,1.3]].map(([x,y])=>[ARENAL_ANCHORS.end.position[0]+x*Math.cos(heading)-y*Math.sin(heading),ARENAL_ANCHORS.end.position[1]+x*Math.sin(heading)+y*Math.cos(heading)]),heading:90,tolerance:16,invisible:true},instructions:'Arfe original → Adriano → Capilla del Baratillo → Pastor y Landero → Reyes Católicos → cabecera sevillana del Puente de Isabel II. Presentación OBLIGATORIA: avanza paralelo a la fachada como en el cortejo real, sitúa el centro del paso ante la puerta rojiza de la capilla y detente 3 segundos. NO lo gires hacia la puerta. La confirmación activa el checkpoint. Después maniobra y continúa sin teletransporte. Arriar en la cabecera, antes de cruzar el puente. En este recorrido, reanudar desde Baratillo recupera el tiempo guardado, permite hasta dos estrellas y no mejora el récord general. Tres estrellas y récord requieren empezar desde Arfe.'};
export function arenalScene(route=ARENAL_ROUTE){const v={...ARENAL_ROUTE,...route};return {...ARENAL_MAP,start:v.start,end:v.end,finish:v.finish,checkpoint:CHECKPOINT_BARATILLO,checkpoints:v.checkpoints.points,presentations:v.presentations,crowd:v.crowd,viewScale:v.viewScale,ambient:ENVIRONMENT_PRESETS['first-light']||{tint:'#4f5260',darkness:.13,water:'#597f85',lamps:true,crowdTint:[.94,.92,.87,1]}};}
