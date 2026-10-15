// Exercise the publication sanitizer without making any network requests.
import assert from 'node:assert/strict';
import handler from '../api/publish-map.js';
import {makeGameDraft,withEditorStreetPoints} from '../editor-game-draft.mjs';
import fs from 'node:fs';
let uploaded=null;
globalThis.fetch=async(url,options={})=>{
 if(url.endsWith('/user'))return{ok:true,status:200,json:async()=>({login:'realidad90fc-svg'})};
 if(options.method==='PUT'){
  uploaded=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64').toString('utf8'));
  return{ok:true,status:200,json:async()=>({commit:{sha:'test-only'}})};
 }
 return{ok:false,status:404,json:async()=>({})};
};
const doc={metadata:{mapKey:'native-1'},labels:[['Nombre editable',[1,2],{radius:.6}]],houses:[{poly:[[0,0],[3,0],[3,3],[0,3]],facade:{shop:'pharmacy',bladeSign:'pharmacy',bladeDepth:1.1,bladeSize:.7,bladePosition:.35}}]};
const draft=makeGameDraft(doc,{});let status,body;
const response={setHeader(){},status(n){status=n;return this},json(v){body=v;return this}};
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft}},response);
assert.equal(status,200,JSON.stringify(body));assert.deepEqual(uploaded.labelScene,doc.labels);assert.deepEqual(uploaded.layers.labels,doc.labels);
assert.deepEqual(uploaded.layers.houses[0].facade,doc.houses[0].facade,'Publication preserves the projecting symbol and its settings');
const preview=withEditorStreetPoints(null,{...doc,labels:[]});assert.equal(preview.total,1);assert.deepEqual(preview.labelScene,[],'Even an unmodified preview with zero points owns its announcements');
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft:{...draft,labelScene:[['Arfe',[0,0],{radius:100}]]}}},response);
assert.equal(status,400);assert(body.error);
const image='data:image/webp;base64,'+fs.readFileSync(new URL('../assets/sevilla/silla-carrera-oficial-v1.webp',import.meta.url)).toString('base64');
const resource={id:'asset-public-chair',name:'Silla importada',category:'chairs',width:.4,depth:.43,angle:15,collision:{kind:'box',width:.4,depth:.43},image};
const authored={metadata:{mapKey:'native-1',map:'Mapa editado',precisionGeometry:true},bounds:[0,0,20,20],paso:{x:5,y:5,angle:0},
 roads:[{poly:[[0,0],[20,0],[20,20],[0,20]],holes:[[[8,8],[8,10],[10,10],[10,8]]],texture:{width:.8,depth:1.2,angle:27,mode:'repeat'}}],
 customObjects:[{assetId:resource.id,point:[3,3],width:.4,depth:.43,angle:15,collision:resource.collision}],resources:[resource],checkpoints:[{id:'finish',name:'Llegada',position:[15,15],finish:true}]};
const authoredDraft=makeGameDraft(authored,{});
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft:authoredDraft}},response);
assert.equal(status,200,JSON.stringify(body));assert.equal(uploaded.resources[0].image,image);assert.deepEqual(uploaded.layers.customObjects,authored.customObjects);
assert.deepEqual(uploaded.authoringScene.roads[0].holes,authored.roads[0].holes);assert.deepEqual(uploaded.authoringScene.roads[0].texture,authored.roads[0].texture);
assert(uploaded.authoringScene.metadata.inheritNativeLimits,'An explicitly authored native map retains its existing star time limits');assert(uploaded.authoringScene.checkpoints[0].finish);
assert(!uploaded.authoringScene.resources[0].image,'Raster bytes must be embedded once per published map');
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft:{...authoredDraft,resources:[{...resource,image:'https://example.com/not-embedded.webp'}]}}},response);assert.equal(status,400);
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft:{...authoredDraft,authoringScene:{...authoredDraft.authoringScene,checkpoints:[]}}}},response);assert.equal(status,400);assert(body.error.includes('llegada'));
console.log('PASS publication: edited street points, projecting signs, embedded custom resources, exact courtyard/texture geometry and native-scene finish validation.');
