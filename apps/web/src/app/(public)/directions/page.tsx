import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DirectionList } from '@/features/catalog/direction-list';
import { Container, EmptyState, ErrorState, PageHeader } from '@/features/catalog/page-section';
import { getDirections, orNull } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('teachers');
  return {
    title: t('directionsTitle'),
    description: t('directionsMetaDescription'),
    alternates: { canonical: '/directions' },
  };
}

export default async function DirectionsPage() {
  const t = await getTranslations('teachers');
  const directions = await orNull(getDirections());
  return (
    <>
      <PageHeader title={t('directionsTitle')} subtitle={t('directionsSubtitle')} />
      <Container className="py-8">
        {!directions ? (
          <ErrorState>{t('loadError')}</ErrorState>
        ) : directions.length === 0 ? (
          <EmptyState>{t('directionsEmpty')}</EmptyState>
        ) : (
          <DirectionList directions={directions} />
        )}
      </Container>
    </>
  );
}
