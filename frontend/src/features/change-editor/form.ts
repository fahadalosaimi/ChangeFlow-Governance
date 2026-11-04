import type {ChangeRecord} from '../changes/decoders.ts'
import {formatDateTime} from '../../localization/formatters.ts'
export const editorEnums={change_type:['database','application','network','security','documentation'],change_mode:['Standard','Normal','Emergency'],
  priority:['Low','Medium','High','Critical'],rollback_complexity:['Low','Medium','High'],security_sensitivity:['Low','Medium','High']} as const
export interface EditorDraft {title:string;description:string;change_type:string;change_mode:string;priority:string;affected_system_ids:readonly number[];
  expected_downtime_minutes:string;rollback_complexity:string;security_sensitivity:string;business_justification:string;planned_start:string;planned_end:string;revision_comment:string}
export type WritePayload=Omit<EditorDraft,'expected_downtime_minutes'|'planned_start'|'planned_end'|'business_justification'|'revision_comment'>&{
  expected_downtime_minutes:number;planned_start:string|null;planned_end:string|null;business_justification:string|null;revision_comment?:string}
export const emptyDraft=():EditorDraft=>({title:'',description:'',change_type:'application',change_mode:'Normal',priority:'Medium',affected_system_ids:[],
  expected_downtime_minutes:'0',rollback_complexity:'Medium',security_sensitivity:'Medium',business_justification:'',planned_start:'',planned_end:'',revision_comment:''})
export function draftFromRecord(r:ChangeRecord):EditorDraft {
  return {...emptyDraft(),title:r.title,description:r.description,change_type:r.change_type,change_mode:r.change_mode,priority:r.priority,
    affected_system_ids:[...r.affected_system_ids],expected_downtime_minutes:String(r.expected_downtime_minutes),rollback_complexity:r.rollback_complexity,
    security_sensitivity:r.security_sensitivity,business_justification:r.business_justification??'',planned_start:r.planned_start??'',planned_end:r.planned_end??''}
}
export function revisionAllowed(r:{requester_id:number|null;status:string},id:number,grants:readonly string[]){
  return grants.includes('changes.revise')&&r.requester_id===id&&r.status==='Needs More Information'
}
export function validateDraft(d:EditorDraft,systemIds:readonly number[],revision:boolean):{errors:Partial<Record<keyof EditorDraft,string>>;payload?:WritePayload}{
  const errors:Partial<Record<keyof EditorDraft,string>>={},length=(s:string)=>[...s].length
  const title=d.title.trim(),description=d.description.trim(),comment=d.revision_comment.trim()
  if(length(title)<3||length(title)>255)errors.title='title'
  if(length(description)<10)errors.description='description'
  if(length(d.business_justification)>8000)errors.business_justification='justification'
  if(revision&&(length(comment)<3||length(comment)>4000))errors.revision_comment='comment'
  for(const key of Object.keys(editorEnums) as (keyof typeof editorEnums)[])
    if(!(editorEnums[key] as readonly string[]).includes(d[key]))errors[key]='enum'
  const ids=d.affected_system_ids
  if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<=0||!systemIds.includes(id)))errors.affected_system_ids='systems'
  if(!/^\d+$/.test(d.expected_downtime_minutes)||!Number.isSafeInteger(Number(d.expected_downtime_minutes))||Number(d.expected_downtime_minutes)>43200)errors.expected_downtime_minutes='downtime'
  for(const key of ['planned_start','planned_end'] as const){
    const v=d[key];if(v&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(v)||formatDateTime(v,'organization-local','en')==='—'))errors[key]='date'
  }
  if(d.planned_start&&d.planned_end&&!errors.planned_start&&!errors.planned_end){
    if(Date.parse(d.planned_end+'Z')<Date.parse(d.planned_start+'Z'))errors.planned_end='window'
  }
  if(Object.keys(errors).length)return {errors}
  return {errors,payload:{title,description,change_type:d.change_type,change_mode:d.change_mode,priority:d.priority,affected_system_ids:[...ids],
    expected_downtime_minutes:Number(d.expected_downtime_minutes),rollback_complexity:d.rollback_complexity,security_sensitivity:d.security_sensitivity,
    business_justification:d.business_justification.trim()||null,planned_start:d.planned_start||null,planned_end:d.planned_end||null,
    ...(revision?{revision_comment:comment}:{})}}
}
export function matchesWritten(record:WritePayload&{status:string},payload:WritePayload){
  const fields=['title','description','change_type','change_mode','priority','expected_downtime_minutes','rollback_complexity','security_sensitivity','business_justification'] as const
  const wall=(value:string|null)=>{
    if(value===null)return null
    const m=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(value)
    return m?`${m[1]}:${m[2]??'00'}.${(m[3]??'').replace(/0+$/,'')}`:`invalid:${value}`
  }
  return record.status==='Pending Approval'&&!fields.some(key=>record[key]!==payload[key])
    &&record.affected_system_ids.length===payload.affected_system_ids.length&&record.affected_system_ids.every(id=>payload.affected_system_ids.includes(id))
    &&wall(record.planned_start)===wall(payload.planned_start)&&wall(record.planned_end)===wall(payload.planned_end)
}
