import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { api, login, authenticated, deferred } from './fixtures.mjs'
import { measuredTextColors, meetsTextContrast } from './contrast.mjs'
const require = createRequire(import.meta.url)
const overview = `${api}/change-management/dashboard/overview`
const recent = `${api}/change-management/requests/paged*`
const section = (page, name) => page.locator(`[data-dashboard-section="${name}"]`)
const ready = page => expect(page.locator('[data-kpi=total]')).toHaveText('1')
async function enter(page, credentials) {
  await login(page, credentials, false, false)
  await page.locator('[data-nav-path="/dashboard"]:visible').click()
  await ready(page)
}

export const dashboardCases = [
  ['dashboard-data', async ({ page, credentials }) => {
    await enter(page, credentials)
    const data = await authenticated(page, '/change-management/dashboard/overview')
    expect(data.status()).toBe(200)
    expect((await data.json()).total_changes).toBe(1)
    expect((await authenticated(page, '/change-management/requests/101')).status()).toBe(404)
    await expect(page.locator('[data-kpi=pending]')).toHaveText('0')
    await expect(page.locator('.dashboard-table tbody tr')).toHaveCount(1)
    await expect(page.locator('.dashboard-table')).toContainText('Local Change')
    await expect(page.locator('main')).not.toContainText('Other Change')
    await expect(page.locator('main')).not.toContainText('FOREIGN-SECRET')
    await expect(page.locator('main')).not.toContainText('Avg Impact Score')
    await expect(page.locator('main')).not.toContainText('Authorized to Proceed')
    await expect(page.locator('.dashboard-distribution')).toContainText('Other lifecycle statuses are not included')
    const response = page.waitForResponse(r => r.url().includes('/requests/paged?') && new URL(r.url()).searchParams.get('status') === 'Approved')
    await page.locator('.dashboard-queue-list a[href*="status=Approved"]').click()
    expect((await response).status()).toBe(200)
    await expect(page.locator('.dashboard-table tbody tr')).toHaveCount(1)
    await page.locator('.dashboard-table a').click()
    await expect(page).toHaveURL(/\/changes\/100$/)
    await expect(page.locator('[data-legacy-shell]')).toBeVisible()
    await expect(page.locator('[data-legacy-shell]')).toContainText('Local Change')
    await page.goBack()
    await ready(page)
  }],
  ['dashboard-faults', async ({ page, credentials }) => {
    await enter(page, credentials)
    await page.route(overview, route => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ total_changes:-1, pending_approval:0, approved:0, rejected:0, needs_more_information:0 }) }))
    await page.route(`${api}/change-management/dashboard/work-queues`, route => route.abort('failed'))
    await page.reload()
    await expect(section(page,'overview').locator('[data-state=dashboard-error]')).toBeVisible()
    await expect(section(page,'work').locator('[data-state=dashboard-error]')).toBeVisible()
    await expect(page.locator('[data-kpi=total]')).toHaveCount(0)
    await expect(section(page,'delivery').locator('.dashboard-queue-list')).toBeVisible()
    await expect(page.locator('.dashboard-table')).toContainText('Local Change')
    await page.unrouteAll({ behavior:'wait' })
    await page.route(recent, route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({items:[{id:100,requester_id:10,title:'MUST-NOT-RENDER',status:'Approved',priority:'Medium',change_type:'application',created_at:'2026-01-02T10:00:00'}],total:1,page:1,page_size:5,total_pages:1}) }))
    await page.reload()
    await ready(page)
    await expect(section(page,'recent').locator('[data-state=dashboard-error]')).toBeVisible()
    await expect(page.locator('main')).not.toContainText('MUST-NOT-RENDER')
    await page.unrouteAll({ behavior:'wait' })
    await page.route(overview, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({total_changes:0,pending_approval:0,approved:0,rejected:0,needs_more_information:0,average_impact_score:99})}))
    await page.route(recent, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],total:0,page:1,page_size:5,total_pages:1})}))
    await page.reload()
    await expect(page.locator('[data-kpi=total]')).toHaveText('0')
    await expect(page.locator('[data-state=dashboard-empty]')).toBeVisible()
    await expect(page.locator('[data-state=dashboard-recent-empty]')).toBeVisible()
    await expect(page.locator('main')).not.toContainText('99')
  }],
  ['dashboard-races', async ({ page, credentials }) => {
    await enter(page, credentials)
    const held = deferred(), release = deferred(), settled = deferred()
    await page.route(recent, async route => {
      const response = await route.fetch(); expect(response.status()).toBe(200)
      held.resolve(); await release.promise
      try { await route.fulfill({response}); settled.resolve() } catch (error) { if (!route.request().failure()) throw error; settled.resolve() }
    },{times:1})
    try {
      await page.locator('[data-action=dashboard-refresh]').click(); await held.promise
      await expect(section(page,'recent').locator('[data-state=dashboard-loading]')).toBeVisible()
      await expect(page.locator('.dashboard-table')).toHaveCount(0)
      await page.locator('.dashboard-queue-list a[href*="Pending%20Approval"]').click()
      await expect(page.locator('[data-state=dashboard-recent-empty]')).toBeVisible()
      release.resolve(); await settled.promise
      await expect(page.locator('.dashboard-table')).toHaveCount(0)
      await expect(page.locator('main')).not.toContainText('Local Change')
      expect((await authenticated(page,'/change-management/requests/paged?status=Pending%20Approval')).status()).toBe(200)
    } finally { release.resolve(); await page.unrouteAll({behavior:'wait'}) }
  }],
  ['dashboard-boundaries', async ({ page, credentials }) => {
    await enter(page, credentials)
    const held = deferred(), release = deferred(), settled = deferred()
    await page.route(overview, async route => {
      const response = await route.fetch(); expect(response.status()).toBe(200)
      held.resolve(); await release.promise
      try { await route.fulfill({response}); settled.resolve() } catch (error) { if (!route.request().failure()) throw error; settled.resolve() }
    },{times:1})
    try {
      await page.locator('[data-action=dashboard-refresh]').click(); await held.promise
      await expect(page.locator('[data-kpi=total]')).toHaveCount(0)
      await page.locator('[data-action=logout]').click()
      await expect(page.locator('#workspace')).toBeVisible()
      await login(page, credentials, true, false)
      await page.goto('/dashboard')
      await expect(page.locator('[data-kpi=total]')).toHaveText('0')
      release.resolve(); await settled.promise
      await expect(page.locator('[data-kpi=total]')).toHaveText('0')
      await expect(page.locator('main')).not.toContainText('Local Change')
      expect((await authenticated(page,'/change-management/requests/100')).status()).toBe(404)
      expect((await authenticated(page,'/change-management/dashboard/overview')).status()).toBe(200)
    } finally { release.resolve(); await page.unrouteAll({behavior:'wait'}) }
    // AuthRoot reserves ?memory=1 when storage is blocked. Queue filtering must
    // still reach the server without changing the established auth URL policy.
    await page.locator('[data-action=logout]').click()
    await page.addInitScript(() => Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Controlled blocked storage')}}))
    await login(page,credentials,false,false)
    await page.locator('[data-nav-path="/dashboard"]:visible').click(); await ready(page)
    const memoryQueue = page.waitForResponse(r => r.url().includes('/requests/paged?') && new URL(r.url()).searchParams.get('status')==='Approved')
    await page.locator('.dashboard-queue-list li').filter({hasText:'Approved (recorded)'}).locator('a,button').click()
    await expect(page.getByRole('heading',{name:'Queue records',exact:true})).toBeVisible()
    const memoryResponse = await memoryQueue
    expect(memoryResponse.status()).toBe(200)
    expect((await memoryResponse.json()).items.every(item=>item.status==='Approved')).toBe(true)
    await expect(page.locator('.dashboard-table')).toContainText('Local Change')
    await expect(page).toHaveURL(/\/dashboard\?memory=1$/)
  }],
  ['dashboard-roles', async ({ page, credentials, request }) => {
    await enter(page, credentials)
    try {
      expect((await request.post(`${api}/_test/control`,{data:{action:'dashboard-manager'}})).status()).toBe(200)
      await page.locator('[data-action=verify]').click(); await page.locator('[data-action=confirm-verify]').click()
      await expect(page.locator('[data-kpi=total]')).toHaveText('2')
      await expect(page.locator('.dashboard-table tbody tr')).toHaveCount(2)
      expect((await authenticated(page,'/change-management/requests/101')).status()).toBe(200)
      expect((await authenticated(page,'/change-management/requests/200')).status()).toBe(404)
      expect((await request.post(`${api}/_test/control`,{data:{action:'dashboard-admin'}})).status()).toBe(200)
      const forbidden = page.waitForResponse(r => r.url().startsWith(`${api}/change-management/`) && r.status()===403)
      await page.locator('[data-action=dashboard-refresh]').click(); await forbidden
      await expect(page.locator('[data-state=forbidden]')).toBeVisible()
      await expect(page.locator('[data-kpi=total]')).toHaveCount(0)
      await expect(page.locator('[data-nav-path="/dashboard"]')).toHaveCount(0)
      const identity = await authenticated(page,'/auth/me'); expect(identity.status()).toBe(200)
      expect((await identity.json()).permissions).not.toContain('changes.read')
      expect((await authenticated(page,'/change-management/dashboard/overview')).status()).toBe(403)
      expect((await authenticated(page,'/change-management/dashboard/work-queues')).status()).toBe(403)
      await page.goto('/workspace'); await expect(page.locator('[data-page=workspace-home]')).toBeVisible()
    } finally { expect((await request.post(`${api}/_test/control`,{data:{action:'restore'}})).status()).toBe(200) }
  }],
  ['dashboard-layout', async ({ page, credentials }) => {
    await enter(page, credentials)
    await expect(page.locator('.dashboard-table tbody tr')).toHaveCount(1)
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')})
    for (const language of ['en','ar-SA']) for (const theme of ['dark','light']) {
      await page.setViewportSize({width:1440,height:960})
      await page.locator('[data-language-switch]:visible').selectOption(language)
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('[data-theme-switch]:visible').click()
      await expect(page.locator('html')).toHaveAttribute('dir',language==='en'?'ltr':'rtl')
      await expect(page.getByRole('heading',{level:1,name:language==='en'?'Operational overview':'نظرة تشغيلية عامة'})).toBeVisible()
      for (const width of [360,390,768,1366,1440]) {
        await page.setViewportSize({width,height:960})
        // Audit the completed visual state, including route/hover transitions.
        // This is an observed animation condition, not a fixed delay.
        await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true)
        expect(await page.locator('main a,main button').evaluateAll(elements => elements.filter(el => {
          const r=el.getBoundingClientRect(); return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)
        }).length)).toBe(0)
        expect(await page.locator('.dashboard-feature').evaluate(el => getComputedStyle(el).fontFamily.includes('Readex'))).toBe(true)
        for(const label of await page.locator('.dashboard-kpis dt').all())
          expect(meetsTextContrast(await label.evaluate(measuredTextColors))).toBe(true)
        expect(await page.evaluate(async () => (await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=> {
          if (v.id !== 'color-contrast') return v.id
          const node = document.querySelector(v.nodes[0]?.target[0])
          return node?.closest('.dashboard-kpis') ? 'contrast-kpi' : node?.closest('.dashboard-queue-list') ? 'contrast-queue'
            : node?.closest('.dashboard-distribution') ? 'contrast-distribution' : node?.closest('.dashboard-table') ? 'contrast-table'
            : node?.closest('.dashboard-boundary') ? 'contrast-boundary' : 'color-contrast'
        }))).toEqual([])
        if (process.env.PILOT_VISUAL_ROOT && ((width===1440&&language==='en'&&theme==='dark')||(width===360&&language==='ar-SA'&&theme==='light')))
          await page.locator('.dashboard-feature').screenshot({path:join(process.env.PILOT_VISUAL_ROOT,`synthetic-dashboard-${width}-${language}-${theme}.png`)})
      }
      const control=page.locator('[data-action=dashboard-refresh]')
      await control.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
      expect(await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle!=='none')).toBe(true)
    }
    const contrastTarget = page.locator('.dashboard-kpis dt').first()
    try {
      await contrastTarget.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}))
      expect(await contrastTarget.evaluate(el=>{
        const r=el.getBoundingClientRect(), top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)
        return top===el||el.contains(top)
      })).toBe(true)
      await contrastTarget.evaluate(el=>{el.style.color='#aaaaaa';el.style.backgroundColor='#ffffff';el.style.fontSize='16px'})
      expect(meetsTextContrast(await contrastTarget.evaluate(measuredTextColors))).toBe(false)
    } finally { await contrastTarget.evaluate(el=>{for(const key of ['color','background-color','font-size'])el.style.removeProperty(key)}) }
    expect(meetsTextContrast(await contrastTarget.evaluate(measuredTextColors))).toBe(true)
    expect(await page.evaluate(async ()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'rule',values:['color-contrast']}})).violations.map(v=>v.id))).toEqual([])
    await page.emulateMedia({reducedMotion:'reduce'})
    await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations().length)).toBe(0)
    await page.locator('[data-action=dashboard-refresh]').click()
    await expect(page.locator('[data-kpi=total]')).toHaveText('١')
  }],
]
