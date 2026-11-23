'use client';

import type { PaymentStatus } from '@onlinedars/shared';
import { useTranslations } from 'next-intl';
import { Badge, type BadgeTone } from '../common/ui';

const TONES: Record<PaymentStatus, BadgeTone> = {
  PENDING: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
  FAILED: 'danger',
  REFUNDED: 'info',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('admin.payments.status');
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
