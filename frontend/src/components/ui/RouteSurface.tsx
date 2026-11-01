import { useLayoutEffect, useRef, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'

// Animate only the current DOM. No exit snapshot, delayed navigation, or remount.
export function RouteSurface({ children }: PropsWithChildren) {
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const { i18n } = useTranslation()
  useLayoutEffect(() => {
    const element = ref.current!
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches || typeof element.animate !== 'function') return
    const style = getComputedStyle(element)
    const duration = style.getPropertyValue('--motion-enter').trim()
    const animation = element.animate([
      { opacity: .96, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], {
      duration: Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000) || 200,
      easing: style.getPropertyValue('--ease').trim() || 'ease-out',
    })
    const stop = () => animation.cancel()
    preference.addEventListener('change', stop)
    return () => { stop(); preference.removeEventListener('change', stop) }
  }, [pathname, i18n.language])
  return <div ref={ref} className="route-surface" data-route-surface>{children}</div>
}
