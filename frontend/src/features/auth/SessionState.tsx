import { useTranslation } from 'react-i18next'
import { Button, StateCard } from '../../components/ui/Primitives.tsx'
import { useAuth } from './useAuth.ts'

export function SessionState() {
  const { t } = useTranslation(['states', 'common'])
  const { state, store, runtime } = useAuth()
  const kind = state.status === 'checking' ? 'checking' : state.status === 'forbidden' ? 'forbidden' : 'unavailable'
  return <StateCard title={t(`${kind}.title`)} body={t(`${kind}.body`)} state={kind}
    loading={kind === 'checking'} icon={kind === 'forbidden' ? 'lock' : 'shield'}>
    {kind !== 'checking' && <div className="button-row">
      <Button data-action="retry-session" onClick={() => { void store.recover() }}>{t('common:actions.retry')}</Button>
      <Button variant="secondary" data-action="logout" onClick={() => { store.logout(); runtime.navigate('/login?logout=1') }}>{t('common:actions.login')}</Button>
    </div>}
  </StateCard>
}
