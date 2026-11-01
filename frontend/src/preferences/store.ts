export type Language = 'ar-SA' | 'en'
export type Theme = 'dark' | 'light'
export interface Preferences { language: Language; theme: Theme; storageWarning: boolean }
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export class PreferenceStore {
  #storage: () => PreferenceStorage
  #snapshot: Preferences
  #listeners = new Set<() => void>()
  constructor(storage: () => PreferenceStorage) {
    this.#storage = storage
    let language: Language = 'ar-SA'
    let theme: Theme = 'dark'
    let storageWarning = false
    try {
      if (storage().getItem('changeflow_language') === 'en') language = 'en'
      if (storage().getItem('changeflow_theme') === 'light') theme = 'light'
    } catch { storageWarning = true }
    this.#snapshot = { language, theme, storageWarning }
  }
  getSnapshot = () => this.#snapshot
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }
  #change(key: 'language' | 'theme', value: Language | Theme) {
    let storageWarning = this.#snapshot.storageWarning
    try { this.#storage().setItem(`changeflow_${key}`, value) }
    catch { storageWarning = true }
    this.#snapshot = { ...this.#snapshot, [key]: value, storageWarning }
    for (const listener of this.#listeners) listener()
  }
  setLanguage = (language: Language) => {
    if (language === 'ar-SA' || language === 'en') this.#change('language', language)
  }
  setTheme = (theme: Theme) => {
    if (theme === 'light' || theme === 'dark') this.#change('theme', theme)
  }
}
