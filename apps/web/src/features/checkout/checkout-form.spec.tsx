// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAuthResponse, resetSessionForTests } from '@/lib/auth/session';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { CheckoutForm } from './checkout-form';
import { isSafeRedirectUrl } from './redirect';

const push = vi.fn();
const router = { replace: vi.fn(), push, refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

beforeEach(() => {
  resetSessionForTests();
  push.mockReset();
  applyAuthResponse({
    accessToken: 'tok',
    expiresIn: 900,
    user: {
      id: 'u1',
      email: 'a@b.uz',
      phone: null,
      fullName: 'Ali',
      role: 'STUDENT',
      avatarUrl: null,
      phoneVerified: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('CheckoutForm', () => {
  it('sends only courseId + chosen provider (never an amount)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(201, {
        orderId: 'o1',
        number: 7,
        amount: 1,
        redirectUrl: 'javascript:alert(1)',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithIntl(<CheckoutForm courseId="c1" isFree={false} />);
    await userEvent.click(screen.getByLabelText(/Click/));
    await userEvent.click(screen.getByTestId('checkout-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/orders');
    expect(JSON.parse(init.body as string)).toEqual({ courseId: 'c1', provider: 'CLICK' });
    // Unsafe redirect URLs are refused.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('free course: enrolls and goes to the cabinet course', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(201, { enrolled: true })),
    );
    renderWithIntl(<CheckoutForm courseId="c1" isFree />);
    expect(screen.queryByText("To'lov usulini tanlang")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kursni boshlash' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/cabinet/courses/c1'));
  });

  it('already enrolled: goes to the course', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(409, { code: 'ALREADY_ENROLLED', message: 'x' })),
    );
    renderWithIntl(<CheckoutForm courseId="c1" isFree={false} />);
    await userEvent.click(screen.getByTestId('checkout-submit'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/cabinet/courses/c1'));
  });

  it('shows the translated API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(404, { code: 'NOT_FOUND', message: 'x' })),
    );
    renderWithIntl(<CheckoutForm courseId="c1" isFree={false} />);
    await userEvent.click(screen.getByTestId('checkout-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Topilmadi');
  });
});

describe('isSafeRedirectUrl', () => {
  it('allows https provider pages and local http only', () => {
    expect(isSafeRedirectUrl('https://checkout.paycom.uz/abc')).toBe(true);
    expect(isSafeRedirectUrl('http://localhost:4000/mock-pay')).toBe(true);
    expect(isSafeRedirectUrl('http://evil.example/pay')).toBe(false);
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectUrl('/relative')).toBe(false);
  });
});
