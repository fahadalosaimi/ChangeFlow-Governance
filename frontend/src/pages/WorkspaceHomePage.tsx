import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/useAuth.ts'
import { navigationFor, withRecoveryMarker } from '../app/routePolicy.ts'
import { Icon } from '../components/ui/Icon.tsx'
import { TableFrame } from '../components/ui/Primitives.tsx'

export function WorkspaceHomePage() {
  const { t } = useTranslation(['shell', 'common'])
  const { state } = useAuth()
  const user = state.user!
  const areas = navigationFor(user.permissions).filter(route => route.path !== '/workspace')
  const description = { '/systems': 'home.systems', '/changes': 'home.changes', '/foundation': 'home.foundation', '/users': 'home.users', '/notifications': 'home.notifications' } as Record<string, string>
  return <div data-page="workspace-home">
    <div className="page-heading"><div><h1>{t('home.title')}</h1><p>{t('home.welcome', { name: user.full_name })} {t('home.body')}</p></div>
      {user.permissions.includes('changes.create') && <Link className="btn btn-primary" to={withRecoveryMarker('/changes/new', state.storageWarning)}><Icon name="plus" />{t('nav.newChange')}</Link>}
    </div>
    <div className="home-grid"><section aria-labelledby="areas-heading"><h2 id="areas-heading">{t('home.areas')}</h2>
      <div className="work-areas">{areas.length ? areas.map(area => <Link key={area.path}
        className="work-area" to={withRecoveryMarker(area.path, state.storageWarning)} aria-label={t('home.open', { area: t(area.title) })}>
        <span className="work-area-icon"><Icon name={area.icon} /></span>
        <div><h3>{t(area.title)}</h3><p>{t(description[area.path])}</p></div><Icon name="arrow" className="icon-directional" />
      </Link>) : <p className="muted">{t('home.identityOnly')}</p>}</div>
    </section><section className="ui-card context-card" aria-labelledby="context-heading"><h2 id="context-heading">{t('home.context')}</h2>
      <TableFrame label={t('home.context')}><table><caption className="sr-only">{t('home.context')}</caption><tbody>
        <tr><th scope="row">{t('context.workspace')}</th><td><bdi dir="ltr">{user.workspace_slug}</bdi></td></tr>
        <tr><th scope="row">{t('context.account')}</th><td><bdi>{user.full_name}</bdi></td></tr>
        <tr><th scope="row">{t('context.email')}</th><td><bdi dir="ltr">{user.email}</bdi></td></tr>
        <tr><th scope="row">{t('context.role')}</th><td><bdi>{user.role_name}</bdi></td></tr>
      </tbody></table></TableFrame><span className="badge badge-accent"><Icon name="check" />{t('context.verified')}</span>
      <p className="small muted permission-count">{t('common:feedback.permissionCount', { count: user.permissions.length })}</p>
    </section></div>
    <aside className="development-note"><Icon name="info" /><div><h2>{t('home.limits')}</h2><p>{t('home.limitsBody')}</p></div></aside>
  </div>
}
