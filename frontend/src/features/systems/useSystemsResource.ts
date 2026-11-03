import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { createWorkspaceGateway } from '../auth/workspaceGateway.ts'
import { createSystemsApi } from './api.ts'
import { SystemsResource } from './resource.ts'
import { ApiError } from '../../services/api/errors.ts'

export function useSystemsApi() {
  const { client, store, state } = useAuth()
  const binding = state.binding ?? '', organization = state.user?.organization_id ?? 0
  const api = useMemo(() => {
    const bound = createWorkspaceGateway(client, store.getSnapshot, binding)
    return createSystemsApi(async (path, options) => {
      try { return await bound(path, options) }
      catch (error) {
        if (error instanceof ApiError && error.code === 'forbidden' && store.getSnapshot().binding === binding)
          void store.recover()
        throw error
      }
    }, organization)
  }, [client, store, binding, organization])
  return { api, binding, allowed: state.user?.permissions.includes('foundation.read') ?? false }
}
export function useSystemsResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const resource = useMemo(() => new SystemsResource<T>(), [])
  const state = useSyncExternalStore(resource.subscribe, resource.getSnapshot)
  const refresh = useCallback(() => { void resource.load(key, load) }, [resource, key, load])
  useEffect(() => { refresh(); return resource.cancel }, [refresh, resource])
  // Render-time key masking prevents an old record painting before effect cleanup.
  return { state: state.key === key ? state : { key, status: 'loading' as const }, refresh }
}
