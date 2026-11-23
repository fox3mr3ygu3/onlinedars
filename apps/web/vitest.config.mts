import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  esbuild: { jsx: 'automatic' },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.spec.ts', 'messages/**/*.spec.ts'],
        },
      },
      {
        // Component specs run in jsdom.
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.spec.tsx'] },
      },
    ],
  },
});
