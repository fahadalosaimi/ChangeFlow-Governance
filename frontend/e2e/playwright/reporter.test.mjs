import { test } from 'node:test'
import assert from 'node:assert/strict'
import SafeReporter from './reporter.mjs'

test('reporter refuses unknown titles and never prints errors, URLs or attachments', () => {
  const reporter = new SafeReporter()
  const output = []
  const original = process.stdout.write
  process.stdout.write = value => { output.push(value); return true }
  try {
    reporter.onTestEnd({ title: 'sensitive-canary' }, { status: 'failed', duration: 1,
      errors: [{ message: 'sensitive-canary', stack: 'sensitive-canary' }], attachments: ['sensitive-canary'] })
    reporter.onStdOut('PILOT={"contexts":0,"browser_exit":0,"secret":"sensitive-canary"}\n')
    reporter.onStdErr('sensitive-canary')
    assert.equal(output.join('').includes('sensitive-canary'), false)
  } finally { process.stdout.write = original }
})

test('reporter exports finite case results and lifecycle metadata only', () => {
  const reporter = new SafeReporter()
  const output = []
  const original = process.stdout.write
  process.stdout.write = value => { output.push(value); return true }
  try {
    reporter.onTestEnd({ title: 'A05' }, { status: 'passed', duration: 17 })
    reporter.onStdOut('PILOT={"contexts":0,"browser_exit":0}\n')
    assert.deepEqual(output.map(line => JSON.parse(line.slice(6))), [
      { case: 'A05', status: 'passed', duration_ms: 17 }, { contexts: 0, browser_exit: 0 }])
  } finally { process.stdout.write = original }
})
