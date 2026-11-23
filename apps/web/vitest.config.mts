import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // tsconfig keeps `jsx: preserve` for Next; component tests need the automatic runtime.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'messages/**/*.spec.ts'],
    // Component specs opt into jsdom with a `// @vitest-environment jsdom` comment.
    setupFiles: ['./vitest.setup.ts'],
  },
});
