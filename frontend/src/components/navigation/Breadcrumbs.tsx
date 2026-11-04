import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { resolveWorkspaceRoute } from '../../app/routePolicy.ts'
import { Icon } from '../ui/Icon.tsx'

export function Breadcrumbs() {
  const { t } = useTranslation('shell')
  const { pathname } = useLocation()
  const route = resolveWorkspaceRoute(pathname)
  return <nav className="breadcrumbs" aria-label={t('nav.breadcrumb')}><ol>
    <li>{pathname === '/workspace' ? <span aria-current="page">{t('nav.workspace')}</span> : <Link to="/workspace">{t('nav.workspace')}</Link>}</li>
    {route && pathname !== '/workspace' && <li><Icon name="chevron" className="icon-directional" />
      {route.systemId && <><Link className="systems-breadcrumb" to="/systems">{t('nav.systems')}</Link><Icon name="chevron" className="icon-directional" /></>}
      {route.changeId && pathname === `/changes/${route.changeId}` && <><Link className="changes-breadcrumb" to="/changes">{t('nav.changes')}</Link><Icon name="chevron" className="icon-directional" /></>}
      <span aria-current="page">{t(route.title)}{(route.changeId || route.systemId) && <> <bdi dir="ltr">#{route.changeId ?? route.systemId}</bdi></>}</span>
    </li>}
  </ol></nav>
}
