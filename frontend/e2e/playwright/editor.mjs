import {expect} from '@playwright/test'
import {createRequire} from 'node:module'
import {join} from 'node:path'
import {api,login,authenticated,deferred} from './fixtures.mjs'
const require=createRequire(import.meta.url)
const create='/development/changes/new',revise='/development/changes/100/revise'
async function enter(page,credentials,path=create){await login(page,credentials,false,false);await page.goto(path);await expect(page.locator('[data-editor-form]')).toBeVisible()}
async function fill(page,title='Synthetic editor request'){
  await page.locator('#editor-title').fill(title);await page.locator('#editor-description').fill('Controlled browser integration description')
  await page.locator('[data-system-id="1001"]').check()
}
const submit=page=>page.locator('[data-editor-form]').evaluate(form=>{form.requestSubmit();form.requestSubmit()})
const control=(request,action)=>request.post(`${api}/_test/control`,{data:{action}})
export const editorCases=[
  ['editor-default',async({page,credentials})=>{
    expect(process.env.PILOT_DEFAULT_ORIGIN).toBeTruthy()
    await login(page,credentials,false,false,`${process.env.PILOT_DEFAULT_ORIGIN}/login`)
    await page.evaluate(()=>{localStorage.setItem('controlledWrites','true');sessionStorage.setItem('enableWrites','true')})
    let writes=0;page.on('request',r=>{if(['POST','PUT'].includes(r.method())&&r.url().includes('/change-management/requests'))writes++})
    for(const path of [create,revise]){
      await page.goto(`${process.env.PILOT_DEFAULT_ORIGIN}${path}?controlledWrites=true&development=1`)
      await expect(page.locator('[data-state=forbidden]')).toBeVisible()
      await expect(page.locator('[data-editor-form]')).toHaveCount(0)
    }
    await page.goto(`${process.env.PILOT_DEFAULT_ORIGIN}/changes/new`)
    await expect(page.locator('[data-legacy-shell]')).toBeVisible()
    expect(writes).toBe(0)
  }],
  ['editor-create',async({page,credentials})=>{
    await enter(page,credentials);await fill(page)
    let writes=0;page.on('request',r=>{if(r.method()==='POST'&&r.url()===`${api}/change-management/requests`)writes++})
    const held=deferred(),release=deferred();let created
    await page.route(`${api}/change-management/requests`,async route=>{
      const response=await route.fetch();expect(response.status()).toBe(200);created=await response.json();held.resolve();await release.promise;await route.fulfill({response})
    },{times:1})
    try{await submit(page);await held.promise;expect(writes).toBe(1);await expect(page.locator('[data-editor-submit]')).toBeDisabled()}
    finally{release.resolve()}
    await expect(page.locator('[data-editor-state=saved]')).toBeVisible();expect(writes).toBe(1)
    expect(created.requester_id).toBe(2);expect(created.status).toBe('Pending Approval')
    expect((await authenticated(page,`/change-management/requests/${created.id}`)).status()).toBe(200)
    await page.locator('[data-editor-state=saved] a').click();await expect(page.locator(`[data-change-id="${created.id}"]`)).toBeVisible()
  }],
  ['editor-revise',async({page,credentials,request})=>{
    expect((await control(request,'editor-eligible')).status()).toBe(200)
    try{await enter(page,credentials,revise)
      await expect(page.locator('#editor-title')).toHaveValue('Local Change')
      await page.locator('#editor-title').fill('Revised through editor');await page.locator('#editor-revision_comment').fill('Corrected operational scope')
      const done=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/requests/100/revise'))
      await submit(page);expect((await done).status()).toBe(200)
      await expect(page.locator('[data-editor-state=saved]')).toBeVisible()
      const record=await (await authenticated(page,'/change-management/requests/100')).json()
      expect(record.title).toBe('Revised through editor');expect(record.status).toBe('Pending Approval')
      await page.reload();await expect(page.locator('[data-editor-state=ineligible]')).toBeVisible()
    }finally{await control(request,'editor-reset')}
  }],
  ['editor-validation',async({page,credentials})=>{
    await enter(page,credentials)
    await page.route(`${api}/foundation/systems`,route=>route.fulfill({json:[]}))
    await page.reload();await expect(page.locator('[data-editor-submit]')).toBeDisabled()
    await page.unrouteAll({behavior:'wait'})
    await page.route(`${api}/foundation/systems`,async route=>{const response=await route.fetch();const rows=await response.json();rows[0].organization_id=2;await route.fulfill({response,json:rows})})
    await page.reload();await expect(page.locator('[data-state=changes-error]')).toBeVisible();await expect(page.locator('[data-editor-form]')).toHaveCount(0)
    await page.unrouteAll({behavior:'wait'});await page.reload();await expect(page.locator('[data-editor-form]')).toBeVisible();await submit(page)
    await expect(page.locator('[data-editor-errors]')).toBeFocused()
    await expect(page.locator('#editor-title')).toHaveAttribute('aria-invalid','true')
    await fill(page,'Correctable request')
    for(const status of [400,409,422]){
      await page.route(`${api}/change-management/requests`,route=>route.fulfill({status,json:{detail:'DO-NOT-EXPOSE'}}),{times:1})
      await submit(page);await expect(page.locator('[data-editor-state=rejected]')).toBeVisible()
      await expect(page.locator('#editor-title')).toHaveValue('Correctable request')
      await expect(page.locator('main')).not.toContainText('DO-NOT-EXPOSE')
    }
    await page.route(`${api}/change-management/requests`,route=>route.fulfill({status:403,json:{detail:'DO-NOT-EXPOSE'}}),{times:1})
    await submit(page);await expect(page.locator('[data-state=changes-forbidden]')).toBeVisible()
    await expect(page.locator('[data-editor-form]')).toHaveCount(0)
  }],
  ['editor-uncertain',async({page,credentials})=>{
    await enter(page,credentials);await fill(page,'Committed but reply lost')
    let writes=0,created
    await page.route(`${api}/change-management/requests`,async route=>{writes++;const response=await route.fetch();expect(response.status()).toBe(200);created=await response.json();await route.abort('failed')})
    await submit(page);await expect(page.locator('[data-editor-state=uncertain]')).toBeVisible()
    await expect(page.locator('[data-editor-submit]')).toBeDisabled();await submit(page)
    const actual=await authenticated(page,`/change-management/requests/${created.id}`)
    expect(actual.status()).toBe(200);expect((await actual.json()).title).toBe('Committed but reply lost')
    expect(writes).toBe(1);await expect(page.locator('[data-editor-state=saved]')).toHaveCount(0)
    await page.unrouteAll({behavior:'wait'});await page.goto(create);await expect(page.locator('[data-editor-form]')).toBeVisible();await fill(page,'Malformed saved reply')
    await page.route(`${api}/change-management/requests`,async route=>{writes++;const response=await route.fetch();const data=await response.json();created=data.id;await route.fulfill({response,json:{...data,id:0}})})
    await submit(page);await expect(page.locator('[data-editor-state=uncertain]')).toBeVisible()
    expect((await authenticated(page,`/change-management/requests/${created}`)).status()).toBe(200)
    expect(writes).toBe(2);await expect(page.locator('[data-editor-state=saved]')).toHaveCount(0)
  }],
  ['editor-boundaries',async({page,credentials})=>{
    await enter(page,credentials);await fill(page,'Old session submitted')
    const held=deferred(),release=deferred(),settled=deferred();let created
    await page.route(`${api}/change-management/requests`,async route=>{
      const response=await route.fetch();expect(response.status()).toBe(200);created=await response.json();held.resolve();await release.promise
      try{await route.fulfill({response})}catch(error){if(!route.request().failure())throw error}finally{settled.resolve()}
    },{times:1})
    try{await submit(page);await held.promise;await page.locator('[data-action=logout]').click()
      await login(page,credentials,true,false);await page.goto(create);await expect(page.locator('[data-editor-form]')).toBeVisible()
      release.resolve();await settled.promise
      await expect(page.locator('#editor-title')).toHaveValue('')
      await expect(page.locator('[data-editor-state=saved]')).toHaveCount(0)
      expect((await authenticated(page,`/change-management/requests/${created.id}`)).status()).toBe(404)
      await expect(page).toHaveURL(new RegExp(`${create}$`))
    }finally{release.resolve();await page.unrouteAll({behavior:'wait'})}
  }],
  ['editor-layout',async({page,credentials,request})=>{
    await control(request,'editor-eligible')
    try{await enter(page,credentials)
      for(const path of [create,revise]){
        await page.goto(path);await expect(page.locator('[data-editor-form]')).toBeVisible()
        await page.locator('#editor-planned_start').fill('2026-12-01T10:00')
        await page.locator('#editor-planned_end').fill('2026-12-01T11:00')
        await expect(page.locator('#editor-planned_start')).toHaveAttribute('dir','ltr')
        await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')})
        for(const language of ['en','ar-SA'])for(const theme of ['dark','light']){
          await page.setViewportSize({width:1440,height:960});await page.locator('[data-language-switch]:visible').selectOption(language)
          if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-switch]:visible').click()
          await expect(page.locator('html')).toHaveAttribute('dir',language==='en'?'ltr':'rtl')
          expect(await page.locator('#editor-planned_start').evaluate(el=>getComputedStyle(el).direction)).toBe('ltr')
          await expect(page.locator('#editor-planned_start')).toHaveValue('2026-12-01T10:00')
          for(const width of [360,390,768,1366,1440]){
            await page.setViewportSize({width,height:960})
            await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0)
            expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
            expect(await page.locator('main a,main button,main input,main select,main textarea').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9)}).length)).toBe(0)
            expect(await page.evaluate(async()=>(await window.axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([])
            if(path===create&&process.env.PILOT_VISUAL_ROOT&&((width===1440&&language==='en'&&theme==='dark')||(width===360&&language==='ar-SA'&&theme==='light')))
              await page.locator('.editor-feature').screenshot({path:join(process.env.PILOT_VISUAL_ROOT,`synthetic-editor-${width}-${language}-${theme}.png`)})
          }
          const field=page.locator('#editor-title');await field.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab')
          expect(await field.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible'))).toBe(true)
        }
        await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.locator('[data-route-surface]').evaluate(el=>el.getAnimations().length)).toBe(0)
      }
    }finally{await control(request,'editor-reset')}
  }],
]
