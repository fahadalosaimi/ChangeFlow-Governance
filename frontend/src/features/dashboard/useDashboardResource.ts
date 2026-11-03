import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { createWorkspaceGateway } from '../auth/workspaceGateway.ts'
import { ApiError } from '../../services/api/errors.ts'
import { createDashboardApi } from './api.ts'
import { DashboardResource } from './resource.ts'

export function useDashboardApi() {
  const { client, state, store } = useAuth()
  const binding = state.binding ?? ''
  const ownId = state.user?.role_name === 'Requester' ? state.user.id : undefined
  const api = useMemo(() => {
    const bound = createWorkspaceGateway(client, store.getSnapshot, binding)
    return createDashboardApi(async (path, options) => {
      try { return await bound(path, options) }
      catch (error) {
        if (error instanceof ApiError && error.code === 'forbidden' && store.getSnapshot().binding === binding)
          void store.recover()
        throw error
      }
    }, ownId)
  }, [client, store, binding, ownId])
  return { api, binding, ownOnly: ownId !== undefined, memoryOnly: state.storageWarning,
    allowed: state.user?.permissions.includes('changes.read') ?? false }
}
export function useDashboardResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>) {
  const resource = useMemo(() => new DashboardResource<T>(), [])
  const state = useSyncExternalStore(resource.subscribe, resource.getSnapshot)
  const refresh = useCallback(() => { void resource.load(key, loader) }, [resource, key, loader])
  useEffect(() => { refresh(); return resource.cancel }, [refresh, resource])
  return { state: state.key === key ? state : { key, status: 'loading' as const }, refresh }
}
