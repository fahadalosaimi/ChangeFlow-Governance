import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Brand } from '../components/navigation/Brand.tsx'
import { PreferenceControls } from '../components/navigation/PreferenceControls.tsx'
import { Notice } from '../components/ui/Primitives.tsx'
import { usePreferences } from '../preferences/context.ts'
import { RouteSurface } from '../components/ui/RouteSurface.tsx'

export function AuthLayout({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation(['auth', 'common'])
  const { state } = usePreferences()
  return <div className="auth-frame">
    <aside className="auth-story" aria-hidden="true">
      <Brand />
      <div className="auth-story-content"><h2>{t('story.title')}</h2><p>{t('story.body')}</p>
        <div className="flow-illustration"><svg viewBox="0 0 420 160" fill="none" aria-hidden="true" focusable="false">
          <path d="M18 80h108c44 0 44-55 88-55h80 M126 80c44 0 44 55 88 55h80 M294 25c44 0 44 55 108 55M294 135c44 0 44-55 108-55" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
          <path d="M18 80h108c44 0 44-55 88-55h80c44 0 44 55 108 55" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="18" cy="80" r="8" fill="currentColor" /><circle cx="214" cy="25" r="7" fill="currentColor" />
          <circle cx="214" cy="135" r="7" stroke="currentColor" strokeWidth="2" /><circle cx="402" cy="80" r="9" fill="currentColor" />
        </svg></div>
        <div className="flow-words"><span>{t('story.flowChange')}</span><span>{t('story.flowImpact')}</span><span>{t('story.flowDecision')}</span></div>
      </div><p className="auth-story-footer">{t('story.footer')}</p>
    </aside>
    <div className="auth-main"><header className="auth-toolbar"><Brand className="auth-mobile-brand" /><PreferenceControls /></header>
      <main id="main-content" className="auth-content" tabIndex={-1}><RouteSurface>{children ?? <Outlet />}</RouteSurface>
        {state.storageWarning && <div className="auth-notices"><Notice><p>{t('common:preferences.warning')}</p></Notice></div>}
      </main>
    </div>
  </div>
}
