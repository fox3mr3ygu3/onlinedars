import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // tsconfig keeps `jsx: preserve` for Next; tests need React's automatic runtime.
  esbuild: { jsx: 'automatic' },
  test: {
    // Default is node; component/browser tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'messages/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
