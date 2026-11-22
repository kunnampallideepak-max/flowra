import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3100',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    screenshot: 'only-on-failure'
  },
  webServer: {
    env: { GEMINI_API_KEY: '', FLOWRA_PUBLIC_ORIGIN: '', FLOWRA_INGEST_TOKEN: 'test-only-ingestion-token-1234567890abcdef', FLOWRA_DEVICE_ID: 'esp32-flowra-01' },
    command: 'npm.cmd start -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 30000
  },
  reporter: 'list'
});
