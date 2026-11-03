import { readFileSync } from 'node:fs'
const events = JSON.parse(readFileSync(new URL('./diagnostic-schema.json', import.meta.url), 'utf8')).fields.transition_id

function install(allowed) {
  const valid = new Set(allowed)
  let active = false, queue = [], seen = new Set(), previous = null, wasOpen = false, fingerprint = null
  const emit = id => { if (active && valid.has(id)) { seen.add(id); if (queue.length < 256) queue.push(id) } }
  const scan = () => {
    if (!active) return
    const dialog = document.querySelector('[data-a06-dialog="verify"]')
    if (previous && previous !== dialog) emit('dialog-unmounted')
    if (dialog && previous !== dialog) { emit('dialog-mounted'); wasOpen = !dialog.open }
    if (dialog) {
      const control = dialog.querySelector('[data-action=confirm-verify]')
      if (!control) emit('dialog-without-confirm')
      else if (previous !== dialog) emit('confirm-present')
      if (dialog.open !== wasOpen) emit(dialog.open ? 'dialog-opened' : 'dialog-closed')
      if (dialog.open && control && document.querySelector('dialog[open] [data-action=confirm-verify]') !== control) emit('selector-mismatch')
      wasOpen = dialog.open
    }
    previous = dialog
    if (document.querySelector('[data-state=forbidden]') && !seen.has('forbidden-view')) emit('forbidden-view')
    if (document.querySelector('[data-state=unexpected]') && !seen.has('component-error')) emit('component-error')
  }
  const observer = new MutationObserver(scan)
  const clicked = event => {
    if (event.target?.closest?.('[data-action=verify]')) emit('verify-click')
    if (event.target?.closest?.('[data-action=confirm-verify]')) emit('confirm-click')
  }
  const pageError = () => emit('page-error')
  window.__changeflowA06 = Object.freeze({
    emit,
    permissions(values) {
      if (!Array.isArray(values)) return
      const next = values.filter(value => typeof value === 'string').slice().sort().join('|')
      if (fingerprint !== null && fingerprint !== next) emit('permissions-changed')
      fingerprint = next // Never returned, persisted, or logged.
    },
    start() {
      active = true; queue = []; seen = new Set(); previous = null; wasOpen = false
      emit('trace-started'); scan()
      observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
      window.addEventListener('click', clicked, true); window.addEventListener('error', pageError)
    },
    drain() { const result = queue; queue = []; return result },
    stop() {
      scan()
      if (!seen.has('dialog-mounted')) emit('dialog-never-mounted')
      if (seen.has('verify-click') && !seen.has('verify-handler-ran')) emit('handler-not-observed')
      if (queue.length >= 256) queue[255] = 'trace-overflow'
      active = false; observer.disconnect()
      window.removeEventListener('click', clicked, true); window.removeEventListener('error', pageError)
    },
  })
}
export const probeSource = `(${install.toString()})(${JSON.stringify(events)})`

export function a06ProbePlugin() {
  const seen = new Set()
  const replace = (code, needle, value) => {
    if (code.split(needle).length !== 2) throw new Error('A06 probe source contract mismatch')
    return code.replace(needle, value)
  }
  const emit = id => `globalThis.__changeflowA06?.emit('${id}')`
  return {
    name: 'a06-test-only-probe', enforce: 'pre', apply: 'build',
    transform(code, id) {
      id = id.split('?')[0].replaceAll('\\', '/')
      if (id.endsWith('/src/layouts/AppLayout.tsx')) {
        seen.add('layout')
        code = replace(code, 'import { useState }', 'import { useState, useEffect }')
        code = replace(code, 'const [verify, setVerify] = useState(false)', `const [verify, setVerify] = useState(false); useEffect(()=>{globalThis.__changeflowA06?.emit(verify?'verify-state-open':'verify-state-closed')},[verify])`)
        code = replace(code, 'onClick={() => setVerify(true)}', `onClick={() => {${emit('verify-handler-ran')}; setVerify(true)}}`)
        code = replace(code, 'setVerify(false); void store.recover()', `${emit('confirm-handler-ran')}; setVerify(false); void store.recover()`)
        code = replace(code, '<Dialog open={verify}', '<Dialog diagnosticId="verify" open={verify}')
      } else if (id.endsWith('/src/components/ui/Dialog.tsx')) {
        seen.add('dialog')
        code = replace(code, "className = ''", "className = '', diagnosticId")
        code = replace(code, 'className?: string', 'className?: string; diagnosticId?: string')
        code = replace(code, '<dialog ref={ref}', '<dialog data-a06-dialog={diagnosticId} ref={ref}')
      } else if (id.endsWith('/src/features/auth/authStore.ts')) {
        seen.add('store')
        code = replace(code, 'const generation = this.#options.session.generation', `if(status==='checking'){${emit('recovery-started')}}; if(status==='authenticated'){globalThis.__changeflowA06?.permissions(user?.permissions);${emit('recovery-completed')}}; if(status==='anonymous'){${emit('session-ended')}}; const generation = this.#options.session.generation`)
        code = replace(code, 'recover = async (): Promise<void> => {', `recover = async (): Promise<void> => {${emit('recovery-requested')};`)
      } else if (id.endsWith('/src/App.tsx')) {
        seen.add('legacy')
        code = replace(code, 'void auth.store.recover();', `void (${emit('business-403')}, auth.store.recover());`)
      } else return
      return { code, map: null }
    },
    generateBundle() { if (seen.size !== 4) throw new Error('A06 probe build coverage incomplete') },
  }
}
