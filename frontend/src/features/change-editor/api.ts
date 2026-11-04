import {ApiError} from '../../services/api/errors.ts'
import {decodeChange} from '../changes/decoders.ts'
import {assertControlledWrite} from './boundary.ts'
import {validateDraft,matchesWritten,type EditorDraft} from './form.ts'
type Gateway=(path:string,options?:RequestInit)=>Promise<unknown>
export function createEditorApi(gateway:Gateway,ownId:number){
  const write=async(id:number|null,draft:EditorDraft,systems:readonly number[],signal?:AbortSignal)=>{
    await assertControlledWrite()
    if(id!==null&&(!Number.isSafeInteger(id)||id<=0))throw new ApiError('configuration')
    const result=validateDraft(draft,systems,id!==null)
    if(!result.payload)throw new ApiError('configuration')
    const value=await gateway(id===null?'/change-management/requests':`/change-management/requests/${id}/revise`,{
      method:id===null?'POST':'PUT',body:JSON.stringify(result.payload),headers:{'Content-Type':'application/json'},signal})
    const record=decodeChange(value,ownId,id??undefined)
    if(!matchesWritten(record,result.payload))throw new ApiError('invalid_response')
    return record
  }
  return {create:(d:EditorDraft,s:readonly number[],signal?:AbortSignal)=>write(null,d,s,signal),
    revise:(id:number,d:EditorDraft,s:readonly number[],signal?:AbortSignal)=>write(id,d,s,signal)}
}
