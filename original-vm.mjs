// A small CIL adapter for the game's shipped Mono scripts. Native Unity calls are
// provided by original-engine.mjs; command/state/UI code stays in its original IL.
export class OriginalVM {
  constructor(data, native) { this.data=data; this.native=native; this.compiled=new Map(); this.depth=0; }
  create(type) {
    const object={__type:type};
    for(const [name,sig] of Object.entries(this.data.fields[type]||{}))object[name]=/^06(02|0[3456789abc]|0e)/.test(sig)?0:null;
    return object;
  }
  invoke(name, object, args=[]) {
    const method=this.data.methods[name];
    if(!method)throw new Error('Missing original method: '+name);
    if(++this.depth>40)throw new Error('Original script recursion: '+name);
    try{return this.execute(name,method,object,args);}finally{this.depth--;}
  }
  execute(name,method,object,parameters) {
    let compiled=this.compiled.get(name);
    if(!compiled){const jumps=new Map(method.code.map((x,i)=>[x[0],i]));compiled={code:method.code,jumps};this.compiled.set(name,compiled);}
    const {code,jumps}=compiled, meta=this.data.metadata[method.meta];
    const args=meta.this?[object,...parameters]:parameters, locals=[], stack=[];
    let pc=0,budget=150000;
    const pop=()=>stack.pop();
    while(pc<code.length&&--budget>0){
      const [offset,op,value]=code[pc++];
      if(op.startsWith('ldc.i4.')){const suffix=op.slice(7);stack.push(suffix==='m1'?-1:suffix==='s'?value:Number(suffix));continue;}
      if(op.startsWith('ldarg.')){stack.push(args[op==='ldarg.s'?value:Number(op.slice(6))]);continue;}
      if(op.startsWith('ldloc.')){stack.push(locals[op==='ldloc.s'?value:Number(op.slice(6))]??0);continue;}
      if(op.startsWith('stloc.')){locals[op==='stloc.s'?value:Number(op.slice(6))]=pop();continue;}
      const base=op.replace(/\.s$/,'').replace(/\.un$/,'');
      switch(base){
        case 'nop':case 'box':case 'unbox.any':case 'castclass':case 'constrained.':break;
        case 'ldnull':stack.push(null);break;
        case 'ldstr':case 'ldc.r4':case 'ldc.r8':case 'ldc.i4':case 'ldc.i8':stack.push(value);break;
        case 'ldarg':case 'ldarga':stack.push(args[value]);break;
        case 'ldloc':case 'ldloca':stack.push(locals[value]??0);break;
        case 'stloc':locals[value]=pop();break;
        case 'starg':args[value]=pop();break;
        case 'dup':stack.push(stack.at(-1));break;
        case 'pop':pop();break;
        case 'ldfld':case 'ldflda':{
          const obj=pop(),field=value.slice(value.lastIndexOf('.')+1);
          if(obj==null)throw new Error(`${name} ${offset.toString(16)}: null ${value}`);
          stack.push(obj[field]??0);break;
        }
        case 'stfld':{
          let v=pop();const obj=pop(),field=value.slice(value.lastIndexOf('.')+1);
          if(obj==null)throw new Error(`${name}: null write ${value}`);
          if(this.data.fields[obj.__type]?.[field]==='060c')v=Math.fround(v);
          obj[field]=v;break;
        }
        case 'ldsfld':stack.push(this.native({name:value,field:true},null,[]));break;
        case 'stsfld':this.native({name:value,field:true},null,[pop()]);break;
        case 'ldlen':stack.push(pop().length);break;
        case 'ldelem.ref':case 'ldelem.i4':case 'ldelem.r4':{
          const index=pop(),array=pop();if(!array||index<0||index>=array.length)throw new Error(`${name}: original array ${index}/${array?.length}`);
          stack.push(array[index]);break;
        }
        case 'stelem.ref':case 'stelem.i4':case 'stelem.r4':{const v=pop(),index=pop(),array=pop();array[index]=v;break;}
        case 'newarr':stack.push(new Array(pop()).fill(null));break;
        case 'add':{const b=pop(),a=pop();stack.push(a+b);break;}
        case 'sub':{const b=pop(),a=pop();stack.push(a-b);break;}
        case 'mul':{const b=pop(),a=pop();stack.push(a*b);break;}
        case 'div':{const b=pop(),a=pop();stack.push(a/b);break;}
        case 'rem':{const b=pop(),a=pop();stack.push(a%b);break;}
        case 'neg':stack.push(-pop());break;
        case 'not':stack.push(~pop());break;
        case 'and':{const b=pop(),a=pop();stack.push(a&b);break;}
        case 'or':{const b=pop(),a=pop();stack.push(a|b);break;}
        case 'xor':{const b=pop(),a=pop();stack.push(a^b);break;}
        case 'conv.i4':stack.push(Math.trunc(pop()));break;
        case 'conv.r4':stack.push(Math.fround(pop()));break;
        case 'conv.r8':case 'conv.u4':case 'conv.u':case 'conv.i':break;
        case 'ceq':{const b=pop(),a=pop();stack.push(a===b?1:0);break;}
        case 'cgt':{const b=pop(),a=pop();stack.push(a>b?1:0);break;}
        case 'clt':{const b=pop(),a=pop();stack.push(a<b?1:0);break;}
        case 'br':case 'leave':pc=jumps.get(value);break;
        case 'brtrue':if(pop())pc=jumps.get(value);break;
        case 'brfalse':if(!pop())pc=jumps.get(value);break;
        case 'beq':case 'bne':case 'bgt':case 'bge':case 'blt':case 'ble':{
          const b=pop(),a=pop(),yes=base==='beq'?a===b:base==='bne'?a!==b:base==='bgt'?a>b:base==='bge'?a>=b:base==='blt'?a<b:a<=b;
          if(yes)pc=jumps.get(value);break;
        }
        case 'switch':{const n=pop();if(n>=0&&n<value.length)pc=jumps.get(value[n]);break;}
        case 'newobj':case 'call':case 'callvirt':{
          const m=this.data.metadata[value];if(!m)throw new Error('Unknown signature '+value);
          const p=stack.splice(stack.length-m.args,m.args);
          if(base==='newobj'){
            const type=m.name.slice(0,m.name.lastIndexOf('..ctor'));
            let result;
            if(this.data.methods[m.name]){result=this.create(type);this.invoke(m.name,result,p);}else result=this.native(m,null,p);
            stack.push(result);
          }else{
            const target=m.this?pop():null;
            let result;
            if(this.data.methods[m.name]&&!this.native.intercepts?.has(m.name))result=this.invoke(m.name,target,p);
            else result=this.native(m,target,p);
            if(m.returns)stack.push(result);
          }
          break;
        }
        case 'ret':return meta.returns?pop():undefined;
        default:throw new Error(`${name} ${offset.toString(16)}: unsupported original opcode ${op}`);
      }
      if(pc===undefined)throw new Error(name+': invalid original branch');
    }
    if(budget<=0)throw new Error('Original instruction budget: '+name);
  }
}
