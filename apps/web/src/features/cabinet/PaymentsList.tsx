'use client';

import type { PaymentStatus } from '@onlinedars/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { type MyOrder, meApi } from '@/lib/api/me';
import { cn, formatSom } from '@/lib/utils';
import { Pager } from './Pager';
import { cabinetRoutes, qk } from './routes';
import { EmptyState, formatDate, PageHeader, QueryBoundary } from './ui';

const PAGE_SIZE = 20;

const STATUS_STYLE: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-secondary text-muted-foreground',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-blue-100 text-blue-800',
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('payments.statuses');
  return (
    <span
      className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status])}
      data-status={status}
    >
      {t(status)}
    </span>
  );
}

function Amount({ o }: { o: MyOrder }) {
  const tc = useTranslations('common');
  return (
    <span className="tabular-nums">
      {formatSom(o.amount)} {o.currency === 'UZS' ? tc('som') : o.currency}
    </span>
  );
}

/** Payment history (GET /me/orders). Access is granted by provider callbacks, never here. */
export function PaymentsList() {
  const t = useTranslations('payments');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: qk.orders(page),
    queryFn: () => meApi.orders({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const provider = (o: MyOrder) =>
    o.provider ? t(`providers.${o.provider}`) : t('providers.none');

  return (
    <div>
      <PageHeader title={t('title')} />
      <QueryBoundary query={query}>
        {(list) =>
          list.items.length === 0 ? (
            <EmptyState>{t('empty')}</EmptyState>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {list.items.map((o) => (
                  <li
                    key={o.orderId}
                    className="bg-card space-y-1 rounded-xl border p-4"
                    data-testid={`order-${o.orderId}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">
                        {t('order', { number: o.number })}
                      </span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="font-medium">{o.courseTitle}</p>
                    <p className="flex justify-between text-sm">
                      <Amount o={o} />
                      <span className="text-muted-foreground">
                        {provider(o)} · {formatDate(o.paidAt ?? o.createdAt)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
              <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3 font-medium">#</th>
                      <th className="p-3 font-medium">{t('course')}</th>
                      <th className="p-3 font-medium">{t('amount')}</th>
                      <th className="p-3 font-medium">{t('method')}</th>
                      <th className="p-3 font-medium">{t('date')}</th>
                      <th className="p-3 font-medium">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {list.items.map((o) => (
                      <tr key={o.orderId}>
                        <td className="p-3 font-mono text-xs">{o.number}</td>
                        <td className="p-3">
                          {o.enrolled ? (
                            <Link
                              href={cabinetRoutes.course(o.courseId)}
                              className="hover:underline"
                            >
                              {o.courseTitle}
                            </Link>
                          ) : (
                            o.courseTitle
                          )}
                        </td>
                        <td className="p-3">
                          <Amount o={o} />
                        </td>
                        <td className="p-3">{provider(o)}</td>
                        <td className="p-3">{formatDate(o.paidAt ?? o.createdAt, true)}</td>
                        <td className="p-3">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager
                page={list.page}
                pageSize={list.pageSize}
                total={list.total}
                onPage={setPage}
              />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
