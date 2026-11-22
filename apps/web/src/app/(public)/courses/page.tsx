import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CatalogFilters } from '@/features/catalog/catalog-filters';
import { parseCatalogParams, toApiParams } from '@/features/catalog/catalog-params';
import { CourseGrid } from '@/features/catalog/course-card';
import { Container, EmptyState, ErrorState, PageHeader } from '@/features/catalog/page-section';
import { CatalogPagination } from '@/features/catalog/pagination';
import { CATALOG_PAGE_SIZE, getCourses, getDirections, orNull } from '@/lib/api/public';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog');
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: { canonical: '/courses' },
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('catalog');
  const state = parseCatalogParams(await searchParams);
  const [courses, directions] = await Promise.all([
    orNull(getCourses(toApiParams(state, CATALOG_PAGE_SIZE))),
    orNull(getDirections()),
  ]);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Container className="space-y-6 py-8">
        <CatalogFilters state={state} directions={directions ?? []} />
        {!courses ? (
          <ErrorState>{t('loadError')}</ErrorState>
        ) : (
          <>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {t('results', { total: courses.total })}
            </p>
            {courses.items.length === 0 ? (
              <EmptyState>{t('empty')}</EmptyState>
            ) : (
              <CourseGrid courses={courses.items} />
            )}
            <CatalogPagination
              state={state}
              total={courses.total}
              pageSize={courses.pageSize || CATALOG_PAGE_SIZE}
            />
          </>
        )}
      </Container>
    </>
  );
}
