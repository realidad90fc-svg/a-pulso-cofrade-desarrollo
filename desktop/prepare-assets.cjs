'use strict';
// Builds a self-contained, OFFLINE static copy of the current editor/game.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const dest=path.join(__dirname,'web');
fs.rmSync(dest,{recursive:true,force:true});
fs.mkdirSync(dest,{recursive:true});
for(const item of fs.readdirSync(root,{withFileTypes:true})){
 if(item.isFile()&&/\.(?:mjs|js|html|css|json|svg|webmanifest)$/i.test(item.name)){
  fs.copyFileSync(path.join(root,item.name),path.join(dest,item.name));
 }
 if(item.isDirectory()&&item.name==='assets'){
  fs.cpSync(path.join(root,item.name),path.join(dest,item.name),{recursive:true});
 }
}
const expected=['editor-arenal.html','index.html','editor-arenal.mjs',
 'assets/game-data.json','assets/original-animation.json'];
for(const name of expected)if(!fs.existsSync(path.join(dest,name)))throw Error('Falta archivo web: '+name);
const count=fs.readdirSync(dest,{withFileTypes:true}).length;
process.stdout.write('Contenido local de A Pulso preparado: '+count+' entradas\n');
