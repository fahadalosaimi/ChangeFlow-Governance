import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { runInNewContext } from 'node:vm'

const routes = await import('../src/app/routePolicy.ts').catch(() => null)
const preferences = await import('../src/preferences/store.ts').catch(() => null)
const localization = await import('../src/localization/index.ts').catch(() => null)
const formatters = await import('../src/localization/formatters.ts').catch(() => null)

function earlyPresentation(values: Record<string, string>, blocked = false) {
  const root = { lang: 'ar-SA', dir: 'rtl', dataset: { theme: 'dark' } }
  const meta = { content: '#151A18', setAttribute(_name: string, value: string) { this.content = value } }
  const document = { documentElement: root, querySelector: () => meta }
  const reads: string[] = []
  const storage = { getItem(key: string) {
    reads.push(key)
    if (blocked) throw new Error('Synthetic blocked preferences')
    if (!['changeflow_language', 'changeflow_theme'].includes(key)) throw new Error('Unapproved storage read')
    return values[key] ?? null
  } }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  for (const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))
    if (!/\b(?:src|type)\s*=/.test(script[1])) runInNewContext(script[2], { document, localStorage: storage })
  return { root, meta, reads }
}

test('persisted presentation is applied before the application module can paint the default theme', () => {
  const { root, meta, reads } = earlyPresentation({ changeflow_language: 'en', changeflow_theme: 'light' })
  assert.equal(root.dataset.theme, 'light')
  assert.equal(root.lang, 'en')
  assert.equal(root.dir, 'ltr')
  assert.equal(meta.content.toLowerCase(), '#f4f1e8')
  assert.deepEqual(reads.sort(), ['changeflow_language', 'changeflow_theme'])
})

test('early presentation rejects invalid preferences and tolerates blocked storage without touching auth', () => {
  for (const blocked of [false, true]) {
    const { root, reads } = earlyPresentation({ changeflow_language: '<invalid>', changeflow_theme: 'unexpected' }, blocked)
    assert.equal(root.dataset.theme, 'dark')
    assert.equal(root.lang, 'ar-SA')
    assert.equal(root.dir, 'rtl')
    assert.ok(reads.every(key => ['changeflow_language', 'changeflow_theme'].includes(key)))
  }
})

test('deep links resolve only supported views and permissions deny unrelated areas', () => {
  assert.ok(routes?.resolveWorkspaceRoute, 'Workspace route policy is missing')
  assert.equal(routes.resolveWorkspaceRoute('/changes/42')?.view, 'details')
  assert.equal(routes.resolveWorkspaceRoute('/changes/42')?.changeId, 42)
  assert.equal(routes.resolveWorkspaceRoute('/changes/42/revise')?.view, 'revise')
  for (const path of ['/changes/0', '/changes/-1', '/changes/1.2', '/changes/9007199254740993', '/projects'])
    assert.equal(routes.resolveWorkspaceRoute(path), null)
  assert.equal(routes.routeAllowed('/users', ['identity.read']), false)
  assert.equal(routes.routeAllowed('/users', ['identity.read', 'users.read']), true)
  assert.equal(routes.routeAllowed('/changes/new', ['changes.read']), false)
  assert.deepEqual(routes.navigationFor(['identity.read']).map(item => item.path), ['/workspace'])
})

test('safe route returns reject encoded, external and credential-bearing destinations', () => {
  assert.ok(routes?.safeDestination, 'Safe route navigation is missing')
  for (const path of ['https://evil.example.test', '//evil.example.test', '/%2f%2fevil', '/changes/4?token=fixture', '/changes/4#fixture', '/changes/../users', '/projects'])
    assert.equal(routes.safeDestination(path), '/workspace')
  assert.equal(routes.safeDestination('/changes/42'), '/changes/42')
  assert.equal(routes.safeDestination('/notifications'), '/notifications')
  assert.equal(routes.withRecoveryMarker('/changes/42', true), '/changes/42?memory=1')
})

