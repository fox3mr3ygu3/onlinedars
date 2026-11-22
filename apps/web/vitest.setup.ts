import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Testing Library auto-cleanup needs globals; do it explicitly (only when a DOM exists).
afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});
