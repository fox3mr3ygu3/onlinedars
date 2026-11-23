import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright for OnlineDars (owner: qa; merged from frontend-admin, -student and -public).
 * - Specs tagged `@smoke` mock the API with `page.route('**\/api/v1/**')` and need only the web app.
 * - CI builds first and runs `next start`; locally `next dev` unless `E2E_PROD=1` (after `pnpm build`).
 * - `E2E_API=1` also starts the built API on :4000 (needs Postgres + Redis) for full-stack specs.
 * - The mobile project skips e2e/public/** until those specs are checked at 375px (qa).
 * - e2e/acceptance/** (`@fullstack`) runs on desktop only, except acceptance/mobile-*.spec.ts,
 *   which runs on mobile only (spec §13.10).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;
const withApi = process.env.E2E_API === '1';
const useBuild = isCI || process.env.E2E_PROD === '1';

// Test-only values so the API boots for full-stack runs. Never real secrets.
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
  use: { baseURL, trace: 'retain-on-failure', locale: 'uz-UZ', timezoneId: 'Asia/Tashkent' },
  projects: [
    {
      name: 'desktop',
      testIgnore: ['acceptance/mobile-*.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      // Full-stack acceptance flows run once (desktop); mobile gets its own acceptance/mobile-*.
      testIgnore: ['public/**', /acceptance[\\/](?!mobile-)[^\\/]+\.spec\.ts$/],
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
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
            ? `pnpm --filter @onlinedars/web start --port ${PORT}`
            : `pnpm --filter @onlinedars/web dev --port ${PORT}`,
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 180_000,
          // Mocked specs never reach a real API unless E2E_API=1.
          env: {
            API_URL: withApi
              ? 'http://localhost:4000/api/v1'
              : (process.env.API_URL ?? 'http://127.0.0.1:4999/api/v1'),
          },
        },
      ],
});