class LocalPreferences {
  values = new Map<string, string>()
  calls: string[] = []
  blocked = false
  getItem(key: string) { this.calls.push(key); if (this.blocked) throw new Error('Storage blocked'); return this.values.get(key) ?? null }
  setItem(key: string, value: string) { if (this.blocked) throw new Error('Storage blocked'); this.values.set(key, value) }
}

test('Arabic dark defaults and persisted language/theme contain no identity or token fields', () => {
  assert.ok(preferences?.PreferenceStore, 'Preference store is missing')
  const memory = new LocalPreferences()
  const first = new preferences.PreferenceStore(() => memory)
  assert.deepEqual(first.getSnapshot(), { language: 'ar-SA', theme: 'dark', storageWarning: false })
  first.setLanguage('en')
  first.setTheme('light')
  const recovered = new preferences.PreferenceStore(() => memory)
  assert.equal(recovered.getSnapshot().language, 'en')
  assert.equal(recovered.getSnapshot().theme, 'light')
  assert.ok(memory.calls.every(key => ['changeflow_language', 'changeflow_theme'].includes(key)))
  assert.deepEqual([...memory.values.values()].sort(), ['en', 'light'])
})

test('blocked or corrupt preferences keep the UI usable without reading session storage', () => {
  assert.ok(preferences?.PreferenceStore)
  const memory = new LocalPreferences()
  memory.blocked = true
  const state = new preferences.PreferenceStore(() => memory)
  state.setLanguage('en')
  state.setTheme('light')
  assert.deepEqual(state.getSnapshot(), { language: 'en', theme: 'light', storageWarning: true })
  memory.blocked = false
  memory.values.set('changeflow_language', 'unrecognized-language')
  memory.values.set('changeflow_theme', 'unrecognized-theme')
  const reset = new preferences.PreferenceStore(() => memory)
  assert.equal(reset.getSnapshot().language, 'ar-SA')
  assert.equal(reset.getSnapshot().theme, 'dark')
})

test('translation resources resolve route, auth and shared UI keys in both languages', () => {
  assert.ok(localization?.createLocalization, 'Local i18next resources are missing')
  for (const language of ['ar-SA', 'en'] as const) {
    const engine = localization.createLocalization(language)
    for (const key of ['auth:login.title', 'auth:login.credentials', 'auth:invitation.missing', 'shell:nav.workspace',
      'shell:nav.changes', 'common:actions.logout', 'states:forbidden.title', 'states:notFound.title']) {
      assert.equal(engine.exists(key, { lng: language, fallbackLng: false }), true, key)
      assert.notEqual(engine.t(key), key)
    }
    for (const item of routes!.navigationFor(['identity.read', 'changes.read', 'notifications.own', 'users.read']))
      assert.equal(engine.exists(item.title, { lng: language, fallbackLng: false }), true, item.title)
    assert.equal(engine.dir(language), language === 'ar-SA' ? 'rtl' : 'ltr')
  }
})

test('Intl formatters preserve identifiers and reject ambiguous or invalid timestamps', () => {
  assert.ok(formatters?.formatDateTime, 'Locale formatters are missing')
  assert.equal(formatters.formatDateTime('invalid', 'utc', 'ar-SA'), '—')
  assert.equal(formatters.formatDateTime('2026-11-01T10:30:00', 'utc', 'en'), '—')
  assert.equal(formatters.formatDateTime('2026-02-30T10:30:00Z', 'utc', 'en'), '—')
  assert.match(formatters.formatDateTime('2026-11-01T10:30:00Z', 'utc', 'en'), /13:30/)
  assert.match(formatters.formatDateTime('2026-11-01T10:30:00', 'organization-local', 'en'), /10:30/)
  assert.equal(formatters.formatNumber(Number.NaN, 'ar-SA'), '—')
  assert.notEqual(formatters.formatNumber(1234, 'ar-SA'), '1234')
})

