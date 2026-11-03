import { runBrowser, verifyIdentity } from './browser.mjs'

await runBrowser(async ({ api, origin, protocol, fixture, check, navigate, until, fill, login: baseLogin, pause, capture, step, observeFailure, trace }) => {
  await protocol.send('Page.addScriptToEvaluateOnNewDocument', { source: "if(!localStorage.getItem('changeflow_language'))localStorage.setItem('changeflow_language','en')" })
  const login = async (fixture, second = false, openLegacy = true) => {
    await baseLogin(fixture, second)
    if (openLegacy) {
      if (!await protocol.evaluate(`Array.from(document.querySelectorAll('[data-nav-path="/changes"]')).some(a=>a.getBoundingClientRect().width>0)`)) {
        await protocol.evaluate('document.querySelector("[data-action=open-menu]").click()')
        await until('!!document.querySelector("dialog[open]")')
      }
      await protocol.evaluate(`Array.from(document.querySelectorAll('[data-nav-path="/changes"]')).find(a=>a.getBoundingClientRect().width>0).click()`)
      await until('!!document.querySelector("[data-legacy-shell]")')
    }
  }
  const verify = expected => verifyIdentity(protocol, until, step, expected)
  await check('generic-login-failure', async () => {
    await navigate('/login')
    const errors = []
    for (const [workspace, email] of [['missing-fixture', fixture.email], [fixture.workspace, 'missing@example.test']]) {
      await until('!!document.querySelector("#workspace")')
      await fill('#workspace', workspace)
      await fill('#login-email', email)
      await fill('#login-password', fixture.password)
      await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
      await until('!!document.querySelector(".login-error")')
      errors.push(await protocol.evaluate('document.querySelector(".login-error").textContent'))
    }
    await capture('generic-login-error-safe')
    if (errors[0] !== errors[1]) throw new Error('Credential enumeration message differs')
  })
  await check('workspace-login', async () => {
    await navigate('/login')
    await login(fixture)
    await until('document.body.innerText.includes("Local Change")')
    if (await protocol.evaluate('document.body.innerText.includes("Create Requester Account")')) throw new Error('Registration UI remains')
  })
  await check('refresh-recovery', async () => {
    let held=false
    const unsubscribe=protocol.on('Fetch.requestPaused',()=>{held=true})
    await protocol.send('Fetch.enable',{patterns:[{urlPattern:api.origin+'/auth/me',requestStage:'Response'}]})
    try {
      await protocol.send('Page.reload')
      await until('!!document.querySelector("[data-state=checking]")')
      if(await protocol.evaluate('!!document.querySelector("[data-workspace-shell]")')) throw new Error('Protected data visible during recovery')
      await capture('session-checking-safe')
      for(let attempt=0;attempt<100&&!held;attempt++) await pause(50)
      if(!held)throw new Error('Real identity response was not paused')
    } finally {await protocol.send('Fetch.disable');unsubscribe()}
    await until('!!document.querySelector("[data-workspace-shell]")')
    if (await protocol.evaluate('!!localStorage.getItem("changeflow_access_token")')) throw new Error('Legacy token storage')
  })
  await check('network-recovery', async () => {
    await protocol.send('Network.enable')
    await protocol.send('Network.setBlockedURLs', { urls: [api.origin + '/auth/me'] })
    await protocol.send('Page.reload')
    await until('!!document.querySelector("[data-state=unavailable]")')
    await capture('session-unavailable-safe')
    if (!await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Network failure removed session')
    await protocol.send('Network.setBlockedURLs', { urls: [] })
    await protocol.evaluate('document.querySelector("[data-action=retry-session]").click()')
    await until('!!document.querySelector("[data-workspace-shell]")')
  })
  await check('pending-response-tenant-switch', async () => {
    // Pause real HTTP responses after FastAPI/PostgreSQL have produced them;
    // do not replace auth, requests, or response bodies with browser mocks.
    step('hold-response')
    const paused = []
    const unsubscribe = protocol.on('Fetch.requestPaused', (event) => { paused.push(event.requestId) })
    await protocol.send('Fetch.enable', { patterns: [{ urlPattern: api.origin + '/change-management/requests/paged*', requestStage: 'Response' }] })
    try {
      await protocol.send('Page.reload')
      await until('!!document.querySelector("[data-workspace-shell]")')
      for (let attempt = 0; attempt < 100 && paused.length === 0; attempt++) await pause(50)
      if (paused.length === 0) throw new Error('No real tenant response was held')
      step('logout-first-frame')
      const removed=await protocol.evaluate(`(async()=>{
        const previous=document.querySelector('[data-workspace-shell]');document.querySelector('[data-action=logout]').click();
        await new Promise(resolve=>requestAnimationFrame(resolve));
        return !previous.isConnected&&!document.querySelector('[data-workspace-shell]')&&document.querySelectorAll('[data-route-surface]').length<=1;
      })()`)
      if(!removed)throw new Error('Old tenant DOM survived a transition frame')
      step('logged-out-clean')
      await until('!!document.querySelector("#workspace")')
      if (await protocol.evaluate('document.body.innerText.includes("Local Change")')) throw new Error('Old tenant remains after logout')
      step('login-replacement')
      await login(fixture, true)
      await until(`document.querySelector('.workspace-identity')?.textContent.includes(${JSON.stringify(fixture.other_workspace)})`)
      step('release-old-response')
      // Release any old response still held by CDP only after the new identity.
      await protocol.send('Fetch.disable')
      step('replacement-empty')
      await until('document.body.innerText.includes("No change records match")')
      await protocol.evaluate(`[...document.querySelectorAll('p')].find(node=>node.textContent.includes('No change records match')).scrollIntoView({block:'center'})`)
      await capture('empty-other-workspace-safe')
      step('replacement-clean')
      if (await protocol.evaluate('document.body.innerText.includes("Local Change") || document.body.innerText.includes("Local notification")'))
        throw new Error('Old tenant data reappeared in replacement session')
      await protocol.evaluate('document.querySelector("[data-action=logout]").click()')
      await until('!!document.querySelector("#workspace")')
      step('restore-original')
      await login(fixture)
      await until('document.body.innerText.includes("Local Change")')
    } catch (error) {
      observeFailure(error)
      throw error
    } finally {
      step('release-interception')
      await protocol.send('Fetch.disable')
      unsubscribe()
    }
  })
  await check('role-change', async () => {
    if (trace.enabled) await trace.start()
    step('role-update')
    await fetch(api.origin + '/_test/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'limit' }) })
    await verify('!!document.querySelector("[data-workspace-shell]") && !!document.querySelector("[data-state=forbidden]")')
    step('verify-forbidden-ready')
    await until('!!document.querySelector("[data-workspace-shell]") && !!document.querySelector("[data-state=forbidden]")')
    if (trace.enabled) await trace.stop()
  })
  await check('disabled-membership', async () => {
    await fetch(api.origin + '/_test/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable' }) })
    await verify('!!document.querySelector("#workspace")')
    await until('!!document.querySelector("#workspace")')
    if (await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Stale token persisted')
  })
  await check('tenant-switch-and-logout', async () => {
    await login(fixture, true)
    await until(`document.querySelector('.workspace-identity')?.textContent.includes(${JSON.stringify(fixture.other_workspace)})`)
    await protocol.evaluate('document.querySelector("[data-action=logout]").click()')
    await until('!!document.querySelector("#workspace")')
  })
  await check('invitation-fragment-and-explicit-login', async () => {
    await navigate('/invitations/accept#token=' + fixture.invitation)
    await until('!!document.querySelector("#invite-name")')
    if (await protocol.evaluate('location.hash !== "" || location.search !== ""')) throw new Error('Secret URL not cleared')
    await fill('#invite-name', 'Browser Fixture Member')
    await fill('#invite-password', fixture.password)
    await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
    await until('document.body.innerText.includes("Membership activated")')
    if (await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Unexpected auto login')
    await protocol.send('Page.reload')
    await until('document.body.innerText.includes("no usable invitation link")')
  })
  await check('invitation-replay', async () => {
    await navigate('/invitations/accept#token=' + fixture.invitation)
    await until('!!document.querySelector("#invite-name")')
    await fill('#invite-name', 'Browser Fixture Member')
    await fill('#invite-password', fixture.password)
    await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
    await until('document.body.innerText.includes("This invitation is unavailable")')
  })
  await check('expired-token-recovery', async () => {
    await protocol.evaluate(`sessionStorage.setItem('changeflow_session_token',${JSON.stringify(fixture.expired)})`)
    await navigate('/workspace')
    await until('!!document.querySelector("#workspace")')
    if (await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Expired session retained')
  })
  await check('safe-redirect', async () => {
    await navigate('/login?next=https%3A%2F%2Fevil.example.test')
    await login(fixture, true, false)
    if (!await protocol.evaluate(`location.origin === ${JSON.stringify(origin)} && location.pathname === '/workspace'`)) throw new Error('Unsafe navigation')
    await protocol.evaluate('document.querySelector("[data-action=logout]").click()')
    await until('!!document.querySelector("#workspace")')
  })
  await check('storage-unavailable', async () => {
    const injected = await protocol.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const session = window.sessionStorage;
      for (const name of ['getItem','setItem','removeItem']) {
        const original = Storage.prototype[name];
        Storage.prototype[name] = function(...args) { if(this === session) throw new Error('Storage unavailable'); return original.apply(this,args); };
      }
    })()` })
    await navigate('/login')
    await login(fixture, true)
    await until('document.body.innerText.includes("Memory-only session")')
    await protocol.send('Page.reload')
    await until('!!document.querySelector("#workspace")')
    await protocol.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier })
  })
}, 'auth')
