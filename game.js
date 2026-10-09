import {applyContentNames,contentStepForNative,CONTENT_STEPS,displayContentName} from './content-catalogue.mjs';
import {CAMPAIGN_DATA} from './campaign-data.mjs';
import {createProgress,finishCampaign,CampaignAttempt,formatCampaignTime} from './campaign-progress.mjs';
import {createCampaignUI} from './campaign-ui.mjs';
import {DEVELOPMENT_UNLOCKS,visibleCampaignProgress} from './development-mode.mjs';
import {createModeNavigation} from './mode-navigation.mjs';
import {createImageLoader,loadSceneImages} from './image-loader.mjs';
import {NEW_ROUTE,customMap,installCustomRouteMenu} from './custom-routes.mjs';
import {prepareMap,prepareStep} from './engine.mjs';
import {OriginalSimulation} from './original-engine.mjs';
import {OriginalMenus} from './original-menu.mjs';
import {OriginalLayout} from './original-ui.mjs';
import {Renderer} from './renderer.mjs';
import {Sound} from './audio.mjs';
import {JESUS_PENAS,customStep,recordKey,installCustomStepMenu,installCustomInfoMenu,drawCustomStepDiagram,customProgress} from './custom-steps.mjs';
let customMenu,modeNavigation,allowLegacyHome=false;
const $=id=>document.getElementById(id),KEY='chicotaz-original-web-v2';
const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const recordFormat=t=>format(t)+'.'+String(Math.floor(t*100)%100).padStart(2,'0');
let saved={prefs:{version:2,numEstampitas:0,libre:0,pasoElegido:1,mapaElegido:1,himnoMapa:0},settings:{enabled:true,musicMenu:1,musicGameplay:1,voice:1,knock:1,applause:1},active:null};
try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old)saved={...saved,...old,prefs:{...saved.prefs,...old.prefs},settings:{...saved.settings,...old.settings}};}catch{}
saved.campaign=createProgress(CAMPAIGN_DATA,saved.campaign);
let campaignRun=null,campaignUI;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved));return true;}catch{return false;}};
function saveCampaign(){if(!save())toast('No se ha podido guardar el progreso. Comprueba el espacio del navegador.',6);}
let r,raw,maps,steps,sim,menus,hud,overlay,screen='loader',back='menu',time=0,last=0,lastSave=0,toastUntil=0,loading=0,tutorialPage=1;
const renderer=new Renderer($('scene')),images=new Map();
let buttonElements=[];
const sound=new Sound(saved.settings,(playing,clip,channel,message)=>{if(playing){$('sound-state').textContent='Sonido activo.';if(channel==='music'&&clip&&!/murmullo|Redoble/i.test(clip.name))$('now-playing').textContent=clip.name;}else if(message){$('sound-state').textContent=message;toast(message,4);}});
const loadImage=createImageLoader({cache:images});
let retryLoad=boot;
function toast(text,seconds=3){$('toast').textContent=text;$('toast').classList.add('visible');toastUntil=performance.now()+seconds*1000;}
function resize(){const app=$('app');renderer.resize(app.clientWidth,app.clientHeight,window.devicePixelRatio||1);hud?.resize();overlay?.resize();menus?.resize();hideUnavailableCampaignCheckpoint();updateHud();}
function setScreen(name){
 screen=name;for(const id of ['loader','entry','menu','selection','pause','result','settings-screen','help','tutorial-screen','records-screen','credits-screen','home-screen','week-screen','brotherhood-screen','information-screen','campaign-day-screen','campaign-brotherhood-screen','campaign-step-screen','campaign-route-screen','campaign-result-screen','campaign-reset-screen'])$(id).hidden=id!==name;
 $('hud').hidden=!['game','pause','result'].includes(name);$('scene').hidden=!['game','pause','result'].includes(name);
 if(name==='game')last=performance.now();
}
function unlock(){sound.unlock(r?.assets.audioByName['llamador x1']);}
function mainMenu(){
 const wasCampaign=!!campaignRun;if(campaignRun)campaignRun.clock.pause(performance.now());saveActive();campaignRun=null;if(wasCampaign)sim=null;overlay?.destroy();overlay=null;sound.stopAll();sound.paused=false;setScreen('menu');
 saved.prefs.checkpoint=0;saved.prefs.checkpointGuardado=0;
 menus.show('MenuInicio');sound.play('menu',r.assets.audioByName['musica menu test 3'],{loop:true});save();
}
function beginCampaign(id,attempt=null,snapshot=null){
 const route=CAMPAIGN_DATA.routes.find(r=>r.id===id);if(!route||route.playable===false||(!DEVELOPMENT_UNLOCKS&&!saved.campaign.unlocked.routes.includes(id))){toast('Este recorrido todavía está bloqueado.');return;}
 overlay?.destroy();overlay=null;campaignRun=attempt||new CampaignAttempt(route);startGame(2,snapshot);
}
function resumeCampaign(id,fromCheckpoint=false){
 const active=saved.campaign.active;if(active?.routeId!==id)return;const route=CAMPAIGN_DATA.routes.find(r=>r.id===id),attempt=new CampaignAttempt(route,active);
 if(fromCheckpoint){if(!attempt.checkpoint)return;const next=attempt.retryFromCheckpoint();beginCampaign(id,next,next.checkpoint.snapshot);}
 else if(active.phase!=='failed'&&active.snapshot)beginCampaign(id,attempt,active.snapshot);
}
function retryCampaign(fromCheckpoint=false){
 if(!campaignRun)return;campaignRun.clock.pause(performance.now());
 if(fromCheckpoint){if(!campaignRun.checkpoint){toast('No hay un checkpoint disponible.');return;}const next=campaignRun.retryFromCheckpoint();beginCampaign(next.route.id,next,next.checkpoint.snapshot);}
 else beginCampaign(campaignRun.route.id);
}
function campaignResult(e){
 campaignRun.clock.pause(performance.now());campaignRun.stopped=true;
 let outcome=null;
 if(e.type==='won')outcome=finishCampaign(CAMPAIGN_DATA,saved.campaign,campaignRun.route.id,campaignRun.clock.elapsedMs,campaignRun.assisted,sim.routeAdapter?.presentationIds||[],DEVELOPMENT_UNLOCKS);
 else saved.campaign.active={...campaignRun.snapshot(),phase:'failed',snapshot:null};
 saveCampaign();campaignUI.result(campaignRun.route,campaignRun,e,outcome);
 if(outcome?.newlyUnlocked.length){const names=outcome.newlyUnlocked.map(({kind,id})=>CAMPAIGN_DATA[kind].find(x=>x.id===id)?.name).filter(Boolean);toast('NUEVO CONTENIDO DESBLOQUEADO\n'+names.join(' · '),6);}
}
function openLegacyAction(button){
 if(campaignRun){campaignRun.clock.pause(performance.now());saveActive();sim=null;}campaignRun=null;unlock();allowLegacyHome=true;try{menus.show('MenuInicio');}finally{allowLegacyHome=false;}
 if(button){const node=menus.find(button).node;if(node)menus.click(node);}
}
function updatePrefsForNative(){saved.prefs.musicaMenu=saved.settings.musicMenu;saved.prefs.musicaGameplay=saved.settings.musicGameplay;saved.prefs.vozCapataz=saved.settings.voice;saved.prefs.llamador=saved.settings.knock;saved.prefs.aplausos=saved.settings.applause;}
function settings(){back=screen==='game'?'pause':screen;setScreen('settings-screen');$('sound-enable').textContent=saved.settings.enabled?'Reactivar sonido':'Activar sonido';}
function closePanel(){if(back==='pause')setScreen('pause');else mainMenu();}
function buildVolumes(){
 const defs=[['musicMenu','Menú principal'],['musicGameplay','Marchas'],['voice','Capataz'],['knock','Llamador'],['applause','Aplausos']];
 $('volumes').replaceChildren(...defs.map(([key,name])=>{const label=document.createElement('label');label.append(document.createTextNode(name));const out=document.createElement('output');out.value=Math.round(saved.settings[key]*100)+'%';const input=document.createElement('input');input.type='range';input.min=0;input.max=100;input.value=saved.settings[key]*100;input.setAttribute('aria-label',name);input.oninput=()=>{saved.settings[key]=Number(input.value)/100;out.value=input.value+'%';sound.update();updatePrefsForNative();save();};label.append(out,input);return label;}));
}
async function startGame(scene=2,snapshot=null){
 if(scene===1){mainMenu();return;}
 const run=++loading;if(campaignRun)sim=null;unlock();sound.stopAll();sound.paused=false;
 retryLoad=()=>startGame(scene,snapshot);$('load-retry').hidden=true;$('load-detail').textContent='Cargando la calle y la cuadrilla…';setScreen('loader');
 try{
  const tutorial=scene===4;
  const choice=campaignRun?.route;
  const chosenStep=CONTENT_STEPS.find(s=>s.id===choice?.stepRef);
  const map=tutorial?{id:0,nodes:[],name:'Tutorial'}:customMap(maps[Math.max(0,Math.min(9,((choice?.mapId||saved.prefs.mapaElegido)||1)-1))],choice?choice.mapKey:saved.prefs.customRoute,choice),step=tutorial?{id:0,code:'Tuto',nodes:[],name:'Tutorial'}:customStep(steps[Math.max(0,Math.min(6,((chosenStep?.engineId||choice?.stepId||saved.prefs.pasoElegido)||1)-1))],choice?(chosenStep?.engineVariant||choice.stepKey):saved.prefs.customStep);
  const resources={...r,prefs:saved.prefs,audioClock:s=>sound.clock(s)};
  const next=new OriginalSimulation(map,step,resources,tutorial?'tutorial':campaignRun?'career':saved.prefs.libre?'practice':'career',snapshot);
  await loadSceneImages(next,loadImage,images,(done,total)=>{if(run===loading)$('load-detail').textContent=`Cargando la calle y la cuadrilla… ${done}/${total}`;});
  if(run!==loading)return;
  sim=next;menus.destroy();hud?.destroy();hud=new OriginalLayout(r.layouts,tutorial?r.controls.tutorial.step.canvasKey:r.layouts.gameplayCanvases[step.code],$('original-hud'),{excludeButtons:true});
  buildButtons();$('now-playing').textContent='';
  document.querySelector('.hud-fallback').hidden=true;
  setScreen('game');resize();processEvents();saveActive();
 }catch(error){if(run!==loading)return;loading++;console.error(error);$('load-detail').textContent='No se ha podido terminar la carga. '+error.message;$('load-retry').hidden=false;}
}
function buildButtons(){
 buttonElements=sim.buttons.map((button,index)=>{const el=document.createElement('button'),d=button.definition;el.className='original-button';el.dataset.nativeButton=index;el.title=d.method;el.setAttribute('aria-label',({alanteMet:'De frente',derAlMet:'Derecha alante',izqAlMet:'Izquierda alante',pararseMet:'Pararse / paso atrás',derAtMet:'Derecha atrás',izqAtMet:'Izquierda atrás',masPasMet:'Abrir zancada',menosPasMet:'Cerrar zancada',martilloMet:'Levantar / arriar',flexMet:'Costeros a tierra / suspender',masGirMet:'Girar más',menosGirMet:'Girar menos',buttonPause:'Pausa'})[d.method]||d.name);const im=document.createElement('img');im.src=d.sprite.url;im.alt='';im.draggable=false;el.append(im);el.onclick=()=>{if(screen!=='game')return;unlock();sim.command(index);processEvents();updateHud();};return el;});$('original-buttons').replaceChildren(...buttonElements);
}
function originalOverlay(name,target){
 overlay?.destroy();const root=Object.values(r.layouts.roots).find(x=>x.name===name);$(target).classList.add('native-overlay');
 overlay=new OriginalLayout(r.layouts,root.key,$(target),{onClick:n=>{unlock();const method=n.button.onClick[0]?.m_MethodName;if(/^botonContinue/.test(method))resume();else if(method==='botonReintentarCheckpoint')retry(true);else if(method==='botonReintentar')retry();else if(method==='botonNext'){saved.prefs.mapaElegido=sim.map.id+1;startGame();}else if(/^botonSalirAMenu/.test(method))mainMenu();}});return overlay;
}
function updateHud(){
 if(!sim)return;
 const w=$('app').clientWidth,h=$('app').clientHeight,u=w/800,c=sim.controller,s=sim.state;
 for(let i=0;i<buttonElements.length;i++){
  const el=buttonElements[i],b=sim.buttons[i],p=b.transform.localPosition,scale=b.transform.scale||{x:1,y:1},rect=b.definition.rect;
  const tutorial=sim.tutorial,offset=tutorial?220-r.controls.tutorial.step.positions.superior:0;
  el.style.left=(i===15?(tutorial?w/2+p.x*u:w+p.x*u):w/2+p.x*u)+'px';el.style.top=(i===15?(tutorial?(offset-p.y)*u:-p.y*u):h-(p.y+offset)*u)+'px';el.style.width=rect.m_SizeDelta.x*u*Math.abs(scale.x)+'px';el.style.height=rect.m_SizeDelta.y*u*Math.abs(scale.y)+'px';el.disabled=!b.interactable;
  el.hidden=i!==15&&p.y+offset<=0;
 }
 hud?.setText('Cronometro',c.cronometro.text,c.cronometro.color);if(!sim.tutorial)hud?.setText('cronometro',`TL: ${format(c.limiteActual)}\nTL2: ${format(c.limiteActual2)}\nRA: ${format(saved.prefs[recordKey(sim.map,sim.step)]||0)}`);
 hud?.setImage('siluetaCost',c.silueta.sprite?.url);hud?.setScale('siluetaCost',c.silueta.transform.scale.x,c.silueta.transform.scale.y);
 hud?.setScale('Barra',1,s.stamina/100);
 if(sim.mode==='practice'){for(const n of ['marcoCron','Cronometro','cronometro','marcoBarra','Barra'])hud?.setVisible(n,false);}
 if(c.pistaYAutorTexto)hud?.setText('pistaYAutorTexto',c.pistaYAutorTexto.text||'');
 if(campaignRun){const time=formatCampaignTime(campaignRun.clock.elapsedMs).slice(0,-3);hud?.setText('Cronometro',time);hud?.setText('cronometro',`★★★ ${formatCampaignTime(campaignRun.route.threeStars*1000).slice(0,-3)}\n★★ ${formatCampaignTime(campaignRun.route.twoStars*1000).slice(0,-3)}`);}
 $('clock').textContent=campaignRun?formatCampaignTime(campaignRun.clock.elapsedMs).slice(0,-3):c.cronometro.text;$('strength-bar').style.height=s.stamina+'%';$('silhouette').src=c.silueta.sprite?.url||'';
}
function saveActive(){if(campaignRun){if(sim&&sim.state.status==='playing'){saved.campaign.active={...campaignRun.snapshot(),phase:'playing',snapshot:sim.snapshot()};saveCampaign();}return;}if(!sim||sim.tutorial||sim.state.status!=='playing')return;saved.active={map:sim.map.id,step:sim.step.id,customStep:sim.step.variant?.key||'',customRoute:sim.map.variant?.key||'',libre:sim.mode==='practice'?1:0,snapshot:sim.snapshot(),checkpoint:sim.checkpointState};save();}
function hideUnavailableCampaignCheckpoint(){
 if(!campaignRun||screen!=='pause'||!overlay)return;
 const nodes=overlay.data.roots[overlay.rootKey].nodes.map(key=>overlay.data.nodes[key]);
 for(const n of nodes)if(n.button?.onClick?.some(c=>c.m_MethodName==='botonReintentarCheckpoint'))for(const [key,el]of overlay.elements){const path=overlay.data.nodes[key].path;if(path===n.path||path.startsWith(n.path+'/'))el.hidden=!campaignRun.checkpoint;}
}
function pause(){if(screen!=='game')return;campaignRun?.clock.pause(performance.now());saveActive();sound.pause();$('checkpoint-retry').hidden=!sim.checkpointState;setScreen('pause');originalOverlay(sim.tutorial?(sim.timeScale?'MenuPausaTuto':'MenuPausaTutoSca0'):'MenuPausa','pause');hideUnavailableCampaignCheckpoint();}
function resume(){unlock();overlay?.destroy();overlay=null;sound.resume();setScreen('game');}
function retry(checkpoint=false){if(campaignRun){retryCampaign(checkpoint);return;}if(!sim)return;if(sim.tutorial){startGame(4);return;}saved.prefs.mapaElegido=sim.map.id;saved.prefs.pasoElegido=sim.step.id;saved.prefs.customStep=sim.step.variant?.key||'';saved.prefs.customRoute=sim.map.variant?.key||'';saved.prefs.libre=sim.mode==='practice'?1:0;startGame(2,checkpoint?sim.checkpointState:null);}
function result(e){
 if(campaignRun){campaignResult(e);return;}
 const won=e.type==='won';saved.active=null;const key=recordKey(sim.map,sim.step);const old=Number(saved.prefs[key]||0);let earned=0;
 if(won&&sim.mode==='career'){
  const previous=old?sim.medalsFor(old):0;earned=Math.max(0,e.stamps-previous);if(!old||e.time<old)saved.prefs[key]=e.time;saved.prefs.numEstampitas=(Number(saved.prefs.numEstampitas)||0)+earned;
 }
 $('result-title').textContent=won?'¡Has arriado correctamente!':'GAME OVER';
 $('result-message').textContent=won?(sim.mode==='practice'?'Recorrido libre completado.':earned?`Has ganado ${earned} estampita${earned===1?'':'s'} y has desbloqueado el siguiente nivel.`:'Has completado el recorrido. Mejora tu tiempo para conseguir las estampitas que te faltan.'):e.reason;
 $('result-time').textContent='Tiempo: '+format(sim.controller.tiempo);
 $('result-stamps').replaceChildren(...Array.from({length:earned},()=>{const im=document.createElement('img');im.src=r.assets.uiByName.estampita.url;im.alt='Estampita';return im;}));
 $('next').hidden=!won||sim.map.id===10||!!sim.map.variant;$('result-checkpoint').hidden=won||!sim.checkpointState;
 saved.prefs.estampitasNuevas=saved.prefs.numEstampitas;Object.assign(saved.prefs,sim.prefs,{numEstampitas:saved.prefs.numEstampitas,estampitasNuevas:saved.prefs.numEstampitas,[key]:saved.prefs[key]||0});
 save();setScreen('result');const view=originalOverlay(won?'menuExito':'menuGameOver','result');
 if(won){view.setText('Text',winMessage(e,old,earned));view.setText('recordAnterior',old?'Tiempo Anterior: '+recordFormat(old):'No había tiempo anterior');view.setText('nuevoRecord','Nuevo tiempo: '+recordFormat(e.time));view.setVisible('ButtonNext',sim.map.id<10&&!sim.map.variant);}
 else{view.setText('Text',e.reason);const el=view.elements.get(view.nodesByName.get('ButtonChekpoint'));if(el)el.disabled=!sim.checkpointState;}
}
function winMessage(e,old,earned){
 if(sim.map.variant)return 'Has completado '+sim.map.name+'. '+(sim.mode==='practice'?'Modo libre.':earned?'Has ganado '+earned+' estampita'+(earned===1?'':'s')+'.':'Tiempo guardado.');
 if(sim.mode==='practice')return 'Has completado el recorrido en modo libre.';
 if(!old)return ['','¡Bien!, has ganado una estampita y has desbloqueado el siguiente nivel','¡Genial!, has ganado dos estampitas y has desbloqueado el siguiente nivel','¡Increíble!, has ganado tres estampitas y has desbloqueado el siguiente nivel'][e.stamps];
 if(e.time>=old)return 'No has mejorado tu anterior tiempo.';
 if(earned===2)return '¡Genial! Has mejorado tu anterior tiempo y ganas las dos estampitas que te faltaban en este nivel';
 if(earned===1)return e.stamps===3?'¡Genial! Has mejorado tu anterior tiempo y ganas la estampita que te faltaba en este nivel':'¡Bien! Has mejorado tu anterior tiempo y ganas una estampita más, te sigue faltando una en este nivel';
 return e.stamps===3?'Has mejorado tu anterior tiempo y no ganas ninguna estampita porque ya conseguiste las tres':e.stamps===2?'Has mejorado tu anterior tiempo pero no has superado la venia rápida, te sigue faltando una estampita':'Has mejorado tu anterior tiempo pero no has superado la venia lenta, te siguen faltando dos estampitas';
}
function processEvents(){
 for(const e of sim.drainEvents()){
  if(e.type==='audio')sound.play(e.channel,e.clip,e);
  else if(e.type==='audioStop')sound.stop(e.channel);
  else if(e.type==='audioMute')sound.mute(e.channel,e.mute);
  else if(e.type==='pause')pause();
  else if(e.type==='checkpoint'){campaignRun?.captureCheckpoints(sim);saveActive();}
  else if(e.type==='won'||e.type==='failed')result(e);
  else if(e.type==='scene'){startGame(e.index);}
 }
}
function showTutorial(){back='menu';setScreen('tutorial-screen');tutorialPage=1;updateTutorial();}
function updateTutorial(){const clip=r.assets.uiByName['dialogo'+tutorialPage];$('tutorial-dialog').src=clip.url;$('tutorial-page').textContent=tutorialPage+' / 35';$('tutorial-prev').disabled=tutorialPage===1;$('tutorial-next').disabled=tutorialPage===35;}
function keyboard(event){
 if(event.code==='Escape'&&['week-screen','brotherhood-screen','information-screen','campaign-day-screen','campaign-brotherhood-screen','campaign-step-screen','campaign-route-screen'].includes(screen)){modeNavigation.home();return;}
 if(screen!=='game')return;if(event.code==='Escape'){pause();return;}if(event.repeat)return;
 const active=indices=>indices.find(i=>sim.buttons[i].interactable);
 const table={KeyW:[0],ArrowUp:[0],KeyS:[3,10],ArrowDown:[3,10],Space:[10,3],KeyA:[2,12],ArrowLeft:[2,12],KeyD:[1,11],ArrowRight:[1,11],KeyQ:[5],KeyC:[4],KeyE:[8],KeyF:[9],Equal:[6],NumpadAdd:[6],Minus:[7],NumpadSubtract:[7],BracketRight:[13],BracketLeft:[14]};
 const indices=table[event.code];if(!indices)return;event.preventDefault();const index=active(indices);if(index!==undefined){unlock();sim.command(index);processEvents();updateHud();}
}
function frame(now){
 const dt=Math.min((now-last)/1000,.05)||0;last=now;
 try{
  if(screen==='game'&&sim){sim.tick(dt);campaignRun?.observe(sim,now);processEvents();updateHud();if(now-lastSave>4000){saveActive();lastSave=now;}}
  else if(screen==='menu')menus?.tick(dt);
  if(sim&&['game','pause','result'].includes(screen))renderer.render(sim,images,screen==='game');
 }catch(e){console.error(e);if(screen==='game'){pause();toast('Se ha detenido la partida: '+e.message,8);}else if(screen==='menu')toast(e.message,6);}
 if(toastUntil&&now>toastUntil){$('toast').classList.remove('visible');toastUntil=0;}
 requestAnimationFrame(frame);
}
function bind(){
 $('enter').onclick=()=>{unlock();mainMenu();};
 $('classic').onclick=()=>{saved.prefs.libre=0;mainMenu();menus.show('MenuEligePaso');};$('free').onclick=()=>{saved.prefs.libre=1;mainMenu();menus.show('MenuEligePaso');};
 $('settings').onclick=settings;$('pause-settings').onclick=settings;
 $('resume').onclick=resume;$('retry').onclick=()=>retry();$('checkpoint-retry').onclick=()=>retry(true);$('pause-home').onclick=mainMenu;
 $('result-retry').onclick=()=>retry();$('result-checkpoint').onclick=()=>retry(true);$('result-home').onclick=mainMenu;
 $('next').onclick=()=>{saved.prefs.mapaElegido=sim.map.id+1;startGame();};
 $('game-sound').onclick=()=>{saved.settings.enabled=!saved.settings.enabled;unlock();sound.update();save();$('game-sound').textContent=saved.settings.enabled?'♪':'×';};
 $('sound-enable').onclick=()=>{saved.settings.enabled=true;unlock();sound.update();sound.resume();if(!['game','pause'].includes(back))sound.play('menu',r.assets.audioByName['musica menu test 3'],{loop:true});save();};
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closePanel);
 $('tutorial-prev').onclick=()=>{tutorialPage=Math.max(1,tutorialPage-1);updateTutorial();};$('tutorial-next').onclick=()=>{tutorialPage=Math.min(35,tutorialPage+1);updateTutorial();};$('tutorial-play').onclick=()=>{saved.prefs.libre=1;saved.prefs.mapaElegido=1;saved.prefs.pasoElegido=1;saved.prefs.customStep='';saved.prefs.customRoute='';startGame();};
 window.addEventListener('keydown',keyboard);window.addEventListener('resize',resize);window.addEventListener('pagehide',()=>{campaignRun?.clock.pause(performance.now());saveActive();});
 $('app').addEventListener('pointerdown',()=>{if(screen==='game'&&sim?.tutorial)sim.inputClick=true;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game')pause();});window.addEventListener('blur',()=>{if(screen==='game')pause();});
}
function customMenuReady(name,menu){
 if(name==='MenuEligeMapa'){const step=customStep(steps[(saved.prefs.pasoElegido||1)-1],saved.prefs.customStep),time=saved.prefs[recordKey(customMap(maps[0],NEW_ROUTE.key),step)]||0;const e=menu.objects.get(r.customRouteMenu.stamps);if(e?.components.Text)e.components.Text.text=(time?(time<=360?3:time<=480?2:1):0)+'/3';menu.refresh();}
 if(name==='MenuDefPasos'&&saved.prefs.customStep===JESUS_PENAS.key){
  const title=menu.find('Título').components.Text;if(title)title.text=CONTENT_STEPS.find(s=>s.id==='JesusPenas').name.toUpperCase();
  const diagram=menu.find('paso');diagram.components.Image.enabled=false;menu.refresh();
  const canvas=document.createElement('canvas');canvas.width=502;canvas.height=222;canvas.className='custom-step-diagram';canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  diagram.view.elements.get(diagram.key).append(canvas);
  loadImage(JESUS_PENAS.image).then(image=>drawCustomStepDiagram(canvas.getContext('2d'),image)).catch(error=>toast(error.message,6));
 }

 if(name==='MenuEligePaso'){
  const progress=customProgress(saved.prefs,(map,time)=>{const limits=r.code.limits.BueMue;return time<=limits['limiteBueMueMapa'+map]?3:time<=limits['limite2BueMueMapa'+map]?2:1;});
  for(const [key,text]of [[customMenu.stamps,String(progress.stamps).padStart(2,'0')+'/30'],[customMenu.levels,String(progress.levels).padStart(2,'0')+'/10']]){const e=menu.objects.get(key);if(e?.components.Text)e.components.Text.text=text;}
  menu.refresh();
 }
 if(name==='MenuEligeMapa'&&saved.prefs.customStep===JESUS_PENAS.key){const e=[...menu.objects.values()].find(e=>e.components.Text?.text==='ITINERARIOS');if(e){e.components.Text.text=CONTENT_STEPS.find(s=>s.id==='JesusPenas').name;menu.refresh();}}
}
async function boot(){
 try{
  const names=['game-data','original-code','original-assets','original-animation','runtime-controls','original-layouts'];
  const values=await Promise.all(names.map(async n=>{const response=await fetch('assets/'+n+'.json');if(!response.ok)throw new Error(n);return response.json();}));
  [raw]=values;r={code:values[1],assets:values[2],animation:values[3],controls:values[4],layouts:values[5]};
  maps=raw.maps.map(x=>({...prepareMap(x),...r.controls.menuMetadata.maps[x.id]}));steps=raw.steps.map(x=>({...prepareStep(x),...r.controls.menuMetadata.steps[x.code]}));
  document.documentElement.style.setProperty('--menu-image',`url('${r.assets.uiByName.fondomenu_02def.url}')`);document.documentElement.style.setProperty('--button-image',`url('${r.assets.uiByName.botonMenuAzul.url}')`);
  document.documentElement.style.setProperty('--entry-image',`url('${r.assets.uiByName.entrada.url}')`);
  $('stamp-image').src=r.assets.uiByName.estampita.url;$('controls-guide').src=r.assets.uiByName.menuDefControles.url;
  customMenu=installCustomStepMenu(r.layouts);installCustomInfoMenu(r.layouts);r.customRouteMenu=installCustomRouteMenu(r.layouts);applyContentNames(r.layouts);
  steps=steps.map(s=>({...s,name:contentStepForNative(s)?.name||s.name}));
  updatePrefsForNative();buildVolumes();
  menus=new OriginalMenus(r,$('menu'),{displayText:displayContentName,prefs:saved.prefs,unlock,save,start:startGame,settings,onError:e=>{console.error(e);toast(e.message,7);},toggleSound:value=>{saved.settings.enabled=value;sound.update();save();},muted:()=>!saved.settings.enabled,onClick:n=>{if(n.name==='ButtonMapaAlemanes'){saved.prefs.customRoute=NEW_ROUTE.key;saved.prefs.mapaElegido=1;save();startGame();return true;}if(/^ButtonMapa\d+$/.test(n.name)){saved.prefs.customRoute='';save();}if(n.name==='ButtonDefJesusPenas'){saved.prefs.customStep=JESUS_PENAS.key;saved.prefs.pasoElegido=1;save();menus.show('MenuDefPasos');return true;}if(n.name==='ButtonJesusPenas'){saved.prefs.customStep=JESUS_PENAS.key;saved.prefs.pasoElegido=1;save();menus.show('MenuEligeMapa');return true;}if(/^Button(?:Def)?(BueMue|DivMis|PenEst|PreJer|BesJud|TreReq|TreCai)$/.test(n.name)){saved.prefs.customStep='';save();}return false;},onReady:customMenuReady,onOpen:name=>{setScreen(name==='MenuInicio'&&!allowLegacyHome?'home-screen':'menu');$('menu').classList.add('native-menu');},openURL:url=>window.open(url,'_blank','noopener')});
  modeNavigation=createModeNavigation({document,onScreen:setScreen,onLegacy:openLegacyAction,onSettings:settings,onNotice:toast,onWeek:()=>campaignUI.week(),onDay:id=>campaignUI.day(id)});
  campaignUI=createCampaignUI({document,data:CAMPAIGN_DATA,getProgress:()=>visibleCampaignProgress(CAMPAIGN_DATA,saved.campaign),onScreen:setScreen,onStart:id=>beginCampaign(id),onResume:resumeCampaign,onRetry:()=>retryCampaign(false),onCheckpoint:()=>retryCampaign(true),onNotice:toast,onReset:()=>{saved.campaign=createProgress(CAMPAIGN_DATA);if(campaignRun){campaignRun=null;sim=null;overlay?.destroy();overlay=null;hud?.destroy();hud=null;back='home-screen';}saveCampaign();}});
  campaignUI.week();
  $('development-notice').hidden=!DEVELOPMENT_UNLOCKS;
  bind();resize();setScreen('entry');last=performance.now();requestAnimationFrame(frame);
 }catch(e){console.error(e);$('load-detail').textContent='No se ha podido cargar el juego. '+e.message;$('load-retry').hidden=false;}
}
$('load-retry').onclick=()=>retryLoad();
boot();
