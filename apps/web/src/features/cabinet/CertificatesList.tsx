'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, Download, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { certificatePdfPath, learningApi } from '@/lib/api/learning';
import type { StudentCertificateItem } from '@/lib/api/learning-types';
import { studentDownload } from '@/lib/api/student-fetch';
import { qk } from './routes';
import { EmptyState, formatDate, PageHeader, QueryBoundary, useErrorMessage } from './ui';

export function CertificatesList() {
  const t = useTranslations('certificates');
  const query = useQuery({
    queryKey: qk.certificates,
    queryFn: () => learningApi.certificates({ pageSize: 100 }),
    // PDFs are rendered by a background job: poll while any is still pending.
    refetchInterval: (q) => (q.state.data?.items.some((c) => !c.pdfReady) ? 10_000 : false),
  });

  return (
    <div>
      <PageHeader title={t('title')} />
      <QueryBoundary query={query}>
        {(list) =>
          list.items.length === 0 ? (
            <EmptyState>{t('empty')}</EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {list.items.map((c) => (
                <CertificateCard key={c.id} cert={c} />
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function CertificateCard({ cert: c }: { cert: StudentCertificateItem }) {
  const t = useTranslations('certificates');
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await studentDownload(certificatePdfPath(c.id), `sertifikat-${c.publicId}.pdf`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // verifyUrl comes from the API (absolute); fall back to the local public verify page.
  const verifyHref =
    /^https?:\/\//.test(c.verifyUrl) || c.verifyUrl.startsWith('/')
      ? c.verifyUrl
      : `/verify/${c.publicId}`;

  return (
    <li
      className="bg-card flex flex-col gap-3 rounded-xl border p-5"
      data-testid={`certificate-${c.id}`}
    >
      <div className="flex items-start gap-3">
        <Award className="text-primary size-8 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold">{c.courseTitle}</h2>
          <p className="text-muted-foreground text-sm">{c.fullName}</p>
        </div>
      </div>
      <dl className="text-muted-foreground space-y-0.5 text-sm">
        <dd>{t('issuedAt', { date: formatDate(c.issuedAt) })}</dd>
        <dd className="font-mono text-xs">{t('id', { id: c.publicId })}</dd>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button onClick={download} disabled={!c.pdfReady || busy} size="sm">
          <Download aria-hidden="true" />
          {!c.pdfReady ? t('pending') : busy ? t('downloading') : t('download')}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={verifyHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {t('verify')}
          </a>
        </Button>
      </div>
    </li>
  );
}
