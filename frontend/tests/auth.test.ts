import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from '../src/services/api/client.ts'
import { ApiSession } from '../src/services/api/session.ts'

const stores = await import('../src/features/auth/authStore.ts').catch(() => null)
const storageModule = await import('../src/features/auth/sessionStorage.ts').catch(() => null)
const redirects = await import('../src/features/auth/safeRedirect.ts').catch(() => null)
const permissionsModule = await import('../src/features/auth/permissions.ts').catch(() => null)
const gatewayModule = await import('../src/features/auth/workspaceGateway.ts').catch(() => null)

const now = 1_800_000_000_000
const token = (expires = now / 1000 + 600) => ['fixture',
  Buffer.from(JSON.stringify({ sub: '2', tid: 1, ver: 2, exp: expires })).toString('base64url'), 'signature'].join('.')
const user = { id: 2, organization_id: 1, department_id: null, full_name: 'Fixture Member',
  email: 'member@example.test', job_title: null, role_name: 'Requester', department_name: null,
  workspace_slug: 'fixture-one', permissions: ['identity.read', 'changes.read', 'changes.create'] }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
})
class MemoryStorage {
  values = new Map<string, string>()
  blocked = false
  getItem(key: string) { if (this.blocked) throw new Error('Storage unavailable'); return this.values.get(key) ?? null }
  setItem(key: string, value: string) { if (this.blocked) throw new Error('Storage unavailable'); this.values.set(key, value) }
  removeItem(key: string) { if (this.blocked) throw new Error('Storage unavailable'); this.values.delete(key) }
}
function setup(fetcher: typeof fetch, initial: string | null = null) {
  assert.ok(stores?.AuthStore, 'Session store is not implemented')
  assert.ok(storageModule?.createSessionStorage, 'Safe session storage is not implemented')
  const memory = new MemoryStorage()
  if (initial) memory.setItem(storageModule.SESSION_STORAGE_KEY, initial)
  const session = new ApiSession()
  const client = createApiClient({ baseUrl: 'https://api.example.test',
    trustedOrigins: ['https://api.example.test'], session, fetcher, timeoutMs: 100 })
  let expiry = () => {}
  const store = new stores.AuthStore({ client, session, storage: storageModule.createSessionStorage(() => memory),
    now: () => now, schedule: (callback: () => void) => { expiry = callback; return () => {} } })
  return { memory, session, client, store, expire: () => expiry() }
}

