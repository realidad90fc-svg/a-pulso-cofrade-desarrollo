import {ARENAL_ROUTE} from './arenal-data.mjs';
import {CATHEDRAL_ROUTE,CATHEDRAL_ANCHORS} from './cathedral-data.mjs';
import {OFFICIAL_ROUTE,OFFICIAL_ANCHORS} from './official-data.mjs';
import {BRIDGE_ROUTE,BRIDGE_ANCHORS} from './bridge-data.mjs';
import {CENTRE_ROUTE,CENTRE_ANCHORS} from './centre-data.mjs';
import {PUENTE_ROUTES} from './pureza-data.mjs';
import {BROTHERHOODS,CONTENT_STEPS} from './content-catalogue.mjs';
import {HOLY_WEEK_DAYS} from './mode-navigation.mjs';
// Provisional catalogue reuses existing scenes and one existing paso.
// All times are seconds; unlock scopes: total, day, brotherhood.
const previous={version:1,
 days:HOLY_WEEK_DAYS.map(day=>({...day,unlock:{scope:'total',stars:day.id==='lunes-santo'?4:0}})),
 brotherhoods:[
  {id:'prueba-a',name:'Cuadrilla de prueba A',dayId:'domingo-ramos',provisional:true,unlock:{scope:'day',stars:0}},
  {id:'prueba-b',name:'Cuadrilla de prueba B',dayId:'domingo-ramos',provisional:true,unlock:{scope:'day',stars:3}},
  {id:'prueba-c',name:'Cuadrilla de prueba C',dayId:'lunes-santo',provisional:true,unlock:{scope:'day',stars:0}}
 ],
 routes:[
  {id:'prueba-a-1',name:'Primer recorrido',brotherhoodId:'prueba-a',mapId:1,stepId:1,threeStars:150,twoStars:180,unlock:{scope:'brotherhood',stars:0},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}},
  {id:'prueba-a-2',name:'Segundo recorrido',brotherhoodId:'prueba-a',mapId:2,stepId:1,threeStars:240,twoStars:300,unlock:{scope:'brotherhood',stars:1},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}},
  {id:'prueba-a-3',name:'Alemanes · Placentines · Francos',brotherhoodId:'prueba-a',mapId:1,mapKey:'AlemanesPlacentinesFrancos',stepId:1,threeStars:360,twoStars:480,unlock:{scope:'brotherhood',stars:3},checkpoints:{policy:'time',points:[{id:'cruce',native:true}]}},
  {id:'prueba-b-1',name:'Recorrido de prueba B',brotherhoodId:'prueba-b',mapId:3,stepId:1,threeStars:240,twoStars:300,unlock:{scope:'brotherhood',stars:0},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}},
  {id:'prueba-b-2',name:'Segundo recorrido B',brotherhoodId:'prueba-b',mapId:4,stepId:1,threeStars:400,twoStars:480,unlock:{scope:'brotherhood',stars:1},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}},
  {id:'prueba-c-1',name:'Recorrido de prueba del Lunes',brotherhoodId:'prueba-c',mapId:5,stepId:1,threeStars:460,twoStars:550,unlock:{scope:'brotherhood',stars:0},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}},
  {id:'prueba-c-2',name:'Segundo recorrido del Lunes',brotherhoodId:'prueba-c',mapId:6,stepId:1,threeStars:300,twoStars:390,unlock:{scope:'brotherhood',stars:1},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}}
 ]};

export const CAMPAIGN_DATA={version:4,days:previous.days,brotherhoods:BROTHERHOODS,steps:CONTENT_STEPS,
 migration:{brotherhoods:{"prueba-a":"domingo-ramos_04","prueba-b":"domingo-ramos_04","prueba-c":"domingo-ramos_04"}},
 routes:[...previous.routes.map((r,index)=>({...r,brotherhoodId:"domingo-ramos_04",stepRef:'BueMue',order:index+1,playable:true,start:null,end:null,provisional:true})),
 ...CONTENT_STEPS.filter(s=>s.id!=='BueMue').map(s=>({id:'existing-'+s.id,name:'Recorrido de prueba · mapa 1',brotherhoodId:s.brotherhoodId,stepRef:s.id,stepId:s.engineId,stepKey:s.engineVariant||undefined,mapId:1,order:1,playable:true,start:null,end:null,provisional:true,archive:s.id==='TreCai',order:s.id==='TreCai'?99:1,threeStars:s.id==='JesusPenas'?150:210,twoStars:s.id==='JesusPenas'?180:255,unlock:{scope:'brotherhood',stars:0},checkpoints:{policy:'time',points:[{id:'azul',native:true}]}})),...PUENTE_ROUTES.map(r=>r.id===BRIDGE_ROUTE.id?BRIDGE_ROUTE:r.id===CENTRE_ROUTE.id?CENTRE_ROUTE:r.id===OFFICIAL_ROUTE.id?OFFICIAL_ROUTE:r.id===CATHEDRAL_ROUTE.id?CATHEDRAL_ROUTE:r.id===ARENAL_ROUTE.id?ARENAL_ROUTE:r.order===7?{...r,start:ARENAL_ROUTE.end}:r)]};
