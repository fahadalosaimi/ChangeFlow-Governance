export type ErrorCode = 'configuration' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict'
  | 'request_validation' | 'http' | 'invalid_response' | 'timeout' | 'aborted' | 'session_changed' | 'network'

// Never retain request options, server detail, transport causes, or credentials.
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number | undefined
  constructor(code: ErrorCode, status?: number) {
    super(`API request failed (${code})`)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}
