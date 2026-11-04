import {ApiError} from '../../services/api/errors.ts'
import {decodeChange} from '../changes/decoders.ts'
import {decodeNotice,decodePage,decodeCount,destination,type NotificationScope,type Notice} from './decoders.ts'
import {serializeQuery,type NotificationQuery} from './query.ts'
export type NoticeAction={kind:'all'}|{kind:'one'|'open';notice:Notice}
type Gateway=(path:string,options?:RequestInit)=>Promise<unknown>
export function createNotificationsApi(gateway:Gateway,scope:NotificationScope){
  const get=(path:string,signal?:AbortSignal)=>gateway(path,{method:'GET',signal})
  const page=async(q:NotificationQuery,signal?:AbortSignal)=>decodePage(await get('/notifications/paged?'+serializeQuery(q),signal),q,scope)
  const unread=async(signal?:AbortSignal)=>decodeCount(await get('/notifications/unread-count',signal),'unread_count')
  return {
    page,unread,
    snapshot:async(q:NotificationQuery,signal?:AbortSignal)=>{const [items,count]=await Promise.all([page(q,signal),unread(signal)]);return {page:items,unread:count}},
    one:async(id:number,signal?:AbortSignal)=>{
      if(!Number.isSafeInteger(id)||id<=0)throw new ApiError('configuration')
      const result=decodeNotice(await gateway(`/notifications/${id}/read`,{method:'PATCH',signal}),scope,id)
      if(!result.is_read)throw new ApiError('invalid_response')
      return result
    },
    all:async(signal?:AbortSignal)=>decodeCount(await gateway('/notifications/read-all',{method:'PATCH',signal}),'updated_count'),
    target:async(notice:Notice,permissions:readonly string[],signal?:AbortSignal)=>{
      const path=destination(notice,permissions)
      if(!path)throw new ApiError('forbidden')
      decodeChange(await get(`/change-management/requests/${notice.change_request_id}`,signal),scope.ownChangeId,notice.change_request_id!)
      return path
    },
    observe:async(action:NoticeAction,signal?:AbortSignal)=>{
      if(action.kind==='all')return await unread(signal)===0
      // No single-notice GET exists. Bounded lookup never resends PATCH and
      // absence is inconclusive, not evidence of failure or permission to retry.
      const result=await page({page:1,page_size:100,unread_only:false,notification_type:action.notice.notification_type,search:action.notice.title},signal)
      return result.items.some(n=>n.id===action.notice.id&&n.is_read)
    },
  }
}
export type NotificationsApi=ReturnType<typeof createNotificationsApi>
export type NoticeSnapshot=Awaited<ReturnType<NotificationsApi['snapshot']>>
