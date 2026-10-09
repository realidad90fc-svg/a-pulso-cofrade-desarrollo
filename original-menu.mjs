import {developmentMenuPreference} from './development-mode.mjs';
import {OriginalVM} from './original-vm.mjs';
import {OriginalLayout} from './original-ui.mjs';
import {JESUS_PENAS,nativeRecordKey} from './custom-steps.mjs';
export class OriginalMenus {
 constructor(resources,container,options){this.r=resources;this.container=container;this.options=options;this.objects=new Map();this.scripts=new Map();this.tasks=[];this.prefs=options.prefs;this.layouts=[];this.dt=0;const native=this.native.bind(this);native.intercepts=new Set(Object.keys(resources.code.methods).filter(k=>/RequestInterstitial|muestraBanner|botonSettings/.test(k)));this.vm=new OriginalVM(resources.code,native);}
 ref(v){if(Array.isArray(v))return v.map(x=>this.ref(x));if(!v||typeof v!=='object')return v;if(v.key){return this.r.assets.uiById[v.key]||this.r.assets.audioById[v.key]||{...v,name:v.name||this.r.layouts.nodes[v.nodeKey]?.name};}return v;}
 script(cls){if(this.scripts.has(cls))return this.scripts.get(cls);const s=this.vm.create(cls);this.scripts.set(cls,s);if(this.r.code.methods[cls+'..ctor'])this.vm.invoke(cls+'..ctor',s);for(const [k,v]of Object.entries(this.r.controls.menuScripts[cls]||{}))s[k]=this.ref(v);s.entity=this.objects.get(s.m_GameObject?.nodeKey);return s;}
 show(name){
  this.destroy();this.options.onOpen?.(name);const root=Object.values(this.r.layouts.roots).find(r=>r.name===name);if(!root)throw new Error('Original menu missing: '+name);
  const view=new OriginalLayout(this.r.layouts,root.key,this.container,{onClick:n=>this.click(n)});this.layouts.push(view);
  const common=Object.values(this.r.layouts.roots).find(r=>r.name==='canvasEst');const views=[[root,view]];
  if(common&&name!=='MenuExit'){const extra=new OriginalLayout(this.r.layouts,common.key,this.container);extra.setText('textEst',String(this.prefs.estampitasNuevas||this.prefs.numEstampitas||0));this.layouts.push(extra);views.push([common,extra]);}
  for(const [layout,view]of views)for(const key of layout.nodes){const n=this.r.layouts.nodes[key],e={key,name:n.name,tag:n.tag,children:[],view,node:n,components:{},active:n.activeSelf};
   if(n.text)e.components.Text={node:n,view,key,text:n.name==='textEst'?String(this.prefs.estampitasNuevas||this.prefs.numEstampitas||0):n.text.text,entity:e,enabled:n.text.enabled};
   if(n.image)e.components.Image={node:n,view,key,sprite:this.r.assets.uiById[n.image.spriteKey],enabled:n.image.enabled,entity:e};
   if(n.button)e.components.Button={node:n,view,key,interactable:n.button.interactable,entity:e};
   this.objects.set(key,e);
  }
  for(const e of this.objects.values())e.children=e.node.childKeys.map(k=>this.objects.get(k)).filter(Boolean);
  this.currentName=name;
  const cls=Object.entries(this.r.controls.menuScripts).find(([,f])=>f.m_GameObject?.name===name)?.[0];
  if(cls&&this.r.code.methods[cls+'.Awake'])this.vm.invoke(cls+'.Awake',this.script(cls));
  this.currentName=name;this.refresh();this.options.onReady?.(name,this);return view;
 }
 click(node){this.options.unlock?.();if(this.options.onClick?.(node))return;try{for(const c of node.button.onClick){const cls=c.m_Target.class||Object.entries(this.r.controls.menuScripts).find(([,f])=>f.m_GameObject?.name===c.m_Target.name)?.[0];if(cls){const args=c.m_Mode===3?[c.m_Arguments.m_IntArgument]:c.m_Mode===4?[c.m_Arguments.m_FloatArgument]:[];this.vm.invoke(cls+'.'+c.m_MethodName,this.script(cls),args);}}this.refresh();}catch(e){this.options.onError?.(e);}}
 destroy(){for(const l of this.layouts)l.destroy();this.layouts=[];this.objects.clear();this.scripts.clear();this.tasks=[];}
 refresh(){for(const e of this.objects.values()){const el=e.view.elements.get(e.key);if(!el)continue;if(e.components.Text){e.view.setText(e.key,this.options.displayText?.(e.components.Text.text)??e.components.Text.text);el.label.hidden=!e.components.Text.enabled;}if(e.components.Image){const s=e.components.Image.sprite;if(s?.url&&el.image.getAttribute('src')!==s.url)el.image.src=s.url;el.image.hidden=!e.components.Image.enabled;}if(e.components.Button)el.disabled=!e.components.Button.interactable;if(!e.active)el.hidden=true;}}
 resize(){for(const l of this.layouts)l.resize();this.refresh();}
 find(name,tag=false){return [...this.objects.values()].find(e=>e[tag?'tag':'name']===name)||{name,children:[],components:{}};}
 components(e,type,children=false){let out=e?.components?.[type]?[e.components[type]]:[];if(children)out.push(...(e?.children||[]).flatMap(x=>this.components(x,type,true)));return out;}
 tick(dt){this.dt=dt;for(const t of [...this.tasks]){t.wait-=dt;if(t.wait<=0)this.resume(t);}this.tasks=this.tasks.filter(t=>!t.done);this.refresh();}
 resume(task){if(!this.vm.invoke(task.iterator.__type+'.MoveNext',task.iterator)){task.done=true;return;}task.wait=task.iterator.$current?.wait??.0167;}
 recordKey(key){return nativeRecordKey(key,this.currentName==='MenuEligeMapa'&&this.prefs.customStep===JESUS_PENAS.key?JESUS_PENAS:null);}
 native(m,o,a){const n=m.name;
  if(n==='botonesMenu.botonSettings'){this.options.settings?.();return;}
  if(/RequestInterstitial|muestraBanner/.test(n))return;
  switch(n){
   case 'MonoBehaviour..ctor':case 'Object..ctor':return;
   case 'GameObject.Find':return this.find(a[0]);
   case 'GameObject.FindGameObjectWithTag':return this.find(a[0],true);
   case 'GameObject.GetComponent':case 'GameObject.GetComponentInChildren':{const type=m.generic?.[0];return this.components(o,type,n.includes('InChildren'))[0]||{node:o.node,enabled:true,key:o.key,name:o.name};}
   case 'GameObject.GetComponentsInChildren':return this.components(o,m.generic?.[0],true);
   case 'Component.GetComponent':return this.components(o.entity,m.generic?.[0])[0];
   case 'Component.GetComponentInChildren':return this.components(o.entity,m.generic?.[0],true)[0];
   case 'Component.GetComponentsInChildren':return this.components(o.entity,m.generic?.[0],true);
   case 'Object.Instantiate':{const ref=a[0];if(ref?.name==='MenuSettings'){this.options.settings?.();return ref;}if(ref?.name)this.show(ref.name);return ref;}
   case 'Object.Destroy':if(a[0]?.key&&this.objects.has(a[0].key)){const e=this.objects.get(a[0].key);e.active=false;const el=e.view.elements.get(e.key);if(el)el.hidden=true;}return;
   case 'GameObject.SetActive':o.active=!!a[0];return;
   case 'GameObject.SendMessage':return;
   case 'Text.set_text':o.text=a[0];return;
   case 'Image.set_sprite':o.sprite=a[0];return;
   case 'Selectable.set_interactable':o.interactable=!!a[0];return;
   case 'Selectable.get_interactable':return !!o.interactable;
   case 'Behaviour.set_enabled':case 'Renderer.set_enabled':o.enabled=!!a[0];return;
   case 'PlayerPrefs.GetInt':case 'PlayerPrefs.GetFloat':{const testAccess=developmentMenuPreference(this.currentName,a[0]);return testAccess===null?Number(this.prefs[this.recordKey(a[0])]||0):testAccess;}
   case 'PlayerPrefs.HasKey':return this.recordKey(a[0])in this.prefs;
   case 'PlayerPrefs.SetInt':case 'PlayerPrefs.SetFloat':this.prefs[this.recordKey(a[0])]=a[1];this.options.save?.();return;
   case 'PlayerPrefs.Save':this.options.save?.();return;
   case 'PlayerPrefs.DeleteAll':for(const key of Object.keys(this.prefs))delete this.prefs[key];return;
   case 'Screen.set_sleepTimeout':return;
   case 'Time.get_deltaTime':return this.dt;
   case 'Time.set_timeScale':return;
   case 'WaitForSeconds..ctor':return{wait:a[0]};
   case 'WaitForSecondsRealtime..ctor':return{wait:a[0]};
   case 'MonoBehaviour.StartCoroutine':{const it=this.vm.invoke(o.__type+'.'+a[0],o);const task={iterator:it,wait:0};this.resume(task);if(!task.done)this.tasks.push(task);return task;}
   case 'SceneManager.LoadScene':this.options.start?.(a[0]);return;
   case 'Object.op_Equality':case 'String.op_Equality':return a[0]===a[1];
   case 'Object.op_Inequality':case 'String.op_Inequality':return a[0]!==a[1];
   case 'String.Concat':return(a.length===1&&Array.isArray(a[0])?a[0]:a).join('');
   case 'Int32.ToString':return String(Math.trunc(o)).padStart(a[0]==='00'?2:1,'0');
   case 'Single.ToString':return a[0]==='00'?String(Math.round(o)).padStart(2,'0'):String(o);
   case 'AudioSource.set_volume':return;
   case 'AudioSource.get_volume':return 1;
   case 'Slider.get_value':return o?.value??1;
   case 'AudioSource.Stop':return;
   case 'AudioListener.get_volume':return this.options.muted?.()?0:1;
   case 'AudioListener.set_volume':this.options.toggleSound?.(a[0]!==0);return;
   case 'AudioSource.Play':return;
   case 'Application.OpenURL':this.options.openURL?.(a[0]);return;
   case 'Application.Quit':this.show('MenuInicio');return;
   case 'Color.get_white':return{r:1,g:1,b:1,a:1};
   case 'Color.get_red':return{r:1,g:0,b:0,a:1};
   case 'Graphic.set_color':if(o.view){const el=o.view.elements.get(o.key);if(el)el.style.color=`rgb(${a[0].r*255},${a[0].g*255},${a[0].b*255})`;}return;
   default:throw new Error('Original menu call: '+n);
  }
 }
}
