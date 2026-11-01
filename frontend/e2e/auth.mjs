import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parseArgs } from 'node:util'
import { setTimeout as pause } from 'node:timers/promises'
import { createServer } from 'vite'

const { values } = parseArgs({ options: { api: { type: 'string' }, 'frontend-port': { type: 'string' },
  'browser-bin': { type: 'string' }, 'temporary-root': { type: 'string' } } })
const api = new URL(values.api)
if (api.hostname !== '127.0.0.1' || api.protocol !== 'http:') throw new Error('Unapproved test origin')
const root = resolve(values['temporary-root'])
const profile = join(root, 'owned-browser-profile')
mkdirSync(profile)
const port = Number(values['frontend-port'])
const origin = `http://127.0.0.1:${port}`
let browser
let protocol
let vite
let phase = 'start'
let passed = 0
let failed = 0
const check = async (name, callback) => { phase = name; await callback(); passed++ }
class Protocol {
  #socket
  #next = 0
  #pending = new Map()
  #listeners = new Map()
  constructor(socket) {
    this.#socket = socket
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.method) for (const listener of this.#listeners.get(message.method) ?? []) listener(message.params)
      const waiting = this.#pending.get(message.id)
      if (waiting) {
        this.#pending.delete(message.id)
        if (message.error) waiting.reject(new Error('Browser protocol request failed'))
        else waiting.resolve(message.result)
      }
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
    const value = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (value.exceptionDetails) throw new Error('Browser expression failed')
    return value.result.value
  }
  close() { this.#socket.close() }
}
async function connect(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  return new Protocol(socket)
}
async function until(expression) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await protocol.evaluate(expression)) return
    await pause(100)
  }
  throw new Error('Browser condition timed out')
}
const navigate = async (path) => { await protocol.send('Page.navigate', { url: origin + path }); await until('document.readyState === "complete"') }
async function fill(selector, value) {
  await protocol.evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); })()`)
}
async function login(fixture, second = false) {
  await until('!!document.querySelector("#workspace")')
  await fill('#workspace', second ? fixture.other_workspace : fixture.workspace)
  await fill('#login-email', second ? fixture.other_email : fixture.email)
  await fill('#login-password', fixture.password)
  await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
  await until('!!document.querySelector("[data-workspace-shell]")')
}
try {
  phase = 'vite-start'
  vite = await createServer({ root: process.cwd(), envDir: false, logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(api.origin),
      'import.meta.env.VITE_API_TRUSTED_ORIGINS': JSON.stringify(api.origin) },
    server: { host: '127.0.0.1', port, strictPort: true } })
  await vite.listen()
  phase = 'browser-start'
  browser = spawn(values['browser-bin'], ['--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  const active = join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 150 && !existsSync(active); i++) await pause(100)
  const debugPort = Number(readFileSync(active, 'utf8').split('\n')[0])
  phase = 'browser-connect'
  let page
  for (let attempt = 0; attempt < 150 && !page; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
    page = targets.find((entry) => entry.type === 'page')
    if (!page) await pause(100)
  }
  if (!page) throw new Error('Owned browser did not create a page')
  protocol = await connect(page.webSocketDebuggerUrl)
  await protocol.send('Page.enable')
  phase = 'fixture-data'
  const fixtureResponse = await fetch(api.origin + '/_test/fixture')
  if (!fixtureResponse.ok) throw new Error('Fixture metadata unavailable')
  const fixture = await fixtureResponse.json()
  await check('generic-login-failure', async () => {
    await navigate('/login')
    const errors = []
    for (const [workspace, email] of [['missing-fixture', fixture.email], [fixture.workspace, 'missing@example.test']]) {
      await until('!!document.querySelector("#workspace")')
      await fill('#workspace', workspace)
      await fill('#login-email', email)
      await fill('#login-password', fixture.password)
      await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
      await until('!!document.querySelector(".login-error")')
      errors.push(await protocol.evaluate('document.querySelector(".login-error").textContent'))
    }
    if (errors[0] !== errors[1]) throw new Error('Credential enumeration message differs')
  })
  await check('workspace-login', async () => {
    await navigate('/login')
    await login(fixture)
    await until('document.body.innerText.includes("Local Change")')
    if (await protocol.evaluate('document.body.innerText.includes("Create Requester Account")')) throw new Error('Registration UI remains')
  })
  await check('refresh-recovery', async () => {
    await protocol.send('Page.reload')
    await until('!!document.querySelector("[data-workspace-shell]")')
    if (await protocol.evaluate('!!localStorage.getItem("changeflow_access_token")')) throw new Error('Legacy token storage')
  })
  await check('network-recovery', async () => {
    await protocol.send('Network.enable')
    await protocol.send('Network.setBlockedURLs', { urls: [api.origin + '/auth/me'] })
    await protocol.send('Page.reload')
    await until('document.body.innerText.includes("Session verification unavailable")')
    if (!await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Network failure removed session')
    await protocol.send('Network.setBlockedURLs', { urls: [] })
    await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Retry verification").click()')
    await until('!!document.querySelector("[data-workspace-shell]")')
  })
  await check('pending-response-tenant-switch', async () => {
    // Pause real HTTP responses after FastAPI/PostgreSQL have produced them;
    // do not replace auth, requests, or response bodies with browser mocks.
    const paused = []
    const unsubscribe = protocol.on('Fetch.requestPaused', (event) => { paused.push(event.requestId) })
    await protocol.send('Fetch.enable', { patterns: [{ urlPattern: api.origin + '/change-management/requests/paged*', requestStage: 'Response' }] })
    try {
      await protocol.send('Page.reload')
      await until('!!document.querySelector("[data-workspace-shell]")')
      for (let attempt = 0; attempt < 100 && paused.length === 0; attempt++) await pause(50)
      if (paused.length === 0) throw new Error('No real tenant response was held')
      await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Logout").click()')
      await until('!!document.querySelector("#workspace")')
      if (await protocol.evaluate('document.body.innerText.includes("Local Change")')) throw new Error('Old tenant remains after logout')
      await login(fixture, true)
      await until(`document.querySelector('.workspace-identity')?.textContent.includes(${JSON.stringify(fixture.other_workspace)})`)
      // Release any old response still held by CDP only after the new identity.
      await protocol.send('Fetch.disable')
      await until('document.body.innerText.includes("No change records match")')
      if (await protocol.evaluate('document.body.innerText.includes("Local Change") || document.body.innerText.includes("Local notification")'))
        throw new Error('Old tenant data reappeared in replacement session')
      await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Logout").click()')
      await until('!!document.querySelector("#workspace")')
      await login(fixture)
      await until('document.body.innerText.includes("Local Change")')
    } finally {
      await protocol.send('Fetch.disable')
      unsubscribe()
    }
  })
  await check('role-change', async () => {
    await fetch(api.origin + '/_test/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'limit' }) })
    await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Verify membership").click()')
    await until('!!document.querySelector("[data-workspace-shell]") && document.body.innerText.includes("Change and administration views are restricted")')
  })
  await check('disabled-membership', async () => {
    await fetch(api.origin + '/_test/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable' }) })
    await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Verify membership").click()')
    await until('!!document.querySelector("#workspace")')
    if (await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Stale token persisted')
  })
  await check('tenant-switch-and-logout', async () => {
    await login(fixture, true)
    await until(`document.querySelector('.workspace-identity')?.textContent.includes(${JSON.stringify(fixture.other_workspace)})`)
    await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Logout").click()')
    await until('!!document.querySelector("#workspace")')
  })
  await check('invitation-fragment-and-explicit-login', async () => {
    await navigate('/invitations/accept#token=' + fixture.invitation)
    await until('!!document.querySelector("#invite-name")')
    if (await protocol.evaluate('location.hash !== "" || location.search !== ""')) throw new Error('Secret URL not cleared')
    await fill('#invite-name', 'Browser Fixture Member')
    await fill('#invite-password', fixture.password)
    await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
    await until('document.body.innerText.includes("Membership activated")')
    if (await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Unexpected auto login')
    await protocol.send('Page.reload')
    await until('document.body.innerText.includes("no usable invitation link")')
  })
  await check('invitation-replay', async () => {
    await navigate('/invitations/accept#token=' + fixture.invitation)
    await until('!!document.querySelector("#invite-name")')
    await fill('#invite-name', 'Browser Fixture Member')
    await fill('#invite-password', fixture.password)
    await protocol.evaluate('document.querySelector(".login-form").requestSubmit()')
    await until('document.body.innerText.includes("This invitation is unavailable")')
  })
  await check('expired-token-recovery', async () => {
    await protocol.evaluate(`sessionStorage.setItem('changeflow_session_token',${JSON.stringify(fixture.expired)})`)
    await navigate('/workspace')
    await until('!!document.querySelector("#workspace")')
    if (await protocol.evaluate('!!sessionStorage.getItem("changeflow_session_token")')) throw new Error('Expired session retained')
  })
  await check('safe-redirect', async () => {
    await navigate('/login?next=https%3A%2F%2Fevil.example.test')
    await login(fixture, true)
    if (!await protocol.evaluate(`location.origin === ${JSON.stringify(origin)} && location.pathname === '/workspace'`)) throw new Error('Unsafe navigation')
    await protocol.evaluate('Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Logout").click()')
    await until('!!document.querySelector("#workspace")')
  })
  await check('storage-unavailable', async () => {
    const injected = await protocol.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const session = window.sessionStorage;
      for (const name of ['getItem','setItem','removeItem']) {
        const original = Storage.prototype[name];
        Storage.prototype[name] = function(...args) { if(this === session) throw new Error('Storage unavailable'); return original.apply(this,args); };
      }
    })()` })
    await navigate('/login')
    await login(fixture, true)
    await until('document.body.innerText.includes("Memory-only session")')
    await protocol.send('Page.reload')
    await until('!!document.querySelector("#workspace")')
    await protocol.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: injected.identifier })
  })
} catch { failed++ }
finally {
  if (protocol) { try { await protocol.send('Browser.close') } catch { /* Owned browser may already be closed. */ } protocol.close() }
  if (browser && browser.exitCode === null) {
    for (let i = 0; i < 50 && browser.exitCode === null; i++) await pause(100)
    if (browser.exitCode === null) browser.kill()
  }
  await vite?.close()
  console.log('A5_BROWSER_METADATA=' + JSON.stringify({ passed, failed, phase }))
  if (failed) process.exitCode = 1
}
