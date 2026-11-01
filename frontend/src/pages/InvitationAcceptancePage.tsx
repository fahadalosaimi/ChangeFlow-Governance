import { useState, useSyncExternalStore, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/useAuth.ts'
import { Button, Notice, TextField } from '../components/ui/Primitives.tsx'

export function InvitationAcceptancePage() {
  const { runtime } = useAuth()
  useSyncExternalStore(runtime.subscribeRoute, runtime.getRouteSnapshot)
  return <InvitationForm key={runtime.invitationVersion} />
}

function InvitationForm() {
  const { runtime } = useAuth()
  const { t } = useTranslation('auth')
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
  return <section aria-labelledby="invitation-title" data-page="invitation" data-invitation-state={state.status}>
    <h1 id="invitation-title">{t(state.status === 'accepted' ? 'invitation.acceptedTitle' : 'invitation.title')}</h1>
    <p className="auth-intro">{t('invitation.body')}</p>
    {state.status === 'missing' && <Notice tone="error"><p>{t('invitation.missing')}</p></Notice>}
    {state.status === 'unavailable' && <Notice tone="error"><p>{t('invitation.unavailable')}</p></Notice>}
    {state.status === 'accepted' && <Notice tone="success"><p>{t('invitation.accepted')}</p></Notice>}
    {showForm && <form className="login-form auth-form" onSubmit={submit} noValidate aria-busy={state.status === 'pending'}>
      <TextField id="invite-name" name="full_name" label={t('invitation.name')} value={name}
        onChange={event => setName(event.target.value)} autoComplete="name" required disabled={state.status === 'pending'} />
      <TextField id="invite-password" name="password" type="password" technical label={t('invitation.password')}
        value={password} hint={t('invitation.passwordHint')} onChange={event => setPassword(event.target.value)}
        autoComplete="new-password" required disabled={state.status === 'pending'} />
      {state.status === 'invalid_input' && <Notice tone="error"><p>{t('invitation.invalid')}</p></Notice>}
      {state.status === 'network' && <Notice tone="error"><p>{t('invitation.network')}</p></Notice>}
      <Button disabled={state.status === 'pending'} type="submit">{t(state.status === 'pending' ? 'invitation.pending' : 'invitation.submit')}</Button>
    </form>}
    <div className="button-row auth-notices"><Button variant="secondary" onClick={() => runtime.navigate('/login?logout=1')}>
      {t(state.status === 'accepted' ? 'invitation.continue' : 'invitation.back')}</Button></div>
  </section>
}
