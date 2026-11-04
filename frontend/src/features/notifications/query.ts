import {ApiError} from '../../services/api/errors.ts'
export const notificationTypes=['GENERAL','CHANGE_SUBMITTED','CHANGE_RESUBMITTED','CHANGE_APPROVED','CHANGE_REJECTED','CHANGE_INFORMATION_REQUESTED','CHANGE_IMPLEMENTATION_STARTED','CHANGE_IMPLEMENTED','CHANGE_IMPLEMENTATION_FAILED','CHANGE_ROLLED_BACK','CHANGE_CLOSED','CHANGE_STATUS_UPDATED','CHANGE_DECISION_RECORDED']
export interface NotificationQuery{page:number;page_size:number;unread_only:boolean;notification_type:string;search:string}
export function readQuery(p:URLSearchParams):NotificationQuery{
  const positive=(v:string)=>{if(!/^[1-9]\d*$/.test(v)||!Number.isSafeInteger(Number(v)))throw new ApiError('configuration');return Number(v)}
  const page=positive(p.get('page')??'1'),page_size=positive(p.get('page_size')??'10'),unread=p.get('unread_only')??'false'
  if(page_size>100||!['true','false'].includes(unread))throw new ApiError('configuration')
  return {page,page_size,unread_only:unread==='true',notification_type:(p.get('notification_type')??'').trim(),search:(p.get('search')??'').trim()}
}
export function serializeQuery(q:NotificationQuery){
  const p=new URLSearchParams({page:String(q.page),page_size:String(q.page_size),unread_only:String(q.unread_only)})
  for(const key of ['notification_type','search'] as const)if(q[key].trim())p.set(key,q[key].trim())
  readQuery(p);return p.toString()
}
