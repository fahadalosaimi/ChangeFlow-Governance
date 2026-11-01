import { useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/useAuth.ts'

export function WorkspaceLoginPage() {
  const { store, state } = useAuth()
  const [workspace, setWorkspace] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!workspace.trim() || !email.trim() || !password) {
      setValidation('Enter your workspace, email address, and password.')
      return
    }
    const input = { tenant_slug: workspace.trim(), email: email.trim(), password }
    setPassword('')
    setValidation('')
    void store.login(input)
  }
  const message = validation || (state.reason === 'credentials'
    ? 'Unable to sign in. Check your workspace, email, and password.'
    : state.reason === 'expired' || state.reason === 'invalid'
      ? 'Your session ended or could not be verified. Sign in again.' : '')
  return <main className="login-page"><section className="panel login-panel auth-panel" aria-labelledby="login-title">
    <span className="login-eyebrow">ChangeFlow Governance</span>
    <h1 id="login-title">Workspace sign in</h1>
    <p>Use the workspace identifier provided by your organization. Accounts are provisioned by invitation.</p>
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="workspace">Workspace</label>
      <input id="workspace" name="tenant_slug" value={workspace} onChange={(event) => setWorkspace(event.target.value)}
        autoComplete="organization" autoCapitalize="none" spellCheck={false} required />
      <label htmlFor="login-email">Email address</label>
      <input id="login-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
        autoComplete="username" required />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" name="password" type="password" value={password}
        onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      {message && <p role="alert" className="login-error">{message}</p>}
      <button type="submit" className="primary-button login-button">Sign in</button>
    </form>
    {state.storageWarning && <p role="status">Session storage is unavailable. Sign-in works in memory;
      refresh may require sign-in again. Close this tab if saved-session removal is blocked.</p>}
    {state.reason === 'logout' && <p role="status">Signed out locally. Backend token revocation is not yet available.</p>}
  </section></main>
}
