import { readFileSync } from 'node:fs'

const schema = JSON.parse(readFileSync(new URL('./diagnostic-schema.json', import.meta.url), 'utf8'))
const allowed = (field, value) => schema.fields[field].includes(value)
const safe = (field, value) => allowed(field, value) ? value : 'unknown'

export function entryMotionStep(result) {
  if (!result.present) return 'entry-missing-surface'
  if (!result.animated) return 'entry-missing-animation'
  if (!result.advanced) return 'entry-no-progress'
  if (result.duration < 150 || result.duration > 250) return 'entry-invalid-duration'
  if (result.opacity < .9) return 'entry-low-opacity'
  if (!result.form) return 'entry-missing-form'
  return 'entry-criteria-met'
}

export class DiagnosticError extends Error {
  constructor(category, timeout = 'none', errorName = 'none') {
    super(safe('category', category))
    this.category = safe('category', category)
    this.timeout = allowed('timeout_kind', timeout) ? timeout : 'none'
    this.errorName = safe('error_name', errorName)
  }
}

export function evaluationError(details) {
  const description = typeof details?.exception?.description === 'string' ? details.exception.description : ''
  const category = description.includes('Cannot read properties of null') || description.includes('Cannot read properties of undefined')
    ? 'dom_target_missing' : details?.text === 'Uncaught (in promise)' ? 'promise_rejection' : 'evaluation_error'
  return new DiagnosticError(category, 'none', details?.exception?.className)
}

export function cdpCategory(error) {
  // Inspect privately; never forward a protocol message, data, URL or expression.
  const message = typeof error?.message === 'string' ? error.message : ''
  if (message.includes('Execution context was destroyed') || message.includes('Cannot find context')) return 'context_destroyed'
  if (message.includes('Target closed') || message.includes('Session closed')) return 'target_closed'
  return 'protocol_error'
}

export function createDiagnostics(suite, output = row => console.log('A5_BROWSER_DIAGNOSTIC=' + JSON.stringify(row))) {
  let sequence = 0
  const state = { suite: safe('suite', suite), scenario_id: 'none', substep_id: 'none', phase: 'setup',
    event: 'phase', failure_kind: 'none', category: 'none', timeout_kind: 'none',
    cleanup_kind: 'none', cleanup_status: 'none', exit_code: null, ...schema.defaults }
  const emit = event => { state.event = event; output({ ...state }) }
  return {
    snapshot: () => ({ ...state }),
    startup(phase, observation = {}) {
      state.startup_phase = safe('startup_phase', phase)
      for (const [field, input] of [['pid_presence', 'pid'], ['startup_process_state', 'process'],
        ['port_file_state', 'file'], ['read_attempt', 'attempt']]) state[field] = safe(field, observation[input] ?? 'none')
      state.os_error_code = allowed('os_error_code', observation.code ?? 'none') ? observation.code ?? 'none' : 'OTHER'
      state.startup_elapsed_ms = Number.isInteger(observation.elapsed) && observation.elapsed >= 0 && observation.elapsed <= 300000 ? observation.elapsed : null
      emit('startup')
    },
    resource(phase, type, ownership, completion) {
      state.lifecycle_phase = safe('lifecycle_phase', phase)
      state.resource_type = safe('resource_type', type)
      state.ownership_status = safe('ownership_status', ownership)
      state.completion_state = safe('completion_state', completion)
      emit('resource')
    },
    phase(value) { state.phase = safe('phase', value); emit('phase') },
    scenario() {
      sequence++
      state.scenario_id = safe('scenario_id', `${state.suite === 'auth' ? 'A' : state.suite === 'recovery' ? 'R' : 'P'}${String(sequence).padStart(2, '0')}`)
      state.substep_id = 'begin'; state.phase = 'scenario'; emit('scenario')
    },
    step(value) { state.substep_id = safe('substep_id', value); emit('substep') },
    transition(value) { state.transition_id = allowed('transition_id', value) ? value : 'other-unknown'; emit('transition') },
    dom(value) { state.dom_state = safe('dom_state', value); emit('lifecycle') },
    lifecycle(values) {
      for (const key of ['document_state', 'context_state', 'target_state'])
        if (Object.hasOwn(values, key)) state[key] = safe(key, values[key])
      emit('lifecycle')
    },
    browser(value, code = null) {
      state.browser_state = safe('browser_state', value)
      state.browser_exit_code = Number.isInteger(code) && code >= -2147483648 && code <= 4294967295 ? code : null
      emit('lifecycle')
    },
    cdp(error) { state.category = cdpCategory(error); emit('cdp_error') },
    failure(error) {
      state.failure_kind = 'runner_failure'; state.category = 'unknown'
      state.error_name = safe('error_name', error?.name)
      if (error instanceof DiagnosticError) {
        state.category = safe('category', error.category)
        state.timeout_kind = allowed('timeout_kind', error.timeout) ? error.timeout : 'none'
        state.error_name = safe('error_name', error.errorName)
      } else if (error instanceof Error && schema.assertions.includes(error.message)) {
        state.failure_kind = 'test_assertion'; state.category = 'assertion'
      } else if (error?.code === 'ENOENT') {
        state.category = 'filesystem_missing'
      } else if (error?.code === 'EACCES' || error?.code === 'EPERM') {
        state.category = 'filesystem_access'
      } else if (error?.code === 'EADDRINUSE') {
        state.category = 'address_in_use'
      }
      emit('failure')
    },
    timeout(value) {
      state.failure_kind = 'runner_failure'
      state.timeout_kind = allowed('timeout_kind', value) ? value : 'none'; emit('failure')
    },
    cleanup(kind, outcome) {
      state.phase = 'cleanup'
      state.cleanup_kind = allowed('cleanup_kind', kind) ? kind : 'resources'
      state.cleanup_status = outcome === 'timeout' ? 'timeout' : outcome === true ? 'passed' : 'failed'
      if (state.cleanup_status !== 'passed') state.failure_kind = 'runner_failure'
      if (state.cleanup_status === 'timeout') state.timeout_kind = 'cleanup'
      emit('cleanup')
    },
    exit(code) {
      state.phase = 'exit'
      state.exit_code = Number.isInteger(code) && code >= -2147483648 && code <= 4294967295 ? code : null
      if (state.exit_code !== 0 && state.failure_kind === 'none') {
        state.failure_kind = 'runner_failure'; state.category = 'process_exit'
      }
      emit('process_exit')
    },
  }
}
