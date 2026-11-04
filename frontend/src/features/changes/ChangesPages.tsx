import { useCallback,useEffect,useMemo,useState } from 'react'
import { Link,useLocation,useParams,useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button,Notice } from '../../components/ui/Primitives.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { StatePage } from '../../pages/StatePage.tsx'
import { formatNumber,formatDateTime } from '../../localization/formatters.ts'
import type { Language } from '../../preferences/store.ts'
import { readChangesQuery,serializeChangesQuery,visiblePages,type ChangesQuery } from './query.ts'
import { creationInstant } from './decoders.ts'
import { useChangesApi,useChangesResource } from './useChangesResource.ts'
import { ChangeValue,ChangesState } from './ChangesState.tsx'
import { ChangesFilters } from './ChangesFilters.tsx'
import { AssessmentPanel } from './AssessmentPanel.tsx'
import './changes.css'
type Context=ReturnType<typeof useChangesApi>
function returnQuery(value:unknown):ChangesQuery {
  try{return readChangesQuery(new URLSearchParams(typeof value==='string'?value:''))}catch{return readChangesQuery(new URLSearchParams())}
}

export function ChangesListPage() {
  const context=useChangesApi()
  return context.allowed?<ChangesList context={context}/>:<StatePage kind="forbidden"/>
}
function ChangesList({context}:{context:Context}) {
  const {t}=useTranslation('changes'),[params,setParams]=useSearchParams(),location=useLocation()
  const [memory,setMemory]=useState(()=>returnQuery(location.state?.changesReturn))
  const commit=useCallback((query:ChangesQuery)=>{if(context.memoryOnly)setMemory(query);else setParams(serializeChangesQuery(query))},[context.memoryOnly,setParams])
  let q:ChangesQuery
  try{q=context.memoryOnly?memory:readChangesQuery(params)}catch{return <section><ChangesState error="configuration"/><p>{t('invalidQuery')}</p><Button onClick={()=>setParams({})}>{t('clear')}</Button></section>}
  return <ListData context={context} query={q} commit={commit}/>
}
function ListData({context,query,commit}:{context:Context;query:ChangesQuery;commit:(q:ChangesQuery)=>void}) {
  const {api,binding,ownOnly,catalogAllowed,canCreate}=context
  const {t,i18n}=useTranslation('changes'),language=i18n.language as Language
  const serial=serializeChangesQuery(query)
  const stableQuery=useMemo(()=>readChangesQuery(new URLSearchParams(serial)),[serial])
  const load=useCallback((signal:AbortSignal)=>api.page(stableQuery,signal),[api,stableQuery])
  const result=useChangesResource(`${binding}:list:${serial}`,load)
  const requestersLoad=useCallback((signal:AbortSignal)=>!ownOnly&&catalogAllowed?api.requesters(signal):Promise.resolve([]),[api,ownOnly,catalogAllowed])
  const requesters=useChangesResource(`${binding}:requesters`,requestersLoad)
  const page=result.state.data
  useEffect(()=>{if(page&&stableQuery.page>page.total_pages)commit({...stableQuery,page:page.total_pages})},[page,stableQuery,commit])
  const n=(v:number)=>formatNumber(v,language)
  return <div className="changes-feature" data-page="changes-list">
    <header className="page-heading"><div><h1>{t('list')}</h1><p>{t(ownOnly?'scopeOwn':'scopeTenant')}</p></div>
      <div className="button-row">{canCreate&&<Link className="btn btn-secondary" to="/changes/new">{t('existingCreate')}</Link>}
      <Button variant="secondary" data-action="changes-refresh" onClick={result.refresh}><Icon name="refresh"/>{t('refresh')}</Button></div>
    </header>
    <ChangesFilters key={serial} query={query} requesters={requesters.state.data??[]} ownOnly={ownOnly} commit={commit}/>
    {requesters.state.error&&<div className="changes-option-error"><ChangesState section error={requesters.state.error} retry={requesters.refresh}/><p>{t('requestersUnavailable')}</p></div>}
    <Notice><p>{t('assessmentWarning')}</p></Notice>
    {result.state.status!=='ready'||!page?<ChangesState error={result.state.error} retry={result.refresh}/>:<>
      <p className="changes-results" role="status">{t('results',{visible:n(page.items.length),total:n(page.total)})}</p>
      {!page.items.length?<section className="ui-card changes-empty" data-state="changes-empty"><h2>{t('empty')}</h2><p>{t('emptyBody')}</p></section>:<table className="changes-table">
        <caption className="sr-only">{t('list')}</caption><thead><tr>{['request','requester','typePriority','status','storedAssessment','created'].map(key=><th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
        <tbody>{page.items.map(item=><tr key={item.id}>
          <td><Link className="change-title" state={{changesReturn:serial}} to={`/changes/${item.id}`}><bdi>{item.title}</bdi><small><bdi dir="ltr">#{item.id}</bdi></small></Link><p><bdi>{item.description}</bdi></p></td>
          <td data-label={t('requester')}><bdi>{item.requester_name??t('unavailable')}</bdi></td>
          <td data-label={t('typePriority')}><ChangeValue category="change_type" value={item.change_type}/><small><ChangeValue category="priority" value={item.priority}/></small></td>
          <td data-label={t('status')}><span className="badge changes-status"><ChangeValue category="status" value={item.status}/></span></td>
          <td data-label={t('storedAssessment')}><AssessmentPanel compact assessment={item.assessment}/></td>
          <td data-label={t('created')}><time dateTime={creationInstant(item.created_at)}>{formatDateTime(creationInstant(item.created_at),'utc',language)}</time></td>
        </tr>)}</tbody></table>}
      <nav className="changes-pagination" aria-label={t('pagination')}><span>{t('pageOf',{page:n(page.page),total:n(page.total_pages)})}</span><div className="button-row">
        <Button variant="secondary" disabled={query.page<=1} onClick={()=>commit({...query,page:query.page-1})}>{t('previous')}</Button>
        {visiblePages(Math.min(query.page,page.total_pages),page.total_pages).map(value=><Button key={value} variant={value===query.page?'primary':'secondary'} aria-current={value===query.page?'page':undefined} aria-label={t('goPage',{page:n(value)})} onClick={()=>commit({...query,page:value})}>{n(value)}</Button>)}
        <Button variant="secondary" disabled={query.page>=page.total_pages} onClick={()=>commit({...query,page:query.page+1})}>{t('next')}</Button>
      </div></nav>
    </>}
    <Link className="changes-legacy-link" data-action="legacy-changes" to="/legacy/changes">{t('legacyList')}</Link>
  </div>
}
export function ChangeDetailsPage() {
  const context=useChangesApi(),raw=useParams().changeId??''
  if(!context.allowed)return <StatePage kind="forbidden"/>
  const id=/^[1-9]\d*$/.test(raw)?Number(raw):NaN
  return Number.isSafeInteger(id)&&id>0?<Details context={context} id={id}/>:<ChangesState error="not_found"/>
}
function Details({context,id}:{context:Context;id:number}) {
  const {api,binding,catalogAllowed}=context
  const {t,i18n}=useTranslation('changes'),language=i18n.language as Language
  const location=useLocation(),backQuery=serializeChangesQuery(returnQuery(location.state?.changesReturn))
  const load=useCallback((signal:AbortSignal)=>api.detail(id,signal),[api,id])
  const result=useChangesResource(`${binding}:detail:${id}`,load)
  const systemLoad=useCallback((signal:AbortSignal)=>catalogAllowed?api.systems(signal):Promise.resolve([]),[api,catalogAllowed])
  const systems=useChangesResource(`${binding}:systems`,systemLoad)
  const record=result.state.data
  if(result.state.status!=='ready'||!record)return <ChangesState error={result.state.error} retry={result.refresh}/>
  const date=(value:string|null,created=false)=>value===null?t('unavailable'):formatDateTime(created?creationInstant(value):value,
    created||/(?:Z|[+-]\d{2}:\d{2})$/.test(value)?'utc':'organization-local',language)
  return <div className="changes-feature" data-page="change-details" data-change-id={record.id}>
    <Link className="changes-back" state={{changesReturn:backQuery}} to={context.memoryOnly?'/changes?memory=1':`/changes?${backQuery}`}>{t('back')}</Link>
    <header className="page-heading"><div><p className="muted small"><bdi dir="ltr">#{record.id}</bdi></p><h1><bdi>{record.title}</bdi></h1><p><ChangeValue category="status" value={record.status}/></p></div>
      <Button variant="secondary" data-action="change-refresh" onClick={result.refresh}><Icon name="refresh"/>{t('refresh')}</Button></header>
    <section className="ui-card change-overview" aria-labelledby="change-overview-title"><h2 id="change-overview-title">{t('information')}</h2><p><bdi>{record.description}</bdi></p>
      <dl className="change-facts">{[['change_type',record.change_type],['priority',record.priority],['mode',record.change_mode],['complexity',record.rollback_complexity],['sensitivity',record.security_sensitivity]].map(([key,value])=><div key={key}><dt>{t(key!)}</dt><dd><ChangeValue category={key!} value={value!}/></dd></div>)}
        <div><dt>{t('requester')}</dt><dd><bdi>{record.requester_name??t('unavailable')}</bdi>{record.requester_email&&<small><bdi dir="ltr">{record.requester_email}</bdi></small>}</dd></div>
        <div><dt>{t('downtime')}</dt><dd>{formatNumber(record.expected_downtime_minutes,language)}</dd></div>
        <div><dt>{t('justification')}</dt><dd><bdi>{record.business_justification??t('unavailable')}</bdi></dd></div>
        {(['created_at','updated_at','planned_start','planned_end'] as const).map(key=><div key={key}><dt>{t(key)}</dt><dd>{date(record[key],key==='created_at'||key==='updated_at')}</dd></div>)}
      </dl></section>
    <section className="change-systems" aria-labelledby="change-systems-title"><h2 id="change-systems-title">{t('systems')}</h2>
      {systems.state.error&&<><ChangesState section error={systems.state.error} retry={systems.refresh}/><p>{t('systemNamesUnavailable')}</p></>}
      {record.affected_system_ids.length?<ul>{record.affected_system_ids.map(sid=><li key={sid}><Link to={`/systems/${sid}`}><bdi>{systems.state.data?.find(s=>s.id===sid)?.name??`${t('systemReference')} #${sid}`}</bdi></Link></li>)}</ul>:<p>{t('noItems')}</p>}
    </section>
    {record.assessment.state==='ready'?<AssessmentPanel assessment={record.assessment}/>:<section className="ui-card changes-empty"><h2>{t('assessment')}</h2><AssessmentPanel assessment={record.assessment}/></section>}
    <Link className="changes-legacy-link" data-action="legacy-change-details" to={`/legacy/changes/${record.id}`}>{t('legacyDetails')}</Link>
  </div>
}
