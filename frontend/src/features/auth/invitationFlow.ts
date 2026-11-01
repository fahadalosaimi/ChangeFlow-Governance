import type { ApiClient } from '../../services/api/client.ts'
import { ApiError } from '../../services/api/errors.ts'
import { createAuthApi } from './authApi.ts'

export interface InvitationSnapshot {
  status: 'ready' | 'pending' | 'accepted' | 'missing' | 'unavailable' | 'network' | 'invalid_input'
}
interface Options {
  client: ApiClient
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  replace: (path: string) => void
  onAccepted: () => void
}

class InvitationFlow {
  #token: string | null
  #client: ApiClient
  #accepted: () => void
  #snapshot: InvitationSnapshot
  #listeners = new Set<() => void>()
  #operation = 0
  #controller: AbortController | null = null
  constructor(token: string | null, client: ApiClient, accepted: () => void) {
    this.#token = token
    this.#client = client
    this.#accepted = accepted
    this.#snapshot = { status: token ? 'ready' : 'missing' }
  }
  getSnapshot = () => this.#snapshot
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  #publish(status: InvitationSnapshot['status']) {
    this.#snapshot = { status }
    for (const listener of this.#listeners) listener()
  }
  discard = () => {
    this.#operation++
    this.#controller?.abort()
    this.#token = null
    this.#publish('missing')
  }
  submit = async (input: { full_name: string; password: string }): Promise<void> => {
    if (!this.#token || this.#snapshot.status === 'pending') return
    const name = input.full_name.trim()
    if (Array.from(name).length < 2 || Array.from(name).length > 255
      || Array.from(input.password).length < 8 || new TextEncoder().encode(input.password).length > 72) {
      this.#publish('invalid_input')
      return
    }
    const operation = ++this.#operation
    this.#controller = new AbortController()
    this.#publish('pending')
    try {
      await createAuthApi(this.#client).acceptInvitation({ token: this.#token, password: input.password,
        full_name: name }, this.#controller.signal)
      if (operation !== this.#operation) return
      this.#token = null
      this.#publish('accepted')
      this.#accepted()
    } catch (error) {
      if (operation !== this.#operation) return
      if (error instanceof ApiError && ['network', 'timeout', 'aborted', 'session_changed'].includes(error.code)) {
        this.#publish('network')
      } else {
        this.#token = null
        this.#publish('unavailable')
      }
    }
  }
}

export function createInvitationFlow(options: Options) {
  let token: string | null = null
  if (options.location.pathname === '/invitations/accept') {
    const parameters = new URLSearchParams(options.location.hash.slice(1))
    const tokens = parameters.getAll('token')
    if (tokens.length === 1 && [...parameters.keys()].length === 1
      && /^[A-Za-z0-9_-]{43}$/.test(tokens[0])) token = tokens[0]
    // Strip query too: query credentials are never accepted or left visible.
    try { options.replace('/invitations/accept') }
    catch { token = null }
  }
  return new InvitationFlow(token, options.client, options.onAccepted)
}
