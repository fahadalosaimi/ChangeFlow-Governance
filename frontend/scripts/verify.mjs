import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] ?? 'test'
if (mode === '--build-child') {
  const { build } = await import('vite')
  await build({ root: project, envDir: false,
    build: { outDir: process.argv[3], emptyOutDir: true } })
} else {
  const tempParent = resolve(tmpdir())
  const temporary = mkdtempSync(join(tempParent, 'changeflow-a5-frontend-'))
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ['SYSTEMROOT', 'WINDIR', 'PATH', 'PATHEXT', 'COMSPEC'].includes(key.toUpperCase())))
  Object.assign(env, { TEMP: temporary, TMP: temporary, NODE_ENV: 'test' })
  const commands = {
    test: ['--test', 'tests/api.test.ts', 'tests/auth.test.ts', 'tests/invitation.test.ts', 'tests/presentation.test.ts', 'tests/systems.test.ts', 'tests/browser-diagnostics.test.mjs',
      'e2e/playwright/reporter.test.mjs', 'e2e/playwright/motion.test.mjs', 'e2e/playwright/gate-contract.test.mjs'],
    typecheck: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json',
      '--incremental', '--tsBuildInfoFile', join(temporary, 'test.tsbuildinfo')],
    appcheck: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json',
      '--incremental', '--tsBuildInfoFile', join(temporary, 'app.tsbuildinfo')],
    configcheck: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.node.json',
      '--incremental', '--tsBuildInfoFile', join(temporary, 'config.tsbuildinfo')],
    build: [fileURLToPath(import.meta.url), '--build-child', join(temporary, 'dist')],
    lint: ['node_modules/oxlint/bin/oxlint'],
  }
  try {
    const selected = mode === 'all' ? Object.keys(commands) : [mode]
    for (const command of selected) {
      if (!Object.hasOwn(commands, command)) throw new Error('Unknown verification mode')
      const result = spawnSync(process.execPath, commands[command], { cwd: project,
        env: { ...env, NODE_ENV: command === 'build' ? 'production' : 'test' },
        stdio: 'inherit' })
      if (result.error || result.status !== 0) {
        process.exitCode = result.status || 1
        break
      }
    }
  } finally {
    // Only this invocation's newly created directory can be removed.
    if (dirname(temporary) === tempParent && temporary.startsWith(join(tempParent, 'changeflow-a5-frontend-')))
      rmSync(temporary, { recursive: true, force: false })
    else process.exitCode = 1
  }
}
