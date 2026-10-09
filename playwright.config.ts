import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.E2E_BASE_URL;
const port = process.env.E2E_PORT || '3001';
const baseURL = externalBaseUrl || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--enable-unsafe-swiftshader'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalBaseUrl ? undefined : {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      OFFICE_DATA_DIR: process.env.E2E_DATA_DIR || `/tmp/kadaka-office-e2e-${process.pid}`,
      OFFICE_ACCESS_TOKEN: '',
      MARKETING_AI_KEY: '',
      OPENAI_API_KEY: '',
      MARKETING_IMAGE_KEY: '',
      MARKETING_PUBLISH_URL: '',
      MARKETING_PUBLISH_TOKEN: '',
    },
  },
});
