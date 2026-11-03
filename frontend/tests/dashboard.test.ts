import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from '../src/services/api/client.ts'
import { ApiSession } from '../src/services/api/session.ts'
import { createWorkspaceGateway } from '../src/features/auth/workspaceGateway.ts'
import type { AuthSnapshot } from '../src/features/auth/authStore.ts'
import { routeAllowed } from '../src/app/routePolicy.ts'

const dto = await import('../src/features/dashboard/decoders.ts').catch(() => null)
const apiModule = await import('../src/features/dashboard/api.ts').catch(() => null)
const resourceModule = await import('../src/features/dashboard/resource.ts').catch(() => null)
const views = await import('../src/features/dashboard/viewModels.ts').catch(() => null)
const overview = { total_changes: 12, pending_approval: 3, approved: 2, rejected: 1, needs_more_information: 1 }
const record = { id: 100, requester_id: 2, title: 'Local Change', status: 'Approved', created_at: '2026-01-02T10:00:00', priority: 'Medium', change_type: 'application' }
const page = { items: [record], total: 12, page: 1, page_size: 5, total_pages: 3 }
const invalid = (e: unknown) => (e as { code: string }).code === 'invalid_response'

test('dashboard overview rejects invented totals and discards assessment metrics; distribution stays explicitly partial', () => {
  assert.ok(dto); assert.ok(views)
  assert.deepEqual(dto.decodeOverview({ ...overview, average_impact_score: 99, critical_risk: 7 }), overview)
  for (const patch of [{ total_changes: -1 }, { approved: 0.5 }, { pending_approval: '3' }, { rejected: undefined },
    { total_changes: Number.MAX_SAFE_INTEGER + 1 }, { total_changes: 6 }])
    assert.throws(() => dto.decodeOverview({ ...overview, ...patch }), invalid)
  assert.deepEqual(views.statusDistribution(overview), [
    { status: 'Pending Approval', count: 3 }, { status: 'Approved', count: 2 },
    { status: 'Rejected', count: 1 }, { status: 'Needs More Information', count: 1 },
  ])
  assert.equal(views.creationInstant('2026-01-02T10:00:00'), '2026-01-02T10:00:00Z')
  assert.equal(views.creationInstant('2026-01-02T10:00:00+03:00'), '2026-01-02T10:00:00+03:00')
})

test('queue and recent decoders enforce counts, pagination, requested status, own-only IDs and calendar dates', () => {
  assert.ok(dto)
  assert.deepEqual(dto.decodeWork({ pending_review: 3, awaiting_requester: 1, high_pending: 2 }), { pending_review: 3, awaiting_requester: 1 })
  assert.deepEqual(dto.decodeDelivery({ approved_ready: 2, in_progress: 1, pending_pir: 1, failed: 0 }), { approved_ready: 2, in_progress: 1, pending_pir: 1, failed: 0 })
  assert.throws(() => dto.decodeWork({ pending_review: 0, awaiting_requester: null }), invalid)
  assert.throws(() => dto.decodeDelivery({ approved_ready: 2, in_progress: -1, pending_pir: 1, failed: 0 }), invalid)
  assert.deepEqual(dto.decodeRecent({ ...page, items: [{ ...record, requester_email: 'unused@example.test', latest_assessment: { impact_score: 98 } }] }, 2, 'Approved'), page)
  for (const bad of [{ ...page, items: [{ ...record, requester_id: 10 }] }, { ...page, items: [record, record] },
    { ...page, page: 2 }, { ...page, page_size: 50 }, { ...page, total_pages: 1 }, { ...page, total: 0 },
    { ...page, items: [{ ...record, id: 0 }] }, { ...page, items: [{ ...record, created_at: '2026-02-31T10:00:00' }] }])
    assert.throws(() => dto.decodeRecent(bad, 2, ''), invalid)
  assert.throws(() => dto.decodeRecent(page, 2, 'Pending Approval'), invalid)
  assert.equal(dto.decodeRecent({ ...page, items: [{ ...record, status: 'Future Status' }] }, undefined, '').items[0].status, 'Future Status')
})

