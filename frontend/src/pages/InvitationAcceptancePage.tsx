import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { useAuth } from '../features/auth/useAuth.ts'

export function InvitationAcceptancePage() {
  const { runtime } = useAuth()
  const flow = runtime.invitation
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const input = { full_name: name, password }
    setPassword('')
    void flow.submit(input)
  }
  const showForm = ['ready', 'pending', 'network', 'invalid_input'].includes(state.status)
  return <main className="login-page"><section className="panel login-panel auth-panel" aria-labelledby="invitation-title">
    <span className="login-eyebrow">ChangeFlow Governance</span>
    <h1 id="invitation-title">Accept workspace invitation</h1>
    {state.status === 'missing' && <p role="alert">This page has no usable invitation link. Reopen the original link
      or ask your workspace administrator for a new invitation. Refresh cannot recover a removed link.</p>}
    {state.status === 'unavailable' && <p role="alert">This invitation is unavailable. It may have expired,
      been revoked, or already been used. Sign in if you already completed acceptance, or request a new invitation.</p>}
    {state.status === 'accepted' && <p role="status">Membership activated. Sign in explicitly with your workspace
      and email to continue. No automatic sign-in was performed.</p>}
    {showForm && <><p>Choose a password of at least 8 characters and at most 72 UTF-8 bytes.
      Existing directory profile details remain controlled by your organization.</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="invite-name">Full name</label>
        <input id="invite-name" value={name} onChange={(event) => setName(event.target.value)}
          autoComplete="name" required disabled={state.status === 'pending'} />
        <label htmlFor="invite-password">New password</label>
        <input id="invite-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password" required disabled={state.status === 'pending'} />
        {state.status === 'invalid_input' && <p role="alert">Enter a name of 2–255 characters and a password within the stated limits.</p>}
        {state.status === 'network' && <p role="alert">The result could not be confirmed. No automatic retry was made.
          Try signing in if acceptance completed, or re-enter your password to retry explicitly.</p>}
        <button className="primary-button login-button" disabled={state.status === 'pending'} type="submit">
          {state.status === 'pending' ? 'Activating membership…' : 'Accept invitation'}</button>
      </form></>}
    <button className="secondary-button" onClick={() => runtime.navigate('/login?logout=1')}>
      {state.status === 'accepted' ? 'Continue to sign in' : 'Back to sign in'}</button>
  </section></main>
}
