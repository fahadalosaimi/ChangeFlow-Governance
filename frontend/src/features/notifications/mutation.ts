import {ApiError} from '../../services/api/errors.ts'
import type {NoticeAction} from './api.ts'
export interface NotificationMutationState{status:'idle'|'saving'|'confirmed'|'rejected'|'uncertain'|'observed';action?:NoticeAction;error?:string;acknowledged?:boolean}
export class NotificationsMutation{
  #state:NotificationMutationState={status:'idle'};#listeners=new Set<()=>void>();#locked=false;#epoch=0;#controller:AbortController|null=null
  getSnapshot=()=>this.#state
  subscribe=(fn:()=>void)=>{this.#listeners.add(fn);return()=>{this.#listeners.delete(fn)}}
  #publish(state:NotificationMutationState){this.#state=state;for(const fn of this.#listeners)fn()}
  cancel=()=>{this.#epoch++;this.#controller?.abort();this.#publish({status:'idle'})}
  clearRejection=()=>{if(!this.#locked&&this.#state.status==='rejected')this.#publish({status:'idle'})}
  async run(action:NoticeAction,write:(signal:AbortSignal)=>Promise<unknown>,confirm:(signal:AbortSignal)=>Promise<unknown>,current:()=>boolean,done:()=>void=()=>{}){
    if(this.#locked)return
    this.#locked=true;const epoch=++this.#epoch,c=new AbortController();this.#controller=c
    const mutating=action.kind!=='open'||!action.notice.is_read
    let acknowledged=false
    this.#publish({status:'saving',action})
    try{await write(c.signal);acknowledged=mutating
      if(epoch!==this.#epoch)return
      if(!current())throw new ApiError('session_changed')
      await confirm(c.signal)
      if(epoch!==this.#epoch)return
      if(!current())throw new ApiError('session_changed')
      this.#locked=false;this.#publish({status:'confirmed',action,acknowledged});done()
    }catch(error){if(epoch!==this.#epoch)return
      const definite=!mutating||(!acknowledged&&error instanceof ApiError&&error.status!==undefined&&[400,401,403,404,409,422].includes(error.status))
      this.#locked=!definite
      this.#publish({status:definite?'rejected':'uncertain',action,acknowledged,error:error instanceof ApiError?error.code:'network'})
    }
  }
  async reconcile(observe:(signal:AbortSignal)=>Promise<boolean>,refresh:(signal:AbortSignal)=>Promise<unknown>,current:()=>boolean){
    if(this.#state.status!=='uncertain'||!this.#state.action)return
    const action=this.#state.action,epoch=++this.#epoch,c=new AbortController();this.#controller=c
    this.#publish({...this.#state,status:'saving'})
    try{const observed=await observe(c.signal);await refresh(c.signal)
      if(epoch!==this.#epoch)return
      if(observed&&current()){this.#locked=false;this.#publish({status:'observed',action})}
      else this.#publish({status:'uncertain',action})
    }catch(error){if(epoch===this.#epoch)this.#publish({status:'uncertain',action,error:error instanceof ApiError?error.code:'network'})}
  }
}
