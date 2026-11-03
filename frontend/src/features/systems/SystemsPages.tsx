import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button, TextField, SelectField, Notice } from '../../components/ui/Primitives.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { StatePage } from '../../pages/StatePage.tsx'
import { formatNumber, formatDateTime } from '../../localization/formatters.ts'
import type { Language } from '../../preferences/store.ts'
import { ApiError } from '../../services/api/errors.ts'
import type { SystemsApi } from './api.ts'
import { positiveId } from './decoders.ts'
import { useSystemsApi, useSystemsResource } from './useSystemsResource.ts'
import { SystemBadge, SystemsState } from './SystemsState.tsx'
import './systems.css'

export function SystemsCatalogPage() {
  const { api, binding, allowed } = useSystemsApi()
  return allowed ? <Catalog api={api} binding={binding} /> : <StatePage kind="forbidden" />
}
function Catalog({ api, binding }: { api: SystemsApi; binding: string }) {
  const { t, i18n } = useTranslation('systems')
  const load = useCallback((signal: AbortSignal) => api.list(signal), [api])
  const { state, refresh } = useSystemsResource(`${binding}:catalog`, load)
  const [params, setParams] = useSearchParams()
  if (state.status !== 'ready' || !state.data) return <SystemsState error={state.error} retry={refresh} />
  const data = state.data
  const query = params.get('q') ?? '', environment = params.get('environment') ?? '', status = params.get('status') ?? ''
  const items = data.filter(item => (!environment || item.environment === environment) && (!status || item.status === status)
    && [item.name, item.system_type ?? '', String(item.id)].some(value => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
  const change = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }) }
  return <div className="systems-feature" data-page="systems-catalog">
    <header className="page-heading"><div><h1>{t('catalog')}</h1><p>{t('intro')}</p></div><span className="badge badge-accent"><Icon name="catalog" />{t('readOnly')}</span></header>
    <form className="systems-toolbar" role="search" aria-label={t('filters')} onSubmit={event => event.preventDefault()}>
      <TextField id="system-search" label={t('search')} placeholder={t('searchHint')} type="search" value={query} onChange={event => change('q', event.target.value)} />
      {(['environment', 'status'] as const).map(key => <label className="field" key={key}><span className="field-label">{t(`${key}Label`)}</span>
        <SelectField label={t(`${key}Label`)} value={key === 'environment' ? environment : status} onChange={event => change(key, event.target.value)}>
          <option value="">{t('all')}</option>{[...new Set([...data.map(item => item[key]), ...(params.get(key) ? [params.get(key)!] : [])])].map(value =>
            <option key={value} value={value}>{i18n.exists(`systems:${key}.${value}`) ? t(`${key}.${value}`) : value}</option>)}
        </SelectField></label>)}
      <Button variant="secondary" onClick={() => setParams({})}>{t('clear')}</Button>
    </form>
    <div className="systems-results" role="status"><strong>{t('results', { visible: formatNumber(items.length, i18n.language as Language), total: formatNumber(data.length, i18n.language as Language) })}</strong><span>{t('localFilters')}</span></div>
    {!items.length ? <section className="ui-card systems-empty"><Icon name="catalog" /><h2>{t(data.length ? 'noMatches' : 'empty')}</h2><p>{t(data.length ? 'noMatchesBody' : 'emptyBody')}</p></section>
      : <div className="systems-table-wrap"><table className="systems-table"><caption className="sr-only">{t('catalog')}</caption>
        <thead><tr>{['name', 'type', 'environmentLabel', 'statusLabel', 'criticalityLabel', 'assignment'].map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <td><Link className="system-name" to={`/systems/${item.id}`} aria-label={t('open', { name: item.name })}><span className="system-symbol"><Icon name="catalog" /></span><span><bdi>{item.name}</bdi><small><bdi dir="ltr">#{item.id}</bdi></small></span><Icon name="chevron" className="icon-directional" /></Link></td>
          <td data-label={t('type')}><bdi>{item.system_type ?? t('unavailable')}</bdi></td>
          <td data-label={t('environmentLabel')}><SystemBadge value={item.environment} category="environment" /></td>
          <td data-label={t('statusLabel')}><SystemBadge value={item.status} category="status" /></td>
          <td data-label={t('criticalityLabel')}><SystemBadge value={item.criticality} category="criticality" /></td>
          <td data-label={t('assignment')}><div className="system-references"><span>{t('department')}: <bdi>{item.department_id === null ? t('unassigned') : `#${item.department_id}`}</bdi></span><span>{t('owner')}: <bdi>{item.owner_id === null ? t('unassigned') : `#${item.owner_id}`}</bdi></span></div></td>
        </tr>)}</tbody></table></div>}
    <p className="systems-footnote">{t('assignmentHint')}</p>
  </div>
}

