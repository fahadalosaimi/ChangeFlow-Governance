import { ApiError } from './errors.ts'
import { validateApiBase } from './config.ts'
import type { ApiSession } from './session.ts'

interface ClientOptions {
  baseUrl: string
  trustedOrigins: readonly string[]
  session: ApiSession
  fetcher?: typeof fetch
  timeoutMs?: number
}
export interface RequestOptions<T> {
  decode: (value: unknown) => T
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: BodyInit
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  authenticated?: boolean
}
export interface ApiClient {
  request<T>(path: string, options: RequestOptions<T>): Promise<T>
}

export function createApiClient(config: ClientOptions): ApiClient {
  const base = validateApiBase(config.baseUrl, config.trustedOrigins)
  const transport = config.fetcher ?? globalThis.fetch.bind(globalThis)
  return { async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('#')
      || Array.from(path).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)
      || /%2f|%5c/i.test(path)) throw new ApiError('configuration')
    let url: URL
    let headers: Headers
    try {
      url = new URL(path.slice(1), base)
      headers = new Headers(options.headers)
    } catch { throw new ApiError('configuration') }
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
      throw new ApiError('configuration')
    if (headers.has('authorization') || headers.has('proxy-authorization')) throw new ApiError('configuration')
    const snapshot = config.session.snapshot()
    const authenticated = options.authenticated !== false
    if (authenticated && snapshot.token) headers.set('Authorization', `Bearer ${snapshot.token}`)
    headers.set('Accept', 'application/json')
    const timeout = options.timeoutMs ?? config.timeoutMs ?? 15000
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647) throw new ApiError('configuration')
    const controller = new AbortController()
    let timedOut = false
    const changed = () => config.session.generation !== snapshot.generation
    const cancellation = () => new ApiError(changed() ? 'session_changed' : timedOut ? 'timeout' : 'aborted')
    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    config.session.track(controller)
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeout)
    try {
      if (options.signal?.aborted) controller.abort()
      if (controller.signal.aborted) throw cancellation()
      const aborted = new Promise<never>((_resolve, reject) => {
        controller.signal.addEventListener('abort', () => reject(cancellation()), { once: true })
      })
      const send = async () => {
        // Redirects are rejected by Fetch before another origin can receive data.
        const response = await transport(url, { method: options.method ?? 'GET', headers,
          body: options.body, signal: controller.signal, redirect: 'error', credentials: 'omit',
          cache: 'no-store', referrerPolicy: 'no-referrer', mode: 'cors' })
        if (changed() || controller.signal.aborted) throw cancellation()
        if (response.redirected) throw new ApiError('network')
        if (!response.ok) {
          if (response.status === 401 && authenticated && snapshot.token) {
            config.session.untrack(controller)
            config.session.invalidate(snapshot.generation)
          }
          const codes = { 401: 'unauthorized', 403: 'forbidden', 404: 'not_found',
            409: 'conflict', 422: 'request_validation' } as const
          throw new ApiError(codes[response.status as keyof typeof codes] ?? 'http', response.status)
        }
        if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
          throw new ApiError('invalid_response')
        let value: unknown
        try { value = await response.json() }
        catch (error) {
          if (controller.signal.aborted || changed()) throw cancellation()
          throw new ApiError(error instanceof SyntaxError ? 'invalid_response' : 'network')
        }
        let result: T
        try { result = options.decode(value) }
        catch { throw new ApiError('invalid_response') }
        if (changed() || controller.signal.aborted) throw cancellation()
        return result
      }
      return await Promise.race([send(), aborted])
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (controller.signal.aborted || changed()) throw cancellation()
      throw new ApiError('network')
    } finally {
      clearTimeout(timer)
      config.session.untrack(controller)
      options.signal?.removeEventListener('abort', onAbort)
    }
  } }
}
