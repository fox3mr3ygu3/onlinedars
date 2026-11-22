'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, ClipboardCheck, GraduationCap, Plus, TrendingUp, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getDashboard } from '@/lib/api/admin/management';
import { formatDateTime, formatMoney } from '../common/format';
import { ErrorState, LoadingState, PageHeader, Section, TableWrap } from '../common/ui';
import { PaymentStatusBadge } from '../payments/PaymentStatusBadge';
import { useAdminMe } from '../useAdminMe';

function Stat({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="bg-card flex items-center gap-4 rounded-lg border p-4">
      <div className="bg-primary/10 text-primary rounded-md p-2.5" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-sm">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const t = useTranslations('admin');
  const me = useAdminMe();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: getDashboard });
  const isAdmin = me.data?.role === 'ADMIN';

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        actions={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus aria-hidden />
              {t('dashboard.newCourse')}
            </Link>
          </Button>
        }
      />
      {q.isPending ? (
        <LoadingState />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label={t('dashboard.students')} value={q.data.students} icon={<Users className="size-5" />} />
            <Stat
              label={t('dashboard.activeCourses')}
              value={q.data.activeCourses}
              icon={<BookOpen className="size-5" />}
            />
            <Stat
              label={t('dashboard.completedLessons')}
              value={q.data.completedLessons}
              icon={<GraduationCap className="size-5" />}
            />
            <Stat
              label={t('dashboard.examsTaken')}
              value={q.data.examsTaken}
              icon={<ClipboardCheck className="size-5" />}
            />
            <Stat
              label={t('dashboard.passRate')}
              value={`${q.data.examsTaken ? Math.round((q.data.examsPassed / q.data.examsTaken) * 100) : 0}%`}
              icon={<TrendingUp className="size-5" />}
            />
            {q.data.certificatesIssued !== undefined && (
              <Stat
                label={t('dashboard.certificatesIssued')}
                value={q.data.certificatesIssued}
                icon={<Award className="size-5" />}
              />
            )}
            {isAdmin && q.data.revenue !== undefined && (
              <Stat
                label={t('dashboard.revenue')}
                value={formatMoney(q.data.revenue, t('common.som'))}
                icon={<Wallet className="size-5" />}
              />
            )}
          </div>
          {isAdmin && q.data.recentPayments && q.data.recentPayments.length > 0 && (
            <Section title={t('dashboard.recentPayments')}>
              <TableWrap>
                <thead>
                  <tr>
                    <th>{t('payments.fields.student')}</th>
                    <th>{t('payments.fields.course')}</th>
                    <th>{t('payments.fields.amount')}</th>
                    <th>{t('payments.fields.createdAt')}</th>
                    <th>{t('payments.fields.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.student.fullName}</td>
                      <td>{p.course.title}</td>
                      <td className="tabular-nums">{formatMoney(p.amount, t('common.som'))}</td>
                      <td>{formatDateTime(p.createdAt)}</td>
                      <td>
                        <PaymentStatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Section>
          )}
        </div>
      )}
    </>
  );
}
