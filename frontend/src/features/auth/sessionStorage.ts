export const SESSION_STORAGE_KEY = 'changeflow_session_token'
export const LEGACY_STORAGE_KEY = 'changeflow_access_token'
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export interface SessionStoragePort {
  read(): { value: string | null; warning: boolean }
  save(value: string): boolean
  clear(): boolean
}

export function createSessionStorage(getStorage: () => StoragePort): SessionStoragePort {
  return {
    read() {
      try { return { value: getStorage().getItem(SESSION_STORAGE_KEY) || null, warning: false } }
      catch { return { value: null, warning: true } }
    },
    save(value) {
      try { getStorage().setItem(SESSION_STORAGE_KEY, value); return true }
      catch { return false }
    },
    clear() {
      try { getStorage().removeItem(SESSION_STORAGE_KEY); return true }
      catch {
        // Some storage implementations reject removal but permit replacement.
        try { getStorage().setItem(SESSION_STORAGE_KEY, ''); return true }
        catch { return false }
      }
    },
  }
}

export function discardLegacyToken(getStorage: () => Pick<StoragePort, 'removeItem'>): boolean {
  try { getStorage().removeItem(LEGACY_STORAGE_KEY); return true }
  catch { return false }
}
