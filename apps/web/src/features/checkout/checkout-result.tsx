'use client';

import { type OrderStatusResponse, PaymentStatus } from '@onlinedars/shared';
import { CheckCircle2, Clock, Loader2, RotateCcw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Price } from '@/features/catalog/price';
import { errorMessageKey, isApiError } from '@/lib/api/client';
import { getOrder, pollOrderStatus } from '@/lib/api/orders';
import { loginRedirect } from '@/lib/auth';
import { cabinetCourseHref } from './redirect';

type View =
  | { kind: 'checking'; order: OrderStatusResponse | null }
  | { kind: 'final'; order: OrderStatusResponse }
  | { kind: 'timeout'; order: OrderStatusResponse | null }
  | { kind: 'error'; messageKey: string };

export interface CheckoutResultProps {
  orderId: string | null;
  intervalMs?: number;
  timeoutMs?: number;
}

function isFatal(e: unknown): boolean {
  return isApiError(e) && (e.status === 401 || e.status === 403 || e.status === 404);
}

/**
 * Return page after Payme/Click. The provider's redirect proves nothing: we poll GET /orders/:id
 * until the server (which only trusts the provider's server-to-server callback) reports a final
 * status, or give up after `timeoutMs`.
 */
export function CheckoutResult({
  orderId,
  intervalMs = 2000,
  timeoutMs = 120_000,
}: CheckoutResultProps) {
  const t = useTranslations('checkout');
  const tRoot = useTranslations();
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: 'checking', order: null });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Keep the router out of the polling effect's deps so a new router object never restarts polling.
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const router = routerRef.current;
    if (!orderId) return;
    const controller = new AbortController();
    setView((v) => ({ kind: 'checking', order: 'order' in v ? v.order : null }));
    pollOrderStatus({
      fetchOrder: (signal) => getOrder(orderId, signal),
      intervalMs,
      timeoutMs,
      signal: controller.signal,
      isFatal,
      onUpdate: (order) => {
        if (!controller.signal.aborted) setView({ kind: 'checking', order });
      },
    })
      .then((outcome) => {
        if (controller.signal.aborted) return;
        setView(
          outcome.kind === 'final'
            ? { kind: 'final', order: outcome.order }
            : { kind: 'timeout', order: outcome.order },
        );
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (isApiError(e) && e.status === 401) {
          router.replace(loginRedirect(`/checkout/result?orderId=${encodeURIComponent(orderId)}`));
          return;
        }
        setView({ kind: 'error', messageKey: errorMessageKey(e) });
      });
    return () => controller.abort();
  }, [orderId, intervalMs, timeoutMs, attempt]);

  if (!orderId) {
    return <StatusBlock tone="error" title={t('missingOrder')} />;
  }

  if (view.kind === 'error') {
    return (
      <StatusBlock tone="error" title={tRoot(view.messageKey)}>
        <Button variant="outline" onClick={retry}>
          <RotateCcw aria-hidden />
          {t('checkAgain')}
        </Button>
      </StatusBlock>
    );
  }

  const order = view.order;
  const summary = order ? (
    <dl className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
      <dt>{t('amount')}</dt>
      <dd className="text-foreground text-right">
        <Price isFree={false} price={order.amount} />
      </dd>
    </dl>
  ) : null;

  if (view.kind === 'checking') {
    return (
      <StatusBlock
        tone="pending"
        title={t('statusChecking')}
        text={t('statusCheckingText')}
        testId="status-checking"
      >
        {summary}
      </StatusBlock>
    );
  }

  if (view.kind === 'timeout') {
    return (
      <StatusBlock
        tone="pending"
        title={t('statusTimeout')}
        text={t('statusTimeoutText')}
        testId="status-timeout"
      >
        {summary}
        <div className="flex flex-wrap gap-2">
          <Button onClick={retry}>
            <RotateCcw aria-hidden />
            {t('checkAgain')}
          </Button>
          <Button asChild variant="outline">
            <Link href="/cabinet/payments">{t('paymentHistory')}</Link>
          </Button>
        </div>
      </StatusBlock>
    );
  }

  const status = view.order.status;
  if (status === PaymentStatus.PAID) {
    return (
      <StatusBlock
        tone="success"
        title={t('statusPaid')}
        text={t('statusPaidText')}
        testId="status-paid"
      >
        {summary}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={cabinetCourseHref(view.order.courseId)}>{t('goToCourse')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/cabinet">{t('goToCabinet')}</Link>
          </Button>
        </div>
      </StatusBlock>
    );
  }

  const failure =
    status === PaymentStatus.CANCELLED
      ? { title: t('statusCancelled'), text: t('statusCancelledText') }
      : status === PaymentStatus.REFUNDED
        ? { title: t('statusRefunded'), text: t('statusRefundedText') }
        : { title: t('statusFailed'), text: t('statusFailedText') };
  return (
    <StatusBlock
      tone="error"
      title={failure.title}
      text={failure.text}
      testId={`status-${status.toLowerCase()}`}
    >
      {summary}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/checkout/${encodeURIComponent(view.order.courseId)}`}>{t('tryAgain')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/cabinet/payments">{t('paymentHistory')}</Link>
        </Button>
      </div>
    </StatusBlock>
  );
}

function StatusBlock({
  tone,
  title,
  text,
  testId,
  children,
}: {
  tone: 'pending' | 'success' | 'error';
  title: string;
  text?: string;
  testId?: string;
  children?: React.ReactNode;
}) {
  const Icon =
    tone === 'success'
      ? CheckCircle2
      : tone === 'error'
        ? XCircle
        : testId === 'status-timeout'
          ? Clock
          : Loader2;
  const color =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'error'
        ? 'text-destructive'
        : 'text-primary';
  return (
    <div className="bg-card grid gap-5 rounded-xl border p-6 shadow-sm" data-testid={testId}>
      <div className="flex items-start gap-4" role="status" aria-live="polite">
        <Icon
          className={`${color} size-10 shrink-0 ${Icon === Loader2 ? 'animate-spin' : ''}`}
          aria-hidden
        />
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {text && <p className="text-muted-foreground text-sm">{text}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
