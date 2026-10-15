import fs from 'node:fs';
import {OriginalSimulation} from '../original-engine.mjs';
import {prepareMap,prepareStep} from '../engine.mjs';
const root=new URL('../assets/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n+'.json',root)));
const data=read('game-data');
const resources={code:read('original-code'),assets:read('original-assets'),animation:read('original-animation'),controls:read('runtime-controls'),random:()=>.5};
export {data,resources,OriginalSimulation,prepareMap,prepareStep};
