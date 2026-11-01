export function safeReturnTo(value: string | null): string {
  return value === '/workspace' ? value : '/workspace'
}

export function recoveryAllowed(search: string): boolean {
  const query = new URLSearchParams(search)
  return query.get('logout') !== '1' && query.get('memory') !== '1'
}

export function workspaceDestination(storageWarning: boolean): string {
  return storageWarning ? '/workspace?memory=1' : '/workspace'
}
