import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from './Icon.tsx'

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button type="button" {...props} className={`btn btn-${variant} ${className}`} />
}

export function TextField({ label, hint, error, trailing, technical, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; hint?: string; error?: string; trailing?: ReactNode; technical?: boolean
}) {
  const generated = useId()
  const id = input.id ?? generated
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label>
    <div className={`input-wrap ${technical ? 'technical-field' : ''}`}>
      <input {...input} id={id} className={`ui-input ${trailing ? 'has-trailing' : ''}`} dir={technical ? 'ltr' : undefined}
        aria-describedby={described} aria-invalid={Boolean(error) || undefined} />
      {trailing && <div className="input-trailing">{trailing}</div>}
    </div>
    {hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
  </div>
}

export function SelectField({ label, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <select {...props} aria-label={label} className={`ui-select ${className}`}>{children}</select>
}

export function Notice({ children, tone = 'info', className = '' }: { children: ReactNode; tone?: 'info' | 'error' | 'success'; className?: string }) {
  return <div className={`notice notice-${tone} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon name={tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'info'} /><div>{children}</div>
  </div>
}

export function Skeleton({ short = false }: { short?: boolean }) {
  return <span aria-hidden="true" className={`skeleton ${short ? 'skeleton-short' : ''}`} />
}

export function StateCard({ title, body, icon = 'info', children, loading = false, state, level = 1 }: {
  title: string; body: string; icon?: IconName; children?: ReactNode; loading?: boolean; state?: string; level?: 1 | 2
}) {
  return <section className="ui-card state-card" data-state={state} role={loading ? 'status' : undefined}>
    <div className="state-icon"><Icon name={icon} /></div>
    {level === 1 ? <h1>{title}</h1> : <h2>{title}</h2>}<p>{body}</p>
    {loading && <><Skeleton /><Skeleton short /></>}{children}
  </section>
}

export function RiskBadge({ risk }: { risk: 'critical' | 'high' | 'medium' | 'low' | 'unknown' }) {
  const { t } = useTranslation('common')
  return <span className={`badge risk-${risk}`}><Icon name={risk === 'unknown' ? 'info' : risk === 'low' ? 'check' : 'alert'} />{t(`risk.${risk}`)}</span>
}

export function TableFrame({ label, children }: { label: string; children: ReactNode }) {
  return <div className="table-frame" role="region" aria-label={label} tabIndex={0}>{children}</div>
}
