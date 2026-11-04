import { ApiError } from '../../services/api/errors.ts'
import { decodeSystems } from '../systems/decoders.ts'
import { decodeChange, decodePage, decodeRequesters } from './decoders.ts'
import { serializeChangesQuery, type ChangesQuery } from './query.ts'
type Gateway=(path:string,options?:RequestInit)=>Promise<unknown>
export function createChangesApi(gateway:Gateway,organization:number,ownId?:number) {
  const get=(path:string,signal?:AbortSignal)=>gateway(path,{method:'GET',signal})
  return {
    page:async(q:ChangesQuery,signal?:AbortSignal)=>decodePage(await get('/change-management/requests/paged?'+serializeChangesQuery(q),signal),q,ownId),
    detail:async(id:number,signal?:AbortSignal)=>{
      if(!Number.isSafeInteger(id)||id<=0)throw new ApiError('configuration')
      return decodeChange(await get(`/change-management/requests/${id}`,signal),ownId,id)
    },
    requesters:async(signal?:AbortSignal)=>decodeRequesters(await get('/foundation/users',signal),organization),
    systems:async(signal?:AbortSignal)=>decodeSystems(await get('/foundation/systems',signal),organization),
  }
}
export type ChangesApi=ReturnType<typeof createChangesApi>
