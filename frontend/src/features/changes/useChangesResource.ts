import { useCallback,useEffect,useMemo,useSyncExternalStore } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { createWorkspaceGateway } from '../auth/workspaceGateway.ts'
import { createChangesApi } from './api.ts'
import { ChangesResource } from './resource.ts'
export function useChangesApi() {
  const {client,store,state}=useAuth()
  const binding=state.binding??'',organization=state.user?.organization_id??0
  const ownId=state.user?.role_name==='Requester'?state.user.id:undefined
  const api=useMemo(()=>createChangesApi(createWorkspaceGateway(client,store.getSnapshot,binding),organization,ownId),[client,store,binding,organization,ownId])
  // A denied resource remains forbidden. The shell owns explicit identity
  // verification; do not create a repeated /me recovery loop for a 403 filter.
  return {api,binding,ownOnly:ownId!==undefined,memoryOnly:state.storageWarning,
    allowed:state.user?.permissions.includes('changes.read')??false,
    catalogAllowed:state.user?.permissions.includes('foundation.read')??false,
    canCreate:state.user?.permissions.includes('changes.create')??false}
}
export function useChangesResource<T>(key:string,loader:(signal:AbortSignal)=>Promise<T>) {
  const resource=useMemo(()=>new ChangesResource<T>(),[])
  const state=useSyncExternalStore(resource.subscribe,resource.getSnapshot)
  const refresh=useCallback(()=>{void resource.load(key,loader)},[resource,key,loader])
  useEffect(()=>{refresh();return resource.cancel},[refresh,resource])
  return {state:state.key===key?state:{key,status:'loading' as const},refresh}
}
