'use client';

import { ErrorCode, PaymentProvider } from '@onlinedars/shared';
import { Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert, useApiErrorMessage } from '@/features/auth/form-bits';
import { isApiError } from '@/lib/api/client';
import { createOrder, isFreeEnrollment } from '@/lib/api/orders';
import { isStaff, loginRedirect, useSession } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { StaffEnrolNotice } from '@/features/course/student-only';
import { cabinetCourseHref, isSafeRedirectUrl } from './redirect';

const PROVIDERS = [PaymentProvider.PAYME, PaymentProvider.CLICK] as const;

/**
 * Sends only `{ courseId, provider }`; the server computes the amount. For a free course the API
 * enrolls directly (`{ enrolled: true }`); the provider field is ignored there.
 */
export function CheckoutForm({ courseId, isFree }: { courseId: string; isFree: boolean }) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const apiMessage = useApiErrorMessage();
  const [provider, setProvider] = useState<PaymentProvider>(PaymentProvider.PAYME);
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSession();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await createOrder({ courseId, provider });
      if (isFreeEnrollment(result)) {
        router.push(cabinetCourseHref(courseId));
        return;
      }
      if (!isSafeRedirectUrl(result.redirectUrl)) {
        setError(t('statusFailedText'));
        setBusy(false);
        return;
      }
      setRedirecting(true);
      window.location.assign(result.redirectUrl);
    } catch (err) {
      if (isApiError(err) && err.code === ErrorCode.ALREADY_ENROLLED) {
        router.push(cabinetCourseHref(courseId));
        return;
      }
      if (isApiError(err) && err.status === 401) {
        router.push(loginRedirect(window.location.pathname + window.location.search));
        return;
      }
      setError(apiMessage(err));
      setBusy(false);
    }
  }

  // Staff accounts cannot enrol or buy (POST /orders is student-only).
  if (isStaff(user?.role)) return <StaffEnrolNotice />;

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {!isFree && (
        <fieldset className="grid gap-3">
          <legend className="mb-3 font-semibold">{t('chooseProvider')}</legend>
          {PROVIDERS.map((p) => (
            <label
              key={p}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors',
                provider === p
                  ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                  : 'hover:bg-muted/50',
              )}
            >
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => setProvider(p)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="flex-1">
                <span className="block font-medium">{t(`provider${p}`)}</span>
                <span className="text-muted-foreground text-sm">{t(`providerHint${p}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <FormAlert>{error}</FormAlert>
      <Button type="submit" size="lg" disabled={busy} data-testid="checkout-submit">
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {redirecting ? t('redirecting') : isFree ? t('startFree') : t('pay')}
      </Button>
      {!isFree && (
        <p className="text-muted-foreground flex gap-2 text-xs">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('secureNote')}
        </p>
      )}
    </form>
  );
}
