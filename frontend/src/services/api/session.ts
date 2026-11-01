import { ApiError } from './errors.ts'

// In-memory boundary only. AuthProvider and session persistence belong to A5-T2.
export class ApiSession {
  #token: string | null = null
  #generation = 0
  #pending = new Set<AbortController>()
  #listeners = new Set<() => void>()

  get generation() { return this.#generation }
  snapshot() { return { generation: this.#generation, token: this.#token } }
  track(controller: AbortController) { this.#pending.add(controller) }
  untrack(controller: AbortController) { this.#pending.delete(controller) }
  subscribe(listener: () => void) {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  setToken(token: string | null) {
    if (token !== null && !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
      throw new ApiError('invalid_response')
    this.#token = token
    this.#generation++
    const pending = [...this.#pending]
    this.#pending.clear()
    for (const controller of pending) controller.abort()
    for (const listener of this.#listeners) {
      // Cleanup subscribers must not prevent aborting other work or clearing auth.
      try { listener() } catch { /* No credentials or callback errors are logged. */ }
    }
  }
  invalidate(generation: number) {
    if (generation === this.#generation) this.setToken(null)
  }
}
