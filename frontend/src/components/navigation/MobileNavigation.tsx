import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../features/auth/useAuth.ts'
import { navigationFor, withRecoveryMarker } from '../../app/routePolicy.ts'
import { Icon } from '../ui/Icon.tsx'

export function MobileNavigation() {
  const { t } = useTranslation('shell')
  const { state } = useAuth()
  const items = navigationFor(state.user!.permissions).filter(route => route.path !== '/foundation').slice(0, 3)
  return <nav className="mobile-bottom-nav" aria-label={t('nav.mobile')}>
    {items.map(route => <NavLink key={route.path} className="nav-link" data-nav-path={route.path}
      end={route.path === '/workspace'} to={withRecoveryMarker(route.path, state.storageWarning)}>
      <Icon name={route.icon} /><span>{t(route.title)}</span>
    </NavLink>)}
  </nav>
}
