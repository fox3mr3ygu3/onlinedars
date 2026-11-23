'use client';

import { ErrorCode } from '@onlinedars/shared';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const KNOWN = new Set<string>(Object.values(ErrorCode));

/** i18n key `errors.<CODE>` for any thrown value. */
export function errorKey(e: unknown): string {
  if (e instanceof ApiError && KNOWN.has(e.code)) return `errors.${e.code}`;
  return `errors.${ErrorCode.INTERNAL_ERROR}`;
}

export function useErrorMessage() {
  const t = useTranslations();
  return (e: unknown) => t(errorKey(e) as 'errors.INTERNAL_ERROR');
}

export function Loading({ className }: { className?: string }) {
  const t = useTranslations('cabinet.state');
  return (
    <div
      role="status"
      className={cn('text-muted-foreground flex items-center gap-2 py-10', className)}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{t('loading')}</span>
    </div>
  );
}

/** Error box; 401 shows a login link (the auth layer usually redirects before this). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations('cabinet.state');
  const message = useErrorMessage();
  const unauthorized = error instanceof ApiError && error.status === 401;
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 flex flex-col items-start gap-3 rounded-lg border p-4"
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertCircle className="text-destructive size-4" aria-hidden="true" />
        {unauthorized ? t('loginRequired') : message(error)}
      </p>
      {unauthorized ? (
        <Button asChild size="sm">
          <Link href="/login?next=/cabinet">{t('login')}</Link>
        </Button>
      ) : onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('retry')}
        </Button>
      ) : null}
    </div>
  );
}

interface QueryLike<T> {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
}

/** Renders loading / error / data for a TanStack query. */
export function QueryBoundary<T>({
  query,
  children,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.error || query.data === undefined)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}

export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label}
      className={cn('bg-secondary h-2 w-full overflow-hidden rounded-full', className)}
    >
      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${v}%` }} />
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
      {children}
    </div>
  );
}

/** Formats an ISO date for display in Tashkent time. */
export function formatDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  // Asia/Tashkent is UTC+5 without DST — deterministic on server and client.
  const t = new Date(d.getTime() + 5 * 3600_000);
  const date = `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}.${t.getUTCFullYear()}`;
  return withTime ? `${date} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` : date;
}
