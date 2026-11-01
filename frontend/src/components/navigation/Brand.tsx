import { useTranslation } from 'react-i18next'

export function Brand({ className = '' }: { className?: string }) {
  const { t } = useTranslation('common')
  return <span className={`brand ${className}`}>
    <svg className="brand-symbol" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 10h10a7 7 0 0 1 7 7v6a7 7 0 0 0 7 7M9 30h10a7 7 0 0 0 7-7v-6a7 7 0 0 1 7-7M9 20h13" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="7" cy="10" r="3" fill="currentColor" /><circle cx="7" cy="20" r="3" fill="currentColor" /><circle cx="7" cy="30" r="3" fill="currentColor" />
    </svg>
    <span className="brand-word"><strong dir="ltr">{t('brand.name')}</strong><small>{t('brand.descriptor')}</small></span>
  </span>
}
