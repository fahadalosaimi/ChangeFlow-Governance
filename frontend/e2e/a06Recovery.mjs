import { runBrowser, verifyIdentity } from './browser.mjs'

await runBrowser(async ({ api, protocol, fixture, check, navigate, until, login, pause, step, trace, a06Mode }) => {
  await protocol.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 960, deviceScaleFactor: 1, mobile: false })
  await protocol.send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('changeflow_language','en')" })
  await check('controlled-403-dialog-lifecycle', async () => {
    await navigate('/login'); await login(fixture)
    await protocol.evaluate('Array.from(document.querySelectorAll("[data-nav-path=\\"/changes\\"]")).find(a=>a.getBoundingClientRect().width>0).click()')
    await until('document.body.innerText.includes("Local Change")')
    const held = []
    const off = protocol.on('Fetch.requestPaused', event => { held.push(event.requestId) })
    await protocol.send('Fetch.enable', { patterns: [{ urlPattern: api.origin + '/change-management/*', requestStage: 'Request' }] })
    const release = async () => {
      await trace.mark('held-request-released')
      await protocol.send('Fetch.disable')
    }
    try {
      await protocol.send('Page.reload')
      await until('!!document.querySelector("[data-legacy-shell]")')
      for (let attempt = 0; attempt < 100 && !held.length; attempt++) await pause(50)
      if (!held.length) throw new Error('No real tenant response was held')
      await trace.start()
      const updated = await fetch(api.origin + '/_test/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'limit' }) })
      if (!updated.ok) throw new Error('Controlled role update failed')
      await trace.mark('role-updated')
      const expected = '!!document.querySelector("[data-workspace-shell]") && !!document.querySelector("[data-state=forbidden]")'
      await verifyIdentity(protocol, until, step, expected, async () => {
        await until('!!document.querySelector("dialog[open] [data-action=confirm-verify]")')
        if (a06Mode === 'race') {
          await release()
          await until(expected)
        }
      })
      await until(expected)
      if (await protocol.evaluate('document.body.innerText.includes("Local Change") || document.body.innerText.includes("Local notification")'))
        throw new Error('Old tenant data reappeared in replacement session')
      const ids = await trace.stop()
      if (a06Mode === 'control' && ids.includes('business-403')) throw new Error('Control trace unexpectedly recovered from 403')
      if (a06Mode === 'control' && !ids.includes('confirm-handler-ran')) throw new Error('Control did not use explicit confirmation')
      if (a06Mode === 'race') {
        const start = ids.indexOf('business-403'), recovery = ids.indexOf('recovery-started', start), unmount = ids.indexOf('dialog-unmounted', recovery)
        const complete = ids.indexOf('recovery-completed', recovery), forbidden = ids.indexOf('forbidden-view', complete)
        const opened = ids.indexOf('dialog-opened'), changed = ids.indexOf('permissions-changed', recovery)
        if (opened < 0 || start <= opened || recovery <= start || unmount <= recovery || changed <= recovery || complete <= changed
          || forbidden <= complete || !ids.includes('verify-handler-ran') || ids.includes('confirm-handler-ran'))
          throw new Error('403 recovery trace did not prove dialog lifecycle')
      }
    } finally { await protocol.send('Fetch.disable'); off() }
  })
}, 'recovery')
