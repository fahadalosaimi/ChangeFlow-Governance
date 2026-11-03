import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from '../src/services/api/client.ts'
import { ApiSession } from '../src/services/api/session.ts'
import { createWorkspaceGateway } from '../src/features/auth/workspaceGateway.ts'
import type { AuthSnapshot } from '../src/features/auth/authStore.ts'
import { routeAllowed, safeDestination, resolveWorkspaceRoute } from '../src/app/routePolicy.ts'

const decoders = await import('../src/features/systems/decoders.ts').catch(() => null)
const apiModule = await import('../src/features/systems/api.ts').catch(() => null)
const resources = await import('../src/features/systems/resource.ts').catch(() => null)
const system = { id: 1001, organization_id: 1, department_id: null, service_id: 1, owner_id: 2,
  name: 'Local System', description: null, system_type: null, environment: 'Production', criticality: 'High', status: 'Active' }
const dependency = { id: 1, source_system_id: 1001, target_system_id: 1002, dependency_type: 'Application', impact_level: 'High', description: null }
const incident = { id: 1, system_id: 1001, title: 'Local Incident', description: null, severity: 'Low', status: 'Resolved', occurred_at: '2026-01-02T10:00:00', resolved_at: null }
const profile = { system_id: 1001, system_name: 'Local System', criticality: 'High', department_name: null, owner_name: 'Owner', service_name: null,
  outgoing_dependencies: ['Local System depends on Local Other (High)'], incoming_dependencies: [], previous_incidents: [], impact_summary: 'Original English narrative.' }
const invalid = (error: unknown) => (error as { code: string }).code === 'invalid_response'

test('systems decoders validate IDs, tenant, nullability and nested parent contracts without guessing enums', () => {
  assert.ok(decoders, 'Systems runtime validation is missing')
  assert.deepEqual(decoders.decodeSystem(system, 1), system)
  assert.equal(decoders.decodeSystem({ ...system, status: 'Future status' }, 1).status, 'Future status')
  for (const patch of [{ id: 0 }, { id: 1.5 }, { id: Number.MAX_SAFE_INTEGER + 1 }, { organization_id: 2 },
    { department_id: undefined }, { owner_id: 0 }, { environment: null }, { description: 3 }])
    assert.throws(() => decoders.decodeSystem({ ...system, ...patch }, 1), invalid)
  for (const bad of [null, {}, [null], [system, system], [{ ...system, organization_id: 2 }]])
    assert.throws(() => decoders.decodeSystems(bad, 1), invalid)
  assert.deepEqual(decoders.decodeDependencies([dependency], 1001), [dependency])
  assert.throws(() => decoders.decodeDependencies([{ ...dependency, source_system_id: 2001 }], 1001), invalid)
  assert.deepEqual(decoders.decodeIncidents([incident], 1001), [incident])
  assert.throws(() => decoders.decodeIncidents([{ ...incident, system_id: 2001 }], 1001), invalid)
  assert.throws(() => decoders.decodeIncidents([{ ...incident, occurred_at: '2026-02-31T00:00:00' }], 1001), invalid)
  assert.deepEqual(decoders.decodeProfile(profile, 1001), profile)
  for (const patch of [{ system_id: 2001 }, { incoming_dependencies: [null] }, { owner_name: 2 }, { outgoing_dependencies: {} }])
    assert.throws(() => decoders.decodeProfile({ ...profile, ...patch }, 1001), invalid)
})

