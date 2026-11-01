import type { PropsWithChildren } from 'react'
import { I18nextProvider } from 'react-i18next'
import type { i18n } from 'i18next'
import { PreferenceContext } from '../preferences/context.ts'
import type { PreferenceStore } from '../preferences/store.ts'
import { AuthProvider } from '../features/auth/AuthProvider.tsx'
import type { AuthRuntime } from '../features/auth/runtime.ts'

export function AppProviders({ runtime, preferences, localization, children }: PropsWithChildren<{
  runtime: AuthRuntime; preferences: PreferenceStore; localization: i18n
}>) {
  return <I18nextProvider i18n={localization}><PreferenceContext.Provider value={preferences}>
    <AuthProvider runtime={runtime}>{children}</AuthProvider>
  </PreferenceContext.Provider></I18nextProvider>
}
