import { useEffect, useSyncExternalStore } from 'react'
import App from '../../App.tsx'
import { WorkspaceLoginPage } from '../../pages/WorkspaceLoginPage.tsx'
import { InvitationAcceptancePage } from '../../pages/InvitationAcceptancePage.tsx'
import { workspaceDestination } from './safeRedirect.ts'
import { useAuth } from './useAuth.ts'
import './auth.css'

export function AuthRoot() {
  const { runtime, store, state } = useAuth()
  useSyncExternalStore(runtime.subscribeRoute, runtime.getRouteSnapshot)
  const path = runtime.path()
  useEffect(() => {
    if (path === '/invitations/accept') return
    if (state.status === 'authenticated' && (path === '/' || path === '/login'))
      runtime.navigate(workspaceDestination(state.storageWarning), true)
    else if (state.status === 'anonymous' && (path === '/' || path === '/workspace'))
      runtime.navigate(state.reason === 'none' ? '/login' : '/login?logout=1', true)
  }, [path, runtime, state.status, state.reason, state.storageWarning])
  if (path === '/invitations/accept') return <InvitationAcceptancePage />
  if (!['/', '/login', '/workspace'].includes(path)) return <main className="login-page"><section className="panel auth-panel">
    <h1>Page not found</h1><button className="secondary-button" onClick={() => runtime.navigate('/login')}>Sign in</button>
  </section></main>
  if (state.status === 'checking') return <main className="login-page"><section className="panel auth-panel" role="status">
    <h1>Verifying workspace session…</h1><p>Protected data stays hidden until verification completes.</p>
  </section></main>
  if (state.status === 'unavailable' || state.status === 'forbidden') return <main className="login-page"><section className="panel auth-panel">
    <h1>{state.status === 'forbidden' ? 'Access restricted' : 'Session verification unavailable'}</h1>
    <p role="alert">{state.status === 'forbidden'
      ? 'Your current membership does not grant access. Contact your workspace administrator.'
      : 'Protected data stays hidden. Retry verification or return to sign in. No password was saved.'}</p>
    <div className="auth-actions"><button className="primary-button" onClick={() => { void store.recover() }}>Retry verification</button>
      <button className="secondary-button" onClick={() => { store.logout(); runtime.navigate('/login?logout=1') }}>Sign out locally</button></div>
  </section></main>
  if (state.status !== 'authenticated' || !state.user || !state.binding) return <WorkspaceLoginPage />
  return <><div className="workspace-identity" role="status">Workspace: <strong>{state.user.workspace_slug}</strong>
    {state.storageWarning && <span> · Memory-only session: refresh requires sign-in.</span>}
    <button className="secondary-button" onClick={() => { void store.recover() }} title="Rechecking clears unsaved workspace data">Verify membership</button>
    <small> Rechecking clears unsaved workspace data.</small></div>
    <App key={state.binding} /></>
}
