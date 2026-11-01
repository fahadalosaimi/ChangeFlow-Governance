import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../features/auth/useAuth.ts'
import { Button, TextField, Notice } from '../components/ui/Primitives.tsx'
import { Icon } from '../components/ui/Icon.tsx'

export function WorkspaceLoginPage() {
  const { store, state } = useAuth()
  const { t } = useTranslation(['auth', 'common'])
  const [visible, setVisible] = useState(false)
  const [workspace, setWorkspace] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validation, setValidation] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!workspace.trim() || !email.trim() || !password) {
      setValidation('login.required')
      return
    }
    const input = { tenant_slug: workspace.trim(), email: email.trim(), password }
    setPassword('')
    setValidation('')
    void store.login(input)
  }
  const messageKey = validation || (state.reason === 'credentials'
    ? 'login.credentials'
    : state.reason === 'expired' || state.reason === 'invalid'
      ? 'login.ended' : '')
  return <section aria-labelledby="login-title" data-page="login">
    <h1 id="login-title">{t('login.title')}</h1><p className="auth-intro">{t('login.body')}</p>
    <form className="login-form auth-form" onSubmit={submit} noValidate>
      <TextField id="workspace" name="tenant_slug" label={t('login.workspace')} hint={t('login.workspaceHint')}
        value={workspace} onChange={event => setWorkspace(event.target.value)} technical
        autoComplete="organization" autoCapitalize="none" spellCheck={false} required />
      <TextField id="login-email" name="email" type="email" label={t('login.email')} value={email}
        onChange={event => setEmail(event.target.value)} technical autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      <TextField id="login-password" name="password" type={visible ? 'text' : 'password'} label={t('login.password')}
        value={password} onChange={event => setPassword(event.target.value)} technical autoComplete="current-password" required
        trailing={<Button variant="ghost" className="btn-icon" aria-pressed={visible}
          aria-label={t(visible ? 'common:actions.hidePassword' : 'common:actions.showPassword')} onClick={() => setVisible(!visible)}>
          <Icon name={visible ? 'eyeOff' : 'eye'} /></Button>} />
      {messageKey && <Notice tone="error" className="login-error"><p>{t(messageKey)}</p></Notice>}
      <Button type="submit">{t('common:actions.login')}<Icon name="arrow" className="icon-directional" /></Button>
    </form><p className="auth-footnote">{t('login.invitationOnly')}</p>
    <div className="auth-notices">
      {state.storageWarning && <Notice><p>{t('login.storageWarning')}</p></Notice>}
      {state.reason === 'logout' && <Notice><p>{t('login.localLogout')}</p></Notice>}
    </div>
  </section>
}
