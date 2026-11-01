import { ApiError } from './errors.ts'

export function validateApiBase(baseUrl: string, trustedOrigins: readonly string[]): URL {
  try {
    const url = new URL(baseUrl)
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
      || url.username || url.password || url.search || url.hash
      || !trustedOrigins.includes(url.origin)) throw new ApiError('configuration')
    url.pathname = url.pathname.replace(/\/+$/, '') + '/'
    return url
  } catch { throw new ApiError('configuration') }
}

// Deployment-owned build settings. No runtime client input can extend this list.
export function configuredApiEndpoint() {
  return {
    baseUrl: import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
    trustedOrigins: (import.meta.env?.VITE_API_TRUSTED_ORIGINS
      ?? 'http://127.0.0.1:8000,http://localhost:8000').split(',').map((value: string) => value.trim()),
  }
}
