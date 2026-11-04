import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react'
import {Link,useLocation,useNavigate,useSearchParams} from 'react-router'
import {useTranslation} from 'react-i18next'
import {useAuth} from '../auth/useAuth.ts'
import {createWorkspaceGateway} from '../auth/workspaceGateway.ts'
import {ChangesResource} from '../changes/resource.ts'
import {visiblePages} from '../changes/query.ts'
import {creationInstant} from '../changes/decoders.ts'
import {StatePage} from '../../pages/StatePage.tsx'
import {Button,StateCard,TextField,SelectField} from '../../components/ui/Primitives.tsx'
import {Icon} from '../../components/ui/Icon.tsx'
import {ApiError} from '../../services/api/errors.ts'
import {formatDateTime,formatNumber} from '../../localization/formatters.ts'
import type {Language} from '../../preferences/store.ts'
import {createNotificationsApi,type NotificationsApi,type NoticeSnapshot,type NoticeAction} from './api.ts'
import {destination,type Notice} from './decoders.ts'
import {readQuery,serializeQuery,notificationTypes,type NotificationQuery} from './query.ts'
import {NotificationsMutation} from './mutation.ts'
import './notifications.css'

export function NotificationsPage(){
  const {state,client,store}=useAuth(),binding=state.binding??'',user=state.user!
  const api=useMemo(()=>createNotificationsApi(createWorkspaceGateway(client,store.getSnapshot,binding),{
    organization:user.organization_id,recipient:user.id,ownChangeId:user.role_name==='Requester'?user.id:undefined}),[client,store,binding,user.organization_id,user.id,user.role_name])
  const currentBinding=useCallback(()=>store.getSnapshot().binding===binding&&store.getSnapshot().status==='authenticated',[store,binding])
  if(!user.permissions.includes('notifications.own'))return <StatePage kind="forbidden"/>
  return <QueryBoundary key={binding} api={api} binding={binding} permissions={user.permissions} memoryOnly={state.storageWarning} currentBinding={currentBinding}/>
}
type Context={api:NotificationsApi;binding:string;permissions:readonly string[];memoryOnly:boolean;currentBinding:()=>boolean}
function safeQuery(value:unknown){try{return readQuery(new URLSearchParams(typeof value==='string'?value:''))}catch{return readQuery(new URLSearchParams())}}
function QueryBoundary(context:Context){
  const [params,setParams]=useSearchParams(),location=useLocation(),[memory,setMemory]=useState(()=>safeQuery(location.state?.notificationsReturn))
  const commit=useCallback((q:NotificationQuery)=>{if(context.memoryOnly)setMemory(q);else setParams(serializeQuery(q))},[context.memoryOnly,setParams])
  let query:NotificationQuery
  try{query=context.memoryOnly?memory:readQuery(params)}catch{return <NoticesState error="configuration" refresh={()=>setParams({})}/>}
  return <Board context={context} query={query} commit={commit}/>
}
function NoticesState({error,refresh}:{error?:string;refresh:()=>void}){
  const {t}=useTranslation('notifications'),kind=error==='forbidden'?'forbidden':error==='not_found'?'missing':error?'error':'loading'
  return <div data-notices-forbidden={kind==='forbidden'?'':undefined}><StateCard state={`notices-${kind}`} title={t(`${kind}.title`)} body={t(`${kind}.body`)} loading={!error}>
    {error&&<Button variant="secondary" onClick={refresh}>{t('refresh')}</Button>}
  </StateCard></div>
}
function Filters({query,commit,locked}:{query:NotificationQuery;commit:(q:NotificationQuery)=>void;locked:boolean}){
  const {t,i18n}=useTranslation('notifications'),[draft,setDraft]=useState(query)
  return <form className="notices-filters" aria-label={t('filters')} onSubmit={event=>{event.preventDefault();commit({...draft,page:1})}}>
    <TextField id="notices-search" label={t('search')} value={draft.search} disabled={locked} onChange={e=>setDraft({...draft,search:e.target.value})}/>
    <label className="field"><span className="field-label">{t('type')}</span><SelectField label={t('type')} data-notices-type value={draft.notification_type} disabled={locked} onChange={e=>setDraft({...draft,notification_type:e.target.value})}>
      <option value="">{t('allTypes')}</option>{[...new Set([...notificationTypes,...(draft.notification_type?[draft.notification_type]:[])])].map(code=><option key={code} value={code}>{notificationTypes.includes(code)?t(`types.${code}`):t('unknownType',{code})}</option>)}
    </SelectField></label>
    <label className="field"><span className="field-label">{t('status')}</span><SelectField label={t('status')} data-notices-unread value={String(draft.unread_only)} disabled={locked} onChange={e=>setDraft({...draft,unread_only:e.target.value==='true'})}><option value="false">{t('all')}</option><option value="true">{t('unreadOnly')}</option></SelectField></label>
    <label className="field"><span className="field-label">{t('rows')}</span><SelectField label={t('rows')} data-notices-rows value={draft.page_size} disabled={locked} onChange={e=>setDraft({...draft,page_size:Number(e.target.value)})}>
      {[...new Set([5,10,20,draft.page_size])].map(n=><option value={n} key={n}>{new Intl.NumberFormat(i18n.language).format(n)}</option>)}
    </SelectField></label>
    <div className="button-row"><Button type="submit" data-notices-apply disabled={locked}>{t('apply')}</Button><Button variant="secondary" data-notices-clear disabled={locked} onClick={()=>commit(readQuery(new URLSearchParams()))}>{t('clear')}</Button></div>
  </form>
}
function Board({context,query,commit}:{context:Context;query:NotificationQuery;commit:(q:NotificationQuery)=>void}){
  const {api,binding,permissions,currentBinding}=context,{t,i18n}=useTranslation('notifications'),navigate=useNavigate()
  const serial=serializeQuery(query),key=`${binding}:${serial}`,scope=useRef(serial);scope.current=serial
  const q=useMemo(()=>readQuery(new URLSearchParams(serial)),[serial])
  const resource=useMemo(()=>new ChangesResource<NoticeSnapshot>(),[]),mutation=useMemo(()=>new NotificationsMutation(),[])
  const raw=useSyncExternalStore(resource.subscribe,resource.getSnapshot),action=useSyncExternalStore(mutation.subscribe,mutation.getSnapshot)
  const snapshot=raw.key===key?raw:{key,status:'loading' as const}
  const denial=action.status==='rejected'&&['forbidden','not_found','unauthorized'].includes(action.error??'')
  const data=denial?undefined:snapshot.data
  const saving=action.status==='saving',locked=saving||action.status==='uncertain'
  const refresh=useCallback(async()=>{
    // A late linked-resource check must not replace the new filter's resource.
    if(scope.current!==serial||!currentBinding())throw new ApiError('session_changed')
    let observed:NoticeSnapshot|undefined
    await resource.load(key,async signal=>{observed=await api.snapshot(q,signal);return observed})
    const latest=resource.getSnapshot()
    if(latest.key!==key||latest.status!=='ready'||latest.data!==observed)throw new ApiError(latest.error==='forbidden'?'forbidden':latest.error==='not_found'?'not_found':'network')
    return observed!
  },[resource,key,api,q,currentBinding,serial])
  useEffect(()=>{void refresh().catch(()=>{});return resource.cancel},[refresh,resource])
  useEffect(()=>mutation.cancel,[mutation])
  useEffect(()=>{if(data&&q.page>data.page.total_pages&&!saving)commit({...q,page:data.page.total_pages})},[data,q,commit,saving])
  const current=()=>scope.current===serial&&currentBinding()
  const manualRefresh=()=>{if(denial){resource.cancel();mutation.clearRejection()}void refresh().catch(()=>{})}
  const run=(operation:NoticeAction)=>{
    let target:string|null=null
    if(operation.kind==='open'&&!destination(operation.notice,permissions))return
    void mutation.run(operation,async signal=>{
      if(operation.kind==='all')return api.all(signal)
      if(operation.kind==='one'||!operation.notice.is_read)return api.one(operation.notice.id,signal)
    },async signal=>{
      if(operation.kind==='open')target=await api.target(operation.notice,permissions,signal)
      if(!current())throw new ApiError('session_changed')
      await refresh()
    },current,()=>{if(target&&current())void navigate(target,{state:{notificationsReturn:serial}})})
  }
  const reconcile=()=>{const op=action.action;if(op)void mutation.reconcile(signal=>api.observe(op,signal),refresh,current)}
  const n=(v:number)=>formatNumber(v,i18n.language as Language)
  return <div className="notices-feature" data-page="notifications" aria-busy={saving}>
    <header className="page-heading"><div><h1>{t('title')}</h1><p>{t('scope')}</p></div><div className="button-row"><span className="notices-unread-badge" role="status">{t('unread')} <strong data-unread-count>{data?n(data.unread):'—'}</strong></span><Button variant="secondary" data-notices-refresh disabled={saving} onClick={manualRefresh}><Icon name="refresh"/>{t('refresh')}</Button></div></header>
    <Filters key={serial} query={q} commit={commit} locked={saving}/>
    <div className="notices-actions"><p>{t('allScope')}</p><Button variant="secondary" data-notices-mark-all disabled={!data||locked||data.unread===0} onClick={()=>run({kind:'all'})}><Icon name="check"/>{t('markAll')}</Button></div>
    {action.status!=='idle'&&<section className="notices-action-state" role={action.status==='confirmed'||action.status==='observed'?'status':'alert'} data-notice-action={action.status}>
      <h2>{t(`mutation.${action.status}`)}</h2><p>{t(action.status==='uncertain'?'mutation.uncertainBody':action.status==='observed'?'mutation.observedBody':action.status==='rejected'?'mutation.rejectedBody':'mutation.updateBody')}</p>
      {action.status==='uncertain'&&<Button variant="secondary" data-notices-reconcile onClick={reconcile}>{t('reconcile')}</Button>}
    </section>}
    {snapshot.status!=='ready'||!data?<NoticesState error={denial?action.error:snapshot.error} refresh={manualRefresh}/>:<>
      <p className="notices-results" role="status">{t('results',{visible:n(data.page.items.length),total:n(data.page.total)})}</p>
      {!data.page.items.length?<section className="ui-card state-card" data-notices-empty><h2>{t('empty')}</h2><p>{t('emptyBody')}</p></section>:<div className="notices-list">{data.page.items.map(notice=><NoticeCard key={notice.id} notice={notice} permissions={permissions} locked={locked} run={run}/>)}</div>}
      <nav className="notices-pagination" aria-label={t('pagination')}><span>{t('pageOf',{page:n(Math.min(q.page,data.page.total_pages)),total:n(data.page.total_pages)})}</span><div className="button-row">
        <Button variant="secondary" disabled={q.page<=1||saving} onClick={()=>commit({...q,page:q.page-1})}>{t('previous')}</Button>
        {visiblePages(Math.min(q.page,data.page.total_pages),data.page.total_pages).map(page=><Button key={page} variant={page===q.page?'primary':'secondary'} aria-current={page===q.page?'page':undefined} aria-label={t('goPage',{page:n(page)})} disabled={saving} onClick={()=>commit({...q,page})}>{n(page)}</Button>)}
        <Button variant="secondary" disabled={q.page>=data.page.total_pages||saving} onClick={()=>commit({...q,page:q.page+1})}>{t('next')}</Button>
      </div></nav>
    </>}
    <Link className="notices-legacy" data-legacy-notifications to="/legacy/notifications">{t('legacy')}</Link>
  </div>
}
function NoticeCard({notice,permissions,locked,run}:{notice:Notice;permissions:readonly string[];locked:boolean;run:(a:NoticeAction)=>void}){
  const {t,i18n}=useTranslation('notifications'),[expanded,setExpanded]=useState(false),language=i18n.language as Language
  const time=(value:string)=>formatDateTime(creationInstant(value),'utc',language)
  return <article className={`ui-card notice-card ${notice.is_read?'notice-read':'notice-unread'}`} data-notice-card={notice.id} aria-labelledby={`notice-${notice.id}`}>
    <div className="notice-marker"><Icon name={notice.is_read?'check':'bell'}/><span>{t(notice.is_read?'read':'unread')}</span></div>
    <div className="notice-content"><header><div><span className="notice-type">{notificationTypes.includes(notice.notification_type)?t(`types.${notice.notification_type}`):t('unknownType',{code:notice.notification_type})}</span><h2 id={`notice-${notice.id}`}><bdi>{notice.title}</bdi></h2></div><time dateTime={creationInstant(notice.created_at)}>{time(notice.created_at)}</time></header>
      <p><bdi>{expanded?notice.message:[...notice.message].slice(0,220).join('')+(notice.message.length>220?'…':'')}</bdi></p>
      {notice.is_read&&<p className="notice-read-time">{t('readAt')} {notice.read_at?<time data-read-at dateTime={creationInstant(notice.read_at)}>{time(notice.read_at)}</time>:t('unavailable')}</p>}
      {expanded&&<dl className="notice-details"><div><dt>{t('actor')}</dt><dd><bdi>{notice.actor_name}</bdi></dd></div>{notice.change_request_id&&<div><dt>{t('linkedChange')}</dt><dd><bdi dir="ltr">#{notice.change_request_id}</bdi></dd></div>}</dl>}
      <div className="button-row"><Button variant="ghost" data-notice-preview={notice.id} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{t(expanded?'less':'preview')}</Button>
        {!notice.is_read&&<Button variant="secondary" data-notice-mark disabled={locked} onClick={()=>run({kind:'one',notice})}>{t('markOne')}</Button>}
        {destination(notice,permissions)&&<Button variant="secondary" data-notice-open disabled={locked} onClick={()=>run({kind:'open',notice})}>{t('open')}</Button>}
      </div>
    </div>
  </article>
}
