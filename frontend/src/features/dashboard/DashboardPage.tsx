import { useCallback, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button, StateCard } from '../../components/ui/Primitives.tsx'
import { Icon } from '../../components/ui/Icon.tsx'
import { StatePage } from '../../pages/StatePage.tsx'
import { formatNumber, formatDateTime } from '../../localization/formatters.ts'
import type { Language } from '../../preferences/store.ts'
import type { DashboardApi } from './api.ts'
import type { DashboardState } from './resource.ts'
import { useDashboardApi, useDashboardResource } from './useDashboardResource.ts'
import { statusDistribution, creationInstant, queueStatuses } from './viewModels.ts'
import './dashboard.css'

export function DashboardPage() {
  const { api, binding, ownOnly, memoryOnly, allowed } = useDashboardApi()
  return allowed ? <Dashboard api={api} binding={binding} ownOnly={ownOnly} memoryOnly={memoryOnly} /> : <StatePage kind="forbidden" />
}
function SectionData<T>({ state, retry, children }: { state: DashboardState<T>; retry: () => void; children: (data: T) => ReactNode }) {
  const { t } = useTranslation('dashboard')
  if (state.status === 'ready' && state.data) return children(state.data)
  const kind = state.error === 'timeout' ? 'timeout' : state.error ? 'error' : 'loading'
  return <div className="dashboard-state" aria-busy={!state.error}><StateCard level={2} state={`dashboard-${kind}`} loading={!state.error}
    title={t(`${kind}.title`)} body={t(`${kind}.body`)}>
    {state.error && <Button variant="secondary" onClick={retry}>{t('retry')}</Button>}
  </StateCard></div>
}
function Dashboard({ api, binding, ownOnly, memoryOnly }: { api: DashboardApi; binding: string; ownOnly: boolean; memoryOnly: boolean }) {
  const { t, i18n } = useTranslation('dashboard')
  const language = i18n.language as Language
  const n = (value: number) => formatNumber(value, language)
  const [params] = useSearchParams()
  const [memoryStatus, setMemoryStatus] = useState('')
  // AuthRoot reserves the complete query for ?memory=1. Keep queue selection
  // local in that mode; requests still use the same server-side status filter.
  const status = memoryOnly ? memoryStatus : params.get('status') ?? ''
  const overview = useDashboardResource(`${binding}:overview`, api.overview)
  const work = useDashboardResource(`${binding}:work`, api.work)
  const delivery = useDashboardResource(`${binding}:delivery`, api.delivery)
  const recentLoad = useCallback((signal: AbortSignal) => api.recent(status, signal), [api, status])
  const recent = useDashboardResource(`${binding}:recent:${status}`, recentLoad)
  const refresh = () => { overview.refresh(); work.refresh(); delivery.refresh(); recent.refresh() }
  const statusLabel = (value: string) => i18n.exists(`dashboard:status.${value}`) ? t(`status.${value}`) : t('unknownStatus')
  const queue = (value: string, count: number, description: string) => {
    const content = <>
      <span className="dashboard-queue-copy"><strong>{statusLabel(value)}</strong><small>{t(description)}</small></span>
      <span className="dashboard-queue-count">{n(count)}</span><Icon name="chevron" className="icon-directional" />
    </>
    return <li key={value}>{memoryOnly
      ? <button type="button" aria-pressed={status === value} onClick={() => setMemoryStatus(value)}>{content}</button>
      : <Link to={`/dashboard?status=${encodeURIComponent(value)}`} aria-current={status === value ? 'true' : undefined}>{content}</Link>}</li>
  }
  return <div className="dashboard-feature" data-page="dashboard">
    <header className="page-heading dashboard-heading"><div><h1>{t('title')}</h1><p>{t('intro')}</p></div>
      <Button variant="secondary" data-action="dashboard-refresh" onClick={refresh}><Icon name="refresh" />{t('refresh')}</Button>
    </header>
    <p className="dashboard-scope"><Icon name="lock" />{t(ownOnly ? 'scopeOwn' : 'scopeTenant')}</p>
    <section className="dashboard-overview" aria-labelledby="dashboard-overview-title" data-dashboard-section="overview">
      <h2 id="dashboard-overview-title" className="sr-only">{t('overview')}</h2>
      <SectionData {...overview} retry={overview.refresh}>{data => <>
        <dl className="dashboard-kpis">
          <div className="dashboard-total"><dt>{t('total')}</dt><dd data-kpi="total">{n(data.total_changes)}</dd><dd className="dashboard-kpi-hint">{t('totalHint')}</dd></div>
          <div><dt>{t('pending')}</dt><dd data-kpi="pending">{n(data.pending_approval)}</dd><dd className="dashboard-kpi-hint">{t('pendingHint')}</dd></div>
          <div><dt>{t('awaiting')}</dt><dd data-kpi="awaiting">{n(data.needs_more_information)}</dd><dd className="dashboard-kpi-hint">{t('awaitingHint')}</dd></div>
        </dl>
        {data.total_changes === 0 && <p className="dashboard-empty" data-state="dashboard-empty">{t('empty')}</p>}
        <div className="dashboard-distribution"><div><h2>{t('distribution')}</h2><p>{t('distributionHint')}</p></div>
          <dl>{statusDistribution(data).map(row => <div key={row.status} className="dashboard-status-row">
            <dt>{statusLabel(row.status)}</dt><dd>{n(row.count)}</dd>
            <dd className="dashboard-bar-track" aria-hidden="true"><span style={{ inlineSize: `${row.count / Math.max(1, ...statusDistribution(data).map(s => s.count)) * 100}%` }} /></dd>
          </div>)}</dl>
        </div>
      </>}</SectionData>
    </section>
    <div className="dashboard-queues">
      <section aria-labelledby="dashboard-work-title" data-dashboard-section="work"><header><Icon name="changes" /><div><h2 id="dashboard-work-title">{t('work')}</h2><p>{t('workHint')}</p></div></header>
        <SectionData {...work} retry={work.refresh}>{data => <ul className="dashboard-queue-list">
          {queue('Pending Approval', data.pending_review, 'reviewHint')}{queue('Needs More Information', data.awaiting_requester, 'requesterHint')}
        </ul>}</SectionData>
      </section>
      <section aria-labelledby="dashboard-delivery-title" data-dashboard-section="delivery"><header><Icon name="catalog" /><div><h2 id="dashboard-delivery-title">{t('delivery')}</h2><p>{t('deliveryHint')}</p></div></header>
        <SectionData {...delivery} retry={delivery.refresh}>{data => <ul className="dashboard-queue-list">
          {queue('Approved', data.approved_ready, 'approvedHint')}{queue('In Progress', data.in_progress, 'progressHint')}
          {queue('Implemented', data.pending_pir, 'implementedHint')}{queue('Failed', data.failed, 'failedHint')}
        </ul>}</SectionData>
      </section>
    </div>
    <section className="dashboard-recent" aria-labelledby="dashboard-recent-title" data-dashboard-section="recent">
      <header><div><h2 id="dashboard-recent-title">{t(status && (queueStatuses as readonly string[]).includes(status) ? 'queueRecords' : 'recent')}</h2><p>{t('recentHint')}</p></div>
        <Link className="btn btn-secondary" to="/changes">{t('allChanges')}</Link></header>
      {status && <div className="dashboard-filter"><span>{t('filter')}: {statusLabel(status)}</span>{memoryOnly
        ? <Button variant="ghost" onClick={() => setMemoryStatus('')}>{t('clear')}</Button>
        : <Link className="btn btn-ghost" to="/dashboard">{t('clear')}</Link>}</div>}
      <SectionData {...recent} retry={recent.refresh}>{data => <>
        <p className="dashboard-result-count">{t('showing', { visible: n(data.items.length), total: n(data.total) })}</p>
        {!data.items.length ? <p className="dashboard-empty" data-state="dashboard-recent-empty">{t('noRecords')}</p> : <table className="dashboard-table">
          <caption className="sr-only">{t('recentTable')}</caption><thead><tr>{['request','recordStatus','priority','created'].map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>
          <tbody>{data.items.map(item => <tr key={item.id}>
            <td><Link to={`/changes/${item.id}`}><bdi>{item.title}</bdi><small><bdi dir="ltr">#{item.id}</bdi></small></Link></td>
            <td data-label={t('recordStatus')}><span className="badge dashboard-status">{statusLabel(item.status)}</span></td>
            <td data-label={t('priority')}>{i18n.exists(`dashboard:priorities.${item.priority}`) ? t(`priorities.${item.priority}`) : t('unknownPriority')}</td>
            <td data-label={t('created')}><time dateTime={creationInstant(item.created_at)}>{formatDateTime(creationInstant(item.created_at), 'utc', language)}</time></td>
          </tr>)}</tbody></table>}
      </>}</SectionData>
    </section>
    <aside className="dashboard-boundary"><Icon name="info" /><p>{t('boundary')}</p></aside>
  </div>
}
