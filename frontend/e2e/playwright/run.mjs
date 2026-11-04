import { build, preview } from 'vite'
import { spawn } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readdir } from 'node:fs/promises'
import { validateGateResults } from './gate-contract.mjs'
import {controlledBuild} from './controlled-build.mjs'

const pilot = fileURLToPath(new URL('.', import.meta.url))
const frontend = resolve(pilot, '../..')
const api = new URL(process.env.PILOT_API)
const root = resolve(process.env.PILOT_ROOT)
if (api.hostname !== '127.0.0.1' || api.protocol !== 'http:') throw new Error('Unowned origin')
let server, defaultServer, exit = 1
try {
  // Python's test-process environment must not select React development mode
  // for the production artifact. Keep StrictMode in the application itself.
  process.env.NODE_ENV = 'production'
  const outDir = join(root, 'build')
  await mkdir(outDir)
  const editor=process.env.PILOT_SELECTION?.startsWith('editor')||['notices-forward','notices-reverse'].includes(process.env.PILOT_SELECTION)
  let defaultOrigin,plugins=[]
  if(editor){
    // Build an ordinary artifact independently. No controlled plugin or nonce.
    const ordinary=join(root,'ordinary-build')
    await build({root:frontend,envDir:false,logLevel:'silent',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify(api.origin),'import.meta.env.VITE_API_TRUSTED_ORIGINS':JSON.stringify(api.origin)},build:{outDir:ordinary,emptyOutDir:false,sourcemap:false}})
    defaultServer=await preview({root:frontend,envDir:false,logLevel:'silent',build:{outDir:ordinary},preview:{host:'127.0.0.1',port:0,strictPort:true}})
    defaultOrigin=`http://127.0.0.1:${defaultServer.httpServer.address().port}`
    plugins=[await controlledBuild({api:api.origin,root,nonce:process.env.PILOT_WRITE_NONCE})]
  }
  await build({ root: frontend, envDir: false, logLevel: 'silent',
    plugins,
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(api.origin),
      'import.meta.env.VITE_API_TRUSTED_ORIGINS': JSON.stringify(api.origin) },
    build: { outDir, emptyOutDir: false, sourcemap: false } })
  server = await preview({ root: frontend, envDir: false, logLevel: 'silent',
    build: { outDir }, preview: { host: '127.0.0.1', port: 0, strictPort: true } })
  const address = server.httpServer.address()
  const child = spawn(process.execPath, [join(pilot, 'node_modules/@playwright/test/cli.js'),
    'test', '--config', join(pilot, 'playwright.config.mjs')], {
    cwd: pilot, env: { ...process.env, PILOT_ORIGIN: `http://127.0.0.1:${address.port}`, ...(defaultOrigin?{PILOT_DEFAULT_ORIGIN:defaultOrigin}:{}) },
    windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
  // The configured reporter emits metadata only. No default reporter is enabled.
  const rows = []
  let buffered = ''
  child.stdout.on('data', chunk => {
    buffered += chunk.toString()
    const lines = buffered.split('\n')
    buffered = lines.pop()
    for (const line of lines) {
      if (line.startsWith('PILOT=')) {
        try { rows.push(JSON.parse(line.slice(6))) } catch { rows.push({ failed: 1 }) }
      }
    }
  })
  exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', code => done(code ?? 1)) })
  for (const row of rows) process.stdout.write(`PILOT=${JSON.stringify(row)}\n`)
  if (!validateGateResults(rows, process.env.PILOT_SELECTION, exit)) exit = 1
} catch {
  process.stdout.write('PILOT={"failed":1}\n')
} finally {
  if (server) await new Promise((done, reject) => server.httpServer.close(error => error ? reject(error) : done()))
  if(defaultServer)await new Promise((done,reject)=>defaultServer.httpServer.close(error=>error?reject(error):done()))
  // Only build output and Playwright's non-sensitive marker are allowed.
  const artifacts = await readdir(join(root, 'results'), { recursive: true }).catch(() => [])
  if (artifacts.some(name => /\.(zip|png|webm|har)$/.test(name))) exit = 1
  process.stdout.write(`PILOT=${JSON.stringify({ exit, cleanup: server?.httpServer.listening||defaultServer?.httpServer.listening ? 'failed' : 'passed' })}\n`)
  process.exitCode = exit
}
