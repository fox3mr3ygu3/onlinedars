import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// API e2e tests: need a real Postgres (DATABASE_URL). They skip when it is not set.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/setup-e2e.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    root: './',
  },
});
