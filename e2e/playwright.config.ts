import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright for OnlineDars (owner: qa; created by frontend-public).
 * - CI (`CI=1`, after `pnpm build`): starts the built api (port 4000) and web (port 3000).
 * - Locally: starts `next dev` (or the built app with `E2E_PROD=1`); the api only with
 *   `E2E_API=1` (needs Postgres + Redis).
 * Specs that don't need the real API mock it with `page.route` and are tagged `@smoke`.
 */
const isCI = !!process.env.CI;
const withApi = isCI || process.env.E2E_API === '1';
// Built app (`pnpm build` first): much faster and closer to production than `next dev`.
const useBuild = isCI || process.env.E2E_PROD === '1';
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

// Test-only values so the API boots in CI when the job doesn't define them. Never real secrets.
const apiEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-not-for-production-000',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-not-for-production-00',
  WEB_URL: baseURL,
};

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    ...(withApi
      ? [
          {
            command: 'pnpm --filter @onlinedars/api start',
            url: 'http://localhost:4000/api/v1/health',
            env: apiEnv,
            reuseExistingServer: !isCI,
            timeout: 120_000,
          },
        ]
      : []),
    {
      command: useBuild
        ? 'pnpm --filter @onlinedars/web start'
        : 'pnpm --filter @onlinedars/web dev',
      url: baseURL,
      env: { API_URL: 'http://localhost:4000/api/v1' },
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
