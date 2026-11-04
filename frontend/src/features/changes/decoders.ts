import { ApiError } from '../../services/api/errors.ts'
import { formatDateTime } from '../../localization/formatters.ts'
import type { ChangesQuery } from './query.ts'
export const assessmentLists=['directly_affected_systems','indirectly_affected_systems','affected_departments','system_owners','previous_incidents','risk_factors','recommendations','rollback_plan','testing_checklist'] as const
export type Assessment=Record<typeof assessmentLists[number],string[]>&{risk_level:string|null;impact_score:number|null;decision_recommendation:string|null;ai_explanation:string|null}
export type AssessmentState={state:'missing'|'invalid'|'ready';value?:Assessment}
export interface ChangeRecord {
  id:number;requester_id:number|null;requester_name:string|null;requester_email:string|null;title:string;description:string
  change_type:string;change_mode:string;priority:string;status:string;expected_downtime_minutes:number
  rollback_complexity:string;security_sensitivity:string;business_justification:string|null
  planned_start:string|null;planned_end:string|null;created_at:string;updated_at:string;affected_system_ids:number[];assessment:AssessmentState
}
export interface ChangePage {items:ChangeRecord[];total:number;page:number;page_size:number;total_pages:number}
export interface RequesterOption {id:number;full_name:string;is_active:string|null}
const bad=():never=>{throw new ApiError('invalid_response')}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:bad()
const text=(v:unknown):string=>typeof v==='string'?v:bad()
const nullable=(v:unknown)=>v===null?null:text(v)
const number=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:bad()
const id=(v:unknown)=>{const n=number(v);return n>0?n:bad()}
const unique=<T,>(items:T[])=>new Set(items).size===items.length?items:bad()
const date=(v:unknown)=>{const s=text(v);return formatDateTime(s,/(?:Z|[+-]\d{2}:\d{2})$/.test(s)?'utc':'organization-local','en')!=='—'?s:bad()}
export const creationInstant=(s:string)=>/(?:Z|[+-]\d{2}:\d{2})$/.test(s)?s:s+'Z'
function assessment(v:unknown):AssessmentState {
  if(v===null)return {state:'missing'}
  try {
    const r=obj(v),score=r.impact_score===null?null:number(r.impact_score)
    if(score!==null&&score>100)return bad()
    const lists={} as Record<typeof assessmentLists[number],string[]>
    for(const key of assessmentLists){const a=r[key];if(!Array.isArray(a))return bad();lists[key]=a.map(text)}
    return {state:'ready',value:{...lists,risk_level:nullable(r.risk_level),impact_score:score,
      decision_recommendation:nullable(r.decision_recommendation),ai_explanation:nullable(r.ai_explanation)}}
  }catch{return {state:'invalid'}}
}
export function decodeChange(value:unknown,ownId?:number,expectedId?:number):ChangeRecord {
  const r=obj(value),rid=r.requester_id===null?null:id(r.requester_id),ids=r.affected_system_ids
  if(!Array.isArray(ids)||(ownId!==undefined&&rid!==ownId))return bad()
  const result={id:id(r.id),requester_id:rid,requester_name:nullable(r.requester_name),requester_email:nullable(r.requester_email),
    title:text(r.title),description:text(r.description),change_type:text(r.change_type),change_mode:text(r.change_mode),priority:text(r.priority),status:text(r.status),
    expected_downtime_minutes:number(r.expected_downtime_minutes),rollback_complexity:text(r.rollback_complexity),security_sensitivity:text(r.security_sensitivity),
    business_justification:nullable(r.business_justification),planned_start:r.planned_start===null?null:date(r.planned_start),planned_end:r.planned_end===null?null:date(r.planned_end),
    created_at:date(r.created_at),updated_at:date(r.updated_at),affected_system_ids:unique(ids.map(id)),assessment:assessment(r.latest_assessment)}
  if(!result.title.trim()||(expectedId!==undefined&&result.id!==expectedId))return bad()
  return result
}
export function decodePage(value:unknown,q:ChangesQuery,ownId?:number):ChangePage {
  const r=obj(value),total=number(r.total),page=id(r.page),size=id(r.page_size),pages=id(r.total_pages)
  if(page!==q.page||size!==q.page_size||pages!==Math.max(1,Math.ceil(total/size))||!Array.isArray(r.items)||r.items.length>Math.min(total,size))return bad()
  const items=r.items.map(v=>decodeChange(v,ownId))
  unique(items.map(item=>item.id))
  for(const item of items)if((q.status&&item.status!==q.status)||(q.change_type&&item.change_type!==q.change_type)
    ||(q.requester_id&&item.requester_id!==Number(q.requester_id)))return bad()
  return {items,total,page,page_size:size,total_pages:pages}
}
export function decodeRequesters(value:unknown,organization:number):RequesterOption[] {
  if(!Array.isArray(value))return bad()
  const items=value.map(v=>{const r=obj(v);if(id(r.organization_id)!==organization)return bad()
    return {id:id(r.id),full_name:text(r.full_name),is_active:nullable(r.is_active)}})
  unique(items.map(v=>v.id));return items
}