test('systems API uses bound relative GET paths and rejects invalid JSON, mismatched IDs and late bindings', async () => {
  assert.ok(apiModule, 'Systems API is missing')
  const session = new ApiSession(); session.setToken('fixture.payload.signature')
  let snapshot = { status: 'authenticated', binding: 'binding-1' } as AuthSnapshot
  let body: unknown = system
  let raw = false
  const paths: string[] = []
  const client = createApiClient({ baseUrl: 'https://api.example.test', trustedOrigins: ['https://api.example.test'], session,
    fetcher: async (url, options) => {
      paths.push(String(url)); assert.equal(options?.method, 'GET')
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer fixture.payload.signature')
      return new Response(raw ? '{broken' : JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
    } })
  const api = apiModule.createSystemsApi(createWorkspaceGateway(client, () => snapshot, 'binding-1'), 1)
  assert.equal((await api.system(1001)).id, 1001)
  assert.deepEqual(paths, ['https://api.example.test/foundation/systems/1001'])
  await assert.rejects(() => api.system(0), error => (error as { code: string }).code === 'configuration')
  assert.equal(paths.length, 1)
  body = { ...system, id: 1002 }; await assert.rejects(() => api.system(1001), invalid)
  raw = true; await assert.rejects(() => api.list(), invalid)
  snapshot = { ...snapshot, binding: 'binding-2' }
  await assert.rejects(() => api.list(), error => (error as { code: string }).code === 'session_changed')
})

test('resource latest key wins even when transport ignores abort; cancel/unmount and tenant switch remove data', async () => {
  assert.ok(resources, 'Systems resource lifecycle is missing')
  const resource = new resources.SystemsResource<string>()
  let releaseA!: (value: string) => void
  let signalA!: AbortSignal
  const a = resource.load('tenant1:A', signal => { signalA = signal; return new Promise(done => { releaseA = done }) })
  await resource.load('tenant1:B', async () => 'B')
  assert.equal(signalA.aborted, true)
  releaseA('A'); await a
  assert.deepEqual(resource.getSnapshot(), { key: 'tenant1:B', status: 'ready', data: 'B' })
  let release!: (value: string) => void
  const pending = resource.load('tenant2:A', () => new Promise(done => { release = done }))
  assert.deepEqual(resource.getSnapshot(), { key: 'tenant2:A', status: 'loading' })
  resource.cancel(); release('old'); await pending
  assert.equal(resource.getSnapshot().status, 'idle')
  assert.equal('data' in resource.getSnapshot(), false)
  await resource.load('same-binding:query1', async () => 'first')
  const changed = resource.load('same-binding:query2', async () => 'latest')
  assert.equal('data' in resource.getSnapshot(), false)
  await changed; assert.equal(resource.getSnapshot().data, 'latest')
})

test('systems read routes require foundation.read and accept only positive decimal safe IDs', () => {
  assert.equal(routeAllowed('/systems', ['foundation.read']), true)
  assert.equal(routeAllowed('/systems/1001', ['foundation.read']), true)
  assert.equal(routeAllowed('/systems', ['foundation.write']), false)
  assert.equal(routeAllowed('/foundation', ['foundation.read']), false)
  assert.equal(safeDestination('/systems/1001'), '/systems/1001')
  for (const suffix of ['0', '-1', '1.5', '01', '1e3', '9007199254740992', '%2f1001'])
    assert.equal(resolveWorkspaceRoute('/systems/' + suffix), null)
})

test('bound systems request rejects a response after user/tenant changes even if transport ignores cancellation', async () => {
  assert.ok(apiModule)
  const session = new ApiSession(); session.setToken('fixture.payload.signature')
  let snapshot = { status: 'authenticated', binding: 'user1:tenant1' } as AuthSnapshot
  let release!: (value: Response) => void
  const client = createApiClient({ baseUrl: 'https://api.example.test', trustedOrigins: ['https://api.example.test'], session,
    fetcher: () => new Promise(done => { release = done }) })
  const api = apiModule.createSystemsApi(createWorkspaceGateway(client, () => snapshot, 'user1:tenant1'), 1)
  const pending = api.system(1001)
  snapshot = { ...snapshot, binding: 'user2:tenant2' }
  release(new Response(JSON.stringify(system), { headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(pending, error => (error as { code: string }).code === 'session_changed')
})