test('every local translation and literal UI key exists in both namespaces without fallback', () => {
  assert.ok(localization?.createLocalization)
  const root = resolve(fileURLToPath(new URL('../src', import.meta.url)))
  const flatten = (value: Record<string, unknown>, prefix = ''): string[] => Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof child === 'string' ? [path] : flatten(child as Record<string, unknown>, path)
  })
  const locales = ['ar-SA', 'en'].map(language => JSON.parse(readFileSync(join(root, 'localization/locales', language + '.json'), 'utf8')))
  const normalize = (data: Record<string, unknown>) => [...new Set(flatten(data).map(key => key.replace(/_(zero|one|two|few|many|other)$/, '')))].sort()
  assert.deepEqual(normalize(locales[0]), normalize(locales[1]))
  const engines = ['ar-SA', 'en'].map(language => localization.createLocalization(language as 'ar-SA' | 'en'))
  for (const [index, locale] of locales.entries()) for (const key of flatten(locale)) {
    const [namespace, ...parts] = key.split('.')
    assert.ok(engines[index].exists(`${namespace}:${parts.join('.')}`, { fallbackLng: false }), key)
  }
  const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(item =>
    item.isDirectory() ? walk(join(directory, item.name)) : item.name.endsWith('.tsx') ? [join(directory, item.name)] : [])
  for (const file of walk(root).filter(path => !path.endsWith('App.tsx'))) {
    const text = readFileSync(file, 'utf8')
    const namespace = /useTranslation\(\s*(?:\[\s*)?['"]([^'"]+)['"]/.exec(text)?.[1] ?? 'common'
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't'
        && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const input = node.arguments[0].text
        const key = input.includes(':') ? input : `${namespace}:${input}`
        for (const engine of engines) assert.ok(engine.exists(key, { fallbackLng: false, count: 2 }), `${file}: ${key}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
})

test('Arabic plural categories and English plurals use localized trusted counts', () => {
  assert.ok(localization?.createLocalization)
  const ar = localization.createLocalization('ar-SA')
  const en = localization.createLocalization('en')
  assert.equal(ar.t('common:feedback.permissionCount', { count: 0 }), 'لا توجد صلاحيات متاحة')
  assert.equal(ar.t('common:feedback.permissionCount', { count: 1 }), 'صلاحية واحدة متاحة')
  assert.equal(ar.t('common:feedback.permissionCount', { count: 2 }), 'صلاحيتان متاحتان')
  assert.match(ar.t('common:feedback.permissionCount', { count: 7 }), /صلاحيات/)
  assert.match(en.t('common:feedback.permissionCount', { count: 1 }), /1 permission available/)
  assert.match(en.t('common:feedback.permissionCount', { count: 2 }), /2 permissions available/)
})

test('actual dark and light semantic CSS tokens meet normal-text and focus contrast thresholds', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
  const tokens = (text: string) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
  const base = tokens(/:root\s*\{([\s\S]*?)\n  \}/.exec(css)![1])
  const light = { ...base, ...tokens(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n  \}/.exec(css)![1]) }
  const luminance = (color: string, palette: Record<string, string>): number => {
    if (color.startsWith('var(')) return luminance(palette[color.slice(4, -1)], palette)
    const rgb = color.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  const ratio = (a: string, b: string, palette: Record<string, string>) => {
    const values = [luminance(palette[a], palette), luminance(palette[b], palette)].sort((a, b) => b - a)
    return (values[0] + .05) / (values[1] + .05)
  }
  for (const palette of [base, light]) {
    for (const [a, b] of [['--text','--bg'],['--muted','--bg'],['--subtle','--bg'],['--on-accent','--accent'],
      ['--accent-text','--accent-soft'],['--danger','--danger-bg'],['--success','--success-bg'],
      ...['critical','high','medium','low','unknown'].map(risk => [`--risk-${risk}`,`--risk-${risk}-bg`])])
      assert.ok(ratio(a,b,palette) >= 4.5, `${a}/${b}`)
    assert.ok(ratio('--focus','--bg',palette) >= 3)
  }
})
