import type {
  AuthResponse,
  AuthUser,
  ForgotPasswordInput,
  LoginInput,
  OtpRequestInput,
  OtpRequestResponse,
  RegisterInput,
  ResetPasswordInput,
} from '@onlinedars/shared';
import { apiFetch } from './client';

/*
 * Raw auth endpoints (apps/api/src/modules/auth/auth.controller.ts). The refresh token only ever
 * travels in the httpOnly `od_refresh` cookie (path /api/v1/auth), so these must run in the
 * browser through the same-origin `/api/v1` proxy. UI code should use the actions in
 * `@/lib/auth` (login/register/logout), which also update the session store.
 */

export function postLogin(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: input });
}

export function postRegister(input: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input });
}

export function postRefresh(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/auth/refresh', { method: 'POST' });
}

export function postLogout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

export function getMe(accessToken: string): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', { accessToken });
}

export function postOtpRequest(input: OtpRequestInput): Promise<OtpRequestResponse> {
  return apiFetch<OtpRequestResponse>('/auth/otp/request', { method: 'POST', body: input });
}

export function postForgotPassword(input: ForgotPasswordInput): Promise<{ sent: true }> {
  return apiFetch<{ sent: true }>('/auth/password/forgot', { method: 'POST', body: input });
}

export function postResetPassword(input: ResetPasswordInput): Promise<void> {
  return apiFetch<void>('/auth/password/reset', { method: 'POST', body: input });
}
