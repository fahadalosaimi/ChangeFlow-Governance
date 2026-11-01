import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApiClient } from '../src/services/api/client.ts'
import { ApiSession } from '../src/services/api/session.ts'

const module = await import('../src/features/auth/invitationFlow.ts').catch(() => null)
const invitationToken = 'x'.repeat(43)
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
})
function setup(fetcher: typeof fetch, suffix = `#token=${invitationToken}`) {
  assert.ok(module?.createInvitationFlow, 'Invitation flow is not implemented')
  let replaced = ''
  let accepted = 0
  const session = new ApiSession()
  session.setToken(['fixture', 'payload', 'signature'].join('.'))
  const client = createApiClient({ baseUrl: 'https://api.example.test', trustedOrigins: ['https://api.example.test'],
    session, fetcher, timeoutMs: 100 })
  const flow = module.createInvitationFlow({ client,
    location: new URL(`https://app.example.test/invitations/accept${suffix}`),
    replace: (path: string) => { replaced = path }, onAccepted: () => { accepted++ } })
  return { flow, replaced: () => replaced, accepted: () => accepted }
}

test('fragment is stripped immediately and acceptance sends the secret only in JSON body', async () => {
  let calls = 0
  const state = setup(async (url, options) => {
    calls++
    assert.equal(state.replaced(), '/invitations/accept')
    assert.equal(String(url), 'https://api.example.test/auth/invitations/accept')
    assert.equal(new Headers(options?.headers).get('Authorization'), null)
    assert.equal(new Headers(options?.headers).get('Content-Type'), 'application/json')
    const body = JSON.parse(options?.body as string)
    assert.deepEqual(Object.keys(body).sort(), ['full_name', 'password', 'token'])
    assert.equal(body.token, invitationToken)
    return json({ user_id: 4, organization_id: 1, status: 'activated' })
  })
  assert.equal(state.replaced(), '/invitations/accept')
  assert.ok(!JSON.stringify(state.flow.getSnapshot()).includes(invitationToken))
  await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
  assert.equal(state.flow.getSnapshot().status, 'accepted')
  assert.equal(state.accepted(), 1)
  await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
  assert.equal(calls, 1, 'A completed invitation must not be replayed by this page')
})

test('query tokens, duplicate fragment tokens and refresh without fragment never submit', async () => {
  for (const suffix of [`?token=${invitationToken}`, '', `#token=${invitationToken}&token=${invitationToken}`]) {
    const state = setup(async () => { assert.fail('unusable link must not submit') }, suffix)
    assert.equal(state.replaced(), '/invitations/accept')
    assert.equal(state.flow.getSnapshot().status, 'missing')
    await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
  }
})

test('expired revoked and consumed responses share a safe unavailable state without server detail', async () => {
  for (const scenario of ['expired', 'revoked', 'consumed']) {
    let calls = 0
    const state = setup(async () => { calls++; return json({ detail: `private ${scenario} marker` }, 400) })
    await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
    assert.equal(state.flow.getSnapshot().status, 'unavailable')
    assert.ok(!JSON.stringify(state.flow.getSnapshot()).includes('private'))
    await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
    assert.equal(calls, 1)
  }
})

test('double submit is locked and temporary network failure requires an explicit retry', async () => {
  let calls = 0
  let fail!: (error: Error) => void
  const state = setup(async () => {
    calls++
    if (calls === 1) return new Promise<Response>((_resolve, reject) => { fail = reject })
    return json({ user_id: 4, organization_id: 1, status: 'activated' })
  })
  const first = state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
  await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
  assert.equal(calls, 1)
  fail(new TypeError('private transport marker'))
  await first
  assert.equal(state.flow.getSnapshot().status, 'network')
  assert.equal(calls, 1)
  await state.flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
  assert.equal(calls, 2)
  assert.equal(state.flow.getSnapshot().status, 'accepted')
})

test('password validation matches backend Unicode character and bcrypt byte bounds', async () => {
  let calls = 0
  const state = setup(async () => { calls++; return json({ user_id: 4, organization_id: 1, status: 'activated' }) })
  for (const password of ['short', '🙂'.repeat(4), '🙂'.repeat(19)]) {
    await state.flow.submit({ full_name: 'Fixture Member', password })
    assert.equal(state.flow.getSnapshot().status, 'invalid_input')
  }
  assert.equal(calls, 0)
  await state.flow.submit({ full_name: 'Fixture Member', password: '🙂'.repeat(8) })
  assert.equal(calls, 1)
})

test('failure to remove the fragment fails closed before a token can be submitted', async () => {
  assert.ok(module?.createInvitationFlow)
  const session = new ApiSession()
  const client = createApiClient({ baseUrl: 'https://api.example.test', trustedOrigins: ['https://api.example.test'],
    session, fetcher: async () => { assert.fail('unsafe link must not submit') } })
  const flow = module.createInvitationFlow({ client,
    location: new URL(`https://app.example.test/invitations/accept#token=${invitationToken}`),
    replace: () => { throw new Error('History unavailable') }, onAccepted: () => {} })
  assert.equal(flow.getSnapshot().status, 'missing')
  await flow.submit({ full_name: 'Fixture Member', password: 'synthetic membership input' })
})
