import { request } from '@playwright/test';
import { ADMIN, API } from './acceptance/support';

/**
 * Full-stack runs only (`E2E_API=1`): the acceptance specs exercise checkout and Payme, so switch
 * the platform to SELF_SERVICE enrolment (the product default is ADMIN_ONLY). Admin-only
 * behaviour is covered by the API e2e (payments.e2e-spec.ts) and web unit tests.
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_API !== '1') return;
  const ctx = await request.newContext();
  try {
    const login = await ctx.post(`${API}/auth/login`, {
      data: { login: ADMIN.email, password: ADMIN.password },
    });
    if (!login.ok()) throw new Error(`admin login failed: ${login.status()}`);
    const { accessToken } = (await login.json()) as { accessToken: string };
    const res = await ctx.patch(`${API}/admin/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { enrollmentMode: 'SELF_SERVICE' },
    });
    if (!res.ok()) throw new Error(`enrollmentMode update failed: ${res.status()}`);
  } finally {
    await ctx.dispose();
  }
}
