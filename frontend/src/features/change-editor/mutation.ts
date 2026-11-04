import {ApiError} from '../../services/api/errors.ts'
export type MutationState<T>={status:'idle'|'saving'|'saved'|'rejected'|'uncertain';data?:T;error?:string;http?:number}
export class ChangeMutation<T>{
  #state:MutationState<T>={status:'idle'};#epoch=0;#locked=false;#controller:AbortController|null=null;#listeners=new Set<()=>void>()
  getSnapshot=()=>this.#state
  subscribe=(fn:()=>void)=>{this.#listeners.add(fn);return()=>{this.#listeners.delete(fn)}}
  #publish(s:MutationState<T>){this.#state=s;for(const f of this.#listeners)f()}
  cancel=()=>{this.#epoch++;this.#controller?.abort();this.#publish({status:'idle'})}
  async run(write:(signal:AbortSignal)=>Promise<T>,refresh:(value:T,signal:AbortSignal)=>Promise<void>){
    if(this.#locked)return
    this.#locked=true;const epoch=++this.#epoch,controller=new AbortController();this.#controller=controller
    this.#publish({status:'saving'})
    let wrote=false
    try{const data=await write(controller.signal);wrote=true
      if(epoch!==this.#epoch||controller.signal.aborted)return
      await refresh(data,controller.signal)
      if(epoch===this.#epoch&&!controller.signal.aborted)this.#publish({status:'saved',data})
    }catch(e){if(epoch!==this.#epoch||controller.signal.aborted)return
      const definite=!wrote&&e instanceof ApiError&&(e.code==='configuration'||(e.status!==undefined&&[400,401,403,404,409,422].includes(e.status)))
      this.#locked=!definite
      this.#publish({status:definite?'rejected':'uncertain',error:e instanceof ApiError?e.code:'network',http:e instanceof ApiError?e.status:undefined})
    }
  }
}
