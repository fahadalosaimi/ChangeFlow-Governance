import { expect } from '@playwright/test'
import { test, api, deferred, login, authenticated, expectCleanTenant } from './fixtures.mjs'
import { presentationCases } from './presentation.mjs'
import { expectedCases } from './gate-contract.mjs'
import { systemsCases } from './systems.mjs'
import { dashboardCases } from './dashboard.mjs'
import { changesCases } from './changes.mjs'

const cases = [
  ['login', async ({ page, credentials }) => {
    await login(page, credentials)
    await expect(page.getByText('Local Change', { exact: true }).first()).toBeVisible()
    const held = deferred(), release = deferred()
    const handler = async route => {
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      held.resolve()
      await release.promise
      await route.fulfill({ response })
    }
    await page.route(`${api}/auth/me`, handler, { times: 1 })
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await held.promise
      await expect(page.locator('[data-state=checking]')).toBeVisible()
      await expect(page.locator('[data-workspace-shell]')).toHaveCount(0)
    } finally { release.resolve() }
    await expect(page.locator('[data-workspace-shell]')).toBeVisible()
    await expect(page.getByText('Local Change', { exact: true }).first()).toBeVisible()
    expect(await page.evaluate(() => ({ session: !!sessionStorage.getItem('changeflow_session_token'),
      legacy: !!localStorage.getItem('changeflow_access_token') }))).toEqual({ session: true, legacy: false })
    const me = await authenticated(page, '/auth/me')
    expect(me.status()).toBe(200)
    expect((await me.json()).organization_id).toBe(1)
    expect((await authenticated(page, '/change-management/requests/200')).status()).toBe(404)
  }],
  ['A05', async ({ page, credentials }) => {
    await login(page, credentials)
    await expect(page.getByText('Local Change', { exact: true }).first()).toBeVisible()
    const held = deferred(), release = deferred(), settled = deferred()
    let intercepted = false
    await page.route(`${api}/change-management/requests/paged*`, async route => {
      if (intercepted) { await route.continue(); return }
      intercepted = true
      // Real FastAPI/PostgreSQL 200 produced under the ORIGINAL identity.
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      expect((await response.json()).items.some(item => item.title === 'Local Change')).toBe(true)
      held.resolve()
      await release.promise
      try { await route.fulfill({ response }); settled.resolve('delivered') }
      catch (error) {
        // Cancellation is the application's valid AbortSignal boundary.
        if (!route.request().failure()) throw error
        settled.resolve('aborted')
      }
    })
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await held.promise
      await expect(page.locator('[data-workspace-shell]')).toBeVisible()
      const removed = await page.evaluate(async () => {
        const previous = document.querySelector('[data-workspace-shell]')
        document.querySelector('[data-action=logout]').click()
        await new Promise(done => requestAnimationFrame(done))
        return !previous.isConnected && !document.querySelector('[data-workspace-shell]')
          && document.querySelectorAll('[data-route-surface]').length <= 1
      })
      expect(removed).toBe(true)
      await expect(page.locator('#workspace')).toBeVisible()
      expect(await page.evaluate(() => sessionStorage.getItem('changeflow_session_token') === null)).toBe(true)
      await login(page, credentials, true)
      await expectCleanTenant(page)
      await page.evaluate(() => {
        window.__staleLeak = false
        window.__tenantObserver = new MutationObserver(() => {
          if (/Local Change|Local notification/.test(document.body.innerText)) window.__staleLeak = true
        })
        window.__tenantObserver.observe(document.body, { subtree: true, childList: true, characterData: true })
      })
      release.resolve()
      expect(['delivered', 'aborted']).toContain(await settled.promise)
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
      await expectCleanTenant(page)
      expect(await page.evaluate(() => window.__staleLeak)).toBe(false)
      await page.evaluate(() => window.__tenantObserver.disconnect())
      await page.locator('[data-action=logout]').click()
      await login(page, credentials)
      await expect(page.getByText('Local Change', { exact: true }).first()).toBeVisible()
    } finally { release.resolve(); await page.unrouteAll({ behavior: 'wait' }) }
  }],
  ...['control', 'race'].map(mode => [`A06-${mode}`, async ({ page, credentials, request }) => {
    expect((await request.post(`${api}/_test/control`, { data: { action: 'restore' } })).status()).toBe(200)
    const held = deferred(), release = deferred()
    await login(page, credentials)
    await expect(page.getByText('Local Change', { exact: true }).first()).toBeVisible()
    const handler = async route => { held.resolve(); await release.promise; await route.continue() }
    await page.route(`${api}/change-management/**`, handler)
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await held.promise
      await expect(page.locator('[data-workspace-shell]')).toBeVisible()
      expect((await request.post(`${api}/_test/control`, { data: { action: 'limit' } })).status()).toBe(200)
      await page.locator('[data-action=verify]').click()
      await expect(page.locator('dialog[open] [data-action=confirm-verify]')).toBeVisible()
      const mePromise = page.waitForResponse(response => response.url() === `${api}/auth/me` && response.status() === 200)
      let forbiddenResponse
      if (mode === 'race') {
        forbiddenResponse = page.waitForResponse(response => response.url().startsWith(`${api}/change-management/`) && response.status() === 403)
        release.resolve()
        expect((await forbiddenResponse).status()).toBe(403)
      } else {
        await page.locator('dialog[open] [data-action=confirm-verify]').click()
      }
      const me = await (await mePromise).json()
      expect(me.role_name).toBe('Viewer')
      expect(me.permissions).not.toContain('changes.read')
      await expect(page.locator('[data-workspace-shell] [data-state=forbidden]')).toBeVisible()
      await expect(page.locator('dialog[open] [data-action=confirm-verify]')).toHaveCount(0)
      await expect(page.locator('body')).not.toContainText('Local Change')
      await expect(page.locator('body')).not.toContainText('Local notification')
      await expect(page.locator('[data-nav-path="/changes"]:visible')).toHaveCount(0)
      expect((await authenticated(page, '/change-management/requests/paged')).status()).toBe(403)
      expect(await page.evaluate(() => !!sessionStorage.getItem('changeflow_session_token'))).toBe(true)
    } finally {
      release.resolve()
      await page.unrouteAll({ behavior: 'wait' })
      expect((await request.post(`${api}/_test/control`, { data: { action: 'restore' } })).status()).toBe(200)
    }
  }]),
  ['isolation', async ({ page, context, browser, credentials }) => {
    const other = await browser.newContext()
    try {
      await context.addCookies([{ name: 'pilot-owned', value: 'synthetic', url: process.env.PILOT_ORIGIN }])
      await login(page, credentials)
      const fresh = await other.newPage()
      await fresh.goto('/workspace')
      await expect(fresh.locator('#workspace')).toBeVisible()
      expect(await other.cookies()).toEqual([])
      expect(await fresh.evaluate(() => sessionStorage.length)).toBe(0)
      expect(await fresh.evaluate(() => !!localStorage.getItem('changeflow_access_token'))).toBe(false)
      await other.addInitScript(() => localStorage.setItem('changeflow_language', 'en'))
      await login(fresh, credentials, true)
      await expectCleanTenant(fresh)
      await expect(page.getByText('Local Change', { exact: true }).first()).toBeVisible()
      expect((await authenticated(page, '/auth/me')).status()).toBe(200)
      await page.locator('[data-action=logout]').click()
      await expect(page.locator('#workspace')).toBeVisible()
      expect(await page.evaluate(() => sessionStorage.getItem('changeflow_session_token') === null)).toBe(true)
      await expect(fresh.locator('.workspace-identity')).toContainText('tenant-2')
    } finally { await other.close() }
    expect(browser.contexts()).not.toContain(other)
    const replacement = await browser.newContext()
    try {
      expect(await replacement.cookies()).toEqual([])
      const clean = await replacement.newPage()
      await clean.goto('/workspace')
      await expect(clean.locator('#workspace')).toBeVisible()
      expect(await clean.evaluate(() => sessionStorage.length)).toBe(0)
    } finally { await replacement.close() }
    // Preserve the legacy A13 assertion in a real isolated browser context.
    const memory = await browser.newContext()
    try {
      await memory.addInitScript(() => {
        localStorage.setItem('changeflow_language', 'en')
        const storage = window.sessionStorage
        for (const name of ['getItem', 'setItem', 'removeItem']) {
          const original = Storage.prototype[name]
          Storage.prototype[name] = function (...args) {
            if (this === storage) throw new Error('Synthetic storage failure')
            return original.apply(this, args)
          }
        }
      })
      const memoryPage = await memory.newPage()
      const verified = memoryPage.waitForResponse(response => response.url() === `${api}/auth/me` && response.status() === 200)
      await login(memoryPage, credentials)
      await verified
      await expect(memoryPage.getByText('Memory-only session', { exact: true })).toBeVisible()
      await expect(memoryPage.getByText('Local Change', { exact: true }).first()).toBeVisible()
      expect(await memoryPage.evaluate(() => {
        try { sessionStorage.getItem('changeflow_session_token'); return false } catch { return true }
      })).toBe(true)
      await memoryPage.reload({ waitUntil: 'domcontentloaded' })
      await expect(memoryPage.locator('#workspace')).toBeVisible()
      await expect(memoryPage.locator('[data-workspace-shell]')).toHaveCount(0)
      expect(await memoryPage.evaluate(() => !!localStorage.getItem('changeflow_access_token'))).toBe(false)
    } finally { await memory.close() }
  }],
  ['routes', async ({ page, credentials }) => {
    let anonymousBusinessCalls = 0
    const observe = request => {
      if (/\/(change-management|foundation)\//.test(request.url())) anonymousBusinessCalls++
    }
    page.on('request', observe)
    await page.goto('/changes/100')
    await expect(page.locator('#workspace')).toBeVisible()
    await expect(page.locator('[data-workspace-shell]')).toHaveCount(0)
    expect(anonymousBusinessCalls).toBe(0)
    page.off('request', observe)
    const errors = []
    for (const [workspace, email] of [['missing-fixture', credentials.email], [credentials.workspace, 'missing@example.test']]) {
      await page.locator('#workspace').fill(workspace)
      await page.locator('#login-email').fill(email)
      await page.locator('#login-password').fill(credentials.password)
      const failure = page.waitForResponse(response => response.url() === `${api}/auth/login` && response.status() === 401)
      await page.locator('.login-form').evaluate(form => form.requestSubmit())
      await failure
      await expect(page.locator('.login-error')).toBeVisible()
      errors.push(await page.locator('.login-error').textContent())
    }
    expect(errors[0]).toBe(errors[1])
    await login(page, credentials)
    await page.goto('/users')
    await expect(page.locator('[data-workspace-shell] [data-state=forbidden]')).toBeVisible()
    expect((await authenticated(page, '/auth/admin/users/paged')).status()).toBe(403)
    await expect(page.locator('[data-nav-path="/users"]:visible')).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('Local Change')
    await page.locator('[data-action=logout]').click()
    await login(page, credentials, false, false, '/login?next=https%3A%2F%2Fevil.example.test')
    expect(await page.evaluate(origin => location.pathname === '/workspace' && location.origin === origin,
      process.env.PILOT_ORIGIN)).toBe(true)
  }],
  ['session-boundaries', async ({ page, credentials, request }) => {
    await login(page, credentials)
    const token = await page.evaluate(() => sessionStorage.getItem('changeflow_session_token'))
    const unavailable = route => route.abort('failed')
    await page.route(`${api}/auth/me`, unavailable)
    try {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-state=unavailable]')).toBeVisible()
      await expect(page.locator('[data-workspace-shell]')).toHaveCount(0)
      expect(await page.evaluate(() => !!sessionStorage.getItem('changeflow_session_token'))).toBe(true)
    } finally { await page.unroute(`${api}/auth/me`, unavailable) }
    const heldBusiness = deferred(), releaseBusiness = deferred()
    const businessPattern = `${api}/change-management/requests/paged*`
    await page.route(businessPattern, async route => {
      heldBusiness.resolve()
      await releaseBusiness.promise
      await route.continue()
    })
    await page.locator('[data-action=retry-session]').click()
    await heldBusiness.promise
    await expect(page.locator('[data-workspace-shell]')).toBeVisible()
    try {
      // Subscribe BEFORE revocation: any authenticated request may observe the
      // database change first and clear the session. Requiring a later me401
      // would miss a valid business401 and wait for a request that must not run.
      const denied = page.waitForResponse(response => response.url().startsWith(`${api}/`)
        && !response.url().startsWith(`${api}/_test/`) && response.status() === 401)
      expect((await request.post(`${api}/_test/control`, { data: { action: 'disable' } })).status()).toBe(200)
      releaseBusiness.resolve()
      await denied
      await expect(page.locator('#workspace')).toBeVisible()
      expect(await page.evaluate(() => sessionStorage.getItem('changeflow_session_token') === null)).toBe(true)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#workspace')).toBeVisible()
      await expect(page.locator('[data-workspace-shell]')).toHaveCount(0)
      expect(await page.evaluate(() => sessionStorage.getItem('changeflow_session_token') === null)).toBe(true)
      expect((await request.get(`${api}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401)
      await page.evaluate(expired => sessionStorage.setItem('changeflow_session_token', expired), credentials.expired)
      await page.goto('/changes')
      await expect(page.locator('#workspace')).toBeVisible()
      expect(await page.evaluate(() => sessionStorage.getItem('changeflow_session_token') === null)).toBe(true)
    } finally {
      releaseBusiness.resolve()
      await page.unrouteAll({ behavior: 'wait' })
      expect((await request.post(`${api}/_test/control`, { data: { action: 'enable' } })).status()).toBe(200)
    }
  }],
]

const selection = process.env.PILOT_SELECTION
const available = new Map([...cases, ...presentationCases, ...systemsCases, ...dashboardCases, ...changesCases])
for (const name of expectedCases(selection)) {
  const run = available.get(name)
  if (!run) throw new Error('Missing required gate case')
  test.describe(name.startsWith('P02-') ? 'Presentation Gate' : name.startsWith('systems-') ? 'Systems B1' : name.startsWith('dashboard-') ? 'Dashboard B2' : name.startsWith('changes-') ? 'Changes C1' : 'Security Gate', () => {
    if (['systems-layout','dashboard-layout','changes-layout'].includes(name)) test.setTimeout(90000)
    test(name, run)
  })
}
