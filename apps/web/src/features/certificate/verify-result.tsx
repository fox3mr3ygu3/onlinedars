import type { CertificateVerify } from '@onlinedars/shared';
import { BadgeCheck, SearchX, ShieldAlert, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

export type VerifyLoad =
  { kind: 'ok'; certificate: CertificateVerify } | { kind: 'notFound' } | { kind: 'error' };

export function VerifyResult({ result }: { result: VerifyLoad }) {
  const t = useTranslations('verify');
  const format = useFormatter();

  if (result.kind === 'notFound') {
    return (
      <div className="flex gap-4 rounded-xl border p-5" data-testid="verify-not-found">
        <SearchX className="text-muted-foreground size-8 shrink-0" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">{t('notFound')}</h2>
          <p className="text-muted-foreground text-sm">{t('notFoundText')}</p>
        </div>
      </div>
    );
  }
  if (result.kind === 'error') {
    return (
      <div role="alert" className="flex gap-4 rounded-xl border p-5">
        <ShieldAlert className="text-destructive size-8 shrink-0" aria-hidden />
        <p className="text-sm">{t('loadError')}</p>
      </div>
    );
  }

  const c = result.certificate;
  const issued = new Date(c.issuedAt);
  return (
    <div
      className={
        c.isValid
          ? 'rounded-xl border border-emerald-600/30 bg-emerald-50 p-5 dark:bg-emerald-950/30'
          : 'border-destructive/30 bg-destructive/5 rounded-xl border p-5'
      }
      data-testid={c.isValid ? 'verify-valid' : 'verify-invalid'}
    >
      <div className="mb-4 flex items-center gap-3">
        {c.isValid ? (
          <BadgeCheck className="size-8 text-emerald-600" aria-hidden />
        ) : (
          <XCircle className="text-destructive size-8" aria-hidden />
        )}
        <div>
          <h2 className="text-lg font-semibold">{c.isValid ? t('valid') : t('invalid')}</h2>
          {!c.isValid && <p className="text-muted-foreground text-sm">{t('invalidText')}</p>}
        </div>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t('holder')}</dt>
          <dd className="font-medium">{c.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('course')}</dt>
          <dd className="font-medium">{c.courseTitle}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('issuedAt')}</dt>
          <dd className="font-medium">
            {Number.isNaN(issued.getTime())
              ? c.issuedAt
              : format.dateTime(issued, { year: 'numeric', month: 'long', day: 'numeric' })}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('certificateId')}</dt>
          <dd className="break-all font-mono font-medium">{c.certificateId}</dd>
        </div>
      </dl>
    </div>
  );
}