export function SystemDetailsPage() {
  const { api, binding, allowed } = useSystemsApi()
  const raw = useParams().systemId ?? ''
  const id = /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN
  if (!allowed) return <StatePage kind="forbidden" />
  return positiveId(id) ? <Details api={api} binding={binding} id={id} /> : <SystemsState error="not_found" />
}
function Details({ api, binding, id }: { api: SystemsApi; binding: string; id: number }) {
  const { t, i18n } = useTranslation('systems')
  const load = useCallback(async (signal: AbortSignal) => {
    const system = await api.system(id, signal)
    const [dependencies, incidents, profile] = await Promise.allSettled([api.dependencies(id, signal), api.incidents(id, signal), api.profile(id, signal)])
    for (const result of [dependencies, incidents, profile]) {
      if (result.status === 'rejected' && result.reason instanceof ApiError
        && ['unauthorized', 'forbidden', 'session_changed'].includes(result.reason.code)) throw result.reason
    }
    return { system, dependencies, incidents, profile }
  }, [api, id])
  const { state, refresh } = useSystemsResource(`${binding}:system:${id}`, load)
  if (state.status !== 'ready' || !state.data) return <SystemsState error={state.error} retry={refresh} />
  const { system, dependencies, incidents, profile } = state.data
  const impact = profile.status === 'fulfilled' ? profile.value : null
  const errorCode = (reason: unknown) => reason instanceof ApiError ? reason.code : 'network'
  return <div className="systems-feature" data-page="system-details" data-system-id={system.id}>
    <Link to="/systems" className="systems-back">{t('back')}</Link>
    <header className="page-heading"><div><p className="system-reference"><bdi dir="ltr">#{system.id}</bdi> <span>{t('readOnly')}</span></p><h1><bdi>{system.name}</bdi></h1><p>{system.description ?? t('noDescription')}</p></div><Button variant="secondary" data-action="systems-refresh" onClick={refresh}><Icon name="refresh" />{t('refresh')}</Button></header>
    <div className="system-overview"><section className="ui-card system-summary" aria-labelledby="system-summary"><h2 id="system-summary">{t('overview')}</h2>
      <dl className="system-facts">{[['type', system.system_type], ['department', impact?.department_name ?? (system.department_id === null ? null : `#${system.department_id}`)],
        ['service', impact?.service_name ?? (system.service_id === null ? null : `#${system.service_id}`)], ['owner', impact?.owner_name ?? (system.owner_id === null ? null : `#${system.owner_id}`)]]
        .map(([key, value]) => <div key={key}><dt>{t(key!)}</dt><dd><bdi>{value ?? t('unassigned')}</bdi></dd></div>)}
        <div><dt>{t('environmentLabel')}</dt><dd><SystemBadge category="environment" value={system.environment} /></dd></div>
        <div><dt>{t('statusLabel')}</dt><dd><SystemBadge category="status" value={system.status} /></dd></div>
        <div><dt>{t('criticalityLabel')}</dt><dd><SystemBadge category="criticality" value={system.criticality} /></dd></div>
      </dl></section><aside className="system-scope"><Icon name="catalog" /><h2>{t('oneHop')}</h2><p>{t('oneHopBody')}</p></aside></div>
    <section className="system-section" aria-labelledby="dependencies-heading"><h2 id="dependencies-heading">{t('dependencies')}</h2>
      {dependencies.status === 'rejected' ? <SystemsState section error={errorCode(dependencies.reason)} retry={refresh} /> : dependencies.value.length ? <ul className="system-relations">{dependencies.value.map(item => <li key={item.id}><bdi>{system.name}</bdi><Icon name="arrow" className="icon-directional" /><Link to={`/systems/${item.target_system_id}`}>{t('systemReference')} <bdi dir="ltr">#{item.target_system_id}</bdi></Link><span><bdi>{item.dependency_type}</bdi></span><SystemBadge category="criticality" value={item.impact_level} />{item.description && <p><bdi>{item.description}</bdi></p>}</li>)}</ul> : <p>{t('noDependencies')}</p>}
    </section>
    <section className="system-section" aria-labelledby="incidents-heading"><h2 id="incidents-heading">{t('incidents')}</h2>
      {incidents.status === 'rejected' ? <SystemsState section error={errorCode(incidents.reason)} retry={refresh} /> : incidents.value.length ? <ul className="system-incidents">{incidents.value.map(item => <li key={item.id}><div><h3><bdi>{item.title}</bdi></h3>{item.description && <p><bdi>{item.description}</bdi></p>}<dl><div><dt>{t('occurred')}</dt><dd>{formatDateTime(item.occurred_at, /(?:Z|[+-]\d{2}:\d{2})$/.test(item.occurred_at) ? 'utc' : 'organization-local', i18n.language as Language)}</dd></div><div><dt>{t('resolved')}</dt><dd>{item.resolved_at === null ? t('unavailable') : formatDateTime(item.resolved_at, /(?:Z|[+-]\d{2}:\d{2})$/.test(item.resolved_at) ? 'utc' : 'organization-local', i18n.language as Language)}</dd></div></dl></div><div><SystemBadge category="severity" value={item.severity} /><SystemBadge category="status" value={item.status} /></div></li>)}</ul> : <p>{t('noIncidents')}</p>}
    </section>
    <section className="system-section" aria-labelledby="impact-heading"><h2 id="impact-heading">{t('impact')}</h2>
      {profile.status === 'rejected' ? <SystemsState section error={errorCode(profile.reason)} retry={refresh} /> : <>
        <Notice><p>{t('originalEnglish')}</p></Notice><div className="system-narrative" lang="en" dir="ltr"><p>{profile.value.impact_summary}</p>
          {[['outgoing', profile.value.outgoing_dependencies], ['incoming', profile.value.incoming_dependencies], ['previous', profile.value.previous_incidents]].map(([key, values]) => <section key={key as string}><h3 lang={i18n.language} dir={i18n.dir()}>{t(key as string)}</h3>{(values as string[]).length ? <ul>{(values as string[]).map((value, index) => <li key={index}>{value}</li>)}</ul> : <p lang={i18n.language} dir={i18n.dir()}>{t('none')}</p>}</section>)}
        </div></>}
    </section>
  </div>
}
