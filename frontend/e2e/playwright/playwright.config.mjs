import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.', testMatch: 'pilot.spec.mjs', workers: 1, fullyParallel: false,
  retries: 0, repeatEach: 1, timeout: 25000,
  globalTimeout: process.env.PILOT_SELECTION?.startsWith('notices') ? 600000 : process.env.PILOT_SELECTION?.startsWith('editor') ? 540000 : process.env.PILOT_SELECTION?.startsWith('changes') ? 420000 : process.env.PILOT_SELECTION?.startsWith('dashboard') ? 300000 : process.env.PILOT_SELECTION?.startsWith('systems') ? 240000 : 120000,
  expect: { timeout: 7000 },
  outputDir: `${process.env.PILOT_ROOT}/results`, preserveOutput: 'never',
  reporter: [['./reporter.mjs']],
  use: { baseURL: process.env.PILOT_ORIGIN, browserName: 'chromium',
    viewport: { width: 1440, height: 960 },
    trace: 'off', screenshot: 'off', video: 'off',
    actionTimeout: 7000, navigationTimeout: 10000, serviceWorkers: 'block' },
})
