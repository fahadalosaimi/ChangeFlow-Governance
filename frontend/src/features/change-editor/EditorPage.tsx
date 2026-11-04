import {useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore,type FormEvent} from 'react'
import {Link,useParams} from 'react-router'
import {useTranslation} from 'react-i18next'
import {useAuth} from '../auth/useAuth.ts'
import {createWorkspaceGateway} from '../auth/workspaceGateway.ts'
import {createChangesApi} from '../changes/api.ts'
import {useChangesResource} from '../changes/useChangesResource.ts'
import {ChangesState} from '../changes/ChangesState.tsx'
import type {ChangeRecord} from '../changes/decoders.ts'
import type {SystemRecord} from '../systems/decoders.ts'
import {StatePage} from '../../pages/StatePage.tsx'
import {Button,Notice,TextField,SelectField} from '../../components/ui/Primitives.tsx'
import {controlledWritesAvailable} from './boundary.ts'
import {createEditorApi} from './api.ts'
import {ChangeMutation} from './mutation.ts'
import {emptyDraft,draftFromRecord,revisionAllowed,validateDraft,matchesWritten,editorEnums,type EditorDraft} from './form.ts'
import './editor.css'

export function EditorPage(){
  const {state,client,store}=useAuth(),raw=useParams().changeId
  const user=state.user!,binding=state.binding??'',revision=raw!==undefined,id=revision?Number(raw):null
  const gateway=useMemo(()=>createWorkspaceGateway(client,store.getSnapshot,binding),[client,store,binding])
  if(!controlledWritesAvailable||!user.permissions.includes(revision?'changes.revise':'changes.create'))return <StatePage kind="forbidden"/>
  if(revision&&(!/^[1-9]\d*$/.test(raw!)||!Number.isSafeInteger(id)))return <ChangesState error="not_found"/>
  return <EditorLoad key={`${binding}:${id}`} gateway={gateway} user={user} id={id}/>
}
type Gateway=ReturnType<typeof createWorkspaceGateway>
type User=NonNullable<ReturnType<typeof useAuth>['state']['user']>
function EditorLoad({gateway,user,id}:{gateway:Gateway;user:User;id:number|null}){
  const {t}=useTranslation('editor')
  const reads=useMemo(()=>createChangesApi(gateway,user.organization_id,user.id),[gateway,user.organization_id,user.id])
  const load=useCallback(async(signal:AbortSignal)=>{
    if(!user.permissions.includes('foundation.read'))throw new Error('unavailable')
    const [systems,record]=await Promise.all([reads.systems(signal),id===null?Promise.resolve(null):reads.detail(id,signal)])
    return {systems,record}
  },[reads,id,user.permissions])
  const resource=useChangesResource(`editor:${id}`,load),data=resource.state.data
  if(resource.state.status!=='ready'||!data)return <ChangesState error={resource.state.error} retry={resource.refresh}/>
  if(data.record&&!revisionAllowed(data.record,user.id,user.permissions))return <section className="ui-card state-card" data-editor-state="ineligible"><h1>{t('ineligible')}</h1><p>{t('eligibility')}</p><Link className="btn btn-secondary" to={`/changes/${id}`}>{t('readRecord')}</Link></section>
  return <EditorForm gateway={gateway} user={user} systems={data.systems} record={data.record}/>
}
function EditorForm({gateway,user,systems,record}:{gateway:Gateway;user:User;systems:SystemRecord[];record:ChangeRecord|null}){
  const {t,i18n}=useTranslation('editor'),{t:change}=useTranslation('changes')
  const [draft,setDraft]=useState<EditorDraft>(()=>record?draftFromRecord(record):emptyDraft())
  const [errors,setErrors]=useState<Partial<Record<keyof EditorDraft,string>>>({}),summary=useRef<HTMLDivElement>(null)
  const mutation=useMemo(()=>new ChangeMutation<ChangeRecord>(),[]),state=useSyncExternalStore(mutation.subscribe,mutation.getSnapshot)
  const api=useMemo(()=>createEditorApi(gateway,user.id),[gateway,user.id])
  const reads=useMemo(()=>createChangesApi(gateway,user.organization_id,user.id),[gateway,user.organization_id,user.id])
  useEffect(()=>mutation.cancel,[mutation])
  useEffect(()=>{if(Object.keys(errors).length)summary.current?.focus()},[errors])
  const locked=state.status==='saving'||state.status==='uncertain',ids=systems.map(s=>s.id)
  const set=<K extends keyof EditorDraft>(key:K,value:EditorDraft[K])=>setDraft(d=>({...d,[key]:value}))
  const submit=(event:FormEvent)=>{
    event.preventDefault()
    const checked=validateDraft(draft,ids,record!==null);setErrors(checked.errors)
    if(!checked.payload)return
    void mutation.run(signal=>record?api.revise(record.id,draft,ids,signal):api.create(draft,ids,signal),async(value,signal)=>{
      const fresh=await reads.detail(value.id,signal)
      if(!matchesWritten(fresh,value))throw new Error('unconfirmed')
    })
  }
  if(state.status==='rejected'&&(state.error==='forbidden'||state.error==='not_found'||state.error==='unauthorized'))return <ChangesState error={state.error}/>
  const readPath=record?`/changes/${record.id}`:'/changes?'+new URLSearchParams({search:draft.title})
  const field=(key:'title'|'description'|'business_justification'|'revision_comment'|'planned_start'|'planned_end'|'expected_downtime_minutes',large=false)=>{
    const error=errors[key]?t(`validation.${errors[key]}`):undefined,id=`editor-${key}`
    const required=key==='title'||key==='description'||key==='revision_comment',label=t(`fields.${key}`)+(required?` (${t('required')})`:'')
    return large?<div className="field" key={key}><label className="field-label" htmlFor={id}>{label}</label>
      <textarea id={id} className="ui-input" required={required} rows={key==='description'?5:3} value={draft[key]} onChange={e=>set(key,e.target.value)} aria-invalid={Boolean(error)||undefined} aria-describedby={error?`${id}-error`:undefined}/>
      {error&&<p id={`${id}-error`} className="field-error">{error}</p>}</div>:
      <TextField key={key} id={id} label={label} required={required} value={draft[key]} error={error} onChange={e=>set(key,e.target.value)}
        technical={key.startsWith('planned_')} placeholder={key.startsWith('planned_')?'2026-12-01T10:00':undefined}
        inputMode={key==='expected_downtime_minutes'?'numeric':undefined} hint={key.startsWith('planned_')?t('scheduleHint'):undefined}/>
  }
  const select=(key:keyof typeof editorEnums)=><div className="field" key={key}><label className="field-label" htmlFor={`editor-${key}`}>{t(`fields.${key}`)}</label>
    <SelectField id={`editor-${key}`} label={t(`fields.${key}`)} value={draft[key]} aria-invalid={Boolean(errors[key])||undefined} aria-describedby={errors[key]?`editor-${key}-error`:undefined} onChange={e=>set(key,e.target.value)}>
      {!(editorEnums[key] as readonly string[]).includes(draft[key])&&<option value={draft[key]}>{t('unknownValue')}</option>}
      {editorEnums[key].map(value=><option key={value} value={value}>{change(`enum.${key==='rollback_complexity'?'complexity':key==='security_sensitivity'?'sensitivity':key==='change_mode'?'mode':key}.${value}`)}</option>)}
    </SelectField>{errors[key]&&<p id={`editor-${key}-error`} className="field-error">{t('validation.enum')}</p>}</div>
  return <div className="editor-feature" data-page="change-editor">
    <header className="page-heading"><div><h1>{t(record?'revise':'create')}</h1><p>{t('subtitle')}</p></div><Link className="btn btn-secondary" to={readPath}>{t('cancel')}</Link></header>
    <Notice><p>{t('boundary')}</p></Notice>
    {state.status==='saved'&&state.data?<section className="ui-card state-card" data-editor-state="saved" role="status"><h2>{t('saved')}</h2><p>{t('savedBody')}</p><Link className="btn btn-primary" to={`/changes/${state.data.id}`}>{t('readRecord')}</Link></section>:<form noValidate data-editor-form onSubmit={submit}>
      <div className="editor-grid"><fieldset disabled={locked} className="editor-fields">
        <legend className="sr-only">{t(record?'revise':'create')}</legend>
        {Object.keys(errors).length>0&&<div ref={summary} tabIndex={-1} role="alert" data-editor-errors className="notice notice-error editor-errors"><h2>{t('reviewErrors')}</h2><ul>{Object.keys(errors).map(key=><li key={key}><a href={`#editor-${key}`} onClick={e=>{e.preventDefault();document.getElementById(`editor-${key}`)?.focus()}}>{t(`fields.${key}`)}: {t(`validation.${errors[key as keyof EditorDraft]}`)}</a></li>)}</ul></div>}
        <section className="ui-card editor-section" aria-labelledby="editor-information"><h2 id="editor-information">{t('information')}</h2>{field('title')}{field('description',true)}<div className="editor-pair">{select('change_type')}{select('change_mode')}{select('priority')}</div></section>
        <section className="ui-card editor-section" aria-labelledby="editor-scope"><h2 id="editor-scope">{t('scope')}</h2>
          <fieldset className="editor-systems" id="editor-affected_system_ids" tabIndex={-1} aria-describedby={errors.affected_system_ids?'editor-systems-error':undefined}>
            <legend>{t('fields.affected_system_ids')} ({t('required')})</legend>
            {systems.length?systems.map(s=><label key={s.id}><input type="checkbox" data-system-id={s.id} checked={draft.affected_system_ids.includes(s.id)} onChange={e=>set('affected_system_ids',e.target.checked?[...draft.affected_system_ids,s.id]:draft.affected_system_ids.filter(id=>id!==s.id))}/><span><bdi>{s.name}</bdi><small><bdi dir="ltr">#{s.id}</bdi></small></span></label>):<p>{t('noSystems')}</p>}
            {errors.affected_system_ids&&<p className="field-error" id="editor-systems-error">{t('validation.systems')}</p>}
          </fieldset>
        </section>
        <section className="ui-card editor-section" aria-labelledby="editor-schedule"><h2 id="editor-schedule">{t('schedule')}</h2><div className="editor-pair">{field('planned_start')}{field('planned_end')}{field('expected_downtime_minutes')}</div></section>
        <section className="ui-card editor-section" aria-labelledby="editor-risk"><h2 id="editor-risk">{t('riskInputs')}</h2><p>{t('noRiskPreview')}</p><div className="editor-pair">{select('rollback_complexity')}{select('security_sensitivity')}</div>{field('business_justification',true)}</section>
        {record&&<section className="ui-card editor-section" aria-labelledby="editor-revision"><h2 id="editor-revision">{t('revision')}</h2><p>{t('eligibility')}</p>{field('revision_comment',true)}</section>}
      </fieldset>
      <aside className="ui-card editor-review" aria-labelledby="editor-review"><h2 id="editor-review">{t('review')}</h2><dl><div><dt>{t('fields.title')}</dt><dd><bdi>{draft.title||t('notProvided')}</bdi></dd></div><div><dt>{t('selected')}</dt><dd>{new Intl.NumberFormat(i18n.language).format(draft.affected_system_ids.length)}</dd></div></dl><p>{t('reviewHint')}</p>
        {state.status==='rejected'&&<div role="alert" data-editor-state="rejected"><h3>{t('rejected')}</h3><p>{state.error==='configuration'?t('modeUnavailable'):t('rejectedBody',{status:state.http??''})}</p></div>}
        {state.status==='uncertain'&&<div role="alert" data-editor-state="uncertain"><h3>{t('uncertain')}</h3><p>{t('uncertainBody')}</p><Link className="btn btn-secondary" to={readPath}>{t('verify')}</Link></div>}
        <Button type="submit" data-editor-submit disabled={locked||systems.length===0}>{t(state.status==='saving'?'saving':'submit')}</Button>
      </aside></div>
    </form>}
  </div>
}
