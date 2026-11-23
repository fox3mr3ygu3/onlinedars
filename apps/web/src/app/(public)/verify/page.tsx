import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Container, PageHeader } from '@/features/catalog/page-section';
import { VerifyForm } from '@/features/certificate/verify-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('verify');
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: { canonical: '/verify' },
  };
}

/** `/verify?code=X` (the form without JS) redirects to `/verify/X`. */
export default async function VerifyIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 64);
  if (code) redirect(`/verify/${encodeURIComponent(code)}`);

  const t = await getTranslations('verify');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Container className="max-w-2xl py-8">
        <VerifyForm />
      </Container>
    </>
  );
}
