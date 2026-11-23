import { expect, test } from '@playwright/test';
import { authBody, json } from './helpers';

test.describe('auth pages @smoke', () => {
  test('login validates, shows API errors and redirects to ?next', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/v1/auth/login', (r) => {
      attempts++;
      return attempts === 1
        ? json(r, 401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' })
        : json(r, 200, authBody);
    });
    await page.goto('/login?next=/cabinet/payments');
    await page.waitForLoadState('networkidle');
    await page.getByLabel('Email yoki telefon raqam').fill('abc');
    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page.getByText('Email yoki telefon raqamni kiriting')).toBeVisible();

    await page.getByLabel('Email yoki telefon raqam').fill('ali@example.com');
    await page.getByLabel('Parol', { exact: true }).fill('wrongpass1');
    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page.locator('form [role=alert]')).toContainText("Login yoki parol noto'g'ri");

    await page.getByRole('button', { name: 'Kirish' }).click();
    await expect(page).toHaveURL(/\/cabinet\/payments$/);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'od_role')?.value).toBe('STUDENT');
  });

  test('phone registration goes through the OTP step', async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route('**/api/v1/auth/otp/request', (r) => {
      bodies.push(r.request().postDataJSON());
      return json(r, 202, { sent: true, expiresIn: 300, resendIn: 60 });
    });
    await page.route('**/api/v1/auth/register', (r) => {
      bodies.push(r.request().postDataJSON());
      return json(r, 201, authBody);
    });
    await page.goto('/register');
    await page.waitForLoadState('networkidle');
    await page.getByLabel("To'liq ism").fill('Ali Valiyev');
    await page.getByLabel('Telefon raqam').fill('90 123 45 67');
    await page.getByLabel('Parol', { exact: true }).fill('secret123');
    await page.getByRole('button', { name: 'SMS kod yuborish' }).click();
    await page.getByRole('textbox', { name: 'SMS kod' }).fill('123456');
    await page.getByRole('button', { name: 'Tasdiqlash' }).click();
    await expect(page).toHaveURL(/\/cabinet$/);
    expect(bodies).toEqual([
      { phone: '+998901234567', purpose: 'REGISTER' },
      { fullName: 'Ali Valiyev', phone: '+998901234567', password: 'secret123', otpCode: '123456' },
    ]);
  });

  test('protected pages send signed-out users to login', async ({ page }) => {
    await page.goto('/cabinet');
    await expect(page).toHaveURL(/\/login\?next=%2Fcabinet$/);
    await page.goto('/checkout/c1');
    await expect(page).toHaveURL(/\/login\?next=%2Fcheckout%2Fc1$/);
  });
});
