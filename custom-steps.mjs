import {CONTENT_STEPS} from './content-catalogue.mjs';
// Extra steps retain an original controller and have independent records.
export const JESUS_PENAS = Object.freeze({key:'JesusPenas',name:CONTENT_STEPS.find(s=>s.id==='JesusPenas').name,baseCode:'BueMue',image:'assets/custom-steps/jesus-penas.png',crop:[190,135,651,1182],size:[.82,1.46],rotation:180});
export function customStep(step,key){return key===JESUS_PENAS.key?{...step,name:JESUS_PENAS.name,variant:JESUS_PENAS}:step;}
export function recordKey(map,step){return 'recordmapa'+(typeof map==='object'?(map.variant?.key||map.id):map)+(step.variant?.key||step.code);}
export function nativeRecordKey(key,variant,route){if(route&&/^recordmapa\d+/.test(key))key=key.replace(/^recordmapa\d+/,'recordmapa'+route.key);return variant&&/BueMue$/.test(key)?key.replace(/BueMue$/,variant.key):key;}
export function installCustomStepMenu(layouts){
 const root=Object.values(layouts.roots).find(r=>r.name==='MenuEligePaso');
 const source=root.nodes.find(k=>layouts.nodes[k].name==='ButtonBueMue'),cloned=[];
 function copy(key,parent){const old=layouts.nodes[key],n=structuredClone(old),next='custom-JesusPenas-'+key;n.key=next;n.parentKey=parent;n.path=old.path.replace('ButtonBueMue','ButtonJesusPenas');layouts.nodes[next]=n;cloned.push(next);n.childKeys=(old.childKeys||[]).map(k=>copy(k,next));return next;}
 const key=copy(source,layouts.nodes[source].parentKey),button=layouts.nodes[key];
 button.name='ButtonJesusPenas';button.anchoredPosition.y=-400;button.localPosition.y=-400;button.button.onClick=[];button.button.interactable=true;
 for(const k of cloned){const n=layouts.nodes[k];if(n.text&&n.name==='Text')n.text.text=JESUS_PENAS.name;if(n.text&&n.name==='numero')n.text.text='0';}
 layouts.nodes[button.parentKey].childKeys.push(key);root.nodes.push(...cloned);
 return {button:key,stamps:cloned.find(k=>layouts.nodes[k].name==='numeroEst'),levels:cloned.find(k=>layouts.nodes[k].name==='numeroNiveles')};
}
export function customProgress(prefs,medalsFor){let stamps=0,levels=0;for(let map=1;map<=10;map++){const record=Number(prefs['recordmapa'+map+JESUS_PENAS.key]||0);if(record>0){levels++;stamps+=medalsFor(map,record);}}return {stamps,levels};}
export function installCustomInfoMenu(layouts){
 const root=Object.values(layouts.roots).find(r=>r.name==='MenuPasos');
 const source=root.nodes.find(k=>layouts.nodes[k].name==='ButtonDefBueMue'),cloned=[];
 function copy(key,parent){const old=layouts.nodes[key],n=structuredClone(old),next='custom-info-JesusPenas-'+key;n.key=next;n.parentKey=parent;n.path=old.path.replace('ButtonDefBueMue','ButtonDefJesusPenas');layouts.nodes[next]=n;cloned.push(next);n.childKeys=(old.childKeys||[]).map(k=>copy(k,next));return next;}
 const key=copy(source,layouts.nodes[source].parentKey),button=layouts.nodes[key];
 button.name='ButtonDefJesusPenas';button.anchoredPosition.y=-400;button.localPosition.y=-400;button.button.onClick=[];button.button.interactable=true;
 for(const k of cloned){const n=layouts.nodes[k];if(n.text)n.text.text=JESUS_PENAS.name;}
 layouts.nodes[button.parentKey].childKeys.push(key);root.nodes.push(...cloned);return key;
}
export function drawCustomStepDiagram(ctx,image){
 const width=502,height=222,long=380,short=long*JESUS_PENAS.crop[2]/JESUS_PENAS.crop[3];
 ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(width/2,height/2);ctx.rotate(Math.PI/2);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,...JESUS_PENAS.crop,-short/2,-long/2,short,long);
 // As on the native cards, highlight the image and elevated corner lanterns.
 ctx.strokeStyle='#ffe100';ctx.lineWidth=3;
 for(const [x,y,rx,ry]of [[0,35,short*.26,long*.22],[-short*.34,-long*.38,short*.17,long*.07],[short*.34,-long*.38,short*.17,long*.07],[-short*.34,long*.38,short*.17,long*.07],[short*.34,long*.38,short*.17,long*.07]]){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
