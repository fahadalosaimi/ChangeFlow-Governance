import { useState } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/useAuth.ts'
import { usePreferences } from '../preferences/context.ts'
import { Sidebar, NavigationLinks } from '../components/navigation/Sidebar.tsx'
import { MobileNavigation } from '../components/navigation/MobileNavigation.tsx'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs.tsx'
import { PreferenceControls } from '../components/navigation/PreferenceControls.tsx'
import { Brand } from '../components/navigation/Brand.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { Button, Notice, TableFrame } from '../components/ui/Primitives.tsx'
import { Dialog } from '../components/ui/Dialog.tsx'
import { RouteSurface } from '../components/ui/RouteSurface.tsx'

export function AppLayout() {
  const { t } = useTranslation(['shell', 'common', 'auth'])
  const { state, store, runtime } = useAuth()
  const { state: preferences } = usePreferences()
  const [drawer, setDrawer] = useState(false)
  const [account, setAccount] = useState(false)
  const [verify, setVerify] = useState(false)
  const user = state.user!
  const logout = () => { store.logout(); runtime.navigate('/login?logout=1') }
  return <div className="shell" data-workspace-shell>
    <Sidebar />
    <div className="shell-body"><header className="topbar">
      <Button variant="ghost" className="btn-icon mobile-menu-trigger" aria-label={t('common:actions.menu')}
        aria-expanded={drawer} data-action="open-menu" onClick={() => setDrawer(true)}><Icon name="menu" /></Button>
      <div className="workspace-context workspace-identity"><span className="workspace-avatar"><Icon name="workspace" /></span>
        <div><small>{t('context.workspace')}</small><bdi dir="ltr">{user.workspace_slug}</bdi></div>
      </div>
      <div className="topbar-actions"><PreferenceControls />
        <Button variant="ghost" className="btn-icon" data-action="verify" aria-label={t('common:actions.verify')}
          title={t('common:actions.verify')} onClick={() => setVerify(true)}><Icon name="refresh" /></Button>
        <Button variant="ghost" className="user-trigger" data-action="account" aria-label={t('common:actions.account')} onClick={() => setAccount(true)}>
          <span className="user-initial" aria-hidden="true">{Array.from(user.full_name)[0]}</span><span className="user-name"><bdi>{user.full_name}</bdi></span>
        </Button>
        <Button variant="ghost" className="btn-icon" data-action="logout" aria-label={t('common:actions.logout')}
          title={t('common:actions.logout')} onClick={logout}><Icon name="logout" className="icon-directional" /></Button>
      </div>
    </header>
      <main id="main-content" className="page-content" tabIndex={-1}>
        <Breadcrumbs />
        {(state.storageWarning || preferences.storageWarning) && <div className="shell-notices">
          <Notice><p>{state.storageWarning && <><strong>{t('context.memory')}</strong><br /></>}{state.storageWarning ? t('auth:login.storageWarning') : t('common:preferences.warning')}</p></Notice>
        </div>}
        <RouteSurface><Outlet /></RouteSurface>
      </main>
    </div><MobileNavigation />
    <Dialog open={drawer} onClose={() => setDrawer(false)} title={t('nav.label')} className="drawer-dialog">
      <Brand /><NavigationLinks mobile onNavigate={() => setDrawer(false)} /><div className="drawer-preferences"><PreferenceControls /></div>
      <p className="muted small">{t('context.development')}</p>
    </Dialog>
    <Dialog open={account} onClose={() => setAccount(false)} title={t('context.account')}>
      <TableFrame label={t('context.account')}><table><caption className="sr-only">{t('context.account')}</caption><tbody>
        <tr><th scope="row">{t('context.account')}</th><td><bdi>{user.full_name}</bdi></td></tr>
        <tr><th scope="row">{t('context.email')}</th><td><bdi dir="ltr">{user.email}</bdi></td></tr>
        <tr><th scope="row">{t('context.role')}</th><td><bdi>{user.role_name}</bdi></td></tr>
      </tbody></table></TableFrame><PreferenceControls />
      <div className="button-row dialog-actions"><Button variant="secondary" onClick={logout}>{t('common:actions.logout')}</Button></div>
    </Dialog>
    <Dialog open={verify} onClose={() => setVerify(false)} title={t('verify.title')}>
      <p className="muted">{t('verify.body')}</p><div className="button-row dialog-actions">
        <Button variant="secondary" onClick={() => setVerify(false)}>{t('common:actions.cancel')}</Button>
        <Button data-action="confirm-verify" onClick={() => { setVerify(false); void store.recover() }}>{t('common:actions.confirmVerify')}</Button>
      </div>
    </Dialog>
  </div>
}
