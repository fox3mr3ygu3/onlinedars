import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import messages from '../../messages/uz.json';

/** Renders with the uz messages and a fresh React Query client (no retries). */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="uz" messages={messages} timeZone="Asia/Tashkent">
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}
