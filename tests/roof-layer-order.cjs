'use strict';
// Test de regresión: las aceras nunca deben tapar tejados.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,fs.existsSync(path.join(__dirname,'../editor-arenal.mjs'))?'../dist':'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const editor=read('editor-arenal.mjs');
const a=editor.slice(editor.indexOf('function renderStaticScene(){'),editor.indexOf('// Maps, roofs, sprites and Google Earth photos'));
function before(text,a,b,label){
 const x=text.indexOf(a),y=text.indexOf(b);
 assert(x>=0&&y>=0&&x<y,label);
}
before(a,"drawFloor(o.poly,'sidewalks'","drawTexture(o.poly,o.material||o.key",'Las aceras deben estar detrás de los tejados en el editor');
before(a,"drawFloor(o.poly,'roads'","drawTexture(o.poly,o.material||o.key",'La calzada debe estar detrás de los tejados en el editor');
const native=read('arenal-layers.mjs');
const n=native.slice(native.indexOf('export function paintArenalScene'));
before(n,'for(const sw of route.sidewalks)','for(const lot of route.buildings)','Las aceras deben estar detrás de los tejados en el Arenal');
const bridge=read('game-editor-bridge.mjs');
const g=bridge.slice(bridge.indexOf("draw(ctx,project,images,canvas,phase='all')"),bridge.indexOf('streetNoticeFor(sim)'));
before(g,"['sidewalks',SIDEWALK_MATERIALS]",'paintCityObjects(ctx,this.layers','La vista previa debe dibujar las cubiertas después de las aceras');
console.log('PASS: Tejados encima de aceras en editor, Arenal y prueba de juego');

