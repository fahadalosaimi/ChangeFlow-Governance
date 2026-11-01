import { safeDestination, withRecoveryMarker } from '../../app/routePolicy.ts'

export const safeReturnTo = safeDestination

export function recoveryAllowed(search: string): boolean {
  const query = new URLSearchParams(search)
  return query.get('logout') !== '1' && query.get('memory') !== '1'
}

export function workspaceDestination(storageWarning: boolean): string {
  return withRecoveryMarker('/workspace', storageWarning)
}
