// HTML media keeps original full-length files streaming and exposes playback failures.
export class Sound {
 constructor(settings,onStatus){this.settings=settings;this.onStatus=onStatus;this.channels=new Map();this.unlocked=false;this.paused=false;this.generation=0;}
 element(channel){if(this.channels.has(channel))return this.channels.get(channel);const audio=new Audio();audio.preload='auto';audio.playsInline=true;audio.setAttribute('playsinline','');const state={audio,clip:null,desired:false,generation:0};audio.addEventListener('playing',()=>this.onStatus?.(true,state.clip,channel));audio.addEventListener('ended',()=>{if(!audio.loop)state.desired=false;});audio.addEventListener('error',()=>{if(state.desired)this.onStatus?.(false,state.clip,channel,'No se ha podido cargar el audio.');});this.channels.set(channel,state);return state;}
 unlock(seed){
  try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
  if(this.unlocked){this.update();return;}
  this.unlocked=true;
  for(const channel of ['music','voice','knock','effect']){
   const state=this.element(channel);if(!seed)continue;
   state.audio.src=seed.url;state.audio.muted=true;const version=state.generation;
   const p=state.audio.play();p?.then(()=>{if(state.generation===version){state.audio.pause();state.audio.currentTime=0;state.audio.muted=false;}}).catch(()=>{state.audio.muted=false;});
  }
 }
 volume(channel){const key={menu:'musicMenu',music:'musicGameplay',voice:'voice',knock:'knock',effect:'applause'}[channel];return this.settings.enabled?Number(this.settings[key]??.8):0;}
 play(channel,clip,{loop=false,volume=1,mute=false}={}){
  if(!clip?.url)return;
  const state=this.element(channel);state.generation++;state.clip=clip;state.desired=true;state.mute=mute;state.multiplier=1;
  const audio=state.audio;audio.pause();audio.src=clip.url;audio.loop=loop;audio.currentTime=0;audio.muted=mute;audio.volume=Math.max(0,Math.min(1,this.volume(channel)));
  if(!this.unlocked||this.paused)return;
  const version=state.generation;
  audio.play()?.catch(error=>{if(state.generation===version&&state.desired&&error.name!=='AbortError')this.onStatus?.(false,clip,channel,'Toca el altavoz para activar el sonido.');});
 }
 stop(channel){const s=this.channels.get(channel);if(!s)return;s.generation++;s.desired=false;s.audio.pause();}
 stopAll(){for(const c of this.channels.keys())this.stop(c);}
 mute(channel,value){const s=this.channels.get(channel);if(s){s.mute=value;s.audio.muted=value;}}
 pause(){this.paused=true;for(const s of this.channels.values())s.audio.pause();}
 resume(){this.paused=false;for(const s of this.channels.values())if(s.desired){s.audio.play()?.catch(()=>this.onStatus?.(false,s.clip,'','Toca el altavoz para activar el sonido.'));}}
 update(){for(const [channel,s]of this.channels){s.audio.volume=Math.max(0,Math.min(1,this.volume(channel)*(s.multiplier??1)));s.audio.muted=!!s.mute;}}
 clock(source){const state=this.channels.get(source.channel);return state?.clip?.key===source.clip?.key?state.audio.currentTime:undefined;}
}
