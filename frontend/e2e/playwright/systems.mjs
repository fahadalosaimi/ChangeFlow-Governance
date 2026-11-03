import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { api, login, authenticated, deferred } from './fixtures.mjs'
const require = createRequire(import.meta.url)
const ready = page => expect(page.locator('[data-page=systems-catalog]')).toBeVisible()

async function preferences(page, language, theme) {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.locator('[data-language-switch]:visible').selectOption(language)
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('[data-theme-switch]:visible').click()
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}
export const systemsCases = [
  ['systems-catalog', async ({ page, credentials }) => {
    await login(page, credentials, false, false)
    const me = await authenticated(page, '/auth/me')
    expect((await me.json()).permissions).not.toContain('foundation.write')
    let identity = 0, lists = 0
    page.on('request', request => { if (request.method() !== 'GET') return; if (request.url() === `${api}/auth/me`) identity++; if (request.url() === `${api}/foundation/systems`) lists++ })
    await page.locator('[data-nav-path="/systems"]:visible').click()
    await ready(page)
    await expect(page.locator('.systems-table tbody tr')).toHaveCount(2)
    await expect(page.locator('body')).not.toContainText('FOREIGN-SECRET')
    await page.locator('#system-search').fill('Local Other')
    await expect(page.locator('.systems-table tbody tr')).toHaveCount(1)
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
    await page.getByRole('combobox', { name: 'Environment', exact: true }).selectOption('Production')
    await expect(page.locator('.systems-table tbody tr')).toHaveCount(2)
    process.stdout.write(`PILOT=${JSON.stringify({ identity_calls: identity, systems_calls: lists })}\n`)
    expect(identity).toBe(0)
    expect(lists).toBe(1)
    await page.locator('#system-search').fill('no-matching-record')
    await expect(page.getByRole('heading', { name: 'No matching systems' })).toBeVisible()
    expect(lists).toBe(1)
  }],
  ['systems-details', async ({ page, credentials }) => {
    await login(page, credentials, false, false)
    await page.goto('/systems/1001')
    await expect(page.getByRole('heading', { name: 'Local System', exact: true })).toBeVisible()
    await expect(page.getByText('Local Incident', { exact: true })).toBeVisible()
    await expect(page.locator('.system-narrative')).toHaveAttribute('lang', 'en')
    expect((await authenticated(page, '/foundation/systems/2001')).status()).toBe(404)
    await page.goto('/systems/2001')
    await expect(page.locator('[data-state=systems-missing]')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('FOREIGN-SECRET')
    await page.route(`${api}/foundation/systems/1001/impact-profile`, route => route.abort('failed'))
    await page.goto('/systems/1001')
    await expect(page.locator('[data-page=system-details]')).toBeVisible()
    await expect(page.locator('[data-state=systems-error]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Local System', exact: true })).toBeVisible()
    await expect(page.getByText('Local Incident', { exact: true })).toBeVisible()
    await page.unrouteAll({ behavior: 'wait' })
    await page.route(`${api}/foundation/systems`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, organization_id: 2, name: 'MUST-NOT-RENDER' }]) }))
    await page.goto('/systems')
    await expect(page.locator('[data-state=systems-error]')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('MUST-NOT-RENDER')
    await page.unrouteAll({ behavior: 'wait' })
    await page.route(`${api}/foundation/systems`, route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.goto('/systems')
    await expect(page.getByRole('heading', { name: 'No systems in this workspace', exact: true })).toBeVisible()
  }],
  ['systems-races', async ({ page, credentials }) => {
    await login(page, credentials, false, false)
    await page.goto('/systems/1001')
    await expect(page.locator('[data-system-id="1001"]')).toBeVisible()
    const held = deferred(), release = deferred(), settled = deferred()
    await page.route(`${api}/foundation/systems/1002`, async route => {
      const response = await route.fetch(); expect(response.status()).toBe(200)
      held.resolve(); await release.promise
      try { await route.fulfill({ response }); settled.resolve() } catch (error) { if (!route.request().failure()) throw error; settled.resolve() }
    }, { times: 1 })
    try {
      await page.getByRole('link', { name: 'System #1002', exact: true }).click()
      await held.promise
      await expect(page.locator('[data-state=systems-loading]')).toBeVisible()
      await expect(page.locator('[data-system-id="1001"]')).toHaveCount(0)
      await page.goBack()
      await expect(page.locator('[data-system-id="1001"]')).toBeVisible()
      release.resolve(); await settled.promise
      await expect(page.getByRole('heading', { name: 'Local System', exact: true })).toBeVisible()
      await expect(page.locator('[data-system-id="1002"]')).toHaveCount(0)
    } finally { release.resolve(); await page.unrouteAll({ behavior: 'wait' }) }
  }],
  ['systems-boundaries', async ({ page, credentials, request }) => {
    await login(page, credentials, false, false)
    await page.goto('/systems')
    await ready(page)
    const held = deferred(), release = deferred(), settled = deferred()
    await page.route(`${api}/foundation/systems`, async route => {
      const response = await route.fetch(); expect(response.status()).toBe(200)
      held.resolve(); await release.promise
      try { await route.fulfill({ response }); settled.resolve() } catch (error) { if (!route.request().failure()) throw error; settled.resolve() }
    }, { times: 1 })
    try {
      await page.reload({ waitUntil: 'domcontentloaded' }); await held.promise
      await page.locator('[data-action=logout]').click()
      await expect(page.locator('#workspace')).toBeVisible()
      await expect(page.locator('[data-page=systems-catalog]')).toHaveCount(0)
      await login(page, credentials, true, false)
      await page.locator('[data-nav-path="/systems"]:visible').click(); await ready(page)
      await expect(page.locator('.systems-table tbody')).toContainText('FOREIGN-SECRET-System')
      release.resolve(); await settled.promise
      await expect(page.locator('.systems-table tbody')).not.toContainText('Local System')
      expect((await authenticated(page, '/foundation/systems/1001')).status()).toBe(404)
    } finally { release.resolve(); await page.unrouteAll({ behavior: 'wait' }) }
    await page.locator('[data-action=logout]').click()
    await login(page, credentials, false, false); await page.goto('/systems/1001')
    await expect(page.locator('[data-system-id="1001"]')).toBeVisible()
    try {
      expect((await request.post(`${api}/_test/control`, { data: { action: 'revoke-foundation' } })).status()).toBe(200)
      const forbidden = page.waitForResponse(response => response.url() === `${api}/foundation/systems/1001` && response.status() === 403)
      await page.locator('[data-action=systems-refresh]').click(); await forbidden
      await expect(page.locator('[data-state=forbidden]')).toBeVisible()
      await expect(page.locator('[data-system-id="1001"]')).toHaveCount(0)
    } finally { await request.post(`${api}/_test/control`, { data: { action: 'restore' } }) }
  }],
  ['systems-layout', async ({ page, credentials }) => {
    await login(page, credentials, false, false)
    for (const path of ['/systems', '/systems/1001']) {
      await page.goto(path)
      await expect(page.locator(path === '/systems' ? '[data-page=systems-catalog]' : '[data-page=system-details]')).toBeVisible()
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      for (const language of ['en', 'ar-SA']) for (const theme of ['dark', 'light']) {
        await preferences(page, language, theme)
        for (const width of [360,390,768,1366,1440]) {
          await page.setViewportSize({ width, height: 960 })
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
          const small = await page.locator('main a,main button,main input,main select').evaluateAll(elements => elements.filter(el => {
            const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 43.9 || r.height < 43.9)
          }).map(el => ({ small_target: el.closest('.breadcrumbs') ? 1 : el.matches('a') ? 2 : el.matches('button') ? 3 : 4,
            width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })))
          for (const target of small) process.stdout.write(`PILOT=${JSON.stringify(target)}\n`)
          expect(small.length).toBe(0)
          expect(await page.locator('.systems-feature').evaluate(el => getComputedStyle(el).fontFamily.includes('Readex'))).toBe(true)
          expect(await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map(v => v.id))).toEqual([])
          if (path === '/systems' && process.env.PILOT_VISUAL_ROOT && ((width === 1440 && language === 'en' && theme === 'dark') || (width === 360 && language === 'ar-SA' && theme === 'light')))
            await page.locator('.systems-feature').screenshot({ path: join(process.env.PILOT_VISUAL_ROOT, `synthetic-catalog-${width}-${language}-${theme}.png`) })
        }
      }
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await preferences(page, 'en', 'dark')
      await expect.poll(() => page.locator('[data-route-surface]').evaluate(el => el.getAnimations().length)).toBe(0)
      const control = page.locator(path === '/systems' ? '#system-search' : '[data-action=systems-refresh]')
      await control.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
      expect(await control.evaluate(el => el === document.activeElement && el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none')).toBe(true)
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
    }
  }],
]