test('dashboard API emits scoped GETs only, never broadens requester filters, and rejects invalid JSON or stale bindings', async () => {
  assert.ok(apiModule)
  const session = new ApiSession(); session.setToken('fixture.payload.signature')
  let snapshot = { status: 'authenticated', binding: 'tenant1:user2' } as AuthSnapshot
  let value: unknown = overview
  let raw = false, hold = false
  let release!: (r: Response) => void
  const urls: string[] = []
  const client = createApiClient({ baseUrl: 'https://api.example.test', trustedOrigins: ['https://api.example.test'], session,
    fetcher: async (url, options) => {
      urls.push(String(url)); assert.equal(options?.method, 'GET')
      if (hold) return new Promise(done => { release = done })
      return new Response(raw ? '{broken' : JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
    } })
  const api = apiModule.createDashboardApi(createWorkspaceGateway(client, () => snapshot, 'tenant1:user2'), 2)
  assert.equal((await api.overview()).total_changes, 12)
  value = page; assert.equal((await api.recent('Approved')).total, 12)
  assert.deepEqual(urls, ['https://api.example.test/change-management/dashboard/overview',
    'https://api.example.test/change-management/requests/paged?page=1&page_size=5&status=Approved'])
  await assert.rejects(() => api.recent('anything'), e => (e as { code: string }).code === 'configuration')
  raw = true; await assert.rejects(() => api.overview(), invalid)
  hold = true; const pending = api.overview(); snapshot = { ...snapshot, binding: 'tenant2:user9' }
  release(new Response(JSON.stringify(overview), { headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(pending, e => (e as { code: string }).code === 'session_changed')
})

test('dashboard resource prevents stale success/error across refresh, filter, session and StrictMode cleanup replay', async () => {
  assert.ok(resourceModule)
  const resource = new resourceModule.DashboardResource<string>()
  let resolve!: (v: string) => void, reject!: (e: Error) => void
  let aborted!: AbortSignal
  const first = resource.load('tenant1:all', s => { aborted = s; return new Promise(done => { resolve = done }) })
  const late = resource.load('tenant1:Approved', () => new Promise((_done, fail) => { reject = fail }))
  assert.equal(aborted.aborted, true)
  await resource.load('tenant2:all', async () => 'current')
  resolve('old'); reject(new Error('old error')); await Promise.all([first, late])
  assert.deepEqual(resource.getSnapshot(), { key: 'tenant2:all', status: 'ready', data: 'current' })
  resource.cancel(); assert.equal('data' in resource.getSnapshot(), false)
  await resource.load('tenant2:all', async () => 'replayed')
  assert.equal(resource.getSnapshot().data, 'replayed')
  const failed = resource.load('tenant2:all', async () => { throw new Error('private raw message') })
  assert.equal('data' in resource.getSnapshot(), false)
  await failed; assert.equal(resource.getSnapshot().error, 'network')
})

test('dashboard API network timeout becomes a safe resource error with no previous snapshot', async () => {
  assert.ok(resourceModule); assert.ok(apiModule)
  const session = new ApiSession(); session.setToken('fixture.payload.signature')
  const client = createApiClient({ baseUrl: 'https://api.example.test', trustedOrigins: ['https://api.example.test'], session,
    timeoutMs: 5, fetcher: async () => new Promise(() => {}) })
  const api = apiModule.createDashboardApi(createWorkspaceGateway(client, () => ({ status: 'authenticated', binding: 'b' } as AuthSnapshot), 'b'))
  const resource = new resourceModule.DashboardResource<unknown>()
  await resource.load('b', signal => api.overview(signal))
  assert.deepEqual(resource.getSnapshot(), { key: 'b', status: 'error', error: 'timeout' })
})

test('dashboard route is available only with changes.read; identity home and legacy routes retain existing grants', () => {
  assert.equal(routeAllowed('/dashboard', ['changes.read']), true)
  for (const grants of [['identity.read'], ['users.read'], ['foundation.read'], ['changes.approve']])
    assert.equal(routeAllowed('/dashboard', grants), false)
  assert.equal(routeAllowed('/workspace', ['identity.read']), true)
  assert.equal(routeAllowed('/changes/100', ['changes.read']), true)
  assert.equal(routeAllowed('/systems', ['foundation.read']), true)
})
