import type { CurrentUser, LoginInput } from '../../types/api.ts'
import type { ApiClient } from '../../services/api/client.ts'
import { ApiSession } from '../../services/api/session.ts'
import { ApiError } from '../../services/api/errors.ts'
import { createAuthApi } from './authApi.ts'
import type { SessionStoragePort } from './sessionStorage.ts'

export interface AuthSnapshot {
  status: 'checking' | 'anonymous' | 'authenticated' | 'unavailable' | 'forbidden'
  user: CurrentUser | null
  generation: number
  binding: string | null
  storageWarning: boolean
  reason: 'none' | 'credentials' | 'expired' | 'logout' | 'network' | 'forbidden' | 'invalid'
}
interface Options {
  client: ApiClient
  session: ApiSession
  storage: SessionStoragePort
  now?: () => number
  schedule?: (callback: () => void, milliseconds: number) => () => void
  skipRecovery?: boolean
}

function expiration(token: string): number | null {
  try {
    if (token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(atob(encoded))
    if (payload === null || typeof payload !== 'object') return null
    const record = payload as Record<string, unknown>
    return record.ver === 2 && typeof record.exp === 'number' && Number.isFinite(record.exp)
      ? record.exp * 1000 : null
  } catch { return null }
}

export class AuthStore {
  #options: Options
  #snapshot: AuthSnapshot
  #listeners = new Set<() => void>()
  #operation = 0
  #changing = false
  #disposed = false
  #suppressed: boolean
  #start: Promise<void> | null = null
  #pendingLogin: symbol | null = null
  #cancelExpiry: (() => void) | null = null
  #unsubscribe: () => void
  constructor(options: Options) {
    this.#options = options
    this.#suppressed = options.skipRecovery ?? false
    this.#snapshot = { status: 'checking', user: null, generation: options.session.generation,
      binding: null, storageWarning: false, reason: 'none' }
    this.#unsubscribe = options.session.subscribe(() => {
      if (!this.#changing && !this.#disposed) this.#end('expired')
    })
  }
  getSnapshot = (): AuthSnapshot => this.#snapshot
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  #publish(status: AuthSnapshot['status'], user: CurrentUser | null, reason: AuthSnapshot['reason']) {
    const generation = this.#options.session.generation
    this.#snapshot = { ...this.#snapshot, status, user, reason, generation,
      binding: status === 'authenticated' && user ? `${generation}:${user.organization_id}:${user.id}` : null }
    for (const listener of this.#listeners) listener()
  }
  #boundary(token: string | null) {
    this.#changing = true
    try { this.#options.session.setToken(token) }
    finally { this.#changing = false }
  }
  #warning(warning: boolean) { this.#snapshot = { ...this.#snapshot, storageWarning: warning } }
  #end(reason: AuthSnapshot['reason']) {
    this.#operation++
    this.#pendingLogin = null
    this.#suppressed = true
    this.#cancelExpiry?.()
    this.#cancelExpiry = null
    this.#boundary(null)
    this.#warning(!this.#options.storage.clear() || this.#snapshot.storageWarning)
    this.#publish('anonymous', null, reason)
  }
  #armExpiry(milliseconds: number) {
    this.#cancelExpiry?.()
    const schedule = this.#options.schedule ?? ((callback, delay) => {
      const timer = globalThis.setTimeout(callback, delay)
      return () => globalThis.clearTimeout(timer)
    })
    this.#cancelExpiry = schedule(() => this.#end('expired'),
      Math.min(Math.max(milliseconds - (this.#options.now?.() ?? Date.now()), 0), 2147483647))
  }
  start = (): Promise<void> => {
    this.#start ??= this.recover()
    return this.#start
  }
  recover = async (): Promise<void> => {
    if (this.#disposed || this.#pendingLogin) return
    if (this.#suppressed) { this.#publish('anonymous', null, 'logout'); return }
    const current = this.#options.session.snapshot().token
    const saved = current ? { value: current, warning: false } : this.#options.storage.read()
    this.#warning(saved.warning || this.#snapshot.storageWarning)
    if (!saved.value) {
      this.#boundary(null)
      this.#publish('anonymous', null, 'none')
      return
    }
    await this.#verify(saved.value)
  }
  #verify = async (token: string): Promise<void> => {
    const expires = expiration(token)
    if (expires === null || expires <= (this.#options.now?.() ?? Date.now())) {
      this.#end('expired')
      return
    }
    const operation = ++this.#operation
    this.#publish('checking', null, 'none')
    this.#boundary(token)
    this.#armExpiry(expires)
    try {
      const user = await createAuthApi(this.#options.client).me()
      if (operation !== this.#operation || this.#disposed) return
      this.#warning(!this.#options.storage.save(token))
      this.#suppressed = false
      this.#publish('authenticated', user, 'none')
    } catch (error) { this.#failure(error, operation, false) }
  }
  #failure(error: unknown, operation: number, login: boolean) {
    if (operation !== this.#operation || this.#disposed) return
    if (error instanceof ApiError && error.code === 'unauthorized') {
      this.#end(login ? 'credentials' : 'expired')
    } else if (error instanceof ApiError && error.code === 'forbidden') {
      this.#publish('forbidden', null, 'forbidden')
    } else if (error instanceof ApiError && error.code === 'invalid_response') {
      this.#end('invalid')
    } else if (login && error instanceof ApiError && error.code === 'request_validation') {
      this.#end('credentials')
    } else {
      this.#publish('unavailable', null, 'network')
    }
  }
  login = async (input: LoginInput): Promise<void> => {
    if (this.#disposed) return
    const operation = ++this.#operation
    const attempt = Symbol()
    this.#pendingLogin = attempt
    this.#suppressed = true
    this.#cancelExpiry?.()
    this.#boundary(null)
    this.#warning(!this.#options.storage.clear())
    this.#publish('checking', null, 'none')
    try {
      const result = await createAuthApi(this.#options.client).login(input)
      if (operation !== this.#operation || this.#disposed) return
      this.#suppressed = false
      await this.#verify(result.access_token)
    } catch (error) { this.#failure(error, operation, true) }
    finally { if (this.#pendingLogin === attempt) this.#pendingLogin = null }
  }
  logout = () => { this.#end('logout') }
  dispose = () => {
    this.#disposed = true
    this.#operation++
    this.#cancelExpiry?.()
    this.#unsubscribe()
    this.#boundary(null)
    this.#listeners.clear()
  }
}
