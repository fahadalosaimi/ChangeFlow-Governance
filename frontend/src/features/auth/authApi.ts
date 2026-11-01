import type { CurrentUser, InvitationInput, LoginInput, MembershipActivated, Permission, TokenOutput } from '../../types/api.ts'
import type { ApiClient } from '../../services/api/client.ts'
import { ApiError } from '../../services/api/errors.ts'

const permissions = new Set<Permission>(['identity.read', 'foundation.read', 'notifications.own', 'risk_rules.read',
  'changes.read', 'changes.create', 'changes.revise', 'changes.approve', 'changes.implement',
  'foundation.write', 'risk_rules.write', 'users.read', 'users.update', 'audit.read', 'invitations.manage'])
const object = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ApiError('invalid_response')
  return value as Record<string, unknown>
}
const id = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const nullableString = (value: unknown) => value === null || typeof value === 'string'

function decodeIdentity(value: unknown): CurrentUser {
  const record = object(value)
  if (!id(record.id) || !id(record.organization_id) || !(record.department_id === null || id(record.department_id))
    || !['full_name', 'email', 'role_name', 'workspace_slug'].every((key) =>
      typeof record[key] === 'string' && record[key].length > 0)
    || !nullableString(record.job_title) || !nullableString(record.department_name)
    || !Array.isArray(record.permissions) || new Set(record.permissions).size !== record.permissions.length
    || !record.permissions.every((permission) => typeof permission === 'string' && permissions.has(permission as Permission)))
    throw new ApiError('invalid_response')
  // Construct an explicit allowlisted contract; discard unknown server fields.
  return { id: record.id as number, organization_id: record.organization_id as number,
    department_id: record.department_id as number | null, full_name: record.full_name as string,
    email: record.email as string, job_title: record.job_title as string | null,
    role_name: record.role_name as string, department_name: record.department_name as string | null,
    workspace_slug: record.workspace_slug as string, permissions: [...record.permissions] as Permission[] }
}

function decodeToken(value: unknown): TokenOutput {
  const record = object(value)
  if (record.token_type !== 'bearer' || typeof record.access_token !== 'string'
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(record.access_token))
    throw new ApiError('invalid_response')
  return { access_token: record.access_token, token_type: 'bearer' }
}

export function createAuthApi(client: ApiClient) {
  return {
    me: (signal?: AbortSignal) => client.request('/auth/me', { signal, decode: decodeIdentity }),
    acceptInvitation: (input: InvitationInput, signal?: AbortSignal): Promise<MembershipActivated> =>
      client.request('/auth/invitations/accept', { method: 'POST', authenticated: false, signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: input.token, password: input.password,
          ...(input.full_name === undefined ? {} : { full_name: input.full_name }) }),
        decode: (value) => {
          const record = object(value)
          if (!id(record.user_id) || !id(record.organization_id) || record.status !== 'activated')
            throw new ApiError('invalid_response')
          return { user_id: record.user_id as number, organization_id: record.organization_id as number,
            status: 'activated' }
        } }),
    login: (input: LoginInput, signal?: AbortSignal): Promise<TokenOutput> => {
      if (![input.tenant_slug, input.email, input.password].every((field) => typeof field === 'string' && field.length > 0))
        return Promise.reject(new ApiError('request_validation'))
      return client.request('/auth/login', { method: 'POST', authenticated: false, signal,
        body: new URLSearchParams({ tenant_slug: input.tenant_slug, email: input.email, password: input.password }),
        decode: decodeToken })
    },
  }
}
