import { runBrowser } from './browser.mjs'
import { entryMotionStep } from './diagnostics.mjs'

await runBrowser(async ({ protocol, fixture, check, navigate, until, fill, login, capture, axe, measurements, legacyAsset, entryAsset, step }) => {
  await protocol.send('Network.enable')
  let meCalls = 0
  let businessCalls = 0
  const authStatuses = []
  protocol.on('Network.responseReceived', event => {
    const path = new URL(event.response.url).pathname
    if (['/auth/login','/auth/me'].includes(path)) authStatuses.push({path,status:event.response.status})
  })
  protocol.on('Network.requestWillBeSent', event => {
    const path = new URL(event.request.url).pathname
    if (path === '/auth/me' && event.request.method === 'GET') meCalls++
    if (event.request.method !== 'OPTIONS' && (path.startsWith('/change-management/') || path.startsWith('/foundation/'))) businessCalls++
  })
  const key = async (value, code, modifiers=0) => {
    await protocol.send('Input.dispatchKeyEvent',{type:'keyDown',key:value,code,windowsVirtualKeyCode:code==='Tab'?9:code==='Escape'?27:13,nativeVirtualKeyCode:code==='Tab'?9:code==='Escape'?27:13,modifiers,...(code==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})})
    await protocol.send('Input.dispatchKeyEvent',{type:'keyUp',key:value,code,windowsVirtualKeyCode:code==='Tab'?9:code==='Escape'?27:13,modifiers})
  }
  const viewport = async width => {
    await protocol.send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 844 : width === 768 ? 1024 : 960, deviceScaleFactor: 1, mobile: width < 768 })
    await protocol.send('Emulation.setTouchEmulationEnabled', { enabled: width < 768 })
  }
  const preferenceControl = async selector => {
    const visible=`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).some(el=>el.getBoundingClientRect().width>0&&(!el.closest('dialog')||el.closest('dialog').open))`
    const opened=!await protocol.evaluate(visible)
    if(opened) {await protocol.evaluate('document.querySelector("[data-action=open-menu]").click()');await until('!!document.querySelector("dialog[open]")')}
    return opened
  }
  const closePreferenceDrawer = async opened => {
    if(opened) {await key('Escape','Escape');await until('!document.querySelector("dialog[open]")')}
  }
  const language = async value => {
    const opened=await preferenceControl('[data-language-switch]')
    await protocol.evaluate(`(() => { const select=Array.from(document.querySelectorAll('[data-language-switch]')).find(el=>el.getBoundingClientRect().width>0&&(!el.closest('dialog')||el.closest('dialog').open));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(value)});
      select.dispatchEvent(new Event('change',{bubbles:true})); })()`)
    await until(`document.documentElement.lang===${JSON.stringify(value)}`)
    await protocol.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    if(await protocol.evaluate('!!document.querySelector("[data-page=login],[data-page=workspace-home]")')) await until(value==='ar-SA'?'document.querySelector("h1")?.textContent.includes(String.fromCodePoint(1605,1587,1575,1581,1577))':'document.querySelector("h1")?.textContent.includes("workspace")')
    await closePreferenceDrawer(opened)
  }
  const theme = async value => {
    const opened=await preferenceControl('[data-theme-switch]')
    if (await protocol.evaluate('document.documentElement.dataset.theme') !== value)
      await protocol.evaluate(`Array.from(document.querySelectorAll('[data-theme-switch]')).find(el=>el.getBoundingClientRect().width>0&&(!el.closest('dialog')||el.closest('dialog').open)).click()`)
    await until(`document.documentElement.dataset.theme===${JSON.stringify(value)}`)
    await closePreferenceDrawer(opened)
  }
  const layout = async (page, width, lang, mode) => {
    await protocol.evaluate('document.fonts.ready')
    const evidence = await protocol.evaluate(`(() => {
      const controls=[...document.querySelectorAll('button:not(:disabled),a.btn,nav a,select,input')].filter(el=>el.getBoundingClientRect().width>0);
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,lang:document.documentElement.lang,dir:document.documentElement.dir,
        theme:document.documentElement.dataset.theme,smallTargets:controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9}).length,
        smallTargetDetails:controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(el=>({tag:el.tagName,type:el.type,className:el.className,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})),
        labels:[...document.querySelectorAll('.auth-form input')].every(el=>el.labels.length>0),font:getComputedStyle(document.body).fontFamily.includes('Readex')};
    })()`)
    measurements.push({ page, width, language:lang, theme:mode, layout:evidence })
    if (evidence.scroll>evidence.width+1 || evidence.smallTargets || !evidence.labels || !evidence.font
      || evidence.lang!==lang || evidence.dir!==(lang==='ar-SA'?'rtl':'ltr') || evidence.theme!==mode)
      throw new Error('Layout assertion failed')
  }
  await viewport(1440)
  await check('initial-login-focus-is-not-a-decorative-frame',async()=>{
    await navigate('/login')
    await until('!!document.querySelector("[data-page=login]")')
    await protocol.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    const result=await protocol.evaluate(`({focusedMain:document.activeElement?.id==='main-content',
      mainOutline:getComputedStyle(document.querySelector('main')).outlineStyle,formBorder:getComputedStyle(document.querySelector('form')).borderTopWidth})`)
    measurements.push({initialFocus:result})
    if(result.focusedMain||result.formBorder!=='0px') throw new Error('Initial focus created a frame around the form')
  })
  await check('entry-motion-progresses-without-delaying-content',async()=>{
    const result=await protocol.evaluate(`(async()=>{
      const select=document.querySelector('[data-language-switch]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'en');select.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const surface=document.querySelector('[data-route-surface]');if(!surface)return {present:false};
      const animation=surface.getAnimations().find(item=>Number.isFinite(item.effect.getTiming().duration));
      if(!animation)return {present:true,animated:false};
      const first=animation.currentTime;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {present:true,animated:true,advanced:animation.currentTime>first,duration:animation.effect.getTiming().duration,
        keys:Object.keys(animation.effect.getKeyframes()[0]),opacity:Number(getComputedStyle(surface).opacity),form:!!surface.querySelector('form')};
    })()`)
    measurements.push({entryMotion:result})
    step(entryMotionStep(result))
    if(!result.present||!result.animated||!result.advanced||result.duration<150||result.duration>250||result.opacity<.9||!result.form) throw new Error('Entry motion missing or delaying content')
  })
  await check('keyboard-skip-link-retains-visible-main-focus',async()=>{
    await navigate('/login');await until('!!document.querySelector("[data-page=login]")')
    await key('Tab','Tab')
    await until('document.activeElement?.classList.contains("skip-link")')
    await key('Enter','Enter')
    if(!await protocol.evaluate('document.activeElement?.id==="main-content"&&getComputedStyle(document.activeElement).outlineStyle!=="none"&&!location.hash')) throw new Error('Skip link focus indicator removed')
  })
  await check('persisted-theme-before-application-module',async()=>{
    const preload=await protocol.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('changeflow_language','en');localStorage.setItem('changeflow_theme','light')`})
    await protocol.send('Network.setCacheDisabled',{cacheDisabled:true})
    await protocol.send('Network.setBlockedURLs',{urls:['*'+entryAsset+'*']})
    await navigate('/login')
    const result=await protocol.evaluate(`({theme:document.documentElement.dataset.theme,lang:document.documentElement.lang,
      dir:document.documentElement.dir,bg:getComputedStyle(document.documentElement).backgroundColor,rootEmpty:!document.querySelector('#root').children.length})`)
    measurements.push({beforeApplicationPaint:result})
    if(result.theme!=='light'||result.lang!=='en'||result.dir!=='ltr'||result.bg!=='rgb(244, 241, 232)'||!result.rootEmpty) throw new Error('Persisted presentation flashed before application startup')
    await protocol.send('Network.setBlockedURLs',{urls:[]})
    await protocol.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:preload.identifier})
    await protocol.evaluate("localStorage.removeItem('changeflow_language');localStorage.removeItem('changeflow_theme')")
  })
  await check('arabic-dark-default', async () => {
    await navigate('/login')
    await until('!!document.querySelector("[data-page=login]")')
    await until('document.documentElement.lang === "ar-SA" && document.documentElement.dir === "rtl" && document.documentElement.dataset.theme === "dark"')
    if (meCalls || businessCalls) throw new Error('Anonymous page fetched protected data')
  })
  for (const lang of ['ar-SA','en']) for (const mode of ['dark','light']) {
    await viewport(1440)
    await language(lang)
    await theme(mode)
    for (const width of [360,390,768,1366,1440]) await check(`login-layout-${lang}-${mode}-${width}`, async () => {
      await viewport(width)
      await layout('login',width,lang,mode)
      if ([390,1440].includes(width)) await axe()
      if ((lang==='ar-SA' && mode==='dark' && [390,1440].includes(width)) || (lang==='ar-SA' && mode==='light' && width===1440))
        await capture(`login-${lang.toLowerCase()}-${mode}-${width}`)
    })
  }
  await check('preference-persistence', async () => {
    await protocol.send('Page.reload')
    await until('!!document.querySelector("[data-page=login]")')
    await until('document.documentElement.lang==="en" && document.documentElement.dir==="ltr" && document.documentElement.dataset.theme==="light"')
  })
  await check('real-login-without-eager-business-data', async () => {
    await login(fixture)
    await until('!!document.querySelector("[data-page=workspace-home]")')
    measurements.push({loginEvidence:{meCalls,businessCalls,legacyLoaded:await protocol.evaluate(`performance.getEntriesByType("resource").some(e=>e.name.includes(${JSON.stringify(legacyAsset)}))`)}})
    if (meCalls!==1 || businessCalls!==0) throw new Error('Duplicate identity or eager business fetch')
    if (await protocol.evaluate(`performance.getEntriesByType("resource").some(e=>e.name.includes(${JSON.stringify(legacyAsset)}))`)) throw new Error('Legacy application was loaded eagerly')
    const timing=await protocol.evaluate('({fcp:performance.getEntriesByName("first-contentful-paint")[0]?.startTime,dom:performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd})')
    measurements.push({ initialLocalDevelopmentTiming:timing })
  })
  for (const lang of ['ar-SA','en']) for (const mode of ['dark','light']) {
    await viewport(1440)
    await language(lang)
    await theme(mode)
    for (const width of [360,390,768,1366,1440]) await check(`shell-layout-${lang}-${mode}-${width}`, async () => {
      await viewport(width)
      await layout('shell',width,lang,mode)
      if ([390,1440].includes(width)) await axe()
      if (lang==='ar-SA' && ((mode==='dark' && width===390) || (mode==='light' && width===1440)))
        await capture(`workspace-${lang.toLowerCase()}-${mode}-${width}`)
    })
  }
  const go = async path => {
    if (!await protocol.evaluate(`Array.from(document.querySelectorAll('[data-nav-path]')).some(el=>el.dataset.navPath===${JSON.stringify(path)}&&el.getBoundingClientRect().width>0)`)) {
      await protocol.evaluate('document.querySelector("[data-action=open-menu]").click()')
      await until('!!document.querySelector("dialog[open]")')
    }
    await protocol.evaluate(`Array.from(document.querySelectorAll('[data-nav-path]')).find(el=>el.dataset.navPath===${JSON.stringify(path)}&&el.getBoundingClientRect().width>0).click()`)
    await until(`location.pathname===${JSON.stringify(path)}`)
  }
  await check('theme-feedback-keeps-layout-stable-and-motion-interrupts-cleanly',async()=>{
    await viewport(1440)
    await protocol.evaluate('document.fonts.ready')
    const result=await protocol.evaluate(`(async()=>{
      const shifts=[];const observer=new PerformanceObserver(list=>shifts.push(...list.getEntries().map(e=>e.value)));
      observer.observe({type:'layout-shift'});
      const control=document.querySelector('[data-theme-switch]');const start=control.getBoundingClientRect();
      const frames=[];let previous=performance.now();
      for(let i=0;i<8;i++){control.click();await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();frames.push(now-previous);previous=now;}
      await new Promise(resolve=>requestAnimationFrame(resolve));observer.disconnect();
      const end=control.getBoundingClientRect();
      const select=document.querySelector('[data-language-switch]');
      for(const lang of ['ar-SA','en','ar-SA','en']){
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,lang);select.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
      return {themeShift:shifts.reduce((sum,value)=>sum+value,0),stableControl:start.width===end.width&&start.height===end.height&&start.x===end.x&&start.y===end.y,
        frameIntervals:frames,runningEntries:document.querySelector('[data-route-surface]').getAnimations().length,domSurfaces:document.querySelectorAll('[data-route-surface]').length};
    })()`)
    measurements.push({interactionMotion:result})
    if(result.themeShift>.001||!result.stableControl||result.runningEntries>1||result.domSurfaces!==1) throw new Error('Motion retained old surfaces or shifted layout')
  })
  for(const lang of ['ar-SA','en']) for(const mode of ['dark','light']) await check(`drawer-visual-${lang}-${mode}`,async()=>{
    await viewport(1440);await language(lang);await theme(mode);await viewport(390)
    await until('document.querySelector("[data-action=open-menu]").getBoundingClientRect().width>0')
    await protocol.evaluate('document.querySelector("[data-action=open-menu]").click()')
    await until('!!document.querySelector("dialog[open]")')
    await axe()
    await capture(`drawer-${lang.toLowerCase()}-${mode}`)
    await key('Escape','Escape');await until('!document.querySelector("dialog[open]")')
  })
  await check('preferences-do-not-repeat-identity',async()=>{
    if(meCalls!==1||businessCalls!==0) throw new Error('Preferences repeated protected requests')
  })
  await check('mobile-drawer-keyboard-and-focus-return',async()=>{
    await viewport(390)
    await until('document.querySelector("[data-action=open-menu]").getBoundingClientRect().width>0')
    await protocol.send('Page.bringToFront')
    await protocol.evaluate('document.querySelector("[data-action=open-menu]").focus()')
    measurements.push({beforeOpen:await protocol.evaluate('({focused:document.activeElement?.dataset.action==="open-menu",docFocus:document.hasFocus(),width:innerWidth})')})
    await key('Enter','Enter')
    measurements.push({afterOpen:await protocol.evaluate('({open:!!document.querySelector("dialog[open]"),focused:document.activeElement?.tagName})')})
    await until('!!document.querySelector("dialog[open]")')
    for(let i=0;i<12;i++) {
      await key('Tab','Tab',i%3===0?8:0)
      const focus=await protocol.evaluate('({contained:document.querySelector("dialog[open]").contains(document.activeElement),tag:document.activeElement?.tagName,modal:document.querySelector("dialog[open]").matches(":modal")})'); measurements.push({keyboardStep:i,focus}); if(!focus.contained) throw new Error('Dialog focus escaped')
    }
    await until('!document.querySelector("dialog[open]").getAnimations({subtree:true}).some(animation=>animation.playState==="running")')
    await axe()
    await capture('mobile-drawer-safe')
    await key('Escape','Escape')
    await until('!document.querySelector("dialog[open]")')
    if(!await protocol.evaluate('document.activeElement?.dataset.action==="open-menu"')) throw new Error('Dialog focus not restored')
  })
  await check('reduced-motion-and-visible-focus',async()=>{
    await protocol.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await protocol.evaluate('document.querySelector("[data-action=open-menu]").focus()')
    await key('Tab','Tab')
    const result=await protocol.evaluate(`({focus:getComputedStyle(document.activeElement).outlineStyle,
      motion:getComputedStyle(document.querySelector('.btn')).transitionDuration.split(',').every(value=>parseFloat(value)<.001)})`)
    if(result.focus==='none'||!result.motion) throw new Error('Focus or motion assertion failed')
    await language('ar-SA')
    if(await protocol.evaluate('document.querySelector("[data-route-surface]").getAnimations().length')) throw new Error('Reduced motion retained a page animation')
    await protocol.send('Emulation.setEmulatedMedia',{features:[]})
    await language('en')
  })
  await check('deep-link-refresh-and-history',async()=>{
    await viewport(1440)
    await go('/changes')
    await until('document.body.innerText.includes("Local Change")')
    if(!await protocol.evaluate('getComputedStyle(document.querySelector("[data-legacy-body] .app-header")).display==="none"')) throw new Error('Legacy CSS overrode the application shell')
    for(const lang of ['ar-SA','en']) for(const mode of ['dark','light']) {
      await viewport(1440);await language(lang);await theme(mode)
      for(const width of [360,390,768,1366,1440]) {await viewport(width);await layout('dashboard',width,lang,mode)}
      await axe(['[data-legacy-body]'])
      await capture(`dashboard-${lang.toLowerCase()}-${mode}`)
    }
    await navigate('/changes/100')
    await until('!!document.querySelector("[data-legacy-shell]") && document.body.innerText.includes("Local Change")')
    await protocol.send('Page.reload')
    await until('!!document.querySelector("[data-legacy-shell]") && document.body.innerText.includes("Local Change")')
    await go('/notifications')
    await until('!!document.querySelector("[data-legacy-shell]")')
    await protocol.evaluate('history.back()')
    await until('location.pathname==="/changes/100" && document.body.innerText.includes("Local Change")')
    await protocol.evaluate('history.forward()')
    await until('location.pathname==="/notifications"')
    await until('document.activeElement?.id==="main-content"')
    await viewport(360)
    if(!await protocol.evaluate('document.documentElement.scrollWidth<=innerWidth+1')) throw new Error('Legacy route overflow')
  })
  await check('new-route-starts-at-top-after-a-scrolled-business-page',async()=>{
    await viewport(390);await go('/changes');await until('document.body.innerText.includes("Local Change")')
    await protocol.evaluate('scrollTo(0,document.body.scrollHeight)')
    const before=await protocol.evaluate('scrollY')
    await go('/workspace');await until('!!document.querySelector("[data-page=workspace-home]")')
    const after=await protocol.evaluate('scrollY')
    measurements.push({routeScroll:{before,after}})
    if(before<50||after>1)throw new Error('New route retained the old page scroll offset')
  })
  await check('foreign-record-does-not-display-old-or-foreign-data',async()=>{
    await navigate('/changes/200')
    await until('!!document.querySelector("[data-state=record-error]")')
    if(await protocol.evaluate('document.body.innerText.includes("FOREIGN-SECRET")||document.body.innerText.includes("Local Change")')) throw new Error('Record data crossed route boundary')
  })
  await check('permission-route-and-not-found',async()=>{
    await navigate('/users')
    await until('!!document.querySelector("[data-state=forbidden]")')
    if(await protocol.evaluate(`!!document.querySelector('[data-nav-path="/users"]')`)) throw new Error('Unauthorized nav exposed')
    await axe()
    for(const lang of ['ar-SA','en']) for(const mode of ['dark','light']) {await viewport(1440);await language(lang);await theme(mode);await capture(`forbidden-${lang.toLowerCase()}-${mode}`)}
    await navigate('/projects')
    await until('!!document.querySelector("[data-state=notFound]")')
    await axe()
    for(const lang of ['ar-SA','en']) for(const mode of ['dark','light']) {await viewport(1440);await language(lang);await theme(mode);await capture(`notfound-${lang.toLowerCase()}-${mode}`)}
  })
  await check('lazy-chunk-failure-safe-recovery',async()=>{
    await protocol.send('Network.setCacheDisabled',{cacheDisabled:true})
    await protocol.send('Network.setBlockedURLs',{urls:['*'+legacyAsset+'*']})
    await navigate('/changes')
    await until('!!document.querySelector("[data-state=unexpected]")')
    await protocol.send('Network.setBlockedURLs',{urls:[]})
    await protocol.send('Page.reload')
    await until('!!document.querySelector("[data-legacy-shell]") && document.body.innerText.includes("Local Change")')
  })
  await check('preferences-storage-blocked-keeps-auth-usable',async()=>{
    await protocol.evaluate('document.querySelector("[data-action=logout]").click()')
    await until('!!document.querySelector("[data-page=login]")')
    const injected=await protocol.send('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
      const local=window.localStorage; for(const name of ['getItem','setItem']){
        const original=Storage.prototype[name];Storage.prototype[name]=function(...args){if(this===local)throw new Error('Preferences unavailable');return original.apply(this,args);};}
    })()`})
    await navigate('/login')
    await until('!!document.querySelector("[data-page=login]")')
    await viewport(1440)
    await language('en')
    await theme('light')
    await login(fixture)
    await until('!!document.querySelector("[data-page=workspace-home]")')
    await protocol.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier})
  })
  await check('invitation-fragment-and-screenshot-safety',async()=>{
    await protocol.evaluate('document.querySelector("[data-action=logout]").click()')
    await until('!!document.querySelector("[data-page=login]")')
    await navigate('/invitations/accept#token='+fixture.invitation)
    await until('!!document.querySelector("#invite-name")')
    if(await protocol.evaluate('!!location.hash||!!location.search')) throw new Error('Invitation URL retained')
    for(const lang of ['ar-SA','en']) for(const mode of ['dark','light']) {
      await viewport(1440);await language(lang);await theme(mode)
      for(const width of [360,390,768,1366,1440]) {await viewport(width);await layout('invitation',width,lang,mode)}
      await axe();await capture(`invitation-${lang.toLowerCase()}-${mode}`)
    }
    await fill('#invite-name','Synthetic Member')
    await fill('#invite-password',fixture.password)
    let blocked=false
    try { await capture('must-not-capture-filled-form') } catch { blocked=true }
    if(!blocked) throw new Error('Filled secret field could be captured')
    await protocol.evaluate(`location.hash='token='+${JSON.stringify(fixture.invitation)}`)
    await until('!location.hash&&document.querySelector("#invite-name")?.value===""&&document.querySelector("#invite-password")?.value===""')
    if(await protocol.evaluate(`JSON.stringify(history.state).includes(${JSON.stringify(fixture.invitation)})`)) throw new Error('Invitation entered history state')
    await axe()
    await capture('invitation-empty-safe')
    await fill('#invite-name','Synthetic Member')
    await fill('#invite-password',fixture.password)
    await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
    await until('!!document.querySelector("[data-invitation-state=accepted]")')
    if(await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Invitation auto login')
    for(const lang of ['ar-SA','en']) for(const mode of ['dark','light']) {await language(lang);await theme(mode);await axe();await capture(`accepted-${lang.toLowerCase()}-${mode}`)}
  })

  measurements.push({authStatuses})
}, 'presentation')
