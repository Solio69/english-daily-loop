import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

if (process.platform === 'win32') {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(
    'tools/playwright-browsers',
  )
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'f02-public-fake-key',
    },
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
