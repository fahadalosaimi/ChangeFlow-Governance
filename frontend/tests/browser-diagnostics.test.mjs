import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const diagnostics = await import('../e2e/diagnostics.mjs').catch(() => null)
const browser = await import('../e2e/browser.mjs')
const a06 = await import('../e2e/a06Probe.mjs').catch(() => null)

test('startup cleanup terminates its owned live child when CDP was never connected', async () => {
  const child = spawn(process.execPath, ['-e', "process.on('message',()=>{}); process.send('ready')"],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true })
  const closed = once(child, 'close')
  const rows = []
  try {
    await once(child, 'message')
    const result = await browser.cleanupOwnedBrowser(null, child, diagnostics.createDiagnostics('auth', row => rows.push(row)))
    assert.equal(result, true)
    assert.ok(child.exitCode !== null || child.signalCode !== null)
    assert.ok(!rows.some(row => row.cleanup_status === 'timeout'))
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill()
    await closed
  }
})

test('cleanup cannot report success for an unexpected nonzero browser exit', async () => {
  const child = spawn(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'ignore', windowsHide: true })
  await once(child, 'close')
  const rows = []
  assert.equal(await browser.cleanupOwnedBrowser(null, child, diagnostics.createDiagnostics('auth', row => rows.push(row))), false)
  assert.ok(rows.some(row => row.cleanup_status === 'failed'))
})

test('resource lifecycle diagnostics retain only allowlisted phase, ownership and completion', () => {
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  assert.equal(typeof log.resource, 'function')
  log.resource('browser-close-request', 'browser-process', 'owned', 'requested')
  assert.equal(rows.at(-1).event, 'resource')
  assert.equal(rows.at(-1).lifecycle_phase, 'browser-close-request')
  assert.equal(rows.at(-1).resource_type, 'browser-process')
  assert.equal(rows.at(-1).ownership_status, 'owned')
  assert.equal(rows.at(-1).completion_state, 'requested')
  log.resource(...Array(4).fill('synthetic-sensitive-marker'))
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
  assert.equal(rows.at(-1).ownership_status, 'unknown')
})

test('browser diagnostics discard arbitrary identifiers and error contents', () => {
  assert.ok(diagnostics?.createDiagnostics, 'Diagnostics must be implemented')
  const rows = []
  const marker = 'synthetic-sensitive-marker'
  const log = diagnostics.createDiagnostics(marker, row => rows.push(row))
  log.phase('https://example.test/#' + marker)
  log.step(marker)
  log.transition(marker)
  log.failure(new Error(JSON.stringify({ headers: { Authorization: marker }, body: marker })))
  assert.ok(rows.length > 0)
  assert.ok(!JSON.stringify(rows).includes(marker))
  assert.equal(rows.at(-1).failure_kind, 'runner_failure')
  assert.equal(rows.at(-1).category, 'unknown')
})

test('scenario checkpoints distinguish assertions, timeout and cleanup without raw errors', async () => {
  assert.ok(diagnostics?.createDiagnostics)
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  log.scenario()
  log.step('logout-first-frame')
  log.failure(new Error('Old tenant DOM survived a transition frame'))
  assert.equal(rows.at(-1).scenario_id, 'A01')
  assert.equal(rows.at(-1).substep_id, 'logout-first-frame')
  assert.equal(rows.at(-1).failure_kind, 'test_assertion')
  log.failure(new diagnostics.DiagnosticError('protocol_error'))
  assert.equal(rows.at(-1).failure_kind, 'runner_failure')
  log.timeout('condition')
  assert.equal(rows.at(-1).timeout_kind, 'condition')
  log.cleanup('vite', false)
  assert.equal(rows.at(-1).cleanup_kind, 'vite')
  assert.equal(rows.at(-1).cleanup_status, 'failed')
  assert.equal(rows.at(-1).failure_kind, 'runner_failure')
  log.exit(7)
  assert.equal(rows.at(-1).exit_code, 7)
})

