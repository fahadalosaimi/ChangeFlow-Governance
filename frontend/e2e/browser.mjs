import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { setTimeout as pause } from 'node:timers/promises'
import { build, preview } from 'vite'
import { gzipSync } from 'node:zlib'
import { createDiagnostics, DiagnosticError, cdpCategory, evaluationError } from './diagnostics.mjs'
import { a06ProbePlugin, probeSource } from './a06Probe.mjs'

// Recovery can replace the shell before or during the manual refresh dialog.
// Only the caller's strict security outcome can replace manual confirmation.
export async function verifyIdentity(protocol, until, step, expected, afterOpen = async () => {}) {
  step('verify-open')
  await until(`(${expected}) || !!document.querySelector('[data-action=verify]')`)
  const opened = await protocol.evaluate(`(() => {
    if (${expected}) return false;
    const control = document.querySelector('[data-action=verify]');
    if (!control) return false;
    control.click(); return true;
  })()`)
  if (!opened) { await until(expected); return }
  await afterOpen()
  step('verify-dialog-ready')
  await until(`(${expected}) || !!document.querySelector('dialog[open] [data-action=confirm-verify]')`)
  step('verify-confirm')
  await protocol.evaluate(`(() => {
    if (${expected}) return;
    document.querySelector('dialog[open] [data-action=confirm-verify]')?.click();
  })()`)
  await until(expected)
}

export async function sampleDOM(protocol, diagnostics) {
  let timer
  try {
    // A bounded diagnostic after failure; it cannot retry or change the assertion.
    const state = await Promise.race([protocol.evaluate(`(() => {
      if(document.querySelector('[data-workspace-shell]')&&document.querySelector('[data-state=forbidden]'))return 'forbidden';
      if(document.querySelector('[data-state=checking]'))return 'checking';
      if(document.querySelector('#workspace'))return 'login';
      if(document.querySelector('dialog[open] [data-action=confirm-verify]'))return 'dialog-ready';
      return document.querySelector('[data-workspace-shell]')?'shell':'unknown';
    })()`), new Promise(resolve => { timer = setTimeout(() => resolve('unknown'), 1000) })])
    diagnostics.dom(state)
  } catch { diagnostics.dom('unknown') }
  finally { clearTimeout(timer) }
}

