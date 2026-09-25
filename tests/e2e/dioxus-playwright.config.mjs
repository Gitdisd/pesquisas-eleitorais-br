import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'dioxus-site.spec.mjs',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173/pesquisas-eleitorais-br/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'python -m http.server 4173 --directory ../../.dioxus-smoke-server',
    url: 'http://127.0.0.1:4173/pesquisas-eleitorais-br/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