test('CDP errors classify context loss and disconnect without publishing protocol payloads', async () => {
  assert.ok(diagnostics?.createDiagnostics)
  assert.ok(browser.Protocol, 'Protocol must be testable without starting a browser')
  class Socket extends EventTarget {
    send(value) { this.sent = JSON.parse(value) }
    close() { this.dispatchEvent(new Event('close')) }
  }
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  const socket = new Socket()
  const protocol = new browser.Protocol(socket, log)
  const request = protocol.send('Runtime.evaluate', { expression: 'synthetic-sensitive-marker' })
  socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: socket.sent.id,
    error: { message: 'Execution context was destroyed. synthetic-sensitive-marker' } }) }))
  await assert.rejects(request, error => error.category === 'context_destroyed'
    && !String(error).includes('synthetic-sensitive-marker'))
  const pending = protocol.send('Runtime.evaluate')
  socket.close()
  await assert.rejects(pending, error => error.category === 'disconnected')
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('mutated diagnostic errors cannot bypass the output allowlist', () => {
  assert.ok(diagnostics?.createDiagnostics)
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  const error = new diagnostics.DiagnosticError('protocol_error')
  error.category = 'synthetic-sensitive-marker'
  error.timeout = 'synthetic-sensitive-marker'
  error.errorName = 'synthetic-sensitive-marker'
  log.failure(error)
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('cleanup deadlines and Windows exit codes keep their actual failure classification', () => {
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  log.cleanup('browser', 'timeout')
  assert.equal(rows.at(-1).cleanup_status, 'timeout')
  assert.equal(rows.at(-1).timeout_kind, 'cleanup')
  assert.equal(rows.at(-1).failure_kind, 'runner_failure')
  log.exit(3221225477)
  assert.equal(rows.at(-1).exit_code, 3221225477)
})

test('startup filesystem and port errors expose categories without paths or messages', () => {
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  for (const [code, category] of [['ENOENT', 'filesystem_missing'], ['EACCES', 'filesystem_access'], ['EPERM', 'filesystem_access'], ['EADDRINUSE', 'address_in_use']]) {
    const error = new Error('synthetic-sensitive-marker')
    error.code = code
    error.path = 'synthetic-sensitive-marker'
    log.failure(error)
    assert.equal(rows.at(-1).category, category)
  }
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('entry motion evidence identifies the failing predicate without retaining UI values', () => {
  assert.ok(diagnostics?.entryMotionStep)
  const ready = { present: true, animated: true, advanced: true, duration: 200, opacity: 1, form: true }
  const cases = [
    [{}, 'entry-criteria-met'], [{ present: false }, 'entry-missing-surface'],
    [{ animated: false }, 'entry-missing-animation'], [{ advanced: false }, 'entry-no-progress'],
    [{ duration: 300 }, 'entry-invalid-duration'], [{ opacity: 0.5 }, 'entry-low-opacity'],
    [{ form: false }, 'entry-missing-form'],
  ]
  const rows = []
  const log = diagnostics.createDiagnostics('presentation', row => rows.push(row))
  for (const [changes, want] of cases) {
    log.step(diagnostics.entryMotionStep({ ...ready, ...changes, extra: 'synthetic-sensitive-marker' }))
    assert.equal(rows.at(-1).substep_id, want)
  }
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('evaluation exceptions retain only allowlisted names and stable categories', async () => {
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  log.scenario(); log.step('verify-confirm')
  class Socket extends EventTarget {
    send(value) { this.sent = JSON.parse(value) }
    close() {}
  }
  const socket = new Socket()
  const protocol = new browser.Protocol(socket, log)
  const pending = protocol.evaluate('synthetic-sensitive-marker')
  socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: socket.sent.id,
    result: { exceptionDetails: { text: 'Uncaught', exception: { className: 'TypeError',
      description: 'TypeError: Cannot read properties of null synthetic-sensitive-marker' } } } }) }))
  await assert.rejects(pending, error => {
    log.failure(error)
    return error.category === 'dom_target_missing'
  })
  assert.equal(rows.at(-1).error_name, 'TypeError')
  assert.equal(rows.at(-1).substep_id, 'verify-confirm')
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('document, default context and target lifecycle remain primitive metadata', () => {
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  class Socket extends EventTarget { send() {} close() { this.dispatchEvent(new Event('close')) } }
  const socket = new Socket()
  new browser.Protocol(socket, log)
  const event = (method, params = {}) => socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ method, params }) }))
  event('Runtime.executionContextCreated', { context: { id: 11, auxData: { isDefault: true }, name: 'synthetic-sensitive-marker' } })
  event('Page.loadEventFired')
  assert.equal(log.snapshot().document_state, 'complete')
  assert.equal(log.snapshot().context_state, 'available')
  event('Runtime.executionContextsCleared')
  assert.equal(log.snapshot().context_state, 'cleared')
  event('Inspector.detached', { reason: 'synthetic-sensitive-marker' })
  assert.equal(log.snapshot().target_state, 'detached')
  socket.close()
  assert.equal(log.snapshot().target_state, 'closed')
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('failure-state sampling emits a state code and never changes the original error', async () => {
  assert.ok(browser.sampleDOM)
  const rows = []
  const log = diagnostics.createDiagnostics('auth', row => rows.push(row))
  await browser.sampleDOM({ evaluate: async () => 'forbidden' }, log)
  assert.equal(log.snapshot().dom_state, 'forbidden')
  await browser.sampleDOM({ evaluate: async () => 'synthetic-sensitive-marker' }, log)
  assert.equal(log.snapshot().dom_state, 'unknown')
  await browser.sampleDOM({ evaluate: async () => { throw new Error('synthetic-sensitive-marker') } }, log)
  assert.equal(log.snapshot().dom_state, 'unknown')
  assert.ok(!JSON.stringify(rows).includes('synthetic-sensitive-marker'))
})

