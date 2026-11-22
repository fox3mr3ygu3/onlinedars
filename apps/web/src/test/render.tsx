import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import messages from '../../messages/uz.json';

/** Renders with the real uz.json messages so tests assert on actual UI text. */
export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="uz" messages={messages} timeZone="Asia/Tashkent">
      {children}
    </NextIntlClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

export { messages };

/** Minimal fetch Response for mocks. */
export function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
