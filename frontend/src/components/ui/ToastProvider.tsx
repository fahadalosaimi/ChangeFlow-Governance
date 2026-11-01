import { useRef, useState, type PropsWithChildren } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastContext } from './ToastContext.ts'
import { Button } from './Primitives.tsx'
import { Icon } from './Icon.tsx'

// This provider lives inside the keyed authenticated boundary, never across users.
export function ToastProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation('common')
  const next = useRef(0)
  const [items, setItems] = useState<{ id: number; message: string }[]>([])
  const show = (message: string) => {
    const item = { id: ++next.current, message }
    setItems(previous => [...previous.slice(-2), item])
  }
  return <ToastContext.Provider value={show}>{children}
    <div className="toast-stack">
      {items.map(item => <div className="toast" key={item.id} role="status" aria-atomic="true"><div>
        <strong>{t('feedback.message')}</strong><p lang="en" dir="ltr">{item.message}</p>
      </div><Button variant="ghost" className="btn-icon" aria-label={t('actions.dismiss')}
        onClick={() => setItems(previous => previous.filter(value => value.id !== item.id))}><Icon name="close" /></Button></div>)}
    </div>
  </ToastContext.Provider>
}
