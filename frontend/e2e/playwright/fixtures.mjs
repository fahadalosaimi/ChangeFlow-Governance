import { test as base, expect } from '@playwright/test'

export const api = process.env.PILOT_API
export const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

// launchServer exposes the owned child exit code through a public API.
// Test Runner still owns a fresh context/page per test and closes them first.
export const test = base.extend({
  browser: [async ({ playwright }, provide) => {
    const server = await playwright.chromium.launchServer({ headless: true })
    const browser = await playwright.chromium.connect(server.wsEndpoint())
    const child = server.process()
    let contexts
    try { await provide(browser) }
    finally {
      contexts = browser.contexts().length
      await browser.close()
      await server.close()
    }
    expect(contexts).toBe(0)
    expect(browser.isConnected()).toBe(false)
    expect(child.exitCode).toBe(0)
    process.stdout.write('PILOT={"contexts":0,"browser_exit":0}\n')
  }, { scope: 'worker' }],
  credentials: async ({ request, context }, provide) => {
    const response = await request.get(`${api}/_test/fixture`)
    expect(response.status()).toBe(200)
    await context.addInitScript(() => localStorage.setItem('changeflow_language', 'en'))
    await provide(await response.json())
  },
})

export async function login(page, credentials, second = false, legacy = true, path = '/login') {
  await page.goto(path)
  await page.locator('#workspace').fill(second ? credentials.other_workspace : credentials.workspace)
  await page.locator('#login-email').fill(second ? credentials.other_email : credentials.email)
  await page.locator('#login-password').fill(credentials.password)
  await page.locator('.login-form').evaluate(form => form.requestSubmit())
  await expect(page.locator('[data-workspace-shell]')).toBeVisible()
  await expect(page.locator('.workspace-identity')).toContainText(second ? 'tenant-2' : 'tenant-1')
  if (legacy) {
    await page.locator('[data-nav-path="/changes"]:visible').click()
    await page.locator('[data-action=legacy-changes]').click()
    await expect(page.locator('[data-legacy-shell]')).toBeVisible()
  }
}

export async function authenticated(page, path) {
  const token = await page.evaluate(() => sessionStorage.getItem('changeflow_session_token'))
  expect(Boolean(token)).toBe(true)
  return page.request.get(`${api}${path}`, { headers: { Authorization: `Bearer ${token}` } })
}

export async function expectCleanTenant(page) {
  await expect(page.getByText('No change records match', { exact: false })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Local Change')
  await expect(page.locator('body')).not.toContainText('Local notification')
  // Backend denial, not merely absence of DOM, proves the replacement binding.
  expect((await authenticated(page, '/change-management/requests/100')).status()).toBe(404)
}
