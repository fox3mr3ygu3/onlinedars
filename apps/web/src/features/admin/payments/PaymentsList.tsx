'use client';

import { PaymentProvider, PaymentStatus } from '@onlinedars/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listCourses } from '@/lib/api/admin/content';
import {
  changePaymentStatus,
  listPayments,
  type PaymentListQuery,
} from '@/lib/api/admin/management';
import type { AdminPayment } from '@/lib/api/admin/types';
import { Pagination } from '../common/controls';
import { dateInputToIso, formatDateTime, formatMoney } from '../common/format';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NativeSelect,
  PageHeader,
  TableWrap,
} from '../common/ui';
import { useAdminMe } from '../useAdminMe';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { PaymentStatusDialog } from './PaymentStatusDialog';

const PAGE_SIZE = 20;

interface Filters {
  status: PaymentStatus | '';
  provider: PaymentProvider | '';
  courseId: string;
  search: string;
  from: string;
  to: string;
}
const emptyFilters: Filters = {
  status: '',
  provider: '',
  courseId: '',
  search: '',
  from: '',
  to: '',
};

export function PaymentsList() {
  const t = useTranslations('admin');
  const me = useAdminMe();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminPayment | null>(null);
  const query: PaymentListQuery = {
    status: filters.status,
    provider: filters.provider,
    courseId: filters.courseId,
    search: filters.search,
    from: dateInputToIso(filters.from),
    to: dateInputToIso(filters.to, true),
    page,
    pageSize: PAGE_SIZE,
  };
  const q = useQuery({
    queryKey: ['admin', 'payments', query],
    queryFn: () => listPayments(query),
    placeholderData: keepPreviousData,
  });
  const courses = useQuery({
    queryKey: ['admin', 'courses', { all: true }],
    queryFn: () => listCourses({ pageSize: 100 }),
  });
  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const isAdmin = me.data?.role === 'ADMIN';

  return (
    <>
      <PageHeader title={t('payments.title')} />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Input
          type="search"
          aria-label={t('common.search')}
          placeholder={t('payments.searchPlaceholder')}
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          className="xl:col-span-2"
        />
        <NativeSelect
          aria-label={t('payments.fields.status')}
          value={filters.status}
          onChange={(e) => set({ status: e.target.value as PaymentStatus | '' })}
        >
          <option value="">
            {t('payments.fields.status')}: {t('common.all')}
          </option>
          {Object.values(PaymentStatus).map((s) => (
            <option key={s} value={s}>
              {t(`payments.status.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t('payments.fields.provider')}
          value={filters.provider}
          onChange={(e) => set({ provider: e.target.value as PaymentProvider | '' })}
        >
          <option value="">
            {t('payments.fields.provider')}: {t('common.all')}
          </option>
          {Object.values(PaymentProvider).map((p) => (
            <option key={p} value={p}>
              {t(`payments.providers.${p}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t('payments.fields.course')}
          value={filters.courseId}
          onChange={(e) => set({ courseId: e.target.value })}
          className="xl:col-span-2"
        >
          <option value="">{t('payments.allCourses')}</option>
          {(courses.data?.items ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </NativeSelect>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t('common.dateFrom')}</span>
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-muted-foreground">{t('common.dateTo')}</span>
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
        <div className="flex items-end">
          <Button variant="ghost" onClick={() => set(emptyFilters)}>
            {t('common.reset')}
          </Button>
        </div>
      </div>
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>{t('payments.fields.orderId')}</th>
                <th>{t('payments.fields.student')}</th>
                <th>{t('payments.fields.course')}</th>
                <th className="text-right">{t('payments.fields.amount')}</th>
                <th>{t('payments.fields.provider')}</th>
                <th>{t('payments.fields.createdAt')}</th>
                <th>{t('payments.fields.status')}</th>
                {isAdmin && <th className="text-right">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((p) => (
                <tr key={p.orderId} data-testid="payment-row">
                  <td className="font-mono text-xs">{p.number}</td>
                  <td>
                    <div>{p.student.fullName}</div>
                    <div className="text-muted-foreground text-xs">
                      {p.student.phone ?? p.student.email}
                    </div>
                  </td>
                  <td>{p.courseTitle}</td>
                  <td className="text-right tabular-nums">
                    {formatMoney(p.amount, t('common.som'))}
                  </td>
                  <td>{p.provider ? t(`payments.providers.${p.provider}`) : '—'}</td>
                  <td className="whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                  <td>
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  {isAdmin && (
                    <td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(p)}>
                        {t('payments.changeStatus')}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />
        </>
      )}
      <PaymentStatusDialog
        payment={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onSubmit={async (id, body) => {
          await changePaymentStatus(id, body);
          await qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
          toast.success(t('payments.dialog.success'));
        }}
      />
    </>
  );
}
