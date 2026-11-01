import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigation, useNavigationType } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/useAuth.ts'
import { resolveWorkspaceRoute } from './routePolicy.ts'

export function RootFrame() {
  const { runtime } = useAuth()
  const location = useLocation()
  const navigation = useNavigation()
  const navigationType = useNavigationType()
  const previousPath = useRef(location.pathname)
  const { t, i18n } = useTranslation()
  useEffect(() => { runtime.syncLocation() }, [location.key, runtime])
  useLayoutEffect(() => {
    if (previousPath.current === location.pathname) return
    previousPath.current = location.pathname
    // New pages begin at the top before paint; POP keeps browser history scroll.
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    const frame = requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, navigationType])
  useEffect(() => {
    const route = resolveWorkspaceRoute(location.pathname)
    const title = route?.title ?? (location.pathname === '/login' ? 'auth:login.title'
      : location.pathname === '/invitations/accept' ? 'auth:invitation.title' : 'states:notFound.title')
    document.title = `${t(title)} | ${t('common:brand.name')}`
  }, [location.pathname, t, i18n.language])
  return <><a className="btn btn-primary skip-link" href="#main-content" onClick={event => {
    event.preventDefault(); document.getElementById('main-content')?.focus()
  }}>{t('common:skip')}</a>{navigation.state !== 'idle' && <div className="route-pending" role="status" aria-label={t('common:feedback.loading')} />}<Outlet /></>
}