export class Protocol {
  #socket
  #diagnostics
  #next = 0
  #pending = new Map()
  #listeners = new Map()
  #defaultContext = null
  constructor(socket, diagnostics) {
    this.#socket = socket
    this.#diagnostics = diagnostics
    diagnostics?.lifecycle({ target_state: 'attached' })
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.method === 'Runtime.executionContextCreated' && message.params.context.auxData?.isDefault) {
        this.#defaultContext = message.params.context.id
        diagnostics?.lifecycle({ context_state: 'available' })
        diagnostics?.resource('context-ready', 'default-context', 'owned', 'completed')
      }
      if (message.method === 'Runtime.executionContextsCleared') {
        this.#defaultContext = null; diagnostics?.lifecycle({ context_state: 'cleared' })
      }
      if (message.method === 'Runtime.executionContextDestroyed' && message.params.executionContextId === this.#defaultContext)
        diagnostics?.lifecycle({ context_state: 'destroyed' })
      if (message.method === 'Page.frameNavigated' && !message.params.frame.parentId)
        diagnostics?.lifecycle({ document_state: 'loading' })
      if (message.method === 'Page.domContentEventFired') diagnostics?.lifecycle({ document_state: 'interactive' })
      if (message.method === 'Page.loadEventFired') diagnostics?.lifecycle({ document_state: 'complete' })
      if (message.method === 'Inspector.detached') diagnostics?.lifecycle({ target_state: 'detached' })
      if (message.method) for (const listener of this.#listeners.get(message.method) ?? []) listener(message.params)
      const pending = this.#pending.get(message.id)
      if (pending) {
        this.#pending.delete(message.id)
        if (message.error) {
          this.#diagnostics?.cdp(message.error)
          pending.reject(new DiagnosticError(cdpCategory(message.error)))
        }
        else pending.resolve(message.result)
      }
    })
    socket.addEventListener('close', () => {
      diagnostics?.resource('cdp-disconnect', 'cdp', 'owned', 'completed')
      diagnostics?.lifecycle({ target_state: 'closed', context_state: 'destroyed' })
      diagnostics?.resource('protocol-pending', 'cdp-promise', 'owned', this.#pending.size ? 'pending' : 'completed')
      for (const pending of this.#pending.values()) pending.reject(new DiagnosticError('disconnected'))
      this.#pending.clear()
      diagnostics?.resource('protocol-pending', 'cdp-promise', 'owned', 'completed')
    })
  }
  on(method, listener) {
    const listeners = this.#listeners.get(method) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(method, listeners)
    return () => listeners.delete(listener)
  }
  send(method, params = {}) {
    const id = ++this.#next
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw evaluationError(result.exceptionDetails)
    return result.result.value
  }
  close() { this.#socket.close() }
}

export async function cleanupOwnedBrowser(protocol, browser, diagnostics) {
  let failed = false
  let startupTerminationRequested = false
  const running = () => browser?.exitCode === null && browser.signalCode === null
  if (protocol) {
    diagnostics.resource('browser-close-request', 'browser-process', 'owned', 'requested')
    try {
      await protocol.send('Browser.close')
      diagnostics.resource('browser-close-settled', 'cdp', 'owned', 'acknowledged')
    } catch (error) {
      diagnostics.resource('browser-close-settled', 'cdp', 'owned', error?.category === 'disconnected' ? 'disconnected' : 'failed')
    }
    protocol.close()
  }
  // A failed startup has no CDP channel through which to ask Edge to close.
  // Terminate only our spawned child; retain the original startup failure.
  if (!protocol && running()) {
    diagnostics.resource('browser-force-stop', 'browser-process', 'owned', 'requested')
    startupTerminationRequested = browser.kill()
  }
  if (running()) {
    diagnostics.resource('browser-wait-exit', 'browser-process', 'owned', 'pending')
    for (let i = 0; i < 50 && running(); i++) await pause(100)
    if (running()) {
      diagnostics.resource('browser-wait-exit', 'browser-process', 'owned', 'timed-out')
      diagnostics.resource('browser-force-stop', 'browser-process', 'owned', 'requested')
      browser.kill(); diagnostics.cleanup('browser', 'timeout'); failed = true
    }
  }
  if (browser && !running()) {
    const expectedExit = browser.exitCode === 0 || startupTerminationRequested
    diagnostics.cleanup('browser', expectedExit)
    failed ||= !expectedExit
  }
  return !failed
}

export async function runBrowser(suite, suiteId = 'unknown') {
  const diagnostics = createDiagnostics(suiteId)
  process.once('uncaughtExceptionMonitor', error => diagnostics.failure(error))
  process.once('exit', code => diagnostics.exit(code))
  process.once('beforeExit', () => diagnostics.resource('node-exit', 'node-runner', 'owned', 'completed'))
  const { values } = parseArgs({ options: { api: { type: 'string' }, 'frontend-port': { type: 'string' },
    'browser-bin': { type: 'string' }, 'temporary-root': { type: 'string' }, 'artifacts-root': { type: 'string' },
    'a06-mode': { type: 'string' }, 'trace-a06': { type: 'boolean' } } })
  const traceEnabled = Boolean(values['trace-a06'] || values['a06-mode'])
  if (values['a06-mode'] && !['control', 'race'].includes(values['a06-mode'])) throw new Error('Invalid A06 mode')
  const api = new URL(values.api)
  if (api.hostname !== '127.0.0.1' || api.protocol !== 'http:') throw new Error('Unapproved test origin')
  const profile = join(resolve(values['temporary-root']), 'edge')
  mkdirSync(profile)
  const port = Number(values['frontend-port'])
  const origin = `http://127.0.0.1:${port}`
  let browser, protocol, vite, deadline
  let phase = 'start'
  const setPhase = value => { phase = value; diagnostics.phase(value) }
  const operation = value => {
    if (['begin', 'operation', 'navigate', 'wait', 'fill', 'login', 'capture_guard', 'axe'].includes(diagnostics.snapshot().substep_id))
      diagnostics.step(value)
  }
  let passed = 0
  let failed = 0
  const measurements = []
  let legacyAsset = '*src/App.tsx*'
  let entryAsset = ''
  try {
    setPhase('production-build')
    const output = join(resolve(values['temporary-root']), 'owned-frontend-build')
    const built = await build({ root: process.cwd(), envDir: false, logLevel: 'silent',
      plugins: traceEnabled ? [a06ProbePlugin()] : [],
      define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(api.origin),
        'import.meta.env.VITE_API_TRUSTED_ORIGINS': JSON.stringify(api.origin) },
      build: { outDir: output, emptyOutDir: false, manifest: true, sourcemap: false } })
    const chunks = (Array.isArray(built) ? built : [built]).flatMap(item => item.output).filter(item => item.type === 'chunk')
    const manifest = JSON.parse(readFileSync(join(output, '.vite/manifest.json'), 'utf8'))
    legacyAsset = manifest['src/App.tsx'].file
    entryAsset = manifest['index.html'].file
    measurements.push({ productionChunks: chunks.map(chunk => ({ file: chunk.fileName,
      initial: chunk.isEntry, dynamic: chunk.isDynamicEntry, bytes: Buffer.byteLength(chunk.code), gzip: gzipSync(chunk.code).byteLength })) })
    setPhase('vite-preview')
    const server = await preview({ root: process.cwd(), envDir: false, logLevel: 'silent',
      build: { outDir: output }, preview: { host: '127.0.0.1', port, strictPort: true } })
    vite = { close: () => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())) }
    setPhase('browser-start')
    diagnostics.step('launch-browser')
    diagnostics.resource('browser-launch', 'browser-process', 'not-created', 'requested')
    browser = spawn(values['browser-bin'], ['--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
    browser.once('spawn', () => {
      diagnostics.browser('running')
      diagnostics.resource('browser-launch', 'browser-process', 'owned', 'completed')
    })
    browser.once('exit', (code, signal) => {
      diagnostics.browser('exited', code)
      diagnostics.resource('browser-exit', 'browser-process', 'owned', signal ? 'signaled' : 'completed')
      diagnostics.resource('browser-exit', 'default-context', 'owned', 'completed')
    })
    const active = join(profile, 'DevToolsActivePort')
    diagnostics.step('wait-debug-port')
    for (let i = 0; i < 300 && !existsSync(active) && browser.exitCode === null; i++) await pause(100)
    diagnostics.step('read-debug-port')
    const debugPort = Number(readFileSync(active, 'utf8').split('\n')[0])
    setPhase('browser-connect')
    let page
    for (let i = 0; i < 150 && !page; i++) {
      page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page')
      if (!page) await pause(100)
    }
    if (!page) throw new Error('Owned browser did not create a page')
    const socket = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    protocol = new Protocol(socket, diagnostics)
    diagnostics.resource('cdp-connect', 'cdp', 'owned', 'completed')
    await protocol.send('Page.enable')
    await protocol.send('Runtime.enable')
    if (traceEnabled) await protocol.send('Page.addScriptToEvaluateOnNewDocument', { source: probeSource })
    const trace = {
      enabled: traceEnabled,
      start: () => protocol.evaluate('window.__changeflowA06?.start()'),
      async flush() {
        const ids = await protocol.evaluate('window.__changeflowA06?.drain() ?? []')
        if (Array.isArray(ids)) for (const id of ids) diagnostics.transition(id)
        return Array.isArray(ids) ? ids : []
      },
      async stop() { await protocol.evaluate('window.__changeflowA06?.stop()'); return this.flush() },
      mark: id => protocol.evaluate(`window.__changeflowA06?.emit(${JSON.stringify(id)})`),
    }
    // End a stuck flow gracefully before the parent timeout so owned resources close.
    deadline = setTimeout(() => {
      failed ||= 1; diagnostics.timeout('suite')
      void protocol.send('Browser.close').catch(() => {})
    }, 180000)
    const until = async expression => {
      operation('wait')
      for (let i = 0; i < 150; i++) { if (await protocol.evaluate(expression)) return; await pause(100) }
      throw new DiagnosticError('unknown', 'condition')
    }
    const navigate = async path => {
      operation('navigate')
      await protocol.send('Page.navigate', { url: origin + path })
      await until('document.readyState === "complete"')
    }
    const fill = async (selector, value) => {
      operation('fill')
      await protocol.evaluate(`(() => { const input=document.querySelector(${JSON.stringify(selector)});
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
        input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`)
    }
    const check = async (_name, callback) => {
      diagnostics.scenario(); phase = diagnostics.snapshot().scenario_id
      try { await callback(); passed++ }
      catch (error) {
        if (traceEnabled) { try { await trace.stop() } catch { /* Preserve the original failure. */ } }
        await sampleDOM(protocol, diagnostics); throw error
      }
    }
    setPhase('fixture-data')
    const response = await fetch(api.origin + '/_test/fixture')
    if (!response.ok) throw new Error('Fixture metadata unavailable')
    const fixture = await response.json()
    const login = async (data = fixture, second = false) => {
      operation('login')
      await until('!!document.querySelector("#workspace")')
      await fill('#workspace', second ? data.other_workspace : data.workspace)
      await fill('#login-email', second ? data.other_email : data.email)
      await fill('#login-password', data.password)
      await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
      await until('!!document.querySelector("[data-workspace-shell]")')
    }
    const settleMotion = () => protocol.evaluate(`Promise.all(document.getAnimations().filter(animation => {
      const timing=animation.effect.getTiming();return Number.isFinite(timing.iterations)&&Number.isFinite(timing.duration);
    }).map(animation=>animation.finished.catch(()=>{})))`)
    const capture = async name => {
      operation('capture_guard')
      if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Unsafe screenshot name')
      if (await protocol.evaluate('!!location.hash || [...document.querySelectorAll("input[name=password],input[autocomplete=current-password],input[autocomplete=new-password]")].some(input=>input.value)'))
        throw new Error('Sensitive form or fragment must not be captured')
      // Diagnostics retain metadata only. Keep the sensitive-form assertion,
      // but never capture account pixels, DOM snapshots, or network traces.
    }
    const axe = async (exclude = []) => {
      operation('axe')
      await settleMotion()
      await protocol.evaluate(readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8'))
      const result = await protocol.evaluate(`axe.run({exclude:${JSON.stringify(exclude.map(selector => [selector]))}},
        {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({
          violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),
          incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.length,targets:v.nodes.map(n=>n.target)})),passes:r.passes.length}))`)
      measurements.push({ phase, axe: result })
      if (result.violations.length) throw new Error('Accessibility violations found')
      // Keep axe's Incomplete result and add independent evidence for the known
      // wrapped dialog heading; unexpected uncertainty still fails this gate.
      for(const item of result.incomplete) for(const target of item.targets) {
        if(item.id!=='color-contrast'||target.length!==1) throw new Error('Unreviewed accessibility uncertainty')
        const colors=await protocol.evaluate(`(() => {
          const node=document.querySelector(${JSON.stringify(target[0])});const foreground=getComputedStyle(node).color;
          let parent=node;while(parent&&getComputedStyle(parent).backgroundColor==='rgba(0, 0, 0, 0)')parent=parent.parentElement;
          const r=node.getBoundingClientRect();return {foreground,background:parent?getComputedStyle(parent).backgroundColor:null,
            heading:node.tagName==='H2'&&!!node.closest('.dialog-heading'),opacity:getComputedStyle(node).opacity,
            visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
            unobscured:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===node};
        })()`)
        if(!colors.heading||!colors.foreground.startsWith('rgb(')||!colors.background?.startsWith('rgb(')) throw new Error('Contrast needs manual investigation')
        const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>value/255)
          .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
        const values=[luminance(colors.foreground),luminance(colors.background)].sort((a,b)=>b-a)
        const ratio=(values[0]+.05)/(values[1]+.05)
        measurements.push({phase,contrastReview:{target:target[0],...colors,ratio}})
        if(ratio<4.5||colors.opacity!=='1'||!colors.visible||!colors.unobscured) throw new Error('Contrast review failed')
      }
      return result
    }
    await suite({ api, origin, protocol, fixture, check, navigate, until, fill, login, pause, capture, axe, measurements, legacyAsset, entryAsset,
      step: id => diagnostics.step(id), observeFailure: error => diagnostics.failure(error), trace, a06Mode: values['a06-mode'] })
    diagnostics.resource('scenario-complete', 'node-runner', 'owned', 'completed')
  } catch (error) {
    diagnostics.failure(error)
    failed++
    if (phase === 'browser-start') measurements.push({browserStartup:{exitCode:browser?.exitCode??null,profileLength:profile.length,activePortFile:existsSync(join(profile,'DevToolsActivePort'))}})
    if (protocol) {
      try {
        measurements.push({ failureUI: await protocol.evaluate(`({login:!!document.querySelector('[data-page=login]'),
          loginError:!!document.querySelector('.login-error'),shell:!!document.querySelector('[data-workspace-shell]'),
          home:!!document.querySelector('[data-page=workspace-home]'),state:document.querySelector('[data-state]')?.getAttribute('data-state')??null})`) })
      } catch { /* Metadata collection must never prevent owned cleanup. */ }
    }
  }
  finally {
    clearTimeout(deadline)
    diagnostics.phase('cleanup')
    if (!await cleanupOwnedBrowser(protocol, browser, diagnostics)) failed ||= 1
    diagnostics.resource('vite-close', 'vite', vite ? 'owned' : 'not-created', 'requested')
    try { await vite?.close(); diagnostics.resource('vite-close', 'vite', vite ? 'owned' : 'not-created', 'completed'); diagnostics.cleanup('vite', true) }
    catch { diagnostics.cleanup('vite', false); failed ||= 1 }
    console.log('A5_BROWSER_METADATA=' + JSON.stringify({ passed, failed, phase }))
    if (failed) process.exitCode = 1
  }
}
