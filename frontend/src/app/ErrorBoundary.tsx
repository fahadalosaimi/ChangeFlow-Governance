import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AuthLayout } from '../layouts/AuthLayout.tsx'
import { Button, StateCard } from '../components/ui/Primitives.tsx'

// Never render or log caught errors, locations, request objects, or auth inputs.
export function RouteErrorBoundary() {
  const { t } = useTranslation(['states', 'common'])
  return <AuthLayout><StateCard title={t('unexpected.title')} body={t('unexpected.body')} state="unexpected">
    <div className="button-row"><Button onClick={() => window.location.reload()}>{t('common:actions.refresh')}</Button>
      <Link className="btn btn-secondary" to="/workspace">{t('common:actions.back')}</Link></div>
  </StateCard></AuthLayout>
}
