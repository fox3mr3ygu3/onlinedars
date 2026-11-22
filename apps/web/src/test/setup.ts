import { afterEach } from 'vitest';

// Testing Library helpers are only needed in jsdom specs.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  window.scrollTo = (() => undefined) as typeof window.scrollTo;
  afterEach(() => {
    cleanup();
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });
}
