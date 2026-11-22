// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readRoleHint } from '@/lib/auth/role-cookie';
import { resetSessionForTests } from '@/lib/auth/session';
import { jsonResponse, renderWithIntl } from '@/test/render';
import { ForgotPasswordForm } from './forgot-password-form';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

const replace = vi.fn();
let search = new URLSearchParams();
const router = { replace, push: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => search,
}));

const user = (role = 'STUDENT') => ({
  accessToken: 'tok',
  expiresIn: 900,
  user: {
    id: 'u1',
    email: null,
    phone: '+998901234567',
    fullName: 'Ali Valiyev',
    role,
    avatarUrl: null,
    phoneVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
});

beforeEach(() => {
  resetSessionForTests();
  document.cookie = 'od_role=; Path=/; Max-Age=0';
  replace.mockReset();
  search = new URLSearchParams();
});
afterEach(() => vi.unstubAllGlobals());

describe('LoginForm', () => {
  it('validates input before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithIntl(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email yoki telefon raqam'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    expect(await screen.findByText('Email yoki telefon raqamni kiriting')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the translated error for wrong credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'x' })),
    );
    renderWithIntl(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email yoki telefon raqam'), 'ali@example.com');
    await userEvent.type(screen.getByLabelText('Parol'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Login yoki parol noto'g'ri");
  });

  it('logs in by phone and follows a safe ?next=', async () => {
    search = new URLSearchParams('next=/checkout/c1');
    const fetchMock = vi.fn(async () => jsonResponse(200, user()));
    vi.stubGlobal('fetch', fetchMock);
    renderWithIntl(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email yoki telefon raqam'), '90 123 45 67');
    await userEvent.type(screen.getByLabelText('Parol'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/checkout/c1'));
    expect(readRoleHint()).toBe('STUDENT');
  });

  it('ignores an unsafe ?next= and uses the role home', async () => {
    search = new URLSearchParams('next=//evil.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, user('ADMIN'))),
    );
    renderWithIntl(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email yoki telefon raqam'), 'a@b.uz');
    await userEvent.type(screen.getByLabelText('Parol'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin'));
  });
});

describe('RegisterForm (phone + OTP)', () => {
  it('requests an OTP, then registers with the code', async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, body: init.body ? JSON.parse(init.body as string) : undefined });
        if (url.endsWith('/auth/otp/request'))
          return jsonResponse(202, { sent: true, expiresIn: 300, resendIn: 60 });
        return jsonResponse(201, user());
      }),
    );
    renderWithIntl(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("To'liq ism"), 'Ali Valiyev');
    await userEvent.type(screen.getByLabelText('Telefon raqam'), '+998 90 123 45 67');
    await userEvent.type(screen.getByLabelText('Parol'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'SMS kod yuborish' }));

    expect(await screen.findByText('SMS kodni kiriting')).toBeInTheDocument();
    expect(calls[0]).toEqual({
      url: '/api/v1/auth/otp/request',
      body: { phone: '+998901234567', purpose: 'REGISTER' },
    });
    expect(screen.getByRole('button', { name: /Qayta yuborish: \d+ s/ })).toBeDisabled();

    await userEvent.type(screen.getByLabelText('SMS kod'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cabinet'));
    expect(calls[1]).toEqual({
      url: '/api/v1/auth/register',
      body: {
        fullName: 'Ali Valiyev',
        phone: '+998901234567',
        password: 'secret123',
        otpCode: '123456',
      },
    });
  });

  it('shows OTP errors from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth/otp/request')
          ? jsonResponse(202, { sent: true, expiresIn: 300, resendIn: 60 })
          : jsonResponse(400, { code: 'OTP_INVALID', message: 'x' }),
      ),
    );
    renderWithIntl(<RegisterForm />);
    await userEvent.type(screen.getByLabelText("To'liq ism"), 'Ali Valiyev');
    await userEvent.type(screen.getByLabelText('Telefon raqam'), '901234567');
    await userEvent.type(screen.getByLabelText('Parol'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'SMS kod yuborish' }));
    await userEvent.type(await screen.findByLabelText('SMS kod'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Tasdiqlash' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("SMS kod noto'g'ri");
  });

  it('email sign-up needs no OTP', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, user()));
    vi.stubGlobal('fetch', fetchMock);
    renderWithIntl(<RegisterForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Email orqali' }));
    await userEvent.type(screen.getByLabelText("To'liq ism"), 'Ali Valiyev');
    await userEvent.type(screen.getByLabelText('Email'), 'Ali@Example.com');
    await userEvent.type(screen.getByLabelText('Parol'), 'short');
    await userEvent.click(screen.getByRole('button', { name: "Ro'yxatdan o'tish" }));
    expect(
      await screen.findByText("Parol kamida 8 ta belgidan iborat bo'lsin"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Parol'), '12345');
    await userEvent.click(screen.getByRole('button', { name: "Ro'yxatdan o'tish" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cabinet'));
    const init = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init[1].body as string)).toMatchObject({ email: 'ali@example.com' });
  });
});

describe('ForgotPasswordForm', () => {
  it('requests a code, then resets the password', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return url.endsWith('/forgot') ? jsonResponse(202, { sent: true }) : jsonResponse(204);
      }),
    );
    renderWithIntl(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('Email yoki telefon raqam'), '+998901234567');
    await userEvent.click(screen.getByRole('button', { name: 'Kod yuborish' }));
    await userEvent.type(await screen.findByLabelText('SMS kod'), '123456');
    await userEvent.type(screen.getByLabelText('Yangi parol', { selector: 'input' }), 'newsecret1');
    await userEvent.click(screen.getByRole('button', { name: "Parolni o'zgartirish" }));
    expect(await screen.findByRole('status')).toHaveTextContent("Parol o'zgartirildi");
    expect(urls).toEqual(['/api/v1/auth/password/forgot', '/api/v1/auth/password/reset']);
  });
});
