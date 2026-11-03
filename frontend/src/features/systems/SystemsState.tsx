import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button, StateCard } from '../../components/ui/Primitives.tsx'

export function SystemsState({ error, retry, section = false }: { error?: string; retry?: () => void; section?: boolean }) {
  const { t } = useTranslation('systems')
  const kind = error === 'not_found' ? 'missing' : error === 'forbidden' ? 'forbidden' : error ? 'error' : 'loading'
  return <div className="systems-state" aria-busy={!error}><StateCard state={`systems-${kind}`} title={t(`${kind}.title`)} body={t(`${kind}.body`)} level={section ? 2 : 1}
    icon={kind === 'forbidden' ? 'lock' : 'info'} loading={!error}>
    {error && <div className="button-row">{retry && kind !== 'missing' && <Button onClick={retry}>{t('retry')}</Button>}
      {!section && <Link className="btn btn-secondary" to="/systems">{t('back')}</Link>}</div>}
  </StateCard></div>
}

export function SystemBadge({ value, category }: { value: string; category: 'criticality' | 'environment' | 'status' | 'severity' }) {
  const { t, i18n } = useTranslation('systems')
  const key = `${category}.${value}`
  const known = i18n.exists(`systems:${key}`, { fallbackLng: false })
  const tone = ['Critical', 'High'].includes(value) ? 'attention' : ['Active', 'Low', 'Resolved'].includes(value) ? 'positive' : 'neutral'
  return <span className={`badge system-badge system-badge-${known ? tone : 'neutral'}`}>
    {known ? t(key) : <><span>{t('unknown')}</span> <bdi>{value}</bdi></>}
  </span>
}