test('the A06 probe stores only stable event IDs and detects dialog removal', () => {
  assert.ok(a06?.probeSource)
  let observer
  let dialog = { open: false, querySelector: () => ({}) }
  const document = { querySelector: selector => selector === '[data-a06-dialog="verify"]' ? dialog : null }
  const window = { addEventListener() {}, removeEventListener() {} }
  class Observer { constructor(callback) { observer = callback } observe() {} disconnect() {} }
  const context = { window, document, MutationObserver: Observer }
  runInNewContext(a06.probeSource, context)
  const probe = window.__changeflowA06
  probe.start()
  probe.emit('synthetic-sensitive-marker')
  probe.permissions(['synthetic-sensitive-marker'])
  probe.permissions(['changed-private-value'])
  probe.emit('business-403')
  dialog = null; observer()
  const events = probe.drain()
  assert.ok(events.includes('dialog-mounted'))
  assert.ok(events.includes('dialog-closed'))
  assert.ok(events.includes('dialog-unmounted'))
  assert.ok(events.includes('permissions-changed'))
  assert.ok(events.includes('business-403'))
  assert.ok(!JSON.stringify(events).includes('synthetic-sensitive-marker'))
  assert.ok(!JSON.stringify(events).includes('changed-private-value'))
  probe.stop()
})

function verificationPage({ completed = false, control = true } = {}) {
  const state = { completed, open: false, confirmations: 0 }
  const document = { querySelector: selector => {
    if (selector === '[data-action=verify]') return control ? { click() { state.open = true } } : null
    if (selector.includes('confirm-verify')) return control && (!selector.includes('dialog[open]') || state.open)
      ? { click() { state.confirmations++; state.completed = true; state.open = false } } : null
    return null
  } }
  const protocol = { evaluate: async expression => runInNewContext(expression, { document, state }) }
  const until = async expression => {
    if (!await protocol.evaluate(expression)) throw new Error('bounded-condition-not-met')
  }
  return { protocol, until, state }
}

test('identity verification accepts only the strict completed state after automatic recovery', async () => {
  const page = verificationPage()
  await browser.verifyIdentity(page.protocol, page.until, () => {}, 'state.completed', async () => {
    page.state.open = false
    page.state.completed = true
  })
  assert.equal(page.state.confirmations, 0)
  assert.equal(page.state.completed, true)
})

test('identity verification can finish before the trigger exists and still requires secure completion', async () => {
  const completed = verificationPage({ completed: true, control: false })
  await browser.verifyIdentity(completed.protocol, completed.until, () => {}, 'state.completed')
  assert.equal(completed.state.confirmations, 0)
  const missing = verificationPage({ control: false })
  await assert.rejects(browser.verifyIdentity(missing.protocol, missing.until, () => {}, 'state.completed'),
    /bounded-condition-not-met/)
})

test('identity verification retains manual confirmation when automatic recovery has not happened', async () => {
  const page = verificationPage()
  await browser.verifyIdentity(page.protocol, page.until, () => {}, 'state.completed')
  assert.equal(page.state.confirmations, 1)
  assert.equal(page.state.completed, true)
})
