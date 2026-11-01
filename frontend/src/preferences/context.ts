import { createContext, useContext, useSyncExternalStore } from 'react'
import type { PreferenceStore } from './store.ts'

export const PreferenceContext = createContext<PreferenceStore | null>(null)
export function usePreferences() {
  const store = useContext(PreferenceContext)
  if (!store) throw new Error('Presentation preference boundary is required')
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return { state, store }
}
