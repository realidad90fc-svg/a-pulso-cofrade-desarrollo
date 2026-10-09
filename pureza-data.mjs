// World units use the unchanged native TreCai scale. Geographical compression
// is deliberate; this is a local stage, not an open-world street network.
export const PUREZA_ANCHORS={
 start:{id:'pureza_temple_exit',position:[3.35,0],angle:90},
 end:{id:'altozano_from_pureza',position:[-1.65,26.6],angle:0},
};
export const PUREZA_CHECKPOINT={id:'pureza_before_bend',position:[.075,11],radius:.65};
export const PUREZA_MODULES=[
 {id:'marineros',kind:'chapel',bounds:[1.3,-2.3,6.1,2.3],room:[1.65,-1.8,5.6,1.8],door:[1.28,-.63,1.67,.63],name:'Capilla de los Marineros'},
 {id:'pureza',kind:'street',points:[[0,-4],[0,0],[0,8],[.1,12],[-.8,18],[-1.5,24],[-1.65,29]],halfWidth:1.3,name:'Calle Pureza'},
 {id:'pureza_exit_bay',kind:'branch',polygon:[[-1.65,-1.6],[1.3,-1.6],[1.3,1.6],[-1.65,1.6]],name:'Espacio de maniobra frente a la capilla'},
 {id:'pureza_bocacalle',kind:'branch',polygon:[[-5.7,12.5],[-1.0,12.5],[-1.0,13.55],[-5.7,13.55]],name:'Bocacalle'},
 {id:'altozano_approach',kind:'square',polygon:[[-6,24.5],[-3.2,23.8],[1.8,25],[4,29],[4,33],[-6,33]],name:'Altozano'},
];
const houses=[];
for(let i=0;i<11;i++)for(const side of [-1,1]){
 const y=-3+i*2.3;if(side===1&&y<3.2)continue;
 const center=y<12?0:y<18?-.15-(y-12)*.12:-.8-(y-18)*.12;
 houses.push({id:'pureza-house-'+side+'-'+i,side,rect:side===1?[center+1.3,y,center+5.7,y+2.24]:[center-5.7,y,center-1.3,y+2.24],material:i%7,balcony:i%3!==1});
}
export const PUREZA_SCENE={key:'SalidaPureza',name:'Salida por Pureza',kind:'modular',
 image:'assets/original-animation/sprite-569.webp',bounds:[-7,-5,8,33],ppu:64,
 modules:PUREZA_MODULES,houses,checkpoint:PUREZA_CHECKPOINT,crowd:{spacing:.19,lanes:[.81,1.005,1.20],clearHalfWidth:.66,plazaSpacing:.20,maxPeople:1500},start:PUREZA_ANCHORS.start,end:PUREZA_ANCHORS.end,
 finish:{polygon:[[-2.7,25.3],[-.6,25.3],[-.6,29],[-2.7,29]],heading:0,tolerance:25},
 lamps:[[-1.18,-1],[1.18,3],[-1.2,6],[1.2,10],[-1.3,14],[.3,18],[-2.4,22],[-3.15,26.1],[1.2,28.5]],
 trees:[[-3.25,27.6,.5],[-5.0,30.5,.8],[-4.5,32,.7]],
 landmarks:[{id:'altozano-corner',polygon:[[-.15,25.8],[3.8,27],[5.8,31.5],[-.15,31.5]],material:4}],
 balconies:[{side:1,y:6.2,width:.55,projection:.10},{side:-1,y:16.4,width:.5,projection:.08}],
 crowdAreas:[[[-5.65,12.52],[-1.15,12.52],[-1.15,13.5],[-5.65,13.5]],[[-6,24.7],[-3.2,24.7],[-3.2,31],[-6,31]],[[.2,26],[3.7,27],[3.7,32],[.2,32]],[[-3.15,28.0],[-.25,28.0],[-.25,33],[-3.15,33]]],
 ambient:{night:true,tint:'#101727',darkness:.35},
};
export const PUENTE_ROUTES=[
 {id:'puente-pureza-01',name:'SALIDA POR PUREZA',order:1,playable:true,mapId:1,mapKey:PUREZA_SCENE.key,stepRef:'TreCai',brotherhoodId:'madruga_05',threeStars:420,twoStars:540,clockStart:'control',provisionalTimes:true,unlock:{scope:'brotherhood',stars:0},checkpoints:{policy:'time',points:[PUREZA_CHECKPOINT]},start:PUREZA_ANCHORS.start,end:PUREZA_ANCHORS.end,moduleIds:PUREZA_MODULES.map(m=>m.id)},
 ...['ALTOZANO Y PUENTE','CAMINO AL CENTRO','CARRERA OFICIAL','CATEDRAL Y POSTIGO','REGRESO POR EL ARENAL','REGRESO A TRIANA','ENTRADA'].map((name,index)=>({id:'puente-future-'+(index+2),name,order:index+2,playable:false,mapId:null,mapKey:null,stepRef:'TreCai',brotherhoodId:'madruga_05',unlock:{scope:'brotherhood',stars:0},start:index===0?PUREZA_ANCHORS.end:null,end:null,checkpoints:{policy:'time',points:[]}})),
];
