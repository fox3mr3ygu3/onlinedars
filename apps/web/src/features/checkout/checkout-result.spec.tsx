// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAuthResponse, resetSessionForTests } from '@/lib/auth/session';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { CheckoutResult } from './checkout-result';

const replace = vi.fn();
const router = { replace, push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

function signIn() {
  applyAuthResponse({
    accessToken: 'tok',
    expiresIn: 900,
    user: {
      id: 'u1',
      email: null,
      phone: '+998901234567',
      fullName: 'Ali',
      role: 'STUDENT',
      avatarUrl: null,
      phoneVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  });
}

const order = (status: string) => ({
  orderId: 'o1',
  status,
  courseId: 'c1',
  amount: 50_000_000,
  currency: 'UZS',
});

function mockOrders(...statuses: string[]) {
  let i = 0;
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (!url.endsWith('/orders/o1')) return jsonResponse(404, { code: 'NOT_FOUND' });
    return jsonResponse(200, order(statuses[Math.min(i++, statuses.length - 1)]!));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetSessionForTests();
  signIn();
  replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('CheckoutResult', () => {
  it('shows "checking" while PENDING, then success when the server says PAID', async () => {
    const fetchMock = mockOrders('PENDING', 'PENDING', 'PAID');
    renderWithIntl(<CheckoutResult orderId="o1" intervalMs={5} timeoutMs={5000} />);
    expect(screen.getByTestId('status-checking')).toHaveTextContent("To'lov tekshirilmoqda");
    expect(await screen.findByTestId('status-paid')).toHaveTextContent("To'lov tasdiqlandi");
    expect(screen.getByRole('link', { name: "Kursga o'tish" })).toHaveAttribute(
      'href',
      '/cabinet/courses/c1',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Polling is authenticated.
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('shows failure with a retry link when FAILED', async () => {
    mockOrders('PENDING', 'FAILED');
    renderWithIntl(<CheckoutResult orderId="o1" intervalMs={5} />);
    expect(await screen.findByTestId('status-failed')).toHaveTextContent("To'lov amalga oshmadi");
    expect(screen.getByRole('link', { name: 'Qayta urinish' })).toHaveAttribute(
      'href',
      '/checkout/c1',
    );
  });

  it('shows cancelled state', async () => {
    mockOrders('CANCELLED');
    renderWithIntl(<CheckoutResult orderId="o1" intervalMs={5} />);
    expect(await screen.findByTestId('status-cancelled')).toBeInTheDocument();
  });

  it('times out while still PENDING and never shows success', async () => {
    mockOrders('PENDING');
    renderWithIntl(<CheckoutResult orderId="o1" intervalMs={5} timeoutMs={30} />);
    expect(await screen.findByTestId('status-timeout')).toHaveTextContent('Tasdiq hali kelmadi');
    expect(screen.queryByTestId('status-paid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qayta tekshirish' })).toBeInTheDocument();
  });

  it('shows the API error for an unknown order and stops polling', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(404, { code: 'ORDER_NOT_FOUND', message: 'x' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithIntl(<CheckoutResult orderId="o1" intervalMs={5} />);
    expect(await screen.findByText('Buyurtma topilmadi')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends a signed-out user to login and back to this page', async () => {
    resetSessionForTests(); // no session, no od_role hint
    vi.stubGlobal('fetch', vi.fn());
    renderWithIntl(<CheckoutResult orderId="o1" intervalMs={5} />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/login?next=%2Fcheckout%2Fresult%3ForderId%3Do1'),
    );
  });

  it('asks for an order id when missing', () => {
    renderWithIntl(<CheckoutResult orderId={null} />);
    expect(screen.getByText("Buyurtma raqami ko'rsatilmagan.")).toBeInTheDocument();
  });
});
