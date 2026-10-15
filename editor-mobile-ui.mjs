// Mobile-only UI: reuses the same editor events, models and local storage.
// No game/editor geometry or serialization is modified here.
const mobileQuery=window.matchMedia('(max-width:850px), (max-height:600px) and (pointer:coarse)');
const body=document.body;
const sidebar=document.querySelector('.sidebar');
const toolbar=document.querySelector('.toolbar');
const canvas=document.querySelector('#editor-canvas');
let details=[...sidebar.querySelectorAll('details')];
const originalOpen=new Map(details.map(el=>[el,el.open]));
const byId=id=>document.getElementById(id);
const quick=[...document.querySelectorAll('.mobile-quick [data-mobile-tool]')];
const more=byId('mobile-more'),options=byId('mobile-options'),headerOptions=byId('mobile-header-settings');

function closeSheets(){
 body.classList.remove('mobile-tools-open','mobile-settings-open');
 for(const button of [more,options,headerOptions])button?.setAttribute('aria-expanded','false');
}
function toggleSheet(sheet){
 if(!mobileQuery.matches)return;
 const active=body.classList.contains('mobile-'+sheet+'-open');
 closeSheets();
 if(active)return;
 body.classList.add('mobile-'+sheet+'-open');
 const trigger=sheet==='tools'?more:options;
 trigger?.setAttribute('aria-expanded','true');
 if(sheet==='settings')headerOptions?.setAttribute('aria-expanded','true');
 if(sheet==='settings')openRelevantSettings();
}
function openRelevantSettings(){
 details=[...sidebar.querySelectorAll('details')];
 const current=canvas.dataset.tool;
 const choose={
  'review-start':'engine-review-panel','collision-draw':'collision-panel','collision-select':'collision-panel','route-event':'route-config-panel','route-select':'route-config-panel',house:'Tejados',road:'Pavimentos',sidewalk:'Pavimentos',tree:'Árboles',
  people:'Público', 'people-row':'Público',erase:'Público',
  fence:'Vallas', 'fence-row':'Vallas',chair:'Vallas','chair-row':'Vallas',
  urban:'urban-panel',reference:'photo-guides-panel',paso:'start-panel',
  'street-name':'street-label-panel',select:'selection-editor-panel',custom:'custom-assets-panel','custom-row':'custom-assets-panel',template:'templates-panel',measure:'precision-panel',split:'precision-panel',hole:'precision-panel','vertex-add':'precision-panel','vertex-remove':'precision-panel'
 };
 const paintTools=['house','road','sidewalk','tree','people','people-row','fence','fence-row','chair','chair-row','urban','sign','checkpoint','street-name','paso','reference'];
 const target=paintTools.includes(current)?'placement-preview-panel':choose[current];
 let section=details[0];
 if(target){
  section=details.find(el=>el.id===target||el.querySelector('summary')?.textContent.includes(target))||section;
 }
 section.open=true;
 requestAnimationFrame(()=>{
  // Scroll the drawer only; avoid moving the map while adjusting a property.
  sidebar.scrollTop=Math.max(0,section.offsetTop-sidebar.offsetTop-70);
 });
}
function syncActiveTool(){
 const name=canvas.dataset.tool||'pan';
 for(const button of quick){
  const active=button.dataset.mobileTool===name;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 }
 const drawing=['road','sidewalk','house','hole','collision-draw'].includes(name);
 body.classList.toggle('mobile-polygon-mode',drawing&&mobileQuery.matches);
 body.classList.toggle('mobile-paso-mode',name==='paso'&&mobileQuery.matches);
}
function switchLayout(){
 details=[...sidebar.querySelectorAll('details')];
 closeSheets();
 if(mobileQuery.matches){
  details.forEach((el,i)=>{el.open=i===0});
 }else{
  details.forEach(el=>{el.open=originalOpen.get(el)??el.open});
 }
 syncActiveTool();
 // Existing map renderer already listens for resize: keep geometry untouched.
 window.dispatchEvent(new Event('resize'));
}
for(const b of quick)b.addEventListener('click',()=>{
 const original=toolbar.querySelector('[data-tool="'+b.dataset.mobileTool+'"]');
 original?.click();
 closeSheets();
 syncActiveTool();
});
toolbar.addEventListener('click',e=>{
 if(!mobileQuery.matches||!e.target.closest('[data-tool]'))return;
 closeSheets();
 requestAnimationFrame(syncActiveTool);
});
more.addEventListener('click',()=>toggleSheet('tools'));
options.addEventListener('click',()=>toggleSheet('settings'));
headerOptions.addEventListener('click',()=>toggleSheet('settings'));
document.addEventListener('editor-open-panel',event=>{
 if(!mobileQuery.matches)return;closeSheets();body.classList.add('mobile-settings-open');options.setAttribute('aria-expanded','true');headerOptions.setAttribute('aria-expanded','true');const section=byId(event.panelId);if(section){section.open=true;requestAnimationFrame(()=>{sidebar.scrollTop=Math.max(0,section.offsetTop-sidebar.offsetTop-70)})}
});
document.addEventListener('editor-tool-selected',()=>{if(mobileQuery.matches){closeSheets();syncActiveTool()}});
byId('mobile-tools-close').addEventListener('click',closeSheets);
byId('mobile-settings-close').addEventListener('click',closeSheets);
byId('mobile-backdrop').addEventListener('click',closeSheets);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&mobileQuery.matches&&
    (body.classList.contains('mobile-tools-open')||body.classList.contains('mobile-settings-open'))){
  closeSheets();e.stopPropagation();
 }
});
for(const [mobileId,originalId] of [
 ['mobile-save','save'],['mobile-export','export'],['mobile-publish','publish'],
 ['mobile-finish','finish-shape'],['mobile-cancel','cancel-shape']
]){
 byId(mobileId).addEventListener('click',()=>{
  if(mobileId==='mobile-export'||mobileId==='mobile-publish')closeSheets();
  byId(originalId).click();
 });
}
const observer=new MutationObserver(syncActiveTool);
observer.observe(canvas,{attributes:true,attributeFilter:['data-tool']});
mobileQuery.addEventListener('change',switchLayout);
switchLayout();
