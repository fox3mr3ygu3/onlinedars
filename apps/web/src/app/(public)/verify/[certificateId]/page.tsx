import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { Container, PageHeader } from '@/features/catalog/page-section';
import { VerifyForm } from '@/features/certificate/verify-form';
import { type VerifyLoad, VerifyResult } from '@/features/certificate/verify-result';
import { isApiError } from '@/lib/api/client';
import { verifyCertificate } from '@/lib/api/public';

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

type Props = { params: Promise<{ certificateId: string }> };

const load = cache(async (code: string): Promise<VerifyLoad> => {
  try {
    return { kind: 'ok', certificate: await verifyCertificate(code) };
  } catch (e) {
    if (isApiError(e) && e.status === 404) return { kind: 'notFound' };
    return { kind: 'error' };
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations('verify');
  const { certificateId } = await params;
  // Certificate pages contain personal names: keep them out of search engines.
  return {
    title: `${t('title')}: ${safeDecode(certificateId)}`,
    robots: { index: false, follow: false },
  };
}

export default async function VerifyPage({ params }: Props) {
  const t = await getTranslations('verify');
  const code = safeDecode((await params).certificateId).trim();
  const result = await load(code);
  return (
    <>
      <PageHeader title={t('title')} />
      <Container className="max-w-2xl space-y-8 py-8">
        <VerifyResult result={result} />
        <div>
          <h2 className="mb-3 text-sm font-medium">{t('checkAnother')}</h2>
          <VerifyForm />
        </div>
      </Container>
    </>
  );
}
