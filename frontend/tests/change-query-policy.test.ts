import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from '../src/services/api/client.ts'
import { ApiSession } from '../src/services/api/session.ts'
import { createWorkspaceGateway } from '../src/features/auth/workspaceGateway.ts'
import type { AuthSnapshot } from '../src/features/auth/authStore.ts'

// Required C1 contract, deliberately RED if the existing URL security policy
// rejects normal form-encoded search data. Do not weaken Client to make it green.
const base = 'https://api.example.test/api'
function transport(expectedSearch: string) {
  const session = new ApiSession(); session.setToken('fixture.payload.signature')
  let calls = 0
  const client = createApiClient({ baseUrl: base, trustedOrigins: ['https://api.example.test'], session,
    fetcher: async (input, options) => {
      calls++
      const url = new URL(String(input))
      assert.equal(url.origin, 'https://api.example.test')
      assert.equal(url.pathname, '/api/change-management/requests/paged')
      assert.equal(url.searchParams.get('search'), expectedSearch)
      assert.deepEqual([...url.searchParams.keys()], ['page','page_size','search'])
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer fixture.payload.signature')
      assert.equal(options?.redirect, 'error')
      return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 5, total_pages: 1 }),
        { headers: { 'Content-Type': 'application/json' } })
    } })
  const gateway = createWorkspaceGateway(client, () => ({ status:'authenticated', binding:'synthetic-binding' } as AuthSnapshot), 'synthetic-binding')
  return { gateway, calls: () => calls }
}
function query(search: string) {
  return '/change-management/requests/paged?' + new URLSearchParams({page:'1',page_size:'5',search})
}

test('C1 query encoding preserves special characters as data at the trusted collection endpoint', async () => {
  const value = 'تغيير A&B + # ? = % ü'
  const { gateway, calls } = transport(value)
  await gateway(query(value))
  assert.equal(calls(), 1)
})

test('C1 slash in form-encoded search must round-trip without changing the request pathname', async () => {
  const value = 'billing/payments'
  const { gateway, calls } = transport(value)
  const path = query(value)
  assert.equal(path, '/change-management/requests/paged?page=1&page_size=5&search=billing%2Fpayments')
  let failureCode: string | null = null
  await gateway(path).catch((error: { code: string }) => { failureCode = error.code })
  assert.deepEqual({ failureCode, transportCalls: calls() }, { failureCode:null, transportCalls:1 })
})

test('literal percent-encoded-looking search text is decoded once and never substituted for slash data', async () => {
  const value = 'billing%2Fpayments'
  const { gateway, calls } = transport(value)
  assert.ok(query(value).endsWith('search=billing%252Fpayments'))
  await gateway(query(value))
  assert.equal(calls(), 1)
})

test('C1 compatibility controls preserve rejection of unsafe destinations and encoded path separators before fetch', async () => {
  const { gateway, calls } = transport('unused')
  for (const path of ['https://evil.example.test/requests', '//evil.example.test/requests', '/../../escape',
    '/change-management/requests/%2F100', '/change-management/requests/%5c100', '/change-management\\requests',
    '/change-management/requests#fragment'])
    await assert.rejects(() => gateway(path), error => (error as {code:string}).code === 'configuration')
  assert.equal(calls(), 0)
})

test('approved query-only encoded slashes preserve URL parser origin and base pathname for mixed case and URL-like values', async () => {
  for (const [value, encoded] of [['ordinary search','ordinary+search'], ['billing/payments','billing%2fpayments'],
    ['https://evil.example.test/a?x=1&y=2#part','https%3A%2F%2Fevil.example.test%2Fa%3Fx%3D1%26y%3D2%23part']]) {
    const { gateway, calls } = transport(value)
    await gateway('/change-management/requests/paged?page=1&page_size=5&search='+encoded)
    assert.equal(calls(),1)
  }
})

test('query allowance never admits encoded pathname separators, backslashes, fragments or control characters', async () => {
  const { gateway,calls } = transport('unused')
  for(const path of ['/change-management/requests%2f100?search=allowed%2Fvalue',
    '/change-management/%2Frequests?search=allowed', '/change-management/requests?search=a%5Cb',
    '/change-management/requests?search=a%5cb','/change-management/requests?search=a\\b',
    '/change-management/requests?search=a%2Fb#fragment', '/change-management/requests?search=a\nb',
    '/change-management/requests?search=a\tb','/change-management/requests?search=a\u0000b',
    '/change-management/requests?search=a\u007fb'])
    await assert.rejects(()=>gateway(path),e=>(e as {code:string}).code==='configuration')
  assert.equal(calls(),0)
})

test('a permitted slash query cannot bypass unsafe-header protection', async () => {
  const { gateway,calls } = transport('billing/payments')
  const unsafe:Record<string,string>[]=[{Authorization:'injected'}, {'Proxy-Authorization':'injected'}, {'X-Note':'bad\nheader'}]
  for(const headers of unsafe)
    await assert.rejects(()=>gateway(query('billing/payments'),{headers}),e=>(e as {code:string}).code==='configuration')
  assert.equal(calls(),0)
})
