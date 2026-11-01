import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { StateCard } from '../components/ui/Primitives.tsx'

export function StatePage({ kind, level = 1 }: { kind: 'notFound' | 'forbidden' | 'unexpected'; level?: 1 | 2 }) {
  const { t } = useTranslation(['states', 'common'])
  return <StateCard title={t(`${kind}.title`)} body={t(`${kind}.body`)} icon={kind === 'forbidden' ? 'lock' : 'info'} state={kind} level={level}>
    <div className="button-row"><Link to="/workspace" className="btn btn-primary">{t('common:actions.back')}</Link></div>
  </StateCard>
}
