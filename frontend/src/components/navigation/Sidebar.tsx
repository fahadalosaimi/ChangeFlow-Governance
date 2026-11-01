import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../features/auth/useAuth.ts'
import { navigationFor, withRecoveryMarker } from '../../app/routePolicy.ts'
import { Brand } from './Brand.tsx'
import { Icon } from '../ui/Icon.tsx'

export function NavigationLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('shell')
  const { state } = useAuth()
  return <nav aria-label={t(mobile ? 'nav.mobile' : 'nav.label')}><ul className="nav-list">
    {navigationFor(state.user!.permissions).map(route => <li key={route.path}>
      <NavLink to={withRecoveryMarker(route.path, state.storageWarning)} end={route.path === '/workspace'}
        className="nav-link" data-nav-path={route.path} onClick={onNavigate}>
        <Icon name={route.icon} /><span>{t(route.title)}</span>
      </NavLink>
    </li>)}
  </ul></nav>
}

export function Sidebar() {
  const { t } = useTranslation('shell')
  return <aside className="sidebar"><Brand /><NavigationLinks />
    <footer className="sidebar-footer"><span className="badge">{t('context.development')}</span><p>{t('home.limitsBody')}</p></footer>
  </aside>
}
