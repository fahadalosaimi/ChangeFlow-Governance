import {expect} from '@playwright/test'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {api,login,authenticated,deferred} from './fixtures.mjs'
const require=createRequire(import.meta.url),paged=`${api}/notifications/paged*`
const control=(request,action)=>request.post(`${api}/_test/control`,{data:{action}})
async function patch(page,path){const token=await page.evaluate(()=>sessionStorage.getItem('changeflow_session_token'));expect(Boolean(token)).toBe(true);return page.request.patch(`${api}${path}`,{headers:{Authorization:`Bearer ${token}`}})}
async function enter(page,credentials){await login(page,credentials,false,false);await page.locator('[data-nav-path="/notifications"]:visible').click();await expect(page.locator('[data-notice-card]')).toHaveCount(4)}
const row=(page,id)=>page.locator(`[data-notice-card="${id}"]`)
export const notificationCases=[
  ['notices-list',async({page,credentials})=>{
    await enter(page,credentials)
    await expect(page.locator('[data-unread-count]')).toHaveText('3')
    await page.goto('/notifications?page=1&page_size=2&unread_only=false')
    await expect(page.locator('[data-notice-card]')).toHaveCount(2)
    await page.getByRole('button',{name:'Next',exact:true}).click();await expect(row(page,10)).toBeVisible();await expect(row(page,1)).toBeVisible()
    await page.goBack();await expect(row(page,17)).toBeVisible();await page.goForward();await expect(row(page,10)).toBeVisible()
    await page.locator('#notices-search').fill('billing/payments')
    const request=page.waitForResponse(r=>r.url().includes('/notifications/paged?')&&new URL(r.url()).searchParams.get('search')==='billing/payments')
    await page.locator('[data-notices-apply]').click();expect((await request).status()).toBe(200)
    await expect(page.locator('[data-notice-card]')).toHaveCount(1);await expect(row(page,11)).toBeVisible()
    await page.locator('[data-notice-preview="11"]').click();await expect(row(page,11)).toContainText('Synthetic notification details')
    await page.locator('[data-notices-clear]').click();await page.locator('[data-notices-type]').selectOption('GENERAL');await page.locator('[data-notices-apply]').click()
    await expect(page.locator('[data-notice-card]')).toHaveCount(2);await expect(page.locator('[data-notice-open]')).toHaveCount(0)
    await page.locator('[data-legacy-notifications]').click();await expect(page.locator('[data-legacy-shell]')).toBeVisible()
    await expect(page.locator('.notification-center-page')).toBeVisible()
  }],
  ['notices-mark',async({page,credentials})=>{
    await enter(page,credentials)
    await page.locator('[data-notices-unread]').selectOption('true');await page.locator('[data-notices-apply]').click()
    await expect(page.locator('[data-notice-card]')).toHaveCount(3)
    const held=deferred(),release=deferred();let writes=0,receipt
    await page.route(`${api}/notifications/11/read`,async route=>{writes++;const response=await route.fetch();expect(response.status()).toBe(200);receipt=await response.json();held.resolve();await release.promise;await route.fulfill({response})})
    try{await row(page,11).locator('[data-notice-mark]').evaluate(button=>{button.click();button.click()});await held.promise;expect(writes).toBe(1);await expect(page.locator('[data-notices-mark-all]')).toBeDisabled()}
    finally{release.resolve()}
    await expect(page.locator('[data-notice-action=confirmed]')).toBeVisible();expect(writes).toBe(1)
    await expect(page.locator('[data-unread-count]')).toHaveText('2');await expect(row(page,11)).toHaveCount(0)
    expect(receipt.read_at).toBeTruthy()
    await page.locator('[data-notices-clear]').click()
    await expect(row(page,11).locator('[data-read-at]')).toHaveAttribute('datetime',receipt.read_at+(/(?:Z|[+-]\d{2}:\d{2})$/.test(receipt.read_at)?'':'Z'))
    await page.locator('[data-notices-type]').selectOption('CHANGE_SUBMITTED');await page.locator('[data-notices-apply]').click()
    await page.locator('[data-notices-mark-all]').click();await expect(page.locator('[data-notice-action=confirmed]')).toBeVisible()
    await expect(page.locator('[data-unread-count]')).toHaveText('0')
    // Read-all is the current authorized recipient scope, not just this filter.
    const all=await (await authenticated(page,'/notifications/paged')).json()
    expect(all.items.filter(n=>!n.is_read)).toHaveLength(0)
    await page.locator('[data-notices-clear]').click();await expect(page.locator('[data-notice-card]')).toHaveCount(4)
    for(const notice of all.items)if(notice.read_at)await expect(row(page,notice.id).locator('[data-read-at]')).toHaveAttribute('datetime',notice.read_at+(/(?:Z|[+-]\d{2}:\d{2})$/.test(notice.read_at)?'':'Z'))
    await page.locator('[data-notices-refresh]').click();await expect(page.locator('[data-unread-count]')).toHaveText('0')
  }],
  ['notices-navigation',async({page,credentials})=>{
    await enter(page,credentials)
    await row(page,11).locator('[data-notice-open]').click()
    await expect(page.locator('[data-change-id="100"]')).toBeVisible()
    const result=await (await authenticated(page,'/notifications/paged?search=billing')).json()
    expect(result.items[0].is_read).toBe(true);expect(result.items[0].read_at).toBeTruthy()
    await page.locator('.changes-back').click();await expect(page.locator('[data-page=notifications]')).toBeVisible()
    await page.route(`${api}/change-management/requests/100`,route=>route.fulfill({status:404,json:{detail:'hidden'}}))
    await row(page,11).locator('[data-notice-open]').click()
    await expect(page.locator('[data-notice-action=rejected]')).toBeVisible();await expect(page).toHaveURL(/\/notifications/)
    await expect(page.locator('[data-change-id]')).toHaveCount(0)
  }],
  ['notices-races',async({page,credentials})=>{
    await enter(page,credentials)
    const held=deferred(),release=deferred(),settled=deferred()
    await page.route(paged,async route=>{
      if(new URL(route.request().url()).searchParams.get('search')!=='billing'){await route.continue();return}
      const response=await route.fetch();expect(response.status()).toBe(200);held.resolve();await release.promise
      try{await route.fulfill({response})}catch(e){if(!route.request().failure())throw e}finally{settled.resolve()}
    },{times:1})
    try{await page.locator('#notices-search').fill('billing');await page.locator('[data-notices-apply]').click();await held.promise
      await expect(page.locator('[data-notice-card]')).toHaveCount(0)
      await page.locator('#notices-search').fill('Service maintenance');await page.locator('[data-notices-apply]').click();await expect(row(page,10)).toBeVisible()
      release.resolve();await settled.promise;await expect(row(page,11)).toHaveCount(0)
    }finally{release.resolve();await page.unrouteAll({behavior:'wait'})}
    await page.locator('#notices-search').fill('billing');await page.locator('[data-notices-apply]').click();await expect(row(page,11)).toBeVisible()
    const targetHeld=deferred(),targetRelease=deferred(),targetSettled=deferred()
    await page.route(`${api}/change-management/requests/100`,async route=>{
      const response=await route.fetch();expect(response.status()).toBe(200);targetHeld.resolve();await targetRelease.promise
      try{await route.fulfill({response})}catch(e){if(!route.request().failure())throw e}finally{targetSettled.resolve()}
    },{times:1})
    try{await row(page,11).locator('[data-notice-open]').click();await targetHeld.promise
      await page.goBack();await expect(row(page,10)).toBeVisible()
      targetRelease.resolve();await targetSettled.promise
      await expect(page.locator('[data-notice-action=uncertain]')).toBeVisible()
      await expect(row(page,10)).toBeVisible();await expect(page).toHaveURL(/\/notifications/);await expect(page.locator('[data-change-id]')).toHaveCount(0)
    }finally{targetRelease.resolve();await page.unrouteAll({behavior:'wait'})}
  }],
  ['notices-boundaries',async({page,credentials})=>{
    for(const status of [200,401]){
      await enter(page,credentials)
      const held=deferred(),release=deferred(),settled=deferred()
      await page.route(paged,async route=>{const response=await route.fetch();held.resolve();await release.promise
        try{await route.fulfill(status===200?{response}:{status:401,json:{detail:'expired old response'}})}catch(e){if(!route.request().failure())throw e}finally{settled.resolve()}
      },{times:1})
      try{await page.locator('[data-notices-refresh]').click();await held.promise;await page.locator('[data-action=logout]').click()
        await login(page,credentials,true,false);await page.locator('[data-nav-path="/notifications"]:visible').click();await expect(page.locator('[data-notices-empty]')).toBeVisible()
        release.resolve();await settled.promise;await expect(page.locator('[data-workspace-shell]')).toBeVisible()
        await expect(page.locator('main')).not.toContainText('billing/payments');await expect(page.locator('[data-unread-count]')).toHaveText('0')
        expect((await authenticated(page,'/notifications/paged')).status()).toBe(200)
      }finally{release.resolve();await page.unrouteAll({behavior:'wait'})}
      await page.locator('[data-action=logout]').click()
    }
  }],
  ['notices-mutation',async({page,credentials,request})=>{
    await enter(page,credentials);let writes=0
    await page.route(`${api}/notifications/11/read`,async route=>{writes++;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed')})
    await row(page,11).locator('[data-notice-mark]').click();await expect(page.locator('[data-notice-action=uncertain]')).toBeVisible()
    await expect(page.locator('[data-notices-mark-all]')).toBeDisabled()
    expect((await (await authenticated(page,'/notifications/paged?search=billing')).json()).items[0].is_read).toBe(true)
    await page.locator('[data-notices-reconcile]').click();await expect(page.locator('[data-notice-action=observed]')).toBeVisible();expect(writes).toBe(1)
    await page.unrouteAll({behavior:'wait'})
    await page.route(`${api}/notifications/read-all`,async route=>{writes++;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed')})
    await page.locator('[data-notices-mark-all]').click();await expect(page.locator('[data-notice-action=uncertain]')).toBeVisible()
    await page.locator('[data-notices-reconcile]').click();await expect(page.locator('[data-notice-action=observed]')).toBeVisible();expect(writes).toBe(2)
    await expect(page.locator('[data-unread-count]')).toHaveText('0')
    await page.unrouteAll({behavior:'wait'})
    expect((await control(request,'notices-reset')).status()).toBe(200);expect((await control(request,'notices-seed')).status()).toBe(200)
    await page.reload();await expect(row(page,10).locator('[data-notice-mark]')).toBeVisible()
    const held=deferred(),release=deferred(),settled=deferred()
    await page.route(`${api}/notifications/10/read`,async route=>{
      const response=await route.fetch();expect(response.status()).toBe(200);expect((await response.json()).is_read).toBe(true);held.resolve();await release.promise
      try{await route.fulfill({response})}catch(e){if(!route.request().failure())throw e}finally{settled.resolve()}
    },{times:1})
    try{await row(page,10).locator('[data-notice-mark]').click();await held.promise
      await page.locator('[data-action=logout]').click();await login(page,credentials,true,false);await page.locator('[data-nav-path="/notifications"]:visible').click()
      await expect(page.locator('[data-notices-empty]')).toBeVisible()
      release.resolve();await settled.promise
      await expect(page.locator('[data-notice-action=confirmed]')).toHaveCount(0)
      await expect(page.locator('main')).not.toContainText('Service maintenance')
      expect((await patch(page,'/notifications/10/read')).status()).toBe(404)
      await expect(page).toHaveURL(/\/notifications/)
    }finally{release.resolve();await page.unrouteAll({behavior:'wait'})}
  }],
  ['notices-roles',async({page,credentials,request})=>{
    await enter(page,credentials)
    try{await control(request,'dashboard-admin');await page.locator('[data-notices-refresh]').click()
      await expect(page.locator('[data-notice-card]')).toHaveCount(2);await expect(page.locator('[data-notice-open]')).toHaveCount(0)
      expect((await patch(page,'/notifications/11/read')).status()).toBe(404)
      await control(request,'notices-revoke');await page.locator('[data-notices-refresh]').click()
      await expect(page.locator('[data-notices-forbidden]')).toBeVisible();await expect(page.locator('[data-notice-card]')).toHaveCount(0)
      expect((await authenticated(page,'/notifications/unread-count')).status()).toBe(403)
    }finally{await control(request,'restore')}
  }],
  ['notices-layout',async({page,credentials})=>{
    await enter(page,credentials);await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')})
    for(const language of ['en','ar-SA'])for(const theme of ['dark','light']){
      await page.setViewportSize({width:1440,height:960});await page.locator('[data-language-switch]:visible').selectOption(language)
      if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-switch]:visible').click()
      await expect(page.locator('html')).toHaveAttribute('dir',language==='en'?'ltr':'rtl')
      for(const width of [360,390,768,1366,1440]){
        await page.setViewportSize({width,height:960});await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0)
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
        expect(await page.locator('main a,main button,main input,main select').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)}).length)).toBe(0)
        expect(await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([])
        if(process.env.PILOT_VISUAL_ROOT&&((width===1440&&language==='en'&&theme==='dark')||(width===360&&language==='ar-SA'&&theme==='light')))
          await page.locator('.notices-feature').screenshot({path:join(process.env.PILOT_VISUAL_ROOT,`synthetic-notices-${width}-${language}-${theme}.png`)})
      }
      const input=page.locator('#notices-search');await input.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(input).toBeFocused()
      expect(await input.evaluate(el=>el.matches(':focus-visible'))).toBe(true)
    }
    await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations().length)).toBe(0)
  }],
]
