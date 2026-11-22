import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import messages from '../../../messages/uz.json';

/** Renders with the real uz.json messages and a fresh QueryClient (test-only helper). */
export function renderAdmin(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="uz" messages={messages} timeZone="Asia/Tashkent">
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}

export { messages };
