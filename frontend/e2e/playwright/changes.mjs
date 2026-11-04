import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { api,login,authenticated,deferred } from './fixtures.mjs'
const require=createRequire(import.meta.url)
const paged=`${api}/change-management/requests/paged*`
const list=page=>expect(page.locator('[data-page=changes-list]')).toBeVisible()
async function enter(page,credentials){await login(page,credentials,false,false);await page.locator('[data-nav-path="/changes"]:visible').click();await list(page)}
const role=(request,action)=>request.post(`${api}/_test/control`,{data:{action}})

export const changesCases=[
  ['changes-list',async({page,credentials,request})=>{
    expect((await role(request,'dashboard-manager')).status()).toBe(200)
    try {
      await enter(page,credentials)
      await page.goto('/changes?page=1&page_size=1')
      await expect(page.locator('.changes-table tbody tr')).toHaveCount(1)
      await expect(page.locator('.changes-table')).toContainText('Other Change')
      await expect(page.locator('.changes-results')).toContainText('of 2')
      await page.getByRole('button',{name:'Next',exact:true}).click()
      await expect(page.locator('.changes-table')).toContainText('Local Change')
      await expect(page).toHaveURL(/page=2/)
      await page.goBack();await expect(page.locator('.changes-table')).toContainText('Other Change')
      await page.goForward();await expect(page.locator('.changes-table')).toContainText('Local Change')
      await page.locator('.change-title').click()
      await expect(page.locator('[data-change-id="100"]')).toBeVisible()
      await page.locator('.changes-back').click()
      await expect(page).toHaveURL(/page=2/)
      await expect(page.locator('.changes-table')).toContainText('Local Change')
      await page.locator('#changes-search').fill('billing/payments & %?')
      const response=page.waitForResponse(r=>r.url().includes('/requests/paged?')&&new URL(r.url()).searchParams.get('search')==='billing/payments & %?')
      await page.locator('[data-action=changes-apply]').click()
      expect((await response).status()).toBe(200)
      await expect(page.locator('[data-state=changes-empty]')).toBeVisible()
      await expect(page.locator('.changes-table')).toHaveCount(0)
      await page.getByRole('button',{name:'Clear filters',exact:true}).click()
      await expect(page.locator('.changes-table tbody tr')).toHaveCount(2)
      await page.getByRole('combobox',{name:'Recorded status',exact:true}).selectOption('Approved')
      await page.getByRole('combobox',{name:'Stored risk (preliminary)',exact:true}).selectOption('Low')
      await page.getByRole('combobox',{name:'Requester',exact:true}).selectOption('2')
      await page.locator('[data-action=changes-apply]').click()
      await expect(page.locator('.changes-table tbody tr')).toHaveCount(1)
      expect((await authenticated(page,'/change-management/requests/200')).status()).toBe(404)
    }finally{expect((await role(request,'restore')).status()).toBe(200)}
  }],
  ['changes-details',async({page,credentials})=>{
    await enter(page,credentials)
    await expect(page.locator('.changes-table tbody tr')).toHaveCount(1)
    await page.locator('.change-title').click()
    await expect(page.locator('[data-change-id="100"]')).toBeVisible()
    await expect(page.getByRole('heading',{name:'Latest stored assessment'})).toBeVisible()
    await expect(page.locator('.changes-assessment')).toContainText('preliminary')
    await expect(page.locator('.changes-assessment')).toContainText('10/100')
    await expect(page.locator('.changes-feature')).not.toContainText('Authorized to Proceed')
    await expect(page.locator('.change-systems a[href="/systems/1001"]')).toContainText('Local System')
    await page.locator('[data-action=legacy-change-details]').click()
    await expect(page).toHaveURL(/\/legacy\/changes\/100$/)
    await expect(page.locator('[data-legacy-shell]')).toContainText('Local Change')
    for(const suffix of ['history','approvals','implementation'])expect((await authenticated(page,`/change-management/requests/100/${suffix}`)).status()).toBe(200)
    await page.goto('/changes');await list(page)
    await page.getByRole('link',{name:'Create request (existing form)',exact:true}).click()
    await expect(page).toHaveURL(/\/changes\/new$/)
    await expect(page.locator('[data-legacy-shell]')).toBeVisible()
    await expect(page.getByRole('heading',{name:'Register New Change Request',exact:true})).toBeVisible()
    await expect(page.locator('.legacy-workspace .form-panel input').first()).toBeVisible()
    await expect(page.getByRole('button',{name:'Register & Assess',exact:true})).toBeVisible()
    await page.route(`${api}/change-management/requests/100`,async route=>{
      const response=await route.fetch();const data=await response.json();data.latest_assessment=null
      await route.fulfill({response,json:data})
    })
    await page.goto('/changes/100')
    await expect(page.locator('[data-assessment=missing]')).toBeVisible()
    await expect(page.locator('[data-change-id="100"]')).toBeVisible()
    await page.unrouteAll({behavior:'wait'})
    await page.route(`${api}/change-management/requests/100`,async route=>{
      const response=await route.fetch();const data=await response.json();data.latest_assessment.impact_score=101
      await route.fulfill({response,json:data})
    })
    await page.reload()
    await expect(page.locator('[data-assessment=invalid]')).toBeVisible()
    await expect(page.locator('[data-change-id="100"]')).toBeVisible()
  }],
  ['changes-races',async({page,credentials,request})=>{
    await role(request,'dashboard-manager')
    try {
      await login(page,credentials,false,false);await page.goto('/changes?page=1&page_size=1')
      await expect(page.locator('.changes-table')).toContainText('Other Change')
      const held=deferred(),release=deferred(),settled=deferred()
      await page.route(paged,async route=>{
        if(new URL(route.request().url()).searchParams.get('page')!=='2'){await route.continue();return}
        const response=await route.fetch();expect(response.status()).toBe(200);held.resolve();await release.promise
        try{await route.fulfill({response});settled.resolve()}catch(error){if(!route.request().failure())throw error;settled.resolve()}
      },{times:1})
      try {
        await page.getByRole('button',{name:'Next',exact:true}).click();await held.promise
        await expect(page.locator('[data-state=changes-loading]')).toBeVisible()
        await expect(page.locator('.changes-table')).toHaveCount(0)
        await page.locator('#changes-search').fill('Other Change');await page.locator('[data-action=changes-apply]').click()
        await expect(page.locator('.changes-table')).toContainText('Other Change')
        release.resolve();await settled.promise
        await expect(page.locator('.changes-table')).not.toContainText('Local Change')
      }finally{release.resolve();await page.unrouteAll({behavior:'wait'})}
    }finally{await role(request,'restore')}
  }],
  ['changes-boundaries',async({page,credentials})=>{
    await enter(page,credentials)
    expect((await authenticated(page,'/change-management/requests/101')).status()).toBe(404)
    const held=deferred(),release=deferred(),settled=deferred()
    await page.route(paged,async route=>{
      const response=await route.fetch();expect(response.status()).toBe(200);held.resolve();await release.promise
      try{await route.fulfill({response});settled.resolve()}catch(error){if(!route.request().failure())throw error;settled.resolve()}
    },{times:1})
    try {
      await page.locator('[data-action=changes-refresh]').click();await held.promise
      await page.locator('[data-action=logout]').click();await expect(page.locator('#workspace')).toBeVisible()
      await login(page,credentials,true,false);await page.locator('[data-nav-path="/changes"]:visible').click()
      await expect(page.locator('[data-state=changes-empty]')).toBeVisible()
      release.resolve();await settled.promise
      await expect(page.locator('main')).not.toContainText('Local Change')
      expect((await authenticated(page,'/change-management/requests/100')).status()).toBe(404)
    }finally{release.resolve();await page.unrouteAll({behavior:'wait'})}
  }],
  ['changes-forbidden',async({page,credentials,request})=>{
    await enter(page,credentials);await page.locator('.change-title').click();await expect(page.locator('[data-change-id="100"]')).toBeVisible()
    let identities=0
    page.on('request',r=>{if(r.method()==='GET'&&r.url()===`${api}/auth/me`)identities++})
    try {
      await role(request,'dashboard-admin')
      const denial=page.waitForResponse(r=>r.url()===`${api}/change-management/requests/100`&&r.status()===403)
      await page.locator('[data-action=change-refresh]').click();await denial
      await expect(page.locator('[data-state=changes-forbidden]')).toBeVisible()
      await expect(page.locator('[data-change-id="100"]')).toHaveCount(0)
      expect(identities).toBe(0)
      expect((await authenticated(page,'/change-management/requests/100')).status()).toBe(403)
      await page.locator('[data-action=verify]').click();await page.locator('[data-action=confirm-verify]').click()
      await expect(page.locator('[data-state=forbidden]')).toBeVisible()
      await expect(page.locator('[data-nav-path="/changes"]')).toHaveCount(0)
      expect(identities).toBe(1)
    }finally{await role(request,'restore')}
  }],
  ['changes-faults',async({page,credentials})=>{
    await enter(page,credentials)
    await page.route(paged,route=>route.abort('failed'))
    await page.locator('[data-action=changes-refresh]').click()
    await expect(page.locator('[data-state=changes-error]')).toBeVisible()
    await expect(page.locator('.changes-results')).toHaveCount(0)
    await page.unrouteAll({behavior:'wait'})
    await page.route(paged,async route=>{
      const response=await route.fetch();const data=await response.json();data.items[0].id=0;data.items[0].title='MUST-NOT-RENDER'
      await route.fulfill({response,json:data})
    })
    await page.locator('[data-action=changes-refresh]').click()
    await expect(page.locator('[data-state=changes-error]')).toBeVisible()
    await expect(page.locator('main')).not.toContainText('MUST-NOT-RENDER')
    await page.unrouteAll({behavior:'wait'})
    await page.route(`${api}/foundation/systems`,route=>route.abort('failed'))
    await page.goto('/changes/100')
    await expect(page.locator('[data-change-id="100"]')).toBeVisible()
    await expect(page.locator('.change-systems [data-state=changes-error]')).toBeVisible()
    await expect(page.locator('.change-systems a[href="/systems/1001"]')).toContainText('#1001')
    await page.goto('/changes/200');await expect(page.locator('[data-state=changes-missing]')).toBeVisible()
    expect((await authenticated(page,'/change-management/requests/200')).status()).toBe(404)
    await page.goto('/changes/999999');await expect(page.locator('[data-state=changes-missing]')).toBeVisible()
  }],
  ['changes-layout',async({page,credentials})=>{
    await enter(page,credentials)
    for(const path of ['/changes','/changes/100']) {
      await page.goto(path)
      await expect(page.locator(path==='/changes'?'.changes-table':'[data-change-id="100"]')).toBeVisible()
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')})
      for(const language of ['en','ar-SA'])for(const theme of ['dark','light']) {
        await page.setViewportSize({width:1440,height:960});await page.locator('[data-language-switch]:visible').selectOption(language)
        if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-switch]:visible').click()
        await expect(page.locator('html')).toHaveAttribute('dir',language==='en'?'ltr':'rtl')
        for(const width of [360,390,768,1366,1440]) {
          await page.setViewportSize({width,height:960})
          await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0)
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
          expect(await page.locator('main a,main button,main input,main select').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)}).length)).toBe(0)
          expect(await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([])
          if(path==='/changes'&&process.env.PILOT_VISUAL_ROOT&&((width===1440&&language==='en'&&theme==='dark')||(width===360&&language==='ar-SA'&&theme==='light')))
            await page.locator('.changes-feature').screenshot({path:join(process.env.PILOT_VISUAL_ROOT,`synthetic-changes-${width}-${language}-${theme}.png`)})
        }
        const control=page.locator(path==='/changes'?'#changes-search':'[data-action=change-refresh]')
        await control.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab')
        expect(await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')&&getComputedStyle(el).outlineStyle!=='none')).toBe(true)
      }
      await page.emulateMedia({reducedMotion:'reduce'})
      await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations().length)).toBe(0)
    }
  }],
]
