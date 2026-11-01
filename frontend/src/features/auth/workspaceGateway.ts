import type { ApiClient, RequestOptions } from '../../services/api/client.ts'
import { ApiError } from '../../services/api/errors.ts'
import type { AuthSnapshot } from './authStore.ts'

export function createWorkspaceGateway(client: ApiClient, snapshot: () => AuthSnapshot, binding: string) {
  const check = () => {
    const state = snapshot()
    if (state.status !== 'authenticated' || state.binding !== binding) throw new ApiError('session_changed')
  }
  return async (path: string, options: RequestInit = {}): Promise<unknown> => {
    check()
    const method = options.method?.toUpperCase() ?? 'GET'
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) throw new ApiError('configuration')
    let headers: Record<string, string>
    try { headers = Object.fromEntries(new Headers(options.headers)) }
    catch { throw new ApiError('configuration') }
    const data = await client.request(path, { method: method as RequestOptions<unknown>['method'],
      body: options.body ?? undefined, headers,
      signal: options.signal ?? undefined, decode: (value) => value })
    check()
    return data
  }
}
