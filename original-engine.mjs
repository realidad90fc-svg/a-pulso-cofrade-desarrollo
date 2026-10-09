import {ArenalRoute} from './arenal-route.mjs';
import {CathedralRoute} from './cathedral-route.mjs';
import {OfficialRoute} from './official-route.mjs';
import {CentreRoute} from './centre-route.mjs';
import {BridgeRoute} from './bridge-route.mjs';
import {ModularRoute} from './modular-route.mjs';
import {OriginalVM} from './original-vm.mjs';
import {SceneGraph,OriginalAnimator} from './original-scene.mjs';
import {CustomRoute} from './custom-routes.mjs';
import {nativeRecordKey} from './custom-steps.mjs';
import {clamp,pointInPolygon,segmentDistance} from './engine.mjs';
const DEG=Math.PI/180;
const vec=(x=0,y=0,z=0)=>({x,y,z});
const array=v=>[v.x,v.y,v.z||0];
const from=a=>vec(...a);
const rotate=(v,a)=>vec(v.x*Math.cos(a)-v.y*Math.sin(a),v.x*Math.sin(a)+v.y*Math.cos(a),v.z);
const matrixPoint=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const inverse=m=>{const d=m[0]*m[3]-m[1]*m[2];return[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];};
const simpleTransform=(p=[0,0,0])=>({position:from(p),localPosition:from(p),angle:0,scale:vec(1,1,1)});
const REASONS=['','¡Te has salido del camino!','¡La parihuela chocó contra una pared!','¡Una manigueta chocó contra una pared!','¡Un candelabro chocó contra una pared!','¡Un candelabro chocó contra una señal de tráfico!','¡Una imagen rozó contra un elemento de altura!','¡Has atropellado al contraguía!','¡Los costaleros están agotados!','¡La parihuela golpeó una valla o pivote!','¡La parihuela chocó contra un contenedor!','¡Una manigueta golpeó un contenedor!','¡Tienes que arriar en el recuadro azul antes de poder continuar hasta el final!','¡Has atropellado a una persona del público!'];
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segments(a,b,c,d){if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return ((x<=0&&y>=0)||(x>=0&&y<=0))&&((z<=0&&w>=0)||(z>=0&&w<=0));}
function edges(points,closed){const a=[];for(let i=1;i<points.length;i++)a.push([points[i-1],points[i]]);if(closed)a.push([points.at(-1),points[0]]);return a;}
function touching(a,b){
  if(!a.enabled||!b.enabled)return false;
  const aa=a.world(),bb=b.world();
  if(aa.circle||bb.circle){
    const c=aa.circle?aa:bb,p=aa.circle?bb:aa;
    if(p.circle)return Math.hypot(c.center[0]-p.center[0],c.center[1]-p.center[1])<=c.radius+p.radius;
    return (!p.edge&&pointInPolygon(c.center,p.points))||edges(p.points,!p.edge).some(([x,y])=>segmentDistance(c.center,x,y).distance<=c.radius);
  }
  const pa=aa.points,pb=bb.points;
  const ba=[Math.min(...pa.map(p=>p[0])),Math.min(...pa.map(p=>p[1])),Math.max(...pa.map(p=>p[0])),Math.max(...pa.map(p=>p[1]))];
  const br=[Math.min(...pb.map(p=>p[0])),Math.min(...pb.map(p=>p[1])),Math.max(...pb.map(p=>p[0])),Math.max(...pb.map(p=>p[1]))];
  if(ba[0]>br[2]||ba[2]<br[0]||ba[1]>br[3]||ba[3]<br[1])return false;
  if(!aa.edge&&pb.some(p=>pointInPolygon(p,pa)))return true;
  if(!bb.edge&&pa.some(p=>pointInPolygon(p,pb)))return true;
  return edges(pa,!aa.edge).some(([x,y])=>edges(pb,!bb.edge).some(([z,w])=>segments(x,y,z,w)));
}
export class OriginalSimulation {
  constructor(map,step,resources,mode='career',snapshot=null){
    this.map=map;this.step=step;this.resources=resources;this.mode=mode;this.tutorial=mode==='tutorial';this.events=[];this.coroutines=[];this.sources=[];this.graphs=[];this.entities=[];this.names=new Map();this.tags=new Map();this.keys=new Map();this.frameCount=0;this.levelTime=0;this.dt=0;this.timeScale=1;this.inputClick=false;this.checkpointState=null;
    this.state={x:0,y:0,angle:-(resources.code.startAngles[map.id-1]||0)*DEG,status:'playing',time:0,stamina:100,checkpointPassed:false};
    this.prefs={...resources.prefs,mapaElegido:map.id,pasoElegido:step.id,libre:mode==='practice'?1:0,checkpoint:0,checkpointGuardado:0,himnoMapa:[0,0,0,0,0,2,0,0,0,1][map.id-1]||0};
    const native=this.native.bind(this);native.intercepts=new Set();this.vm=new OriginalVM(resources.code,native);
    this.className=this.tutorial?'pasoTutoController':step.code+'Controller';this.mapClass=this.tutorial?'mapaTutorial':'ColisionesMapa1';this.controller=this.vm.create(this.className);this.controller.transform=null;
    this.vm.invoke(this.className+'..ctor',this.controller);
    this.mapController=this.vm.create(this.mapClass);this.vm.invoke(this.mapClass+'..ctor',this.mapController);
    if(this.tutorial)this.setupTutorialScene();else this.setupScene();
    this.setupController();
    this.setupMap();
    this.cameraController=this.vm.create('cameraController');this.vm.invoke('cameraController..ctor',this.cameraController);this.cameraController.transform=this.cameraEntity.transform;
    this.cameraEntity.script=this.cameraController;
    this.vm.invoke(this.className+'.Start',this.controller);
    if(this.resources.code.methods[this.mapClass+'.Awake'])this.vm.invoke(this.mapClass+'.Awake',this.mapController);
    this.vm.invoke(this.mapClass+'.Start',this.mapController);
    this.vm.invoke('cameraController.Start',this.cameraController);
    if(!this.tutorial){this.controller.limiteActual=resources.code.limits[step.code]['limite'+step.code+'Mapa'+map.id];this.controller.limiteActual2=resources.code.limits[step.code]['limite2'+step.code+'Mapa'+map.id];}
    if(map.variant&&!this.tutorial)this.routeAdapter=map.variant.kind==='arenal'?new ArenalRoute(this):map.variant.kind==='cathedral'?new CathedralRoute(this):map.variant.kind==='official'?new OfficialRoute(this):map.variant.kind==='centre'?new CentreRoute(this):map.variant.kind==='bridge'?new BridgeRoute(this):map.variant.kind==='modular'?new ModularRoute(this):new CustomRoute(this);
    if(snapshot)this.restore(snapshot);
    this.sync();
  }
  emit(type,data={}){this.events.push({type,...data});}
  entity(name,tag='',transform=simpleTransform()){
    const e={name,tag,transform,components:{},children:[],active:true};transform.entity=e;
    this.entities.push(e);this.names.set(name,e);if(tag)this.tags.set(tag,e);return e;
  }
  graphEntity(name,alias=null,tag=''){
    const g=new SceneGraph(this.resources.animation,name);this.graphs.push(g);const nodes=new Map();
    for(const n of g.nodes.values()){
      const tagData=this.resources.controls?.graphTags?.[name]?.[n.id]||n.tag||'';
      const e=this.entity(n.name,tagData,{graph:g,id:n.id});nodes.set(n.id,e);
      if(n.gameObjectKey)this.keys.set(n.gameObjectKey,e);if(n.transformKey)this.keys.set(n.transformKey,e);
      if(n.animator){const a=g.animators.get(n.id);e.components.Animator=a;a.transform=e.transform;}
      if(n.sprite)e.components.SpriteRenderer={enabled:!!n.sprite.enabled,transform:e.transform,entity:e,graphSprite:n.sprite};
    }
    for(const n of g.nodes.values())if(n.parent)nodes.get(n.parent).children.push(nodes.get(n.id));
    const root=nodes.get(g.root.id);root.graph=g;root.nodes=nodes;
    if(alias)this.names.set(alias,root);if(tag){root.tag=tag;this.tags.set(tag,root);}
    return root;
  }
  setupTutorialScene(){
    const t=this.resources.controls.tutorial;
    for(const p of this.resources.animation.tutorialScene){const name=p.graph;
      const e=this.graphEntity(name,p.sourceName||name);this.setPosition(e.transform,p.position);this.setAngle(e.transform,Math.atan2(p.rotation[2],p.rotation[3])*2/DEG);
      if(name==='pasoTuto')this.stepEntity=e;
      if(name==='mapaTuto'){this.mapEntity=e;this.mapGraph=e.graph;}
      if(name==='capatazTuto')this.capatazEntity=e;
      if(name==='contraguiaTuto')this.contraEntity=e;
    }
    for(const n of Object.values(t.nodes)){
      const e=this.keys.get(n.key)||this.entities.find(e=>e.transform.graph?.nodes.get(e.transform.id).path===n.path.slice(1));
      if(e){this.keys.set(n.key,e);this.keys.set(n.transformKey,e);if(n.tag&&n.tag!=='Untagged'){e.tag=n.tag;this.tags.set(n.tag,e);}}
    }
    this.tags.set('Paso',this.stepEntity);this.tags.set('capataz',this.capatazEntity);this.tags.set('contraguia',this.contraEntity);this.tags.set('mapa',this.mapEntity);
    this.stepEntity.script=this.controller;this.controller.transform=this.stepEntity.transform;this.mapEntity.script=this.mapController;this.mapController.transform=this.mapEntity.transform;
    this.mapEntities=new Map(this.entities.map(e=>[e.name,e]));this.cortejos=[];this.stepColliders=[];this.mapColliders=[];
    for(const c of Object.values(t.colliders)){const e=this.keys.get(c.nodeKey);if(e){const collider=this.addCollider(e,c,true);(e.transform.graph===this.stepEntity.graph?this.stepColliders:this.mapColliders).push(collider);}}
    this.renderGraphs=[this.mapGraph,...this.graphs.filter(g=>g!==this.mapGraph)];
    this.cameraEntity=this.entity('Main Camera','MainCamera',simpleTransform([0,0,-10]));this.cameraEntity.components.Camera={orthographicSize:3.5,transform:this.cameraEntity.transform};
    this.canvasEntity=this.entity('Canvas','canvas');this.makeUI();
    this.capatazEntity.components.AudioSource=this.source('knock');this.gestorEntity=this.entity('gestor','gestor');
    this.entity('checkpoint').components.Text={enabled:false};this.entity('marcoCron').components.Image={enabled:true};this.entity('marcoBarra').components.Image={enabled:true};
  }
  setupScene(){
    this.stepEntity=this.graphEntity(this.step.code,'Paso','Paso');this.stepEntity.script=this.controller;this.controller.transform=this.stepEntity.transform;
    this.setAngle(this.stepEntity.transform,this.resources.code.startAngles[this.map.id-1]||0);
    this.capatazEntity=this.graphEntity('capataz','capataz','capataz');this.contraEntity=this.graphEntity('contraguia','contraguia','contraguia');
    const angle=this.angle(this.stepEntity.transform)*DEG;
    this.setPosition(this.capatazEntity.transform,array(rotate(vec(0,1),angle)));this.setAngle(this.capatazEntity.transform,(angle/DEG)-90);
    this.setPosition(this.contraEntity.transform,array(rotate(vec(-1,0),angle)));this.setAngle(this.contraEntity.transform,angle/DEG);
    const list=this.resources.animation.mapSpawns[this.step.code][this.map.id].entities;const spawns={paso:list[0],...Object.fromEntries(list.slice(1).map(e=>[e.name,e]))};for(let i=0;i<3;i++)spawns['cortejo'+(i+1)]=list[i+3];
    const pose=(e,record)=>{this.setPosition(e.transform,record.position);this.setAngle(e.transform,record.angle);};
    pose(this.stepEntity,spawns.paso);pose(this.capatazEntity,spawns.capataz);pose(this.contraEntity,spawns.contraguia);
    this.cortejos=[1,2,3].map(i=>{const d=spawns['cortejo'+i],e=this.graphEntity(d.name,'cortejo'+i,'cortejo'+i);pose(e,d);return e;});
    this.mapGraph=new SceneGraph(this.resources.animation,'mapa'+this.map.id);this.graphs.push(this.mapGraph);this.renderGraphs=[this.mapGraph,...this.graphs.filter(g=>g!==this.mapGraph)];
    this.mapEntities=new Map();
    for(const n of this.resources.controls.mapNodes[this.map.id]){
      const tag=this.resources.controls?.mapTags?.[this.map.id]?.[n.path]||'';
      const gn=[...this.mapGraph.nodes.values()].find(x=>'/' + x.path===n.path);const e=this.entity(n.name,tag,gn?{graph:this.mapGraph,id:gn.id}:simpleTransform([...n.pos,0]));if(gn?.sprite){e.components.SpriteRenderer={enabled:!!gn.sprite.enabled,transform:e.transform,graphSprite:gn.sprite};}if(gn?.animator){e.components.Animator=this.mapGraph.animators.get(gn.id);e.components.Animator.transform=e.transform;}this.mapEntities.set(n.path,e);e.active=n.active;
      if(['mapa'+this.map.id,'caminosYVallas','edificiosYObst','señales','arbolesYBalcones','zonaParada','zonaInter','colliderHimno'].includes(n.name))this.tags.set(n.name==='mapa'+this.map.id?'mapa':n.name,e);
      
    }
    for(const [path,e]of this.mapEntities){const parent=this.mapEntities.get(path.slice(0,path.lastIndexOf('/')));if(parent)parent.children.push(e);}
    this.tags.get('mapa').script=this.mapController;this.mapController.transform=this.tags.get('mapa').transform;
    this.stepColliders=[];
    const stepEntities=[...this.stepEntity.nodes.values()];
    const matches=(path)=>stepEntities.find(e=>e.transform.graph.nodes.get(e.transform.id).path===(path.replace(/^\//,'')));
    for(const c of this.resources.controls.steps[this.step.code].colliders){const e=matches(c.path);if(e)this.stepColliders.push(this.addCollider(e,c,true));}
    this.mapColliders=this.resources.controls.maps[this.map.id].colliders.map(c=>this.addCollider(this.mapEntities.get(c.path),c,false));
    for(const n of this.step.nodes){
      if(['parihuela','maniguetas','candelabros','imagenes','body','llamador','trasera','Manigueteros'].includes(n.name)){
        const e=matches(n.path);if(e)this.tags.set(n.name==='body'?'Body':n.name,e);
      }
    }
    // Original graphs have no serialized Collider records; the contraguia's native circle is supplied by the asset manifest.
    const cc=this.resources.controls?.characterColliders?.contraguia||{kind:'CircleCollider2D',center:[-1,0],radius:.1,enabled:1};
    this.addCollider(this.contraEntity,cc,true);
    this.cameraEntity=this.entity('Main Camera','MainCamera',simpleTransform([0,0,-10]));this.cameraEntity.components.Camera={orthographicSize:3.5,transform:this.cameraEntity.transform};
    this.canvasEntity=this.entity('Canvas','canvas');this.makeUI();
    this.audioMartillo=this.entity('AudioMartillo');this.audioMartillo.components.AudioSource=this.source('knock',this.resources.assets.audioByName['llamador x1']);
    this.gestorEntity=this.entity('gestor','gestor');
    this.entity('checkpoint').components.Text={enabled:false};this.entity('marcoCron').components.Image={enabled:true};this.entity('marcoBarra').components.Image={enabled:true};
  }
  makeUI(){
    const defs=this.tutorial?this.resources.controls.tutorial.step:this.resources.controls?.steps?.[this.step.code]||this.resources.controls?.controllers?.[this.step.code]||{};
    this.controlDefinitions=defs.buttons||[];
    this.buttons=Array.from({length:16},(_,i)=>{
      const d=this.controlDefinitions[i]||{},p=d.position||d.rect?.position||[0,-1000,0];
      const e=this.entity(d.name||'button-'+i,'',simpleTransform(p));e.transform.scale=from(d.scale||[1,1,1]);const b={index:i,interactable:i===15,enabled:true,transform:e.transform,entity:e,definition:d};e.components.Button=b;this.canvasEntity.children.push(e);return b;
    });
    const positions=defs.positions||{superior:-415,inferior:-635,fuera:-1700,encima:-245};
    for(const [tag,key]of [['botonSuperior','superior'],['botonInferior','inferior'],['botonFueraPantalla','fuera'],['botonEncimaSuperior','encima']])this.entity(tag,tag,simpleTransform([0,positions[key],0]));
    this.canvasEntity.components.Buttons=this.buttons;
    this.controller.botonesJuego=this.buttons;
  }
  addCollider(e,raw,moving){
    if(!e)throw new Error('Missing original collider '+raw.path);
    const c={...raw,enabled:!!raw.enabled,entity:e,transform:e.transform};
    if(moving&&raw.fields){
      const f=raw.fields,off=f.m_Offset||{x:0,y:0};
      if(raw.kind==='CircleCollider2D'){c.localCenter=[off.x,off.y];c.localRadius=f.m_Radius;}
      else if(raw.kind==='EdgeCollider2D')c.localPoints=f.m_Points.map(p=>[p.x+off.x,p.y+off.y]);
      else{const z=f.m_Size;c.localPoints=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>[off.x+x*z.x/2,off.y+y*z.y/2]);}
    }else if(moving){
      const m=e.transform.graph?e.transform.graph.worldMatrix(e.transform.id):[1,0,0,1,0,0];
      // game-data step collider points were exported before root heading; undo root rotation first.
      const heading=this.angle(this.stepEntity.transform)*DEG;
      let points=raw.points,center=raw.center;
      if(e.transform.graph===this.stepEntity.graph){const turn=p=>matrixPoint([Math.cos(heading),Math.sin(heading),-Math.sin(heading),Math.cos(heading),0,0],p);points=points?.map(turn);center=center&&turn(center);}
      const inv=inverse(m);c.localPoints=points?.map(p=>matrixPoint(inv,p));c.localCenter=center&&matrixPoint(inv,center);
      c.localRadius=raw.radius;
    }
    c.world=()=>{
      if(c._frame===this.frameCount)return c._world;
      let p=c.localPoints||c.points,center=c.localCenter||c.center,radius=c.localRadius||c.radius;
      if(moving){const m=e.transform.graph.worldMatrix(e.transform.id);p=p?.map(v=>matrixPoint(m,v));center=center&&matrixPoint(m,center);radius=radius*Math.hypot(m[0],m[1]);}
      c._frame=this.frameCount;c._world=c.kind==='CircleCollider2D'?{circle:true,center,radius}:{points:p,edge:c.kind==='EdgeCollider2D'};return c._world;
    };
    const t=raw.kind;e.components[t]=c;e.components.Collider2D??=c;if(!e.components.Colliders)e.components.Colliders=[];e.components.Colliders.push(c);
    return c;
  }
  setupController(){
    const c=this.controller,a=this.resources.assets.controllers[this.step.code];
    if(this.tutorial){for(const [k,v]of Object.entries(this.resources.controls.tutorial.step.fields))if(v?.asset)c[k]=v.asset;}else Object.assign(c,a.audio,a.sprites);
    c.animator=this.tags.get('Body')?.components.Animator||[...this.stepEntity.graph.animators.values()].find(a=>a.controllerName==='paso');
    c.animManig=[...this.stepEntity.graph.animators.values()].find(a=>a!==c.animator&&/manig/.test(a.controllerName||a.name||''))||new OriginalAnimator(this.resources.animation,'manigueteros');
    const aux=[...this.stepEntity.graph.animators.values()].find(a=>['PenEstAux','PreJerAux','BesJudAux'].includes(a.controllerName));if(aux){c.plumas=aux;c.preJerAux=aux;c.besJudAux=aux;}c.pistaYAutor={enabled:false,transform:simpleTransform()};c.pistaYAutorTexto={enabled:false,transform:simpleTransform(),text:''};
    c.animBarra=new OriginalAnimator(this.resources.animation,'barra');
    c.barraResist={transform:simpleTransform()};c.silueta={transform:simpleTransform(),sprite:c.costDesc};c.cronometro={transform:simpleTransform(),text:'00:00',color:[1,1,1,1]};c.records={transform:simpleTransform()};
    c.musicaPaso=this.source('music',c.murmullo);c.vozCapataz=this.source('voice');
    c.libre=this.mode==='practice'?1:0;c.checkpointInt=0;c.gameOver=false;c.mapaElegido=this.map.id;
  }
  setupMap(){
    if(this.tutorial){for(const [k,v]of Object.entries(this.resources.controls.tutorial.map.fields))this.mapController[k]=Array.isArray(v)?v.map(x=>this.keys.get(x.key)?.transform):v?.asset||v;return;}
    const m=this.mapController,d=this.resources.controls?.maps?.[this.map.id]||{};
    Object.assign(m,d.numeric||{});
    m.velocidadCortejoCap=d.fields?.velocidadCortejoCap??d.velocidadCortejoCap??.1;
    m.velocidadCortejoCont=d.fields?.velocidadCortejoCont??d.velocidadCortejoCont??.075;
    const nodeArray=(name)=>this.map.nodes.filter(n=>n.path.includes('/'+name+'/')&&/^punto\d+$/.test(n.name)).sort((a,b)=>Number(a.name.slice(5))-Number(b.name.slice(5))).map(n=>this.mapEntities.get(n.path).transform);
    const resolve=r=>this.mapEntities.get(this.resources.controls.nodes[r.nodeKey].path).transform;m.puntosDestino=d.puntosDestino.map(resolve);m.puntosCortejo=d.puntosCortejo.map(resolve);
    m.llamadorPor1=this.resources.assets.audioByName['llamador x1'];m.llamadorPor3=this.resources.assets.audioByName['llamador x3'];
  }
  source(channel,clip=null){const s={channel,clip,time:0,playing:false,loop:channel==='music',mute:false,volume:1};this.sources.push(s);return s;}
  position(t){if(t.graph)return from(t.graph.worldPosition(t.id));return t.position;}
  angle(t){return t.graph?t.graph.worldAngle(t.id):t.angle||0;}
  setPosition(t,p,local=false){if(t.graph){if(local)t.graph.setLocalPosition(t.id,p);else t.graph.setWorldPosition(t.id,p);}else{t.position=from(p);t.localPosition=from(p);}}
  setAngle(t,v){if(t.graph)t.graph.setWorldAngle(t.id,v);else t.angle=v;}
  getComponents(e,type,recursive=false){
    if(!e)return[];
    if(type==='Transform')return[e.transform];
    let own=type==='Collider2D'?(e.components.Colliders||[]):e.components[type]?[e.components[type]]:[];
    if(type==='Button'&&e===this.canvasEntity)return this.buttons;
    if(recursive)own=[...own,...e.children.filter(c=>c.active).flatMap(c=>this.getComponents(c,type,true))];
    return own;
  }
  send(e,message,value){
    if(e===this.gestorEntity){
      if(message==='records')this.pendingWin=value;
      if(message==='aplausos')this.playApplause();
      return;
    }
    if(e===this.cameraEntity&&(message==='gameOverMet'||message==='exitoMet')){
      if(this.state.status!=='playing')return;
      if(message==='gameOverMet'){this.state.status='failed';this.emit('failed',{reason:REASONS[this.prefs.motivoGameOver]||'Ahí quedó…',reasonId:this.prefs.motivoGameOver});}
      else{this.state.status='won';this.playApplause();this.emit('won',{time:this.controller.tiempo,stamps:this.medalsFor(this.controller.tiempo)});}
      return;
    }
    const script=e?.script;if(script&&this.resources.code.methods[script.__type+'.'+message])this.vm.invoke(script.__type+'.'+message,script,value===undefined?[]:[value]);
  }
  playApplause(){const a=this.resources.assets.audioByName[this.step.code==='DivMis'?'aplausos y silencio':'aplausos']||this.resources.assets.audioByName['aplausos'];if(a)this.emit('audio',{channel:'effect',clip:a,loop:false,volume:.7});}
  medalsFor(time){const c=this.controller;return time<=c.limiteActual?3:time<=c.limiteActual2?2:1;}
  native(m,o,a){
    const n=m.name,t=o?.transform||o?.entity?.transform;
    switch(n){
      case 'MonoBehaviour..ctor':case 'Object..ctor':return;
      case 'Color..ctor':return[a[0],a[1],a[2],a[3]??1];
      case 'Color.get_red':return[1,0,0,1];
      case 'Vector2..ctor':case 'Vector3..ctor':return vec(...a);
      case 'Vector2.op_Implicit':return vec(a[0].x,a[0].y,a[0].z||0);
      case 'Vector3.get_forward':return vec(0,0,1);
      case 'Vector3.op_Addition':return vec(a[0].x+a[1].x,a[0].y+a[1].y,a[0].z+a[1].z);
      case 'Vector3.op_Subtraction':return vec(a[0].x-a[1].x,a[0].y-a[1].y,a[0].z-a[1].z);
      case 'Vector3.op_Multiply':{const v=typeof a[0]==='number'?a[1]:a[0],s=typeof a[0]==='number'?a[0]:a[1];return vec(v.x*s,v.y*s,v.z*s);}
      case 'Vector3.Normalize':{const l=Math.hypot(o.x,o.y,o.z)||1;o.x/=l;o.y/=l;o.z/=l;return;}
      case 'Quaternion.Euler':return{angle:a[2]};
      case 'Quaternion.AngleAxis':return{angle:a[0]};
      case 'Quaternion.get_eulerAngles':return vec(0,0,((o.angle%360)+360)%360);
      case 'GameObject.Find':return this.names.get(a[0])||this.entity(a[0]);
      case 'GameObject.FindGameObjectWithTag':case 'GameObject.FindWithTag':return this.tags.get(a[0])||this.entity(a[0],a[0]);
      case 'GameObject.get_transform':case 'Component.get_transform':return t;
      case 'Component.get_tag':return o.tag||o.entity?.tag||'';
      case 'Component.GetComponent':case 'GameObject.GetComponent':case 'GameObject.GetComponentInChildren':{
        const e=o.components?o:o.entity||o.transform?.entity,typ=m.generic?.[0]||'Transform';
        if(e?.script?.__type===typ)return e.script;
        const found=this.getComponents(e,typ,n.includes('InChildren'))[0];
        if(found)return found;
        if(typ==='Animator'){const dummy=new OriginalAnimator(this.resources.animation,'barra');dummy.transform=e.transform;e.components.Animator=dummy;return dummy;}
        const dummy={enabled:true,transform:e.transform,entity:e};e.components[typ]=dummy;return dummy;
      }
      case 'GameObject.GetComponentsInChildren':return this.getComponents(o,m.generic?.[0],true);
      case 'GameObject.SendMessage':this.send(o,a[0],a[1]);return;
      case 'GameObject.SetActive':o.active=!!a[0];if(o.transform?.graph)o.transform.graph.nodes.get(o.transform.id).active=o.active;return;
      case 'Object.Destroy':if(a[0])a[0].active=false;return;
      case 'Object.Instantiate':if(/Pausa/.test(a[0]?.name||''))this.emit('pause');return a[0];
      case 'Object.op_Equality':case 'String.op_Equality':return a[0]===a[1]?1:0;
      case 'Object.op_Inequality':case 'String.op_Inequality':return a[0]!==a[1]?1:0;
      case 'Transform.get_position':return {...this.position(o)};
      case 'Transform.get_localPosition':return o.graph?from(o.graph.nodes.get(o.id).position):{...o.localPosition};
      case 'Transform.set_position':this.setPosition(o,array(a[0]));return;
      case 'Transform.set_localPosition':this.setPosition(o,array(a[0]),true);return;
      case 'Transform.set_localScale':if(o.graph)o.graph.setLocalScale(o.id,array(a[0]));else o.scale=a[0];return;
      case 'Transform.get_eulerAngles':return vec(0,0,((this.angle(o)%360)+360)%360);
      case 'Transform.get_rotation':return{angle:this.angle(o)};
      case 'Transform.set_rotation':this.setAngle(o,a[0].angle);return;
      case 'Transform.SetPositionAndRotation':this.setPosition(o,array(a[0]));this.setAngle(o,a[1].angle);return;
      case 'Transform.Rotate':this.setAngle(o,this.angle(o)+a[2]);return;
      case 'Transform.Translate':{
        let delta=a.length===3?vec(...a):a[0];if(a.length===3||a[1]===1)delta=rotate(delta,this.angle(o)*DEG);
        const p=this.position(o);this.setPosition(o,[p.x+delta.x,p.y+delta.y,p.z+delta.z]);return;
      }
      case 'Animator.StringToHash':return a[0];
      case 'Animator.GetCurrentAnimatorStateInfo':return {fullPathHash:o.fullPath||'Base Layer.'+o.state};
      case 'AnimatorStateInfo.get_fullPathHash':return o.fullPathHash;
      case 'Animator.SetBool':o.setBool(a[0],!!a[1]);return;
      case 'Animator.set_speed':o.speed=a[0];return;
      case 'Behaviour.set_enabled':case 'Renderer.set_enabled':o.enabled=!!a[0];if(o.graphSprite)o.graphSprite.enabled=o.enabled;return;
      case 'Selectable.set_interactable':o.interactable=!!a[0];return;
      case 'Selectable.get_interactable':return !!o.interactable;
      case 'Graphic.set_color':o.color=a[0];return;
      case 'Image.set_sprite':o.sprite=a[0];return;
      case 'Text.set_text':o.text=a[0];return;
      case 'Camera.get_orthographicSize':return o.orthographicSize;
      case 'Camera.set_orthographicSize':o.orthographicSize=a[0];return;
      case 'Mathf.Clamp':return clamp(a[0],a[1],a[2]);
      case 'Mathf.Abs':return Math.abs(a[0]);
      case 'Mathf.Atan2':return Math.atan2(a[0],a[1]);
      case 'Random.Range':{const v=this.resources.random?.()??Math.random();return Number.isInteger(a[0])&&Number.isInteger(a[1])?Math.floor(a[0]+v*(a[1]-a[0])):a[0]+v*(a[1]-a[0]);}
      case 'Int32.ToString':return String(Math.trunc(o)).padStart(a[0]==='00'?2:1,'0');
      case 'Single.ToString':return a[0]==='00'?String(Math.round(o)).padStart(2,'0'):String(o);
      case 'String.Concat':return (a.length===1&&Array.isArray(a[0])?a[0]:a).join('');
      case 'Time.get_deltaTime':return this.dt;
      case 'Time.get_timeScale':return this.timeScale;
      case 'Time.set_timeScale':this.timeScale=a[0];return;
      case 'Input.GetMouseButtonDown':return !!this.inputClick;
      case 'Input.GetKeyDown':return false;
      case 'Debug.Log':return;
      case 'Time.get_frameCount':return this.frameCount;
      case 'Time.get_timeSinceLevelLoad':return this.levelTime;
      case 'PlayerPrefs.GetInt':case 'PlayerPrefs.GetFloat':return Number(this.prefs[nativeRecordKey(a[0],this.step.variant,this.map.variant)]||0);
      case 'PlayerPrefs.SetInt':case 'PlayerPrefs.SetFloat':this.prefs[nativeRecordKey(a[0],this.step.variant,this.map.variant)]=a[1];return;
      case 'WaitForSeconds..ctor':return{wait:a[0]};
      case 'WaitForSecondsRealtime..ctor':return{wait:a[0],realtime:true};
      case 'MonoBehaviour.StartCoroutine':{
        const iterator=typeof a[0]==='string'?this.vm.invoke(o.__type+'.'+a[0],o):a[0];
        const task={iterator,remaining:0};this.resumeCoroutine(task);if(!task.done)this.coroutines.push(task);return task;
      }
      case 'AudioSource.set_clip':o.clip=a[0];o.time=0;o.playing=false;return;
      case 'AudioSource.get_clip':return o.clip;
      case 'AudioSource.get_time':return o.time;
      case 'AudioClip.get_length':return o?.duration||0;
      case 'AudioSource.set_loop':o.loop=!!a[0];return;
      case 'AudioSource.set_mute':o.mute=!!a[0];this.emit('audioMute',{channel:o.channel,mute:o.mute});return;
      case 'AudioSource.set_volume':o.volume=a[0];return;
      case 'AudioSource.Play':o.playing=true;o.time=0;if(o.clip)this.emit('audio',{channel:o.channel,clip:o.clip,loop:o.loop,volume:o.volume,mute:o.mute});return;
      case 'AudioSource.Stop':o.playing=false;this.emit('audioStop',{channel:o.channel});return;
      case 'Collider2D.IsTouching':return touching(o,a[0]);
      case 'SceneManager.LoadScene':this.emit('scene',{index:a[0]});return;
      default:throw new Error('Unsupported Unity call: '+n);
    }
  }
  resumeCoroutine(task){
    const it=task.iterator;
    if(!it){task.done=true;return;}
    if(!this.vm.invoke(it.__type+'.MoveNext',it)){task.done=true;return;}
    task.remaining=it.$current?.wait??0;
    task.realtime=!!it.$current?.realtime;
  }
  command(index){
    if(this.state.status!=='playing'||!this.buttons[index]?.interactable)return false;
    const name=this.controlDefinitions[index]?.method||['alanteMet','derAlMet','izqAlMet','pararseMet','derAtMet','izqAtMet','masPasMet','menosPasMet','martilloMet','flexMet','pararseMet','derAlMet','izqAlMet','masGirMet','menosGirMet'][index];
    if(index===15){this.emit('pause');return true;}this.vm.invoke(this.className+'.'+name,this.controller);return true;
  }
  tick(dt){
    if(this.state.status!=='playing')return;
    const unscaled=Math.min(Math.max(dt,0),.05);this.dt=unscaled*this.timeScale;this.levelTime+=this.dt;this.frameCount++;
    for(const s of this.sources)if(s.playing){const real=this.resources.audioClock?.(s);s.time=typeof real==='number'?real:s.time+this.dt;if(s.loop&&s.time>s.clip?.duration)s.time=0;}
    for(const task of [...this.coroutines]){task.remaining-=task.realtime?unscaled:this.dt;if(task.remaining<=0&&!task.done)this.resumeCoroutine(task);}
    this.coroutines=this.coroutines.filter(c=>!c.done);
    // Same passing checkpoint rule for every original map, without arriado.
    if(!this.tutorial&&!this.routeAdapter&&!this.mapController.zonaInterPasada&&!this.controller.martillo&&!['prelevanta','pasoBajado'].includes(this.controller.animator.state)){
      const zone=this.mapColliders.find(c=>c.entity.tag==='zonaInter'),p=this.position(this.stepEntity.transform);
      if(zone&&pointInPolygon([p.x,p.y],zone.world().points)){this.mapController.zonaInterPasada=true;this.controller.checkpointInt=1;this.prefs.checkpoint=1;this.prefs.checkpointGuardado=1;}
    }
    this.vm.invoke(this.className+'.Update',this.controller);
    if(!this.routeAdapter)this.vm.invoke(this.mapClass+'.Update',this.mapController);
    this.vm.invoke('cameraController.Update',this.cameraController);
    for(const g of this.graphs)g.advance(this.dt);
    this.vm.invoke(this.className+'.LateUpdate',this.controller);
    if(this.routeAdapter)this.routeAdapter.tick();
    this.vm.invoke('cameraController.LateUpdate',this.cameraController);
    this.sync();
    if(!this.tutorial&&this.names.get('checkpoint')?.components.Text)this.names.get('checkpoint').components.Text.enabled=false;
    this.inputClick=false;
    if(this.state.status==='playing'&&this.prefs.checkpointGuardado&&!this.checkpointState){this.checkpointState=this.snapshot();this.emit('checkpoint');}
  }
  sync(){
    const p=this.position(this.stepEntity.transform),c=this.controller;
    Object.assign(this.state,{x:p.x,y:p.y,angle:-this.angle(this.stepEntity.transform)*DEG,time:c.tiempo||0,stamina:c.resistencia/c.maxResist*100,checkpointPassed:!!this.mapController.zonaInterPasada,lifted:!['prelevanta','pasoBajado'].includes(c.animator.state),flex:!!c.flex,animation:c.animator.state,stride:c.zancada,turn:c.giro});
    const cp=this.position(this.cameraEntity.transform);this.camera={x:cp.x,y:cp.y,angle:this.angle(this.cameraEntity.transform)*DEG,size:this.cameraEntity.components.Camera.orthographicSize};
  }
  snapshot(){
    const serialize=s=>Object.fromEntries(Object.entries(s).filter(([k,v])=>!k.startsWith('__')&&(['number','boolean','string'].includes(typeof v))));
    return {route:this.routeAdapter?.snapshot(),state:{...this.state},controller:serialize(this.controller),mapController:serialize(this.mapController),prefs:{...this.prefs},levelTime:this.levelTime,graphs:this.graphs.map(g=>({name:g.name||g.graphName||g.root.name,nodes:[...g.nodes.values()].map(n=>({id:n.id,position:[...n.position],scale:[...n.scale],rotation:[...n.rotation]})),animators:[...g.animators].map(([id,a])=>({id,state:a.state,time:a.time,params:{...a.params},speed:a.speed}))}))};
  }
  restore(snapshot){
    if(!snapshot.controller)return;
    Object.assign(this.controller,snapshot.controller);Object.assign(this.mapController,snapshot.mapController);Object.assign(this.prefs,snapshot.prefs);
    this.levelTime=snapshot.levelTime||0;
    for(let i=0;i<this.graphs.length;i++){
      const g=this.graphs[i],saved=snapshot.graphs?.[i];if(!saved||g===this.routeAdapter?.graph)continue;
      for(const n of saved.nodes){const target=g.nodes.get(n.id);if(target)Object.assign(target,n);}
      for(const record of saved.animators){const a=g.animators.get(record.id);if(a){Object.assign(a.params,record.params);a.play(record.state,record.time/a.machine.states.find(s=>s.name===record.state).motions.map(m=>a.data.clips[m.clip]?.duration||1)[0]);a.speed=record.speed;}}
      g.applyAnimations();
    }
    this.controller.estadoanimator={fullPathHash:'Base Layer.__restore'};this.vm.invoke(this.className+'.LateUpdate',this.controller);this.coroutines=[];
    this.controller.musicaPaso.clip=this.controller.murmullo;this.native({name:'AudioSource.Play'},this.controller.musicaPaso,[]);
    this.state.status='playing';
    this.routeAdapter?.restore(snapshot.route);
  }
  drainEvents(){const e=this.events;this.events=[];return e;}
}
