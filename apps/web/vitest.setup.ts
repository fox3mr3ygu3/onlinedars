import { afterEach } from 'vitest';

// Testing Library setup only applies to jsdom specs.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
