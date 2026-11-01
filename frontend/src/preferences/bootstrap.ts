import { createLocalization } from '../localization/index.ts'
import { PreferenceStore } from './store.ts'

export function createPresentation() {
  const preferences = new PreferenceStore(() => window.localStorage)
  const localization = createLocalization(preferences.getSnapshot().language)
  const apply = () => {
    const { language, theme } = preferences.getSnapshot()
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar-SA' ? 'rtl' : 'ltr'
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
    if (localization.language !== language) void localization.changeLanguage(language)
  }
  apply()
  preferences.subscribe(apply)
  return { preferences, localization }
}
