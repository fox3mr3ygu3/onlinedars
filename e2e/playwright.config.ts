import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal Playwright config (created by frontend-student; qa owns e2e/ and may extend it,
 * e.g. add the API to `webServer` for full-stack flows).
 *
 * Specs tagged `@smoke` mock the API with `page.route('** /api/v1/**')`, so they only need the
 * web app. Run after `pnpm build`: `pnpm exec playwright test --config e2e/playwright.config.ts`.
 */
const PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @onlinedars/web exec next start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // The mocked specs never reach a real API; point the proxy somewhere harmless.
        env: { API_URL: process.env.API_URL ?? 'http://127.0.0.1:4999/api/v1' },
      },
});
