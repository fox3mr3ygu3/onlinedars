'use client';

import {
  type AdminPaymentStatusChange,
  PaymentStatus,
  adminPaymentStatusChangeSchema,
} from '@onlinedars/shared';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AdminPayment } from '@/lib/api/admin/types';
import { formatMoney } from '../common/format';
import { useApiErrorMessage } from '../common/useApiErrorMessage';
import { Field, NativeSelect, Textarea } from '../common/ui';
import { PaymentStatusBadge } from './PaymentStatusBadge';

export type StatusChangeProblem = 'reasonRequired' | 'sameStatus';

/** Client-side check before PATCH /admin/payments/:id/status (the API validates + audits again). */
export function validateStatusChange(
  current: PaymentStatus,
  body: { status: PaymentStatus; reason: string },
): { ok: true; value: AdminPaymentStatusChange } | { ok: false; problems: StatusChangeProblem[] } {
  const problems: StatusChangeProblem[] = [];
  if (body.status === current) problems.push('sameStatus');
  const parsed = adminPaymentStatusChangeSchema.safeParse(body);
  if (!parsed.success && parsed.error.issues.some((i) => i.path[0] === 'reason'))
    problems.push('reasonRequired');
  if (problems.length || !parsed.success) return { ok: false, problems };
  return { ok: true, value: parsed.data };
}

/**
 * ADMIN-only manual status change. Requires a reason (≥ 5 chars), which the API writes to the
 * audit log. Access is still granted only by verified provider callbacks.
 */
export function PaymentStatusDialog({
  payment,
  open,
  onOpenChange,
  onSubmit,
}: {
  payment: AdminPayment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (id: string, body: AdminPaymentStatusChange) => Promise<unknown>;
}) {
  return (
    <Dialog open={open && !!payment} onOpenChange={onOpenChange}>
      {open && payment && (
        <Inner payment={payment} onDone={() => onOpenChange(false)} onSubmit={onSubmit} />
      )}
    </Dialog>
  );
}

function Inner({
  payment,
  onDone,
  onSubmit,
}: {
  payment: AdminPayment;
  onDone: () => void;
  onSubmit: (id: string, body: AdminPaymentStatusChange) => Promise<unknown>;
}) {
  const t = useTranslations('admin.payments');
  const tc = useTranslations('admin.common');
  const errMsg = useApiErrorMessage();
  const options = Object.values(PaymentStatus).filter((s) => s !== payment.status);
  const [status, setStatus] = useState<PaymentStatus>(options[0] ?? payment.status);
  const [reason, setReason] = useState('');
  const [problems, setProblems] = useState<StatusChangeProblem[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const r = validateStatusChange(payment.status, { status, reason });
    if (!r.ok) {
      setProblems(r.problems);
      return;
    }
    setProblems([]);
    setServerError(null);
    setBusy(true);
    try {
      await onSubmit(payment.id, r.value);
      onDone();
    } catch (e) {
      setServerError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent closeLabel={tc('close')}>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('fields.orderId')}</dt>
          <dd className="font-mono">{payment.orderNumber ?? payment.orderId}</dd>
          <dt className="text-muted-foreground">{t('fields.student')}</dt>
          <dd>{payment.student.fullName}</dd>
          <dt className="text-muted-foreground">{t('fields.amount')}</dt>
          <dd className="tabular-nums">{formatMoney(payment.amount, tc('som'))}</dd>
          <dt className="text-muted-foreground">{t('dialog.current')}</dt>
          <dd>
            <PaymentStatusBadge status={payment.status} />
          </dd>
        </dl>
        <Field
          label={t('dialog.newStatus')}
          error={problems.includes('sameStatus') ? t('dialog.sameStatus') : undefined}
        >
          {(id) => (
            <NativeSelect
              id={id}
              value={status}
              onChange={(e) => setStatus(e.target.value as PaymentStatus)}
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field
          label={t('dialog.reason')}
          error={problems.includes('reasonRequired') ? t('dialog.reasonRequired') : undefined}
        >
          {(id, describedBy) => (
            <Textarea
              id={id}
              required
              aria-describedby={describedBy}
              aria-invalid={problems.includes('reasonRequired')}
              placeholder={t('dialog.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
        {serverError && (
          <p role="alert" className="text-destructive text-sm">
            {serverError}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {t('dialog.submit')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
