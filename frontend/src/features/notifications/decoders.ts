import {ApiError} from '../../services/api/errors.ts'
import {formatDateTime} from '../../localization/formatters.ts'
import {routeAllowed} from '../../app/routePolicy.ts'
import type {NotificationQuery} from './query.ts'
export interface Notice{id:number;organization_id:number;recipient_id:number;actor_id:number|null;actor_name:string;change_request_id:number|null;notification_type:string;title:string;message:string;is_read:boolean;created_at:string;read_at:string|null}
export interface NoticePage{items:Notice[];total:number;page:number;page_size:number;total_pages:number}
export interface NotificationScope{organization:number;recipient:number;ownChangeId?:number}
const bad=():never=>{throw new ApiError('invalid_response')}
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:bad()
const number=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:bad()
const id=(v:unknown)=>{const n=number(v);return n>0?n:bad()}
const string=(v:unknown)=>typeof v==='string'?v:bad()
const date=(v:unknown)=>{const s=string(v);return formatDateTime(s,/(?:Z|[+-]\d{2}:\d{2})$/.test(s)?'utc':'organization-local','en')==='—'?bad():s}
export function decodeNotice(value:unknown,scope:NotificationScope,expectedId?:number):Notice{
  const r=object(value)
  if(r.organization_id!==scope.organization||r.recipient_id!==scope.recipient||typeof r.is_read!=='boolean')return bad()
  const result={id:id(r.id),organization_id:id(r.organization_id),recipient_id:id(r.recipient_id),actor_id:r.actor_id===null?null:id(r.actor_id),
    actor_name:string(r.actor_name),change_request_id:r.change_request_id===null?null:id(r.change_request_id),notification_type:string(r.notification_type),
    title:string(r.title),message:string(r.message),is_read:r.is_read,created_at:date(r.created_at),read_at:r.read_at===null?null:date(r.read_at)}
  if((expectedId!==undefined&&result.id!==expectedId)||(result.change_request_id===null&&result.notification_type!=='GENERAL'))return bad()
  return result
}
export function decodePage(value:unknown,q:NotificationQuery,scope:NotificationScope):NoticePage{
  const r=object(value),total=number(r.total),page=id(r.page),page_size=id(r.page_size),total_pages=id(r.total_pages)
  if(page!==q.page||page_size!==q.page_size||total_pages!==Math.max(1,Math.ceil(total/page_size))||!Array.isArray(r.items)||r.items.length>Math.min(total,page_size))return bad()
  const items=r.items.map(v=>decodeNotice(v,scope))
  if(new Set(items.map(n=>n.id)).size!==items.length||items.some(n=>(q.unread_only&&n.is_read)||(q.notification_type&&n.notification_type!==q.notification_type)))return bad()
  return {items,total,page,page_size,total_pages}
}
export function decodeCount(value:unknown,key:'unread_count'|'updated_count'){return number(object(value)[key])}
export function destination(value:unknown,permissions:readonly string[]):string|null{
  if(!value||typeof value!=='object')return null
  const cid=(value as Record<string,unknown>).change_request_id
  if(typeof cid!=='number'||!Number.isSafeInteger(cid)||cid<=0)return null
  const path=`/changes/${cid}`
  return routeAllowed(path,permissions)?path:null
}