test('workspace login verifies me before publishing identity and persists only the token', async () => {
  let calls = 0
  const state = setup(async (url, options) => {
    calls++
    if (String(url).endsWith('/auth/login')) {
      assert.equal(new Headers(options?.headers).get('Authorization'), null)
      assert.ok(options?.body instanceof URLSearchParams)
      assert.equal(options.body.get('tenant_slug'), 'fixture-one')
      return json({ access_token: token(), token_type: 'bearer' })
    }
    assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${token()}`)
    return json(user)
  })
  await state.store.start()
  await state.store.login({ tenant_slug: 'fixture-one', email: 'member@example.test', password: 'synthetic input' })
  assert.equal(calls, 2)
  assert.equal(state.store.getSnapshot().status, 'authenticated')
  assert.equal(state.store.getSnapshot().user?.workspace_slug, 'fixture-one')
  assert.deepEqual([...state.memory.values.values()], [token()])
  assert.ok(!JSON.stringify(state.store.getSnapshot()).includes(token()))
  assert.ok(!JSON.stringify(state.store.getSnapshot()).includes('synthetic input'))
  state.store.dispose()
})

test('refresh recovery starts hidden and always verifies the persisted session using me', async () => {
  const state = setup(async () => json(user), token())
  assert.equal(state.store.getSnapshot().user, null)
  assert.equal(state.store.getSnapshot().status, 'checking')
  await state.store.start()
  assert.equal(state.store.getSnapshot().status, 'authenticated')
  state.store.dispose()
})

test('corrupted persisted JWT structure fails closed without an unhandled recovery error', async () => {
  const corrupted = token().replace('fixture.', 'invalid header.')
  const state = setup(async () => { assert.fail('corrupted token must not be sent') }, corrupted)
  await state.store.start()
  assert.equal(state.store.getSnapshot().status, 'anonymous')
  assert.equal(state.memory.values.size, 0)
  state.store.dispose()
})

test('explicit login after logout can retry a temporary me outage without reviving old storage', async () => {
  let offline = true
  const state = setup(async (url) => {
    if (String(url).endsWith('/auth/login')) return json({ access_token: token(), token_type: 'bearer' })
    if (offline) throw new TypeError('temporary fixture outage')
    return json(user)
  })
  await state.store.start()
  state.store.logout()
  await state.store.login({ tenant_slug: 'fixture-one', email: 'member@example.test', password: 'synthetic input' })
  assert.equal(state.store.getSnapshot().status, 'unavailable')
  offline = false
  await state.store.recover()
  assert.equal(state.store.getSnapshot().status, 'authenticated')
  state.store.dispose()
})

test('repeated startup shares one verification and an explicit recovery reflects changed grants', async () => {
  let calls = 0
  let changed = false
  const state = setup(async () => { calls++; return json(changed ? { ...user, permissions: ['identity.read'] } : user) }, token())
  await Promise.all([state.store.start(), state.store.start()])
  assert.equal(calls, 1)
  const original = state.store.getSnapshot().binding
  changed = true
  await state.store.recover()
  assert.deepEqual(state.store.getSnapshot().user?.permissions, ['identity.read'])
  assert.notEqual(state.store.getSnapshot().binding, original)
  state.store.dispose()
})

test('network recovery failure hides data and preserves the token for an explicit retry', async () => {
  let offline = true
  const state = setup(async () => { if (offline) throw new TypeError('private transport marker'); return json(user) }, token())
  await state.store.start()
  assert.equal(state.store.getSnapshot().status, 'unavailable')
  assert.equal(state.store.getSnapshot().user, null)
  assert.equal(state.memory.values.size, 1)
  offline = false
  await state.store.recover()
  assert.equal(state.store.getSnapshot().status, 'authenticated')
  state.store.dispose()
})

test('login server outage stays unavailable rather than being reported as bad credentials', async () => {
  for (const status of [408, 429, 500, 503]) {
    const state = setup(async () => json({ detail: 'private outage marker' }, status))
    await state.store.start()
    await state.store.login({ tenant_slug: 'fixture-one', email: 'member@example.test', password: 'synthetic input' })
    assert.equal(state.store.getSnapshot().status, 'unavailable')
    assert.equal(state.store.getSnapshot().reason, 'network')
    assert.equal(state.store.getSnapshot().user, null)
    assert.equal(state.memory.values.size, 0)
    assert.ok(!JSON.stringify(state.store.getSnapshot()).includes('private outage marker'))
    state.store.dispose()
  }
})

test('401 invalidates and clears storage; 403 remains a forbidden state without granting identity', async () => {
  for (const status of [401, 403]) {
    const state = setup(async () => json({ detail: 'private server marker' }, status), token())
    await state.store.start()
    assert.equal(state.store.getSnapshot().status, status === 401 ? 'anonymous' : 'forbidden')
    assert.equal(state.store.getSnapshot().user, null)
    assert.equal(state.memory.values.size, status === 401 ? 0 : 1)
    assert.ok(!JSON.stringify(state.store.getSnapshot()).includes('private server marker'))
    state.store.dispose()
  }
})

test('expired tokens are rejected before protected requests and a verified token expires locally', async () => {
  const old = setup(async () => { assert.fail('expired token must not be sent') }, token(now / 1000 - 1))
  await old.store.start()
  assert.equal(old.store.getSnapshot().status, 'anonymous')
  assert.equal(old.memory.values.size, 0)
  old.store.dispose()
  const current = setup(async () => json(user), token())
  await current.store.start()
  current.expire()
  assert.equal(current.store.getSnapshot().status, 'anonymous')
  assert.equal(current.memory.values.size, 0)
  current.store.dispose()
})

test('logout during me discards late identity and aborts session-bound work', async () => {
  let finish!: (value: Response) => void
  const state = setup(async () => new Promise<Response>((resolve) => { finish = resolve }), token())
  const pending = state.store.start()
  state.store.logout()
  finish(json(user))
  await pending
  assert.equal(state.store.getSnapshot().status, 'anonymous')
  assert.equal(state.store.getSnapshot().user, null)
  assert.equal(state.memory.values.size, 0)
  state.store.dispose()
})

test('a late login response cannot revive a logged out session', async () => {
  let finish!: (value: Response) => void
  const state = setup(async () => new Promise<Response>((resolve) => { finish = resolve }))
  await state.store.start()
  const pending = state.store.login({ tenant_slug: 'fixture-one', email: 'member@example.test', password: 'synthetic input' })
  state.store.logout()
  finish(json({ access_token: token(), token_type: 'bearer' }))
  await pending
  assert.equal(state.store.getSnapshot().status, 'anonymous')
  assert.equal(state.memory.values.size, 0)
  state.store.dispose()
})

test('storage unavailable allows memory authentication and cannot restore stale data after logout', async () => {
  const state = setup(async (url) => String(url).endsWith('/auth/login')
    ? json({ access_token: token(), token_type: 'bearer' }) : json(user), token())
  state.memory.blocked = true
  await state.store.start()
  assert.equal(state.store.getSnapshot().status, 'anonymous')
  await state.store.login({ tenant_slug: 'fixture-one', email: 'member@example.test', password: 'synthetic input' })
  assert.equal(state.store.getSnapshot().status, 'authenticated')
  assert.equal(state.store.getSnapshot().storageWarning, true)
  state.store.logout()
  state.memory.blocked = false
  await state.store.recover()
  assert.equal(state.store.getSnapshot().status, 'anonymous')
  state.store.dispose()
})

test('session switching changes tenant binding and old callers cannot use the new session', async () => {
  assert.ok(gatewayModule?.createWorkspaceGateway)
  let second = false
  let calls = 0
  const state = setup(async () => { calls++; return json(second ? { ...user, id: 3, organization_id: 2, workspace_slug: 'fixture-two' } : user) }, token())
  await state.store.start()
  const first = state.store.getSnapshot().binding!
  const gateway = gatewayModule.createWorkspaceGateway(state.client, state.store.getSnapshot, first)
  second = true
  await state.store.recover()
  assert.notEqual(state.store.getSnapshot().binding, first)
  assert.equal(state.store.getSnapshot().user?.organization_id, 2)
  const before = calls
  await assert.rejects(gateway('/foundation/overview'), { code: 'session_changed' })
  assert.equal(calls, before)
  state.store.dispose()
})

test('pending tenant or user responses cannot repopulate data or invalidate the replacement session', async () => {
  assert.ok(gatewayModule?.createWorkspaceGateway)
  for (const sameTenant of [false, true]) {
    for (const lateStatus of [200, 401]) {
      let second = false
      let release!: (response: Response) => void
      let oldSignal: AbortSignal | null = null
      const state = setup(async (url, options) => {
        if (String(url).endsWith('/auth/login')) return json({ access_token: token(), token_type: 'bearer' })
        if (String(url).endsWith('/auth/me')) return json(second
          ? { ...user, id: 3, organization_id: sameTenant ? 1 : 2, workspace_slug: sameTenant ? 'fixture-one' : 'fixture-two' }
          : user)
        oldSignal = options?.signal ?? null
        return new Promise<Response>((resolve) => { release = resolve })
      }, token())
      await state.store.start()
      const gateway = gatewayModule.createWorkspaceGateway(state.client, state.store.getSnapshot, state.store.getSnapshot().binding!)
      let displayed: unknown = null
      const old = gateway('/foundation/overview').then(value => { displayed = value; return 'displayed' },
        (error: unknown) => (error as { code: string }).code)
      state.store.logout()
      assert.equal((oldSignal as AbortSignal | null)?.aborted, true)
      second = true
      await state.store.login({ tenant_slug: sameTenant ? 'fixture-one' : 'fixture-two', email: 'other@example.test', password: 'synthetic input' })
      release(json({ private_old_tenant_marker: true }, lateStatus))
      assert.equal(await old, 'session_changed')
      await new Promise(resolve => setTimeout(resolve, 0))
      assert.equal(displayed, null)
      assert.equal(state.store.getSnapshot().status, 'authenticated')
      assert.equal(state.store.getSnapshot().user?.id, 3)
      assert.equal(state.store.getSnapshot().user?.organization_id, sameTenant ? 1 : 2)
      state.store.dispose()
    }
  }
})

test('workspace gateway never exposes invalid header values in configuration errors', async () => {
  assert.ok(gatewayModule?.createWorkspaceGateway)
  const state = setup(async () => json(user), token())
  await state.store.start()
  const gateway = gatewayModule.createWorkspaceGateway(state.client, state.store.getSnapshot, state.store.getSnapshot().binding!)
  await assert.rejects(gateway('/foundation/overview', { headers: { 'X-Test': 'synthetic private marker\ninvalid' } }),
    (error: unknown) => (error as { code: string }).code === 'configuration'
      && !String(error).includes('synthetic private marker'))
  state.store.dispose()
})

test('permission guards use grants rather than role labels and redirects stay inside the minimal routes', () => {
  assert.ok(permissionsModule?.canView)
  assert.ok(redirects?.safeReturnTo)
  assert.equal(permissionsModule.canView('users', ['identity.read']), false)
  assert.equal(permissionsModule.canView('users', ['users.read']), true)
  assert.equal(permissionsModule.canView('new', ['changes.create']), true)
  assert.equal(permissionsModule.canView('details', ['foundation.read']), false)
  for (const unsafe of ['https://evil.example.test', '//evil.example.test', '/%2f%2fevil', '/workspace?token=fixture', '/workspace/../login'])
    assert.equal(redirects.safeReturnTo(unsafe), '/workspace')
  assert.equal(redirects.safeReturnTo('/workspace'), '/workspace')
})
