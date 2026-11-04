import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button,TextField,SelectField } from '../../components/ui/Primitives.tsx'
import type { RequesterOption } from './decoders.ts'
import { readChangesQuery,serializeChangesQuery,statuses,risks,changeTypes,type ChangesQuery } from './query.ts'
export function ChangesFilters({query,requesters,ownOnly,commit}:{query:ChangesQuery;requesters:RequesterOption[];ownOnly:boolean;commit:(q:ChangesQuery)=>void}) {
  const {t,i18n}=useTranslation('changes')
  const [draft,setDraft]=useState(query),[invalid,setInvalid]=useState(false)
  const set=(key:keyof ChangesQuery,value:string|number)=>setDraft({...draft,[key]:value})
  return <form className="changes-filters" aria-label={t('filters')} onSubmit={event=>{
    event.preventDefault()
    try{const q={...draft,page:1};readChangesQuery(new URLSearchParams(serializeChangesQuery(q)));setInvalid(false);commit(q)}catch{setInvalid(true)}
  }}>
    <TextField id="changes-search" type="search" label={t('search')} hint={t('searchHint')} value={draft.search} onChange={e=>set('search',e.target.value)}/>
    {(['status','risk_level','change_type'] as const).map(key=><label className="field" key={key}><span className="field-label">{t(key)}</span>
      <SelectField label={t(key)} value={draft[key]} onChange={e=>set(key,e.target.value)}><option value="">{t('all')}</option>
        {(key==='status'?statuses:key==='risk_level'?risks:changeTypes).map(value=><option key={value} value={value}>{t(`enum.${key==='risk_level'?'risk':key}.${value}`)}</option>)}
      </SelectField></label>)}
    {!ownOnly&&<label className="field"><span className="field-label">{t('requester')}</span><SelectField label={t('requester')} value={draft.requester_id} onChange={e=>set('requester_id',e.target.value)}>
      <option value="">{t('allRequesters')}</option>{requesters.filter(r=>r.is_active!=='inactive').map(r=><option key={r.id} value={r.id}>{r.full_name}</option>)}
      {draft.requester_id&&!requesters.some(r=>String(r.id)===draft.requester_id&&r.is_active!=='inactive')&&<option value={draft.requester_id}>#{draft.requester_id}</option>}
    </SelectField></label>}
    {(['created_from','created_to'] as const).map(key=><TextField key={key} type="date" label={t(key)} value={draft[key]} onChange={e=>set(key,e.target.value)}/>)}
    <label className="field"><span className="field-label">{t('pageSize')}</span><SelectField label={t('pageSize')} value={draft.page_size} onChange={e=>set('page_size',Number(e.target.value))}>
      {[...new Set([5,10,20,draft.page_size])].map(n=><option value={n} key={n}>{new Intl.NumberFormat(i18n.language).format(n)}</option>)}
    </SelectField></label>
    <div className="button-row"><Button type="submit" data-action="changes-apply">{t('apply')}</Button><Button variant="secondary" onClick={()=>commit(readChangesQuery(new URLSearchParams()))}>{t('clear')}</Button></div>
    {invalid&&<p role="alert" className="changes-filter-error">{t('invalidQuery')}</p>}
  </form>
}
