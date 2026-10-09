// Presentation-only campaign catalogue. Stable IDs are ready for future content;
// no unlock conditions, brotherhood records or economy exist in this phase.
export const HOLY_WEEK_DAYS=Object.freeze([
 ['viernes-dolores','Viernes de Dolores'],['sabado-pasion','Sábado de Pasión'],
 ['domingo-ramos','Domingo de Ramos'],['lunes-santo','Lunes Santo'],
 ['martes-santo','Martes Santo'],['miercoles-santo','Miércoles Santo'],
 ['jueves-santo','Jueves Santo'],['madruga','Madrugá'],
 ['viernes-santo','Viernes Santo'],['sabado-santo','Sábado Santo'],
 ['domingo-resurreccion','Domingo de Resurrección']
].map(([id,name])=>Object.freeze({id,name})));
export function dayPresentation({stars=0,total=null,status='planned'}={}){
 return {stars:total===null?`${stars} ★`:`${stars} / ${total} ★`,status,
  label:({planned:'Por preparar',available:'Disponible',locked:'🔒 Bloqueado',completed:'✓ Completado'})[status]||'Por preparar'};
}
export function createModeNavigation({document,onScreen,onLegacy,onSettings,onNotice,onWeek,onDay}){
 const get=id=>document.getElementById(id);
 const show=name=>onScreen(name);
 const home=()=>show('home-screen');
 get('mode-week').onclick=()=>{onWeek?.();show('week-screen');};
 get('mode-brotherhood').onclick=()=>show('brotherhood-screen');
 get('mode-free').onclick=()=>onLegacy('ButtonJugar');
 get('mode-settings').onclick=onSettings;
 get('mode-information').onclick=()=>show('information-screen');
 for(const id of ['week-back','brotherhood-back','information-back'])get(id).onclick=home;
 get('new-brotherhood').onclick=()=>onNotice('La fundación de tu hermandad estará disponible próximamente.');
 const actions={'info-pasos':'ButtonPasos','info-records':'ButtonRecords','info-instructions':'ButtonInstrucciones','info-tutorial':'ButtonTutorial','info-credits':'ButtonCreditos','info-original':'',};
 for(const [id,native]of Object.entries(actions))get(id).onclick=()=>onLegacy(native);
 const cards=[];
 for(const day of HOLY_WEEK_DAYS){
  const card=document.createElement('button'),title=document.createElement('strong'),progress=document.createElement('span'),status=document.createElement('small'),view=dayPresentation();
  card.className='day-card';card.dataset.dayId=day.id;card.dataset.status=view.status;card.setAttribute('aria-pressed','false');
  title.textContent=day.name;progress.className='day-stars';progress.textContent=view.stars;status.className='day-status';status.textContent=view.label;
  card.append(title,progress,status);card.onclick=()=>{for(const item of cards)item.setAttribute('aria-pressed',String(item===card));get('day-message').textContent=`${day.name}: las hermandades y sus recorridos llegarán próximamente.`;onDay?.(day.id);};cards.push(card);
 }
 get('day-list').replaceChildren(...cards);
 return {home,show,days:HOLY_WEEK_DAYS};
}
