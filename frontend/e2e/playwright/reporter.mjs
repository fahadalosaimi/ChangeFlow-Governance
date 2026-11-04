import { securityNames, presentationNames, systemsNames, dashboardNames, changesNames, editorNames,notificationNames } from './gate-contract.mjs'

// Intentionally omit error messages, call logs, stdout, attachments and URLs.
export default class SafeReporter {
  onTestEnd(test, result) {
    if (![...securityNames, ...presentationNames, ...systemsNames, ...dashboardNames, ...changesNames, ...editorNames,...notificationNames].includes(test.title)
      || !['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status)
      || !Number.isFinite(result.duration) || result.duration < 0) {
      this.onError()
      return
    }
    process.stdout.write(`PILOT=${JSON.stringify({ case: test.title, status: result.status,
      duration_ms: result.duration,
      ...(result.status === 'passed' ? {} : { failure_line: Number(result.errors?.[0]?.stack?.match(/(?:pilot\.spec|systems|dashboard|changes|editor|notifications)\.mjs:(\d+)/)?.[1] ?? 0),
        failure_rule: ['contrast-kpi','contrast-queue','contrast-distribution','contrast-table','contrast-boundary','definition-list','dlitem','listitem','color-contrast','label','aria-required-children','aria-required-parent','region','heading-order','link-name','button-name'].find(rule => result.errors?.[0]?.message?.includes(rule)) ?? 'none' }) })}\n`)
  }
  onError() { process.stdout.write('PILOT={"failed":1}\n') }
  onStdOut(chunk) {
    // Only finite lifecycle numeric metadata from the worker can escape.
    for (const line of String(chunk).split('\n')) {
      if (/^PILOT=\{"contexts":0,"browser_exit":0\}$/.test(line)) process.stdout.write(`${line}\n`)
      if (/^PILOT=\{"identity_calls":\d{1,3},"systems_calls":\d{1,3}\}$/.test(line)
        || /^PILOT=\{"small_target":\d,"width":\d{1,4},"height":\d{1,4}\}$/.test(line)
        || /^PILOT=\{"contrast_target":[1-5],"contrast_ratio":\d{1,4},"foreground_rgb":\d{1,8},"background_rgb":\d{1,8}\}$/.test(line)) process.stdout.write(`${line}\n`)
    }
  }
  onStdErr() {}
}
