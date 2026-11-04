import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar-SA.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }
import type { Language } from '../preferences/store.ts'

export const resources = { 'ar-SA': ar, en }
export function createLocalization(language: Language = 'ar-SA') {
  const instance = createInstance()
  void instance.use(initReactI18next).init({
    resources, lng: language, supportedLngs: ['ar-SA', 'en'], fallbackLng: 'ar-SA',
    ns: ['common', 'auth', 'shell', 'states', 'systems', 'dashboard', 'changes'], defaultNS: 'common', initAsync: false,
    debug: false, saveMissing: false, returnNull: false,
    interpolation: { escapeValue: false }, react: { useSuspense: false },
  })
  return instance
}
