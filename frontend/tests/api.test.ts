import assert from 'node:assert/strict'
import { test } from 'node:test'

// RED remains an assertion about the missing API, rather than a loader error.
const clientModule = await import('../src/services/api/client.ts').catch(() => null)
const authModule = await import('../src/features/auth/authApi.ts').catch(() => null)
const sessionModule = await import('../src/services/api/session.ts').catch(() => null)
const syntheticToken = ['fixture', 'payload', 'signature'].join('.')
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
const identity = { id: 2, organization_id: 1, department_id: null, full_name: 'Fixture User',
  email: 'fixture@example.test', job_title: null, role_name: 'Requester', department_name: null,
  workspace_slug: 'fixture-one', permissions: ['identity.read', 'changes.read'] }
const decode = (value: unknown) => value

function setup(fetcher: typeof fetch, baseUrl = 'https://api.example.test/api') {
  assert.ok(clientModule?.createApiClient, 'Secure API client is not implemented')
  assert.ok(sessionModule?.ApiSession, 'Session generation boundary is not implemented')
  const session = new sessionModule.ApiSession()
  const client = clientModule.createApiClient({ baseUrl, trustedOrigins: ['https://api.example.test'],
    session, fetcher, timeoutMs: 100 })
  return { client, session }
}

test('only the configured trusted origin receives a bearer; redirects cannot forward it', async () => {
  let calls = 0
  const { client, session } = setup(async (url, options) => {
    calls++
    assert.equal(String(url), 'https://api.example.test/api/auth/me')
    assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${syntheticToken}`)
    assert.equal(options?.redirect, 'error')
    assert.equal(options?.credentials, 'omit')
    assert.equal(options?.referrerPolicy, 'no-referrer')
    return response(identity)
  })
  session.setToken(syntheticToken)
  await client.request('/auth/me', { decode })
  for (const path of ['https://evil.example.test/me', '//evil.example.test/me', '/../../escape', '/auth\\evil']) {
    await assert.rejects(client.request(path, { decode }), { code: 'configuration' })
  }
  assert.equal(calls, 1)
})

test('untrusted origin, URL credentials and insecure remote HTTP fail before fetch', () => {
  for (const url of ['https://evil.example.test', 'https://user:pass@api.example.test', 'http://api.example.test']) {
    assert.throws(() => setup(async () => response({}), url), { code: 'configuration' })
  }
})

test('caller cannot override authorization headers', async () => {
  const { client } = setup(async () => { assert.fail('fetch must not run') })
  await assert.rejects(client.request('/auth/me', { decode, headers: { authorization: 'injected' } }),
    { code: 'configuration' })
})

test('invalid header input is reduced to a safe configuration error', async () => {
  const { client } = setup(async () => { assert.fail('fetch must not run') })
  await assert.rejects(client.request('/auth/me', { decode,
    headers: { 'X-Note': 'synthetic private marker\ninvalid' } }),
    (error: unknown) => (error as { code: string }).code === 'configuration'
      && !String(error).includes('synthetic private marker'))
})

test('unexpected redirects and stalled JSON are rejected without publishing data', async () => {
  const redirected = response(identity)
  Object.defineProperty(redirected, 'redirected', { value: true })
  const first = setup(async () => redirected)
  await assert.rejects(first.client.request('/auth/me', { decode }), { code: 'network' })
  const stalled = response(identity)
  stalled.json = () => new Promise(() => {})
  const second = setup(async () => stalled)
  await assert.rejects(second.client.request('/auth/me', { decode, timeoutMs: 5 }), { code: 'timeout' })
})

test('body transport failures remain network errors while malformed JSON is validation failure', async () => {
  const broken = response(identity)
  broken.json = async () => { throw new TypeError('synthetic body transport marker') }
  const first = setup(async () => broken)
  await assert.rejects(first.client.request('/auth/me', { decode }),
    (error: unknown) => (error as { code: string }).code === 'network'
      && !String(error).includes('synthetic body transport marker'))
  const second = setup(async () => new Response('malformed JSON', {
    headers: { 'Content-Type': 'application/json' },
  }))
  await assert.rejects(second.client.request('/auth/me', { decode }), { code: 'invalid_response' })
})

test('workspace login uses the real form contract and sends no bearer or extra fields', async () => {
  assert.ok(authModule?.createAuthApi, 'Workspace auth service is not implemented')
  const { client, session } = setup(async (url, options) => {
    assert.equal(String(url), 'https://api.example.test/api/auth/login')
    assert.equal(options?.method, 'POST')
    assert.equal(new Headers(options?.headers).get('Authorization'), null)
    const form = options?.body as URLSearchParams
    assert.ok(form instanceof URLSearchParams)
    assert.deepEqual([...form.keys()].sort(), ['email', 'password', 'tenant_slug'])
    assert.equal(form.get('tenant_slug'), 'fixture-one')
    assert.equal(form.get('email'), 'fixture@example.test')
    assert.equal(form.get('password'), 'synthetic login input')
    return response({ access_token: syntheticToken, token_type: 'bearer' })
  })
  session.setToken(syntheticToken)
  const result = await authModule.createAuthApi(client).login({ tenant_slug: 'fixture-one',
    email: 'fixture@example.test', password: 'synthetic login input' })
  assert.equal(result.token_type, 'bearer')
})

test('identity and token responses are validated at runtime', async () => {
  assert.ok(authModule?.createAuthApi)
  for (const invalid of [null, {}, { ...identity, permissions: ['admin.*'] },
    { ...identity, organization_id: '1' }, { ...identity, workspace_slug: null },
    { ...identity, permissions: ['identity.read', 'identity.read'] }]) {
    const { client } = setup(async () => response(invalid))
    await assert.rejects(authModule.createAuthApi(client).me(), { code: 'invalid_response' })
  }
  for (const invalid of [{ access_token: '', token_type: 'bearer' },
    { access_token: syntheticToken, token_type: 'basic' }]) {
    const { client } = setup(async () => response(invalid))
    await assert.rejects(authModule.createAuthApi(client).login({ tenant_slug: 'fixture-one',
      email: 'fixture@example.test', password: 'synthetic input' }), { code: 'invalid_response' })
  }
  const { client } = setup(async () => response(identity))
  assert.deepEqual(await authModule.createAuthApi(client).me(), identity)
})

test('401 clears the session and registered data once; 403/404/409 preserve it', async () => {
  for (const [status, code] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'not_found'], [409, 'conflict']] as const) {
    const { client, session } = setup(async () => response({ detail: 'server content withheld' }, status))
    session.setToken(syntheticToken)
    let cleared = 0
    const data = new Map([['private', 'fixture data']])
    session.subscribe(() => { cleared++; data.clear() })
    const generation = session.generation
    await assert.rejects(client.request('/auth/me', { decode }), { code, status })
    assert.equal(session.generation, generation + (status === 401 ? 1 : 0))
    assert.equal(cleared, status === 401 ? 1 : 0)
    assert.equal(data.size, status === 401 ? 0 : 1)
  }
})

test('failed public login does not invalidate a separate existing authenticated session', async () => {
  assert.ok(authModule?.createAuthApi)
  const { client, session } = setup(async () => response({}, 401))
  session.setToken(syntheticToken)
  const generation = session.generation
  await assert.rejects(authModule.createAuthApi(client).login({ tenant_slug: 'fixture-one',
    email: 'fixture@example.test', password: 'synthetic input' }), { code: 'unauthorized' })
  assert.equal(session.generation, generation)
})

test('timeout and external abort settle even when transport ignores AbortSignal', async () => {
  const { client } = setup(async () => new Promise<Response>(() => {}))
  await assert.rejects(client.request('/auth/me', { decode, timeoutMs: 5 }), { code: 'timeout' })
  const controller = new AbortController()
  const pending = client.request('/auth/me', { decode, signal: controller.signal })
  controller.abort()
  await assert.rejects(pending, { code: 'aborted' })
})

test('generation change cancels outstanding work and discards late success and 401', async () => {
  for (const status of [200, 401]) {
    let finish!: (value: Response) => void
    let signal: AbortSignal | null | undefined
    const { client, session } = setup(async (_url, options) => {
      signal = options?.signal
      return new Promise<Response>((resolve) => { finish = resolve })
    })
    session.setToken(syntheticToken)
    let cleared = 0
    session.subscribe(() => cleared++)
    const pending = client.request('/auth/me', { decode })
    session.setToken(['replacement', 'payload', 'signature'].join('.'))
    const generation = session.generation
    assert.equal(signal?.aborted, true)
    await assert.rejects(pending, { code: 'session_changed' })
    finish(response(identity, status))
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(session.generation, generation)
    assert.equal(cleared, 1)
  }
})

test('network, validation and server errors never expose input, token or server body', async () => {
  let writes = 0
  const { client } = setup(async () => {
    writes++
    return response({ detail: { password: 'synthetic private marker' } }, 422)
  })
  const error = await client.request('/auth/login', { method: 'POST', decode,
    body: 'synthetic private marker' }).catch((value: unknown) => value)
  assert.equal(writes, 1, 'Writes must never be automatically retried')
  assert.equal((error as { code: string }).code, 'request_validation')
  assert.ok(!String(error).includes('synthetic private marker'))
  assert.ok(!JSON.stringify(error).includes('synthetic private marker'))
  const network = setup(async () => { throw new Error('synthetic transport marker') })
  await assert.rejects(network.client.request('/auth/me', { decode }),
    (failure: unknown) => (failure as { code: string }).code === 'network'
      && !String(failure).includes('synthetic transport marker'))
})
