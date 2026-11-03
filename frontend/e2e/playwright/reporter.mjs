import { securityNames, presentationNames } from './gate-contract.mjs'

// Intentionally omit error messages, call logs, stdout, attachments and URLs.
export default class SafeReporter {
  onTestEnd(test, result) {
    if (![...securityNames, ...presentationNames].includes(test.title)
      || !['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status)
      || !Number.isFinite(result.duration) || result.duration < 0) {
      this.onError()
      return
    }
    process.stdout.write(`PILOT=${JSON.stringify({ case: test.title, status: result.status,
      duration_ms: result.duration,
      ...(result.status === 'passed' ? {} : { failure_line: Number(result.errors?.[0]?.stack?.match(/pilot\.spec\.mjs:(\d+)/)?.[1] ?? 0) }) })}\n`)
  }
  onError() { process.stdout.write('PILOT={"failed":1}\n') }
  onStdOut(chunk) {
    // Only finite lifecycle numeric metadata from the worker can escape.
    for (const line of String(chunk).split('\n')) {
      if (/^PILOT=\{"contexts":0,"browser_exit":0\}$/.test(line)) process.stdout.write(`${line}\n`)
    }
  }
  onStdErr() {}
}
