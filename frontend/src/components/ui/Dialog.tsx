import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Primitives.tsx'
import { Icon } from './Icon.tsx'

export function Dialog({ open, onClose, title, children, className = '' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { t } = useTranslation('common')
  useEffect(() => {
    const dialog = ref.current!
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [open])
  return <dialog ref={ref} className={`ui-dialog ${className}`} aria-labelledby={titleId}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href],button,input,select,textarea,[tabindex]',
      )).filter(element => element.tabIndex >= 0 && !element.matches(':disabled')
        && !element.closest('[inert]') && element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls.at(-1)
      // Native modal inertness stays in charge; keep boundary Tab presses inside
      // the dialog instead of allowing the browser chrome to take focus.
      if (!first || (event.shiftKey && document.activeElement === first)
        || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target?.focus()
      }
    }}
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-body"><div className="dialog-heading"><h2 id={titleId}>{title}</h2>
      <Button variant="ghost" className="btn-icon" aria-label={t('actions.close')} onClick={onClose}><Icon name="close" /></Button>
    </div>{children}</div>
  </dialog>
}
