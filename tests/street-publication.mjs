// Exercise the publication sanitizer without making any network requests.
import assert from 'node:assert/strict';
import handler from '../api/publish-map.js';
import {makeGameDraft,withEditorStreetPoints} from '../editor-game-draft.mjs';
let uploaded=null;
globalThis.fetch=async(url,options={})=>{
 if(url.endsWith('/user'))return{ok:true,status:200,json:async()=>({login:'realidad90fc-svg'})};
 if(options.method==='PUT'){
  uploaded=JSON.parse(Buffer.from(JSON.parse(options.body).content,'base64').toString('utf8'));
  return{ok:true,status:200,json:async()=>({commit:{sha:'test-only'}})};
 }
 return{ok:false,status:404,json:async()=>({})};
};
const doc={metadata:{mapKey:'native-1'},labels:[['Nombre editable',[1,2],{radius:.6}]]};
const draft=makeGameDraft(doc,{});let status,body;
const response={setHeader(){},status(n){status=n;return this},json(v){body=v;return this}};
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft}},response);
assert.equal(status,200,JSON.stringify(body));assert.deepEqual(uploaded.labelScene,doc.labels);assert.deepEqual(uploaded.layers.labels,doc.labels);
const preview=withEditorStreetPoints(null,{...doc,labels:[]});assert.equal(preview.total,1);assert.deepEqual(preview.labelScene,[],'Even an unmodified preview with zero points owns its announcements');
await handler({method:'POST',headers:{authorization:'Bearer test-only'},body:{mapKey:'native-1',draft:{...draft,labelScene:[['Arfe',[0,0],{radius:100}]]}}},response);
assert.equal(status,400);assert(body.error);
console.log('PASS street publication: edited name/position/radius retained, invalid radius rejected and empty preview points remain authoritative.');
