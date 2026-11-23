import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal Playwright config (created by frontend-admin; qa/coordinator may merge with theirs).
 * Admin specs mock the API with `page.route('**\/api/v1/**')`, so only the web app is started.
 * CI builds first and runs `next start`; locally `next dev` is used unless a server is running.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure', locale: 'uz-UZ', timezoneId: 'Asia/Tashkent' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI
          ? `pnpm --filter @onlinedars/web start --port ${PORT}`
          : `pnpm --filter @onlinedars/web dev --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
