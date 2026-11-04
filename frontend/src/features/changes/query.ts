import { ApiError } from '../../services/api/errors.ts'
export const statuses=['Pending Approval','Needs More Information','Approved','Rejected','In Progress','Implemented','Failed','Rolled Back','Closed']
export const changeTypes=['application','database','network','security','documentation']
export const risks=['Low','Medium','High','Critical']
export interface ChangesQuery {page:number;page_size:number;search:string;status:string;risk_level:string;change_type:string;requester_id:string;created_from:string;created_to:string}
const bad=():never=>{throw new ApiError('configuration')}
const positive=(s:string)=>/^[1-9]\d*$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):bad()
function day(s:string) {
  if(!s)return s
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)return bad()
  const [y,month,d]=m.slice(1).map(Number),v=new Date(Date.UTC(y,month-1,d))
  return v.getUTCFullYear()===y&&v.getUTCMonth()===month-1&&v.getUTCDate()===d?s:bad()
}
export function readChangesQuery(params:URLSearchParams):ChangesQuery {
  const q={page:positive(params.get('page')??'1'),page_size:positive(params.get('page_size')??'5'),
    search:params.get('search')??'',status:params.get('status')??'',risk_level:params.get('risk_level')??'',
    change_type:params.get('change_type')??'',requester_id:params.get('requester_id')??'',
    created_from:day(params.get('created_from')??''),created_to:day(params.get('created_to')??'')}
  if(q.page_size>100||(q.status&&!statuses.includes(q.status))||(q.risk_level&&!risks.includes(q.risk_level))
    ||(q.change_type&&!changeTypes.includes(q.change_type))||(q.created_from&&q.created_to&&q.created_from>q.created_to))return bad()
  if(q.requester_id)positive(q.requester_id)
  return q
}
export function serializeChangesQuery(q:ChangesQuery) {
  const p=new URLSearchParams({page:String(q.page),page_size:String(q.page_size)})
  for(const key of ['search','status','risk_level','change_type','requester_id','created_from','created_to'] as const)if(q[key])p.set(key,q[key])
  // Validate direct typed callers as well as browser URL input.
  readChangesQuery(p)
  return p.toString()
}
export function visiblePages(page:number,total:number) {
  const start=Math.max(1,Math.min(page-2,total-4))
  return Array.from({length:Math.min(5,total)},(_,i)=>start+i)
}
