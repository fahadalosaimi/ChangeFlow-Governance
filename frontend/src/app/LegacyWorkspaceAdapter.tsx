import { lazy, Suspense } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/useAuth.ts'
import { resolveWorkspaceRoute, routeAllowed, viewDestination, withRecoveryMarker } from './routePolicy.ts'
import { useToast } from '../components/ui/ToastContext.ts'
import { Button, Notice, StateCard } from '../components/ui/Primitives.tsx'
import { StatePage } from '../pages/StatePage.tsx'
import type { WorkspaceView } from '../features/auth/permissions.ts'

const LegacyApp = lazy(() => import('../App.tsx'))

export function LegacyWorkspaceAdapter() {
  const { state } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const notify = useToast()
  const { t, i18n } = useTranslation('shell')
  const route = resolveWorkspaceRoute(location.pathname)
  if (!route) return <StatePage kind="notFound" />
  if (!routeAllowed(location.pathname, state.user!.permissions)) return <StatePage kind="forbidden" />
  const go = (view: WorkspaceView, id?: number) => {
    const legacy = location.pathname.startsWith('/legacy/changes')
    const path = legacy && view === 'dashboard' ? '/legacy/changes'
      : legacy && view === 'details' && Number.isSafeInteger(id) && id! > 0 ? `/legacy/changes/${id}` : viewDestination(view, id)
    if (path !== location.pathname) void navigate(withRecoveryMarker(path, state.storageWarning))
  }
  const pending = <div lang={i18n.language} dir={i18n.dir()}><StateCard level={2} title={t('legacy.loading')} body={t('common:feedback.loading')} loading /></div>
  const failure = <div lang={i18n.language} dir={i18n.dir()}><StateCard level={2} title={t('legacy.dataError')} body={t('legacy.tryAgain')} state="record-error">
    <div className="button-row"><Button onClick={() => window.location.reload()}>{t('common:actions.retry')}</Button></div>
  </StateCard></div>
  return <>
    <header className="page-heading"><h1>{t(route.title)}{route.changeId && <> <bdi dir="ltr">#{route.changeId}</bdi></>}</h1>
      {route.view === 'dashboard' && state.user!.permissions.includes('changes.create') &&
        <Link className="btn btn-primary" to={withRecoveryMarker('/changes/new', state.storageWarning)}>{t('nav.newChange')}</Link>}
    </header>
    <Notice className="legacy-label"><p>{t('legacy.body')}</p></Notice>
    <Suspense fallback={pending}><div className="legacy-workspace" lang="en" dir="ltr" data-legacy-body>
      <LegacyApp view={route.view!} changeId={route.changeId} onView={go} onNotice={notify} pending={pending} failure={failure} />
    </div></Suspense><Outlet />
  </>
}
