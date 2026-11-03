import { ApiError } from '../../services/api/errors.ts'
export type DashboardState<T> = { key: string; status: 'idle' | 'loading' | 'error' | 'ready'; data?: T; error?: string }

// Each section owns its lifecycle; there is no shared snapshot/cache between bindings.
export class DashboardResource<T> {
  #epoch = 0
  #controller: AbortController | null = null
  #state: DashboardState<T> = { key: '', status: 'idle' }
  #listeners = new Set<() => void>()
  getSnapshot = () => this.#state
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener) } }
  #publish(value: DashboardState<T>) { this.#state = value; for (const listener of this.#listeners) listener() }
  cancel = () => { this.#epoch++; this.#controller?.abort(); this.#publish({ key: '', status: 'idle' }) }
  async load(key: string, loader: (signal: AbortSignal) => Promise<T>) {
    const epoch = ++this.#epoch
    this.#controller?.abort()
    const controller = new AbortController(); this.#controller = controller
    this.#publish({ key, status: 'loading' })
    try {
      const data = await loader(controller.signal)
      if (epoch === this.#epoch && !controller.signal.aborted) this.#publish({ key, status: 'ready', data })
    } catch (error) {
      if (epoch === this.#epoch && !controller.signal.aborted)
        this.#publish({ key, status: 'error', error: error instanceof ApiError ? error.code : 'network' })
    }
  }
}
