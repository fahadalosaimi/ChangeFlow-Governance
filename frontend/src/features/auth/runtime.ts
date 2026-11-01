import { createApiClient } from '../../services/api/client.ts'
import { configuredApiEndpoint } from '../../services/api/config.ts'
import { ApiSession } from '../../services/api/session.ts'
import { AuthStore } from './authStore.ts'
import { createSessionStorage, discardLegacyToken } from './sessionStorage.ts'
import { createInvitationFlow } from './invitationFlow.ts'
import { recoveryAllowed } from './safeRedirect.ts'

const destinations = new Set(['/workspace', '/workspace?memory=1', '/login', '/login?logout=1', '/invitations/accept'])

export function createBrowserRuntime() {
  const session = new ApiSession()
  const client = createApiClient({ ...configuredApiEndpoint(), session })
  const store = new AuthStore({ client, session, storage: createSessionStorage(() => window.sessionStorage),
    skipRecovery: !recoveryAllowed(window.location.search) })
  // Delete the old record without reading, copying, or attempting to validate it.
  discardLegacyToken(() => window.localStorage)
  const capture = () => createInvitationFlow({ client, location: window.location,
    replace: (path) => {
      if (!window.location.hash && !window.location.search) return
      try { window.history.replaceState(null, '', path) }
      catch {
        // Fall back to a clean same-origin document and deliberately lose the token.
        window.location.replace(path)
        throw new Error('Invitation URL could not be safely removed')
      }
    }, onAccepted: store.logout })
  let invitation = capture() // Removes the URL secret before React mounts.
  let version = 0
  let previousPath = window.location.pathname
  const listeners = new Set<() => void>()
  const notify = () => { version++; for (const listener of listeners) listener() }
  const changed = () => {
    const path = window.location.pathname
    if (previousPath === '/invitations/accept' && path !== previousPath) invitation.discard()
    if (path === '/invitations/accept' && (window.location.hash || window.location.search)) {
      invitation.discard()
      invitation = capture()
    }
    previousPath = path
    notify()
  }
  window.addEventListener('popstate', changed)
  window.addEventListener('hashchange', changed)
  return {
    client, store,
    get invitation() { return invitation },
    path: () => window.location.pathname,
    getRouteSnapshot: () => `${window.location.pathname}:${version}`,
    subscribeRoute: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    navigate: (destination: string, replace = false) => {
      const target = destinations.has(destination) ? destination : '/workspace'
      if (window.location.pathname === '/invitations/accept' && !target.startsWith('/invitations/accept')) invitation.discard()
      if (replace) window.history.replaceState(null, '', target)
      else window.history.pushState(null, '', target)
      changed()
    },
  }
}
export type AuthRuntime = ReturnType<typeof createBrowserRuntime>
