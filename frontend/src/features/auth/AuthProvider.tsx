import { useEffect, type PropsWithChildren } from 'react'
import type { AuthRuntime } from './runtime.ts'
import { AuthContext } from './AuthContext.ts'

export function AuthProvider({ runtime, children }: PropsWithChildren<{ runtime: AuthRuntime }>) {
  useEffect(() => { void runtime.store.start() }, [runtime])
  // start() is idempotent across StrictMode effect replay. Subscriptions belong
  // to useSyncExternalStore; effect cleanup must not destroy a refresh session.
  return <AuthContext.Provider value={runtime}>{children}</AuthContext.Provider>
}
