import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { setTimeout as pause } from 'node:timers/promises'
import { build, preview } from 'vite'
import { gzipSync } from 'node:zlib'

class Protocol {
  #socket
  #next = 0
  #pending = new Map()
  #listeners = new Map()
  constructor(socket) {
    this.#socket = socket
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.method) for (const listener of this.#listeners.get(message.method) ?? []) listener(message.params)
      const pending = this.#pending.get(message.id)
      if (pending) {
        this.#pending.delete(message.id)
        if (message.error) pending.reject(new Error('Browser protocol request failed'))
        else pending.resolve(message.result)
      }
    })
    socket.addEventListener('close', () => {
      for (const pending of this.#pending.values()) pending.reject(new Error('Owned browser disconnected'))
      this.#pending.clear()
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
    if (result.exceptionDetails) throw new Error('Browser expression failed')
    return result.result.value
  }
  close() { this.#socket.close() }
}

export async function runBrowser(suite) {
  const { values } = parseArgs({ options: { api: { type: 'string' }, 'frontend-port': { type: 'string' },
    'browser-bin': { type: 'string' }, 'temporary-root': { type: 'string' }, 'artifacts-root': { type: 'string' } } })
  const api = new URL(values.api)
  if (api.hostname !== '127.0.0.1' || api.protocol !== 'http:') throw new Error('Unapproved test origin')
  const profile = join(resolve(values['temporary-root']), 'edge')
  mkdirSync(profile)
  const artifacts = values['artifacts-root'] ? resolve(values['artifacts-root']) : null
  const port = Number(values['frontend-port'])
  const origin = `http://127.0.0.1:${port}`
  let browser, protocol, vite, deadline
  let phase = 'start'
  let passed = 0
  let failed = 0
  const measurements = []
  let legacyAsset = '*src/App.tsx*'
  let entryAsset = ''
  try {
    phase = 'production-build'
    const output = join(resolve(values['temporary-root']), 'owned-frontend-build')
    const built = await build({ root: process.cwd(), envDir: false, logLevel: 'silent',
      define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(api.origin),
        'import.meta.env.VITE_API_TRUSTED_ORIGINS': JSON.stringify(api.origin) },
      build: { outDir: output, emptyOutDir: false, manifest: true, sourcemap: false } })
    const chunks = (Array.isArray(built) ? built : [built]).flatMap(item => item.output).filter(item => item.type === 'chunk')
    const manifest = JSON.parse(readFileSync(join(output, '.vite/manifest.json'), 'utf8'))
    legacyAsset = manifest['src/App.tsx'].file
    entryAsset = manifest['index.html'].file
    measurements.push({ productionChunks: chunks.map(chunk => ({ file: chunk.fileName,
      initial: chunk.isEntry, dynamic: chunk.isDynamicEntry, bytes: Buffer.byteLength(chunk.code), gzip: gzipSync(chunk.code).byteLength })) })
    phase = 'vite-preview'
    const server = await preview({ root: process.cwd(), envDir: false, logLevel: 'silent',
      build: { outDir: output }, preview: { host: '127.0.0.1', port, strictPort: true } })
    vite = { close: () => new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())) }
    phase = 'browser-start'
    browser = spawn(values['browser-bin'], ['--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
    const active = join(profile, 'DevToolsActivePort')
    for (let i = 0; i < 300 && !existsSync(active) && browser.exitCode === null; i++) await pause(100)
    const debugPort = Number(readFileSync(active, 'utf8').split('\n')[0])
    phase = 'browser-connect'
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
    protocol = new Protocol(socket)
    await protocol.send('Page.enable')
    // End a stuck flow gracefully before the parent timeout so owned resources close.
    deadline = setTimeout(() => { phase = 'suite-timeout'; void protocol.send('Browser.close').catch(() => {}) }, 180000)
    const until = async expression => {
      for (let i = 0; i < 150; i++) { if (await protocol.evaluate(expression)) return; await pause(100) }
      throw new Error('Browser condition timed out')
    }
    const navigate = async path => {
      await protocol.send('Page.navigate', { url: origin + path })
      await until('document.readyState === "complete"')
    }
    const fill = async (selector, value) => {
      await protocol.evaluate(`(() => { const input=document.querySelector(${JSON.stringify(selector)});
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
        input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`)
    }
    const check = async (name, callback) => { phase = name; await callback(); passed++ }
    phase = 'fixture-data'
    const response = await fetch(api.origin + '/_test/fixture')
    if (!response.ok) throw new Error('Fixture metadata unavailable')
    const fixture = await response.json()
    const login = async (data = fixture, second = false) => {
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
      if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Unsafe screenshot name')
      if (await protocol.evaluate('!!location.hash || [...document.querySelectorAll("input[name=password],input[autocomplete=current-password],input[autocomplete=new-password]")].some(input=>input.value)'))
        throw new Error('Sensitive form or fragment must not be captured')
      if (!artifacts) return
      await settleMotion()
      const image = await protocol.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      writeFileSync(join(artifacts, name + '.png'), Buffer.from(image.data, 'base64'), { flag: 'wx' })
    }
    const axe = async (exclude = []) => {
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
    await suite({ api, origin, protocol, fixture, check, navigate, until, fill, login, pause, capture, axe, measurements, legacyAsset, entryAsset })
  } catch {
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
    if (protocol) { try { await protocol.send('Browser.close') } catch { /* Already closed. */ } protocol.close() }
    if (browser?.exitCode === null) {
      for (let i = 0; i < 50 && browser.exitCode === null; i++) await pause(100)
      if (browser.exitCode === null) browser.kill()
    }
    await vite?.close()
    if (artifacts) writeFileSync(join(artifacts, 'measurements.json'), JSON.stringify({ passed, failed, phase, measurements }, null, 2), { flag: 'wx' })
    console.log('A5_BROWSER_METADATA=' + JSON.stringify({ passed, failed, phase }))
    if (failed) process.exitCode = 1
  }
}
