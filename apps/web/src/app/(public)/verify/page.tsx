import type { Metadata } from 'next';
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

export default async function VerifyIndexPage() {
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
