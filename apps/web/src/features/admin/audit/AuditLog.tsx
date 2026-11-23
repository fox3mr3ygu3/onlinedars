'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { listAuditLogs } from '@/lib/api/admin/management';
import { Pagination } from '../common/controls';
import { dateInputToIso, formatDateTime } from '../common/format';
import { EmptyState, ErrorState, LoadingState, PageHeader, TableWrap } from '../common/ui';

const PAGE_SIZE = 30;

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="bg-muted max-h-48 overflow-auto rounded p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function AuditLog() {
  const t = useTranslations('admin');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const query = {
    action,
    entityType,
    from: dateInputToIso(from),
    to: dateInputToIso(to, true),
    page,
    pageSize: PAGE_SIZE,
  };
  const q = useQuery({
    queryKey: ['admin', 'audit', query],
    queryFn: () => listAuditLogs(query),
    placeholderData: keepPreviousData,
  });
  const reset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader title={t('audit.title')} />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label={t('audit.actionFilter')}
          placeholder={t('audit.actionFilter')}
          value={action}
          onChange={(e) => reset(setAction)(e.target.value)}
        />
        <Input
          aria-label={t('audit.entityFilter')}
          placeholder={t('audit.entityFilter')}
          value={entityType}
          onChange={(e) => reset(setEntityType)(e.target.value)}
        />
        <Input
          type="date"
          aria-label={t('common.dateFrom')}
          value={from}
          onChange={(e) => reset(setFrom)(e.target.value)}
        />
        <Input
          type="date"
          aria-label={t('common.dateTo')}
          value={to}
          onChange={(e) => reset(setTo)(e.target.value)}
        />
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
                <th>{t('audit.fields.createdAt')}</th>
                <th>{t('audit.fields.actor')}</th>
                <th>{t('audit.fields.action')}</th>
                <th>{t('audit.fields.entity')}</th>
                <th>{t('audit.fields.reason')}</th>
                <th>{t('common.details')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td>
                    {log.actor?.fullName ?? t('audit.system')}
                    {log.ip && <div className="text-muted-foreground text-xs">{log.ip}</div>}
                  </td>
                  <td className="font-mono text-xs">{log.action}</td>
                  <td className="text-xs">
                    <div>{log.entityType}</div>
                    <div className="text-muted-foreground font-mono">{log.entityId}</div>
                  </td>
                  <td className="max-w-56 text-sm">{log.reason ?? '—'}</td>
                  <td className="min-w-56">
                    <details>
                      <summary className="text-primary cursor-pointer text-sm">
                        {t('common.details')}
                      </summary>
                      <div className="mt-2 grid gap-2">
                        <div>
                          <p className="text-muted-foreground text-xs">{t('audit.before')}</p>
                          <Json value={log.before} />
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">{t('audit.after')}</p>
                          <Json value={log.after} />
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
