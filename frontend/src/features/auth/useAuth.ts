import { useContext, useSyncExternalStore } from 'react'
import { AuthContext } from './AuthContext.ts'

export function useAuth() {
  const runtime = useContext(AuthContext)
  if (!runtime) throw new Error('Authentication boundary is required')
  const state = useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot)
  return { runtime, store: runtime.store, client: runtime.client, state }
}
